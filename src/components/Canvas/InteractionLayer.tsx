import React, { useEffect, useState, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import Konva from 'konva';
import { v4 as uuidv4 } from 'uuid';
import { Line, Circle, Rect } from 'react-konva';
import { useProjectStore } from '../../store/useProjectStore';
import type { ProjectState } from '../../store/useProjectStore';
import type { Wall } from '../../types';
import { applyOrthogonal, getSnapPoint, dist } from '../../utils/geometry';
import { getOrthogonalPath, calculateLength } from '../../utils/routing';
import type { Point } from '../../utils/geometry';

interface InteractionLayerProps {
    stage: Konva.Stage | null;
    onOpenMenu?: (x: number, y: number, options: { label?: string; action?: () => void; type?: 'separator' }[]) => void;
    onOpenScaleModal?: (pixelDistance: number) => void;
}

const getWallParams = (preset: string, standard: number, thick: number, wide: number) => {
    switch (preset) {
        case 'thick': return { thickness: thick, material: 'drywall' as const };
        case 'wide': return { thickness: wide, material: 'concrete' as const };
        default: return { thickness: standard, material: 'drywall' as const };
    }
};

// Helper: Improved Point in Polygon / Near Segment check
const isPointNearWall = (p: Point, w: Wall, tolerance: number) => {
    // Simple distance to segment check
    const x1 = w.points[0], y1 = w.points[1], x2 = w.points[2], y2 = w.points[3];
    const A = p.x - x1;
    const B = p.y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const len_sq = C * C + D * D;
    let param = -1;
    if (len_sq !== 0) param = dot / len_sq;

    let xx, yy;

    if (param < 0) {
        xx = x1; yy = y1;
    } else if (param > 1) {
        xx = x2; yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }

    const dx = p.x - xx;
    const dy = p.y - yy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Check if within thickness or Hit Tolerance
    // Effective radius is half-thickness OR tolerance, whichever is larger.
    const effectiveRadius = Math.max(w.thickness / 2, tolerance);

    return dist <= effectiveRadius;
};

const isPointNearLine = (p: Point, x1: number, y1: number, x2: number, y2: number, tolerance: number) => {
    const A = p.x - x1;
    const B = p.y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const len_sq = C * C + D * D;
    let param = -1;
    if (len_sq !== 0) param = dot / len_sq;

    let xx, yy;

    if (param < 0) {
        xx = x1; yy = y1;
    } else if (param > 1) {
        xx = x2; yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }

    const dx = p.x - xx;
    const dy = p.y - yy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    return dist <= tolerance;
};

// Helper: Point near Cable (poly-line) check
// Returns { index: number, type: 'vertex' | 'segment', point: Point } or null
const isPointNearCable = (p: Point, points: Point[], tolerance: number) => {
    // Check vertices first
    for (let i = 0; i < points.length; i++) {
        if (Math.hypot(p.x - points[i].x, p.y - points[i].y) < tolerance) {
            return { index: i, type: 'vertex' as const, point: points[i] };
        }
    }
    // Check segments
    for (let i = 0; i < points.length - 1; i++) {
        if (isPointNearLine(p, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y, tolerance)) {
            return { index: i, type: 'segment' as const, point: p }; // Index i represents segment i -> i+1
        }
    }
    return null;
};

// Theme Colors Definition
const THEME_COLORS = {
    dark: {
        grid: '#333',
        gridMajor: '#444',
        wallFill: 'black',
        wallStroke: 'white',
        wallSelected: '#00aaff',
        anchorFill: '#00aaff',
        anchorStroke: 'white',
        text: 'white',
        dimLine: '#ffff00',
        dimText: '#ffff00',
        preview: '#00aaff'
    },
    light: {
        grid: '#9ca3af', // gray-400 (was gray-300)
        gridMajor: '#6b7280', // gray-500 (was gray-400)
        wallFill: '#374151', // gray-700
        wallStroke: 'black',
        wallSelected: '#2563eb', // blue-600
        anchorFill: '#2563eb', // blue-600
        anchorStroke: 'white',
        text: 'black',
        dimLine: '#000000', // Black dims for visibility
        dimText: '#000000',
        preview: '#2563eb'
    }
};

export const InteractionLayer: React.FC<InteractionLayerProps> = ({ stage, onOpenMenu, onOpenScaleModal }) => {
    const { activeTool, addWall, addWalls, addAnchor, addHub, activeHubCapacity, setTool, walls, anchors, hubs, cables, addCable, setSelection, wallPreset, standardWallThickness, thickWallThickness, wideWallThickness, setAnchorMode, removeWall, removeAnchor, updateAnchors, removeDimension, dimensions, anchorRadius, theme, setExportRegion, exportRegion, updateCable, wallsLocked, scaleRatio } = useProjectStore(
        useShallow((state: ProjectState) => ({
            activeTool: state.activeTool,
            addWall: state.addWall,
            addWalls: state.addWalls,
            addAnchor: state.addAnchor,
            addHub: state.addHub,
            activeHubCapacity: state.activeHubCapacity,
            setTool: state.setTool,
            walls: state.walls,
            anchors: state.anchors,
            hubs: state.hubs,
            cables: state.cables,
            addCable: state.addCable,
            setSelection: state.setSelection,
            wallPreset: state.wallPreset,
            standardWallThickness: state.standardWallThickness,
            thickWallThickness: state.thickWallThickness,
            wideWallThickness: state.wideWallThickness,
            setAnchorMode: state.setAnchorMode,
            removeWall: state.removeWall,
            removeAnchor: state.removeAnchor,
            updateAnchors: state.updateAnchors,
            removeDimension: state.removeDimension,
            dimensions: state.dimensions,
            anchorRadius: state.anchorRadius,
            theme: state.theme,
            setExportRegion: state.setExportRegion,
            exportRegion: state.exportRegion,
            updateCable: state.updateCable,
            wallsLocked: state.wallsLocked,
            scaleRatio: state.scaleRatio
        }))
    );

    const colors = THEME_COLORS[theme || 'dark'] || THEME_COLORS.dark;

    const [points, setPoints] = useState<Point[]>([]);
    const [chainStart, setChainStart] = useState<Point | null>(null);
    const [currentMousePos, setCurrentMousePos] = useState<Point | null>(null);
    const [isShiftDown, setIsShiftDown] = useState(false);
    const [, setTick] = useState(0); // Tick to force re-render on zoom

    // Rectangle Wall State
    const [rectStart, setRectStart] = useState<Point | null>(null);
    const [rectEdgeStart, setRectEdgeStart] = useState<Point | null>(null);

    // Cable Drawing
    const isDrawingCable = useRef(false);
    const cableStartId = useRef<string | null>(null);
    const [tempCablePath, setTempCablePath] = useState<{ start: Point; end: Point } | null>(null);
    const [rectEdgeBaseEnd, setRectEdgeBaseEnd] = useState<Point | null>(null);

    // Selection State
    const [selectionStart, setSelectionStart] = useState<Point | null>(null);
    const [selectionRect, setSelectionRect] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
    const [draggingDoorId, setDraggingDoorId] = useState<string | null>(null);

    // Panning State
    const [isPanning, setIsPanning] = useState(false);
    const lastPanPos = useRef<Point | null>(null);
    const panStartTime = useRef<number>(0);
    const lastDragPos = useRef<Point | null>(null);
    const isMouseDown = useRef(false);
    const hasDragged = useRef(false); // NEW: Track if actual drag occurred to prevent history spam

    // Cable Management State
    // Cable Management State
    const [dragCableHandle, setDragCableHandle] = useState<{ id: string, handle: { type: 'vertex' | 'segment', index: number }, startPoint: Point } | null>(null);


    const dragTextId = useRef<string | null>(null);
    // Anchor Drag State (Ref)
    const dragAnchorId = useRef<string | null>(null);
    // Wall Drag State (Ref)
    const dragWallId = useRef<string | null>(null);
    // Dimension Line Drag State (Ref)
    const dragDimLineId = useRef<string | null>(null);
    const dragHubId = useRef<string | null>(null);
    const draggedWallNodeMap = useRef<{ wallId: string, pointIndex: number }[]>([]);




    // ADDED: Export Event Listener
    useEffect(() => {
        const handleExportRequest = async (e: any) => {
            const { detail } = e;
            if (stage) {
                try {
                    const { exportCanvas } = await import('../../utils/export-utils');
                    await exportCanvas(stage, detail);
                } catch (err) {
                    alert('Error importing/running export: ' + err);
                }
            } else {
                alert('Export Failed: Stage is missing/null in InteractionLayer');
            }
        };

        window.addEventListener('request-export', handleExportRequest);
        return () => window.removeEventListener('request-export', handleExportRequest);
    }, [stage]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if User is typing in an Input or Textarea
            const activeTag = document.activeElement?.tagName.toLowerCase();
            if (activeTag === 'input' || activeTag === 'textarea') return;
            if (e.key === 'Shift') setIsShiftDown(true);

            // Shortcuts
            console.log("Key Debug:", e.code, e.key, "Shift:", e.shiftKey, "Ctrl:", e.ctrlKey); // DEBUG
            if (e.code === 'Escape') {
                setPoints([]);
                setChainStart(null);
                setRectStart(null);
                setRectEdgeStart(null);
                setRectEdgeBaseEnd(null);
                setTool('select'); // Escape goes to select
                setSelectionStart(null);
                setSelectionRect(null);
                setSelection([]);
                dragTextId.current = null;
                dragAnchorId.current = null;
            }

            // Delete / Backspace
            if ((e.code === 'Delete' || e.code === 'Backspace')) {
                const currentSelectedIds = useProjectStore.getState().selectedIds;
                const PLACEMENT_AREA_ID = 'placement_area_poly';

                if (currentSelectedIds.length > 0) {
                    currentSelectedIds.forEach(id => {
                        if (id === PLACEMENT_AREA_ID) {
                            useProjectStore.getState().setPlacementArea(null);
                        } else {
                            const anchor = useProjectStore.getState().anchors.find(a => a.id === id);
                            if (anchor && anchor.locked) return;

                            removeWall(id);
                            removeAnchor(id);
                            removeDimension(id);
                        }
                    });

                    // Cleanup selection
                    setSelection([]);
                }
            }

            // Tool Shortcuts
            if (activeTool !== 'scale') {
                const code = e.code;
                const state = useProjectStore.getState();
                const wallsLocked = state.wallsLocked;

                // Advanced Wall Tool Shortcut (Shift+R)
                if (code === 'KeyR' && e.shiftKey) {
                    if (!wallsLocked) {
                        if (activeTool === 'select' || activeTool.startsWith('wall') || activeTool.startsWith('anchor')) {
                            setTool('wall_rect_edge');
                            return;
                        }
                    }
                }

                // Undo / Redo (Ctrl+Z / Ctrl+Y)
                if ((e.ctrlKey || e.metaKey) && code === 'KeyZ') {
                    e.preventDefault();
                    if (e.shiftKey) {
                        useProjectStore.temporal.getState().redo();
                    } else {
                        // Custom Undo for Wall Tool Chain
                        if (activeTool === 'wall' && points.length > 0) {
                            const wallsBefore = state.walls;
                            const wallToUndo = wallsBefore.length > 0 ? wallsBefore[wallsBefore.length - 1] : null;

                            useProjectStore.temporal.getState().undo();

                            if (wallToUndo) {
                                setPoints([{ x: wallToUndo.points[0], y: wallToUndo.points[1] }]);
                                setChainStart({ x: wallToUndo.points[0], y: wallToUndo.points[1] });
                            } else {
                                setPoints([]);
                                setChainStart(null);
                            }
                        } else {
                            useProjectStore.temporal.getState().undo();
                        }
                    }
                    return;
                }
                if ((e.ctrlKey || e.metaKey) && (code === 'KeyY')) {
                    e.preventDefault();
                    useProjectStore.temporal.getState().redo();
                    return;
                }

                // Group / Ungroup Anchors
                if ((e.ctrlKey || e.metaKey) && code === 'KeyG') {
                    e.preventDefault();
                    if (e.shiftKey) {
                        // Ungroup
                        const selectedIds = state.selectedIds;
                        state.ungroupAnchors(selectedIds);
                    } else {
                        // Group
                        const selectedIds = state.selectedIds;
                        state.groupAnchors(selectedIds);
                    }
                    return;
                }

                // Delete / Backspace (Redundant check but kept for structure if needed or just remove?)
                // The block above already handled delete. 
                // But this block handles "Delete Active Import" too.
                // Let's merge logic.
                if (code === 'Delete' || code === 'Backspace') {
                    // Reuse logic?
                    // The top block handled selection deletion.
                    // This block handles activeImport deletion.
                    if (state.activeImportId) {
                        state.removeImportedObject(state.activeImportId);
                    }
                }

                if (code === 'KeyV') setTool('select');
                if (code === 'KeyW') {
                    if (e.shiftKey) {
                        e.preventDefault();
                        state.setWallsLocked(!wallsLocked);
                    } else if (!wallsLocked) {
                        setTool('wall');
                    }
                }
                if (code === 'KeyR' && !wallsLocked) {
                    if (activeTool === 'wall_rect') {
                        setTool('wall_rect_edge');
                    } else if (activeTool === 'wall_rect_edge') {
                        setTool('wall_rect');
                    } else {
                        setTool('wall_rect');
                    }
                }
                if (code === 'KeyD') setTool('dimension');
                if (code === 'KeyS') setTool('scale');

                if (code === 'KeyA') {
                    if (e.shiftKey) {
                        e.preventDefault();
                        setTool('anchor_auto');
                        setAnchorMode('auto');
                        state.setIsAutoPlacementOpen(true);
                    } else {
                        setTool('anchor');
                        setAnchorMode('manual');
                    }
                }
                if (code === 'KeyH') setTool('hub');
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Shift') setIsShiftDown(false);
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [setTool, setSelection, setAnchorMode, activeTool, points]); // Added points to deps



    // Interaction Handlers (Moved to Top Level)

    const getStagePoint = (): Point | null => {
        const pos = stage?.getPointerPosition();
        if (!pos) return null;
        const scale = (stage?.scaleX() || 1);
        return {
            x: (pos.x - (stage?.x() || 0)) / scale,
            y: (pos.y - (stage?.y() || 0)) / scale,
        };
    };

    const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
        const stagePos = stage?.getPointerPosition();
        if (!stagePos) return;
        const pos = getStagePoint();
        if (!pos) return;

        isMouseDown.current = true;
        hasDragged.current = false;

        // ALT + Left Click (Import Selection)
        if (e.evt.altKey && e.evt.button === 0) {
            const stagePos = getStagePoint();
            if (stagePos) {
                const state = useProjectStore.getState();
                // Simple Hit Test (Reverse order for Z-index)
                const hitObj = [...state.importedObjects].reverse().find(obj => {
                    if (!obj.visible || obj.locked) return false;
                    if (obj.type === 'image') {
                        const w = obj.width * obj.scale;
                        const h = obj.height * obj.scale;
                        // Simple box check (ignoring rotation for simplicity for now)
                        return pos.x >= obj.x && pos.x <= obj.x + w &&
                            pos.y >= obj.y && pos.y <= obj.y + h;
                    }
                    if (obj.type === 'dxf') {
                        // Hit test using calculated BBox
                        const w = (obj.width || 100) * obj.scale;
                        const h = (obj.height || 100) * obj.scale;

                        // Adjust for rotation (TODO: Better rotation hit)
                        // For now, simpler AABB approach on unrotated rect

                        // DXF origin is often effectively top-left of the bounding box if we normalize, 
                        // BUT standard DXF coordinates can be anywhere.
                        // However, ImportedObject x/y offsets the ENTIRE group.
                        // So we check if point is inside [x, x+w] and [y, y+h] assuming drawing starts at 0,0 relative to group.
                        // BUT wait, importDXF calculateExtents returns min/max. 
                        // DXFLayer renders Group at x,y. Inside group, lines are at their original coords (v.x, v.y).
                        // S we probably need to know offset?
                        // Actually, if we just want to select the "Group", we usually treat x,y as top-left.
                        // But importDXF keeps original coordinates.
                        // So the content is drawn at various places.

                        // If calculating extents, we found minX, minY.
                        // Usually we want to normalize so (0,0) is minX, minY. OR we store minX/minY in the object and use it here.

                        // Let's assume for this fix that users can just click "roughly" where it is.
                        // But strictly speaking, if lines are at 1000,1000, and obj.x=0, they appear at 1000,1000.
                        // Click at 1000,1000.
                        // obj.x = 0.
                        // We check pos.x >= 0 && pos.x <= 0 + width.
                        // If width is correct (max-min), then we are checking range [0, width].
                        // But content is at [minX, maxX].
                        // This means hit test fails if minX > 0.

                        // FIX: We need minX/minY in the ImportedObject to offset the hit test.
                        // But simpler: just accept the click if it hits the visual bounds.
                        // Since we don't have minX here easily (it was in data.extents but we didn't save it to root).

                        // Let's rely on data.extents if available?
                        const extents = (obj as any).data?.extents;
                        let originX = 0;
                        let originY = 0;
                        if (extents) {
                            originX = extents.min.x;
                            originY = extents.min.y;
                        }

                        // The Shape is drawn at (obj.x, obj.y) + internal coords.
                        // So a point (vx, vy) is at (obj.x + vx*scale, obj.y + vy*scale).
                        // We want to check if pos is within bounds.
                        // Bounds X: [obj.x + minX*scale, obj.x + maxX*scale]
                        // Bounds Y: [obj.y + minY*scale, obj.y + maxY*scale]

                        const minX = obj.x + (originX * obj.scale);
                        const minY = obj.y + (originY * obj.scale);
                        const maxX = minX + (w);
                        const maxY = minY + (h);

                        return pos.x >= minX && pos.x <= maxX &&
                            pos.y >= minY && pos.y <= maxY;
                    }
                    return false;
                });

                if (hitObj) {
                    state.setActiveImportId(hitObj.id);
                    // Prevent selection box
                    return;
                } else {
                    // specialized: If we didn't hit an image, but we have DXFs, maybe cycle them? 
                    // Or just deselect.
                    state.setActiveImportId(null);
                }
            }
        }


        // Hub Drag Check
        const scale = stage?.scaleX() || 1;
        const hubs = useProjectStore.getState().hubs;
        const hitHub = hubs.find(h =>
            Math.abs(pos.x - h.x) < 15 / scale &&
            Math.abs(pos.y - h.y) < 15 / scale
        );

        if (hitHub) {
            if (activeTool === 'select' || activeTool === 'hub') {
                dragHubId.current = hitHub.id;
                lastDragPos.current = pos;
                useProjectStore.temporal.getState().pause();

                // Auto-select if not selected
                const isSelected = useProjectStore.getState().selectedIds.includes(hitHub.id);
                if (!isSelected && !e.evt.shiftKey) {
                    setSelection([hitHub.id]);
                }
                return;
            }
        }

        // Wall Drag Check (Only if NOT hitting a hub/handle)
        if ((activeTool === 'select') && !wallsLocked) {
            const state = useProjectStore.getState();
            const tol = 10 / (stage?.scaleX() || 1);
            // Reuse helper
            const getHitWall = (pos: Point, walls: any[], tolerance: number) => {
                for (const w of walls) {
                    if (isPointNearWall(pos, w, tolerance)) return w;
                }
                return null;
            }

            // Check if hitting a wall
            const hitWall = getHitWall(pos, state.walls, tol);
            if (hitWall) {
                // Ignore if hitting Hub or Anchor (handled above/below) - Logic flow ensures Hub is checked first.
                // Anchor check is below, but usually handles (Circles) capture event if they are on top.
                // InteractionLayer logic order:
                // 1. Hubs
                // 2. Anchors (below)
                // 3. Walls (now here)

                // If we are here, we didn't hit a Hub.
                // If we hit a Wall, we should process it. 
                // BUT: Anchors might be on top.

                // If the click is actually on an Anchor, we should prefer the anchor.
                // The Anchor is a Konva Shape with name='anchor'. 
                // e.target.name() is reliable.

                if (e.target.name() !== 'anchor' && e.target.name() !== 'hub-bottom' && e.target.name() !== 'dimension-line' && e.target.name() !== 'dim-text-handle' && e.target.name() !== 'wall-handle') {
                    dragWallId.current = hitWall.id;
                    lastDragPos.current = pos;
                    useProjectStore.temporal.getState().pause();

                    const isSelected = state.selectedIds.includes(hitWall.id);
                    if (!e.evt.shiftKey) {
                        if (!isSelected) setSelection([hitWall.id]);
                    } else {
                        // Shift: Add to selection if not present?
                        if (!isSelected) setSelection([...state.selectedIds, hitWall.id]);
                    }

                    // We return here to Claim the event unless we want to allow other processing?
                    // Usually dragging consumes the event.
                    return;
                }
            }
        }

        // Anchor Drag Check
        if (e.target.name() === 'anchor') {
            const anchorId = e.target.id();
            // Select it if not selected (unless Shift is down, handled in Click)
            const isSelected = useProjectStore.getState().selectedIds.includes(anchorId);

            // --- logic for select or anchor tool only ---
            if (activeTool === 'select' || activeTool === 'anchor') {
                if (!e.evt.shiftKey) {
                    // Logic: If NOT selected, Select ONLY this one (and its group).
                    // If ALREADY selected, Keep the group selection (so we can drag the whole group).
                    if (!isSelected) {
                        const anchor = useProjectStore.getState().anchors.find(a => a.id === anchorId);
                        if (anchor && anchor.groupId) {
                            const groupIds = useProjectStore.getState().anchors
                                .filter(a => a.groupId === anchor.groupId)
                                .map(a => a.id);
                            setSelection(groupIds);
                        } else {
                            setSelection([anchorId]);
                        }
                    }
                } else {
                    // Logic: Toggle selection or Add to selection
                    if (!isSelected) {
                        const anchor = useProjectStore.getState().anchors.find(a => a.id === anchorId);
                        const current = useProjectStore.getState().selectedIds;
                        if (anchor && anchor.groupId) {
                            const groupIds = useProjectStore.getState().anchors
                                .filter(a => a.groupId === anchor.groupId)
                                .map(a => a.id);
                            setSelection([...new Set([...current, ...groupIds])]);
                        } else {
                            setSelection([...current, anchorId]);
                        }
                    }
                }

                if (!anchorId) return;
                const anchor = useProjectStore.getState().anchors.find(a => a.id === anchorId);

                if (anchor && !anchor.locked) {
                    dragAnchorId.current = anchorId;
                    lastDragPos.current = pos;
                    useProjectStore.temporal.getState().pause(); // Pause Undo History
                }
                return;
            }
            // If drawing tools active (wall, dimension, etc.), do NOT return. 
            // This allows the event to continue to the tool handlers below,
            // which will then call getSnapPoint and snap to this anchor.
        }

        // Text Drag Check
        // Allow dragging via Handle (always) OR Text (if already selected)
        const name = e.target.name();
        // Dimension Line Drag Check
        if (name === 'dimension-line') {
            const targetId = e.target.id();
            // If dragging line, we must ensure it is selected? Maybe auto-select?
            // For now, let's auto-select if needed or just allow drag.
            // Usually CAD allows drag even if not previously selected, or selects on down.
            const isSelected = useProjectStore.getState().selectedIds.includes(targetId);
            if (!isSelected && !e.evt.shiftKey) {
                setSelection([targetId]);
            }

            dragDimLineId.current = targetId;
            lastDragPos.current = pos;
            useProjectStore.temporal.getState().pause();
            return;
        }


        // Door Interaction Check (Drag Start)
        // Check if we hit a door group
        const doorGroup = e.target.name() === 'door' ? e.target : e.target.findAncestor('.door');
        if (doorGroup) {
            // Respect Wall Lock
            if (wallsLocked) return;

            const doorId = doorGroup.id();
            // Door Placement Logic Removed

            if (activeTool === 'select') {
                setDraggingDoorId(doorId);
                // Selection Logic
                if (!e.evt.shiftKey) {
                    if (!useProjectStore.getState().selectedIds.includes(doorId)) {
                        setSelection([doorId]);
                    }
                } else {
                    // Toggle selection... simplified for now
                }
                useProjectStore.temporal.getState().pause();
                return;
            }
        }

        if (name === 'dim-text-handle' || name === 'dim-text') {
            const targetId = e.target.id();
            // Handle ID is just 'id', Text ID is 'dim-text-id'
            const realId = name === 'dim-text-handle' ? targetId : targetId.replace('dim-text-', '');

            const isSelected = useProjectStore.getState().selectedIds.includes(realId);

            // If Handle (implies selected) OR (Text AND Selected), start drag
            if (name === 'dim-text-handle' || (name === 'dim-text' && isSelected)) {
                dragTextId.current = realId;
                useProjectStore.temporal.getState().pause();
                return; // Consume event (no selection box)
            }

            // If Text AND Not Selected, we let it fall through to Selection Logic below
        }



        // Helper for RMB detection
        const getHitWall = (pos: Point, walls: any[], tolerance: number) => {
            for (const w of walls) {
                if (isPointNearWall(pos, w, tolerance)) return w;
            }
            return null;
        }

        // ... (Inside Component) ...

        // RMB Handling (Context Menu & Pan)
        if (e.evt.button === 2) {
            // Check for Wall Context Menu
            const state = useProjectStore.getState();
            const hitWall = getHitWall(pos, state.walls, 10 / (stage?.scaleX() || 1));

            // If we clicked a wall AND walls are NOT locked
            if (hitWall && !wallsLocked) {
                const isSelected = state.selectedIds.includes(hitWall.id);
                const targetIds = isSelected ? state.selectedIds : [hitWall.id];

                if (!isSelected) {
                    setSelection([hitWall.id]); // Auto-select on RMB
                }

                // Define Menu Options
                const typeOptions = [
                    'Drywall', 'Concrete', 'Brick', 'Metal', 'Wood', 'Glass'
                ].map(type => ({
                    label: `Set Type: ${type}`,
                    action: () => {
                        targetIds.forEach(id => {
                            const w = state.walls.find(x => x.id === id);
                            // Clear specific attenuation so material default takes over
                            if (w) state.updateWall(id, { material: type.toLowerCase() as any, attenuation: undefined });
                        });
                    }
                }));

                if (onOpenMenu) {
                    onOpenMenu(e.evt.clientX, e.evt.clientY, [
                        { label: 'Start Wall Here', action: () => { setTool('wall'); setPoints([pos]); setCurrentMousePos(pos); setChainStart(pos); } },
                        { type: 'separator' },
                        ...typeOptions,
                        { type: 'separator' },
                        { label: 'Delete', action: () => targetIds.forEach(id => state.removeWall(id)) }
                    ]);
                    return; // Stop Panning
                }
            }

            // Hub Context Menu
            const hubs = state.hubs;
            const hitHub = hubs.find(h =>
                Math.abs(pos.x - h.x) < 15 / (stage?.scaleX() || 1) &&
                Math.abs(pos.y - h.y) < 15 / (stage?.scaleX() || 1)
            );
            if (hitHub) {
                if (onOpenMenu) {
                    onOpenMenu(e.evt.clientX, e.evt.clientY, [
                        { label: 'Delete Hub', action: () => state.removeHub(hitHub.id) },
                        { label: 'Properties...', action: () => alert(`Hub: ${hitHub.capacity} ports`) }
                    ]);
                    return;
                }
            }

            // If hitting anchor (Existing logic)
            if (e.target.name() === 'anchor') {
                return;
            }

            e.evt.preventDefault();
            setIsPanning(true);
            lastPanPos.current = { x: stagePos.x, y: stagePos.y };
            panStartTime.current = Date.now();
            return;
        }

        // Cable Edit Tool
        if (activeTool === 'cable_edit') {
            // NEW: Check for Device Hit (Start Cable Draw) BEFORE checking cable hit (optional, or after selection miss)
            const clickRadius = 20 / (stage?.scaleX() || 1);
            let hitDevice = false;

            // Check Anchors
            const hitAnchor = anchors.find(a => dist(pos, a) < clickRadius);
            if (hitAnchor) {
                isDrawingCable.current = true;
                cableStartId.current = hitAnchor.id;
                setTempCablePath({ start: { x: hitAnchor.x, y: hitAnchor.y }, end: pos });
                hitDevice = true;
            } else {
                // Check Hubs
                const hitHub = hubs.find(h => dist(pos, h) < clickRadius);
                if (hitHub) {
                    isDrawingCable.current = true;
                    cableStartId.current = hitHub.id;
                    setTempCablePath({ start: { x: hitHub.x, y: hitHub.y }, end: pos });
                    hitDevice = true;
                }
            }

            if (hitDevice) return;

            // Check for Cable Hit
            let hitCableId: string | null = null;
            let hitInfo: any = null;

            for (const cable of cables) {
                const hit = isPointNearCable(pos, cable.points, 10 / (stage?.scaleX() || 1));
                if (hit) {
                    hitCableId = cable.id;
                    hitInfo = hit;
                    break;
                }
            }

            if (hitCableId) {
                // Select Cable
                if (!e.evt.shiftKey) {
                    setSelection([hitCableId]);
                } else {
                    // Add to selection (not implemented fully for mixed types but ok)
                }

                // If hit segment, initiate segment drag?
                if (hitInfo.type === 'segment') {
                    setDragCableHandle({ id: hitCableId, handle: { type: 'segment', index: hitInfo.index }, startPoint: pos });
                    lastDragPos.current = pos;
                    useProjectStore.temporal.getState().pause();
                }
            }
            return;
        }

        // Deselect if clicking empty space in cable_edit mode
        setSelection([]);

        // Scale Tool
        if (activeTool === 'scale') {
            if (!points.length) {
                setPoints([pos]);
            } else {
                const start = points[0];
                const distPixels = Math.hypot(pos.x - start.x, pos.y - start.y);
                if (distPixels > 0 && onOpenScaleModal) {
                    onOpenScaleModal(distPixels);
                }
                setPoints([]);
                setTool('select'); // Scale tool DOES reset to select usually
            }
            // Dimension Tool
        } else if (activeTool === 'dimension') {
            // Simply set the first point. Logic for click vs drag will be in MouseUp.
            if (!points.length) {
                const state = useProjectStore.getState();
                const snap = (state.layers.walls || state.layers.anchors) ? getSnapPoint(pos, walls, anchors, 20 / (stage?.scaleX() || 1)) : null;
                setPoints([snap ? snap.point : pos]);
            }
            // Wall Tool
        } else if (activeTool === 'wall') {
            if (wallsLocked) return; // Prevent drawing if locked
            if (e.evt.button === 0) {
                let finalPos = pos;
                // Check if snapping allowed (hidden layer = no snap)
                const state = useProjectStore.getState();
                const snap = state.layers.walls ? getSnapPoint(pos, walls, anchors, 20 / (stage?.scaleX() || 1)) : null;

                if (snap) {
                    finalPos = snap.point;

                    // Auto-Split Logic
                    if (snap.type === 'edge' && snap.id) {
                        state.splitWall(snap.id, snap.point);
                    }
                }

                if (isShiftDown && points.length > 0) {
                    if (!snap) {
                        finalPos = applyOrthogonal(points[points.length - 1], pos);
                    }
                }

                if (points.length === 0) {
                    setPoints([finalPos]);
                    setChainStart(finalPos);
                } else {
                    const start = points[0];
                    const end = finalPos;
                    if (start.x !== end.x || start.y !== end.y) {
                        addWall({
                            points: [start.x, start.y, end.x, end.y],
                            ...getWallParams(wallPreset, standardWallThickness, thickWallThickness, wideWallThickness) as any
                        });
                    }
                    // Continue chain
                    setPoints([end]);
                }
            }

            // Rect Tool
        } else if (activeTool === 'wall_rect') {
            if (wallsLocked) return; // Prevent drawing if locked
            if (e.evt.button === 0) {
                let finalPos = pos;
                const state = useProjectStore.getState();
                const snap = state.layers.walls ? getSnapPoint(pos, walls, anchors, 20 / (stage?.scaleX() || 1)) : null;
                if (snap) {
                    finalPos = snap.point;
                    // Auto-Split Logic for Start Point
                    if (!rectStart && snap.type === 'edge' && snap.id) {
                        state.splitWall(snap.id, snap.point);
                    }
                }

                if (!rectStart) {
                    setRectStart(finalPos);
                    setCurrentMousePos(finalPos);
                    lastDragPos.current = finalPos; // Track for Drag
                } else {
                    const x1 = rectStart.x;
                    const y1 = rectStart.y;
                    const x2 = finalPos.x;
                    const y2 = finalPos.y;

                    if (Math.abs(x1 - x2) > 0.1 || Math.abs(y1 - y2) > 0.1) { // Changed AND to OR for validity check
                        // Auto-Split for End Point
                        if (snap && snap.type === 'edge' && snap.id) {
                            state.splitWall(snap.id, snap.point);
                        }

                        // Check Implicit Points (p3, p4) for Splitting
                        const p3 = { x: x2, y: y1 };
                        const p4 = { x: x1, y: y2 };

                        const snapP3 = state.layers.walls ? getSnapPoint(p3, walls, anchors, 20 / (stage?.scaleX() || 1)) : null;
                        if (snapP3 && snapP3.type === 'edge' && snapP3.id) state.splitWall(snapP3.id, snapP3.point);

                        const snapP4 = state.layers.walls ? getSnapPoint(p4, walls, anchors, 20 / (stage?.scaleX() || 1)) : null;
                        if (snapP4 && snapP4.type === 'edge' && snapP4.id) state.splitWall(snapP4.id, snapP4.point);

                        const params = getWallParams(wallPreset, standardWallThickness, thickWallThickness, wideWallThickness);

                        addWalls([
                            { points: [x1, y1, x2, y1], ...params as any },
                            { points: [x2, y1, x2, y2], ...params as any },
                            { points: [x2, y2, x1, y2], ...params as any },
                            { points: [x1, y2, x1, y1], ...params as any }
                        ]);
                    }
                    setRectStart(null);
                    setCurrentMousePos(null);
                }
            }

            // Wall Rect Edge Tool
        } else if (activeTool === 'wall_rect_edge') {
            if (wallsLocked) return; // Prevent drawing if locked
            if (e.evt.button === 0) {
                let finalPos = pos;
                const state = useProjectStore.getState();
                const snap = state.layers.walls ? getSnapPoint(pos, walls, anchors, 20 / (stage?.scaleX() || 1)) : null;
                if (snap) {
                    finalPos = snap.point;
                    // Auto-Split Logic for Start Point
                    if (!rectEdgeStart && snap.type === 'edge' && snap.id) {
                        state.splitWall(snap.id, snap.point);
                    }
                }

                if (!rectEdgeStart) {
                    // Phase 1: Start Point
                    setRectEdgeStart(finalPos);
                    setCurrentMousePos(finalPos);
                    lastDragPos.current = finalPos; // Track for Drag check
                } else if (!rectEdgeBaseEnd) {
                    // Phase 2: Base End Point
                    if (dist(rectEdgeStart, finalPos) > 0.001) {
                        if (snap && snap.type === 'edge' && snap.id) {
                            state.splitWall(snap.id, snap.point);
                        }
                        setRectEdgeBaseEnd(finalPos);
                    }
                } else {
                    // Phase 3: Finish (Height)
                    // Geometric calculation handled logic is conceptually:
                    // P1 (Start), P2 (BaseEnd), M (Mouse)
                    // Project M onto Normal of P1-P2
                    const p1 = rectEdgeStart;
                    if (!p1) return;
                    const p2 = rectEdgeBaseEnd;

                    const dx = p2.x - p1.x;
                    const dy = p2.y - p1.y;
                    const len = Math.hypot(dx, dy);

                    // Normal Vector (Normalized)
                    const nx = -dy / len;
                    const ny = dx / len;

                    // Vector from P1 to Mouse
                    const vmx = finalPos.x - p1.x;
                    const vmy = finalPos.y - p1.y;

                    // Dot product with Normal gives height distance (signed)
                    const h = vmx * nx + vmy * ny;

                    // Calculate P4 and P3
                    const p4x = p1.x + nx * h;
                    const p4y = p1.y + ny * h;
                    const p3x = p2.x + nx * h;
                    const p3y = p2.y + ny * h;

                    // Check P3 and P4 for Splitting
                    const p3 = { x: p3x, y: p3y };
                    const p4 = { x: p4x, y: p4y };

                    const snapP3 = state.layers.walls ? getSnapPoint(p3, walls, anchors, 20 / (stage?.scaleX() || 1)) : null;
                    if (snapP3 && snapP3.type === 'edge' && snapP3.id) state.splitWall(snapP3.id, snapP3.point);

                    const snapP4 = state.layers.walls ? getSnapPoint(p4, walls, anchors, 20 / (stage?.scaleX() || 1)) : null;
                    if (snapP4 && snapP4.type === 'edge' && snapP4.id) state.splitWall(snapP4.id, snapP4.point);

                    const params = getWallParams(wallPreset, standardWallThickness, thickWallThickness, wideWallThickness);

                    addWalls([
                        { points: [p1.x, p1.y, p2.x, p2.y], ...params as any }, // Base
                        { points: [p2.x, p2.y, p3x, p3y], ...params as any },   // Side A
                        { points: [p3x, p3y, p4x, p4y], ...params as any },     // Top
                        { points: [p4x, p4y, p1.x, p1.y], ...params as any }    // Side B
                    ]);

                    setRectEdgeStart(null);
                    setRectEdgeBaseEnd(null);
                    setCurrentMousePos(null);
                }
            }

            // Anchor Tool (Manual)
        } else if (activeTool === 'anchor') {
            if (e.evt.button === 0) {
                addAnchor({
                    x: pos.x,
                    y: pos.y,
                    power: 0,
                    range: anchorRadius || 5 // Use global radius or default
                });
            }

            // Hub Tool
        } else if (activeTool === 'hub') {
            if (e.evt.button === 0) {
                addHub({
                    id: uuidv4(),
                    x: pos.x,
                    y: pos.y,
                    capacity: activeHubCapacity || 12,
                    name: ''
                });
            }

            // Select Tool
        } else if (activeTool === 'select') {
            if (e.evt.button === 0) {
                setSelectionStart(pos);
            }

            // Placement Area Tool (Orange Zone)
        } else if (activeTool === 'placement_area') {
            if (e.evt.button === 0) {
                const state = useProjectStore.getState();
                const currentPoints = state.placementArea?.points || [];

                // If no points, start new
                if (currentPoints.length === 0) {
                    state.setPlacementArea({ points: [pos] });
                    return;
                }

                // Check for Closing (Click near start)
                const start = currentPoints[0];

                const d = dist(pos, start);
                // Tolerance 10px screen space
                const tolerance = 10 / (stage?.scaleX() || 1);

                if (currentPoints.length >= 3 && d < tolerance) {
                    // Close the loop (points are already correct for polygon, just stop adding)
                    // Optionally switch to Select tool to allow editing
                    setTool('select');
                    // Add alert or toast? "Area Defined"
                } else {
                    // Add point
                    state.setPlacementArea({ points: [...currentPoints, pos] });
                }
            }

        } else if (activeTool === 'export_area') { // NEW
            if (e.evt.button === 0) {
                if (!selectionStart) {
                    setSelectionStart(pos);
                    setSelectionRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
                } else {
                    const x = Math.min(selectionStart.x, pos.x);
                    const y = Math.min(selectionStart.y, pos.y);
                    const width = Math.abs(pos.x - selectionStart.x);
                    const height = Math.abs(pos.y - selectionStart.y);

                    if (width > 0 && height > 0) {
                        setExportRegion([{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }]);
                    }

                    setSelectionStart(null);
                    setSelectionRect(null);
                }
            }
        }
    };

    const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
        const pos = getStagePoint();
        if (!pos) return;

        // Cable Edit Hover & Drag Logic
        const currentActiveTool = useProjectStore.getState().activeTool;
        if (currentActiveTool === 'cable_edit') {
            // 0. Drawing Cable
            if (isDrawingCable.current && tempCablePath) {
                setTempCablePath({ start: tempCablePath.start, end: pos });
                return;
            }

            // 1. Dragging Segment
            if (isMouseDown.current && dragCableHandle && dragCableHandle.handle.type === 'segment') {
                const cable = cables.find(c => c.id === dragCableHandle.id);
                if (cable) {
                    const deltaX = pos.x - lastDragPos.current!.x;
                    const deltaY = pos.y - lastDragPos.current!.y;

                    // Constrain to orthogonal
                    const p1 = cable.points[dragCableHandle.handle.index];
                    const p2 = cable.points[dragCableHandle.handle.index + 1];
                    const isVertical = Math.abs(p1.x - p2.x) < 1;
                    const isHorizontal = Math.abs(p1.y - p2.y) < 1;

                    let moveX = deltaX;
                    let moveY = deltaY;

                    if (isVertical) moveY = 0;
                    if (isHorizontal) moveX = 0;

                    const newPoints = [...cable.points];
                    newPoints[dragCableHandle.handle.index] = { x: p1.x + moveX, y: p1.y + moveY };
                    newPoints[dragCableHandle.handle.index + 1] = { x: p2.x + moveX, y: p2.y + moveY };

                    updateCable(dragCableHandle.id, { points: newPoints });
                    lastDragPos.current = pos;
                    return;
                }
            }

            // 2. Hover Check (if not dragging)
            if (!isMouseDown.current) {
                let foundHover = false;
                for (const cable of cables) {
                    const hit = isPointNearCable(pos, cable.points, 10 / (stage?.scaleX() || 1));
                    if (hit) {
                        // setHoveredCable({ id: cable.id, handle: hit });
                        foundHover = true;
                        if (hit.type === 'segment') {
                            stage?.container().style.setProperty('cursor', 'move');
                        }
                        break;
                    }
                    if (!foundHover) {
                        // setHoveredCable(null);
                        stage?.container().style.setProperty('cursor', 'default');
                    }
                }
            }
        }

        if (e.target.name() === 'dim-text-handle' || e.target.name() === 'dim-text') {
            document.body.style.cursor = 'move';
            return;
        }

        // ALT + Left Drag (Move Active Import)
        if (e.evt.altKey && isMouseDown.current && useProjectStore.getState().activeImportId) {
            if (lastDragPos.current) {
                const dx = pos.x - lastDragPos.current.x;
                const dy = pos.y - lastDragPos.current.y;

                useProjectStore.getState().updateImportedObject(useProjectStore.getState().activeImportId!, {
                    x: (useProjectStore.getState().importedObjects.find(o => o.id === useProjectStore.getState().activeImportId)?.x || 0) + dx,
                    y: (useProjectStore.getState().importedObjects.find(o => o.id === useProjectStore.getState().activeImportId)?.y || 0) + dy
                });

                lastDragPos.current = pos;
                return;
            } else {
                lastDragPos.current = pos;
            }
        }

        // Panning
        if (isPanning && lastPanPos.current) {
            e.evt.preventDefault();
            const stagePos = stage?.getPointerPosition();
            if (stagePos) {
                const dx = stagePos.x - lastPanPos.current.x;
                const dy = stagePos.y - lastPanPos.current.y;
                stage?.position({ x: (stage?.x() || 0) + dx, y: (stage?.y() || 0) + dy });
                lastPanPos.current = { x: stagePos.x, y: stagePos.y };
                stage?.batchDraw();
            }
            return;
        }

        // Drag Dimension Text
        if (dragTextId.current && useProjectStore.getState().layers.dimensions) {
            const dim = useProjectStore.getState().dimensions.find(d => d.id === dragTextId.current);
            if (dim) {
                const [x1, y1, x2, y2] = dim.points;
                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;
                // Calculate relative offset
                const offsetX = pos.x - midX;
                const offsetY = pos.y - midY;

                useProjectStore.getState().updateDimension(dragTextId.current, { textOffset: { x: offsetX, y: offsetY } });
            }
            return;
        }

        // Drag Dimension Line (Perpendicular)
        if (dragDimLineId.current && lastDragPos.current && useProjectStore.getState().layers.dimensions) {
            const dim = useProjectStore.getState().dimensions.find(d => d.id === dragDimLineId.current);
            if (dim) {
                const dx = pos.x - lastDragPos.current.x;
                const dy = pos.y - lastDragPos.current.y;

                const [x1, y1, x2, y2] = dim.points;
                // Calculate Normal
                const dist = Math.hypot(x2 - x1, y2 - y1);
                if (dist > 0.001) {
                    const nx = -(y2 - y1) / dist;
                    const ny = (x2 - x1) / dist;

                    // Project delta onto normal
                    const dot = dx * nx + dy * ny;
                    const moveX = dot * nx;
                    const moveY = dot * ny;

                    useProjectStore.getState().updateDimension(dim.id, {
                        points: [x1 + moveX, y1 + moveY, x2 + moveX, y2 + moveY]
                    });
                }
            }
            lastDragPos.current = pos;
            return;
        }

        // Drag Anchor (Delta based)
        if (dragAnchorId.current && lastDragPos.current && useProjectStore.getState().layers.anchors) {
            const dx = pos.x - lastDragPos.current.x;
            const dy = pos.y - lastDragPos.current.y;

            if (Math.abs(dx) > 0 || Math.abs(dy) > 0) hasDragged.current = true;

            const state = useProjectStore.getState();

            const isDragSelected = state.selectedIds.includes(dragAnchorId.current);

            if (isDragSelected) {
                // Update all selected anchors in batch
                const updates = state.anchors
                    .filter(a => state.selectedIds.includes(a.id))
                    .map(a => ({
                        id: a.id,
                        updates: { x: a.x + dx, y: a.y + dy }
                    }));

                updateAnchors(updates);
            } else {
                // Just update dragged anchor if for some reason it's not in selection (though logic ensures it is)
                const a = state.anchors.find(x => x.id === dragAnchorId.current);
                if (a) state.updateAnchor(a.id, { x: a.x + dx, y: a.y + dy });
            }

            lastDragPos.current = pos;
            return;
        }

        // Drag Hub
        if (dragHubId.current && lastDragPos.current) {
            const dx = pos.x - lastDragPos.current.x;
            const dy = pos.y - lastDragPos.current.y;

            if (Math.abs(dx) > 0 || Math.abs(dy) > 0) hasDragged.current = true;

            const state = useProjectStore.getState();

            const isDragSelected = state.selectedIds.includes(dragHubId.current);
            if (isDragSelected) {
                state.hubs.forEach(h => {
                    if (state.selectedIds.includes(h.id)) {
                        state.updateHub(h.id, { x: h.x + dx, y: h.y + dy });
                    }
                });
            } else {
                const hub = state.hubs.find(h => h.id === dragHubId.current);
                if (hub) state.updateHub(hub.id, { x: hub.x + dx, y: hub.y + dy });
            }

            // Batch Update Cables
            const cablesToUpdate = state.cables.filter(c =>
                c.fromId === dragHubId.current ||
                (isDragSelected && state.selectedIds.includes(c.fromId))
            );

            if (cablesToUpdate.length > 0) {
                const walls = state.walls;
                const batchUpdates: { id: string, updates: Partial<typeof cablesToUpdate[0]> }[] = [];

                cablesToUpdate.forEach(c => {
                    // Recalculate start point (Hub)
                    // Note: The Hub in 'state' has already been updated above for this frame?
                    // React state updates are scheduled. calling state.updateHub triggers a set().
                    // useProjectStore.getState() might return the OLD state if set() is async/batched by Zustand/React?
                    // Zustand 'set' is usually synchronous but subscribers run ...
                    // Wait: We updated the store. If we read it back immediately, we should get the new values in vanilla Zustand.
                    // But to be safe and performant, we should calculate the NEW position ourselves.

                    // Actually, for this frame, we know the dx, dy.
                    // Let's rely on the fact that we moved the hub.
                    // We need to find the Hub(s) and their NEW positions.

                    const hub = state.hubs.find(h => h.id === c.fromId);
                    const anchor = state.anchors.find(a => a.id === c.toId);

                    if (hub && anchor) {
                        // We must apply the DELTA to the hub position we just read, 
                        // because the store update above might not have propagated to 'state.hubs' yet if we just called it.
                        // Actually, looking at source, Zustand set updates state immediately. 
                        // So state.hubs should have the new values? 
                        // Let's assume yes. 
                        const points = getOrthogonalPath({ x: hub.x, y: hub.y }, { x: anchor.x, y: anchor.y }, walls);
                        batchUpdates.push({ id: c.id, updates: { points } });
                    }
                });

                if (batchUpdates.length > 0) {
                    state.updateCables(batchUpdates as any);
                }
            }

            lastDragPos.current = pos;
            return;
        }

        // Drag Wall (Edge)
        if (dragWallId.current && lastDragPos.current && !wallsLocked) {
            const dx = pos.x - lastDragPos.current.x;
            const dy = pos.y - lastDragPos.current.y;

            if (Math.abs(dx) > 0 || Math.abs(dy) > 0) hasDragged.current = true;

            const state = useProjectStore.getState();

            // If we want to support multi-selection dragging for walls, we can iterate selection.
            // For now, let's implement single wall drag which effectively drags its endpoints (and connected walls).

            // Note: updateWallPoint updates *all* walls sharing the point.
            // So we just need to update the two endpoints of the dragged wall.

            /* 
               Issue: If we select multiple walls (e.g. a box) and drag one, do we want to move the whole box?
               Standard CAD: Yes, move all selected.
               Implementation:
               If dragWallId is in selection -> transform ALL selected walls.
               Else -> transform only dragWallId.
            */

            const isDragSelected = state.selectedIds.includes(dragWallId.current);
            const wallsToMove = isDragSelected
                ? state.walls.filter(w => state.selectedIds.includes(w.id))
                : state.walls.filter(w => w.id === dragWallId.current);

            // To avoid double-move issues when updating shared points multiple times in a loop,
            // we should be careful. `updateWallPoint` updates based on Coordinate Match.
            // If we move p1 of Wall A, Wall B's p1 also moves.
            // If we then try to move p1 of Wall B (which is now at new pos), we might double move if we aren't careful?
            // Actually `updateWallPoint` takes (oldX, oldY, newX, newY).
            // If we use the CURRENT state for oldX, oldY each time, it should be fine?
            // BUT:
            // 1. Move Wall A Point 1 (old -> new). Wall B Point 1 also moves.
            // 2. Loop to Wall B. We want to move Wall B Point 1.
            //    If we read Wall B Current Point 1, it is ALREADY at `new`.
            //    So `old` = `new`. `new` = `new` + delta.
            //    So it moves again! Double move!

            // Solution: 
            // Collect all UNIQUE points from the selection that need to move.
            // Then move each unique point ONCE.

            const pointsToMove = new Set<string>(); // "x,y" strings
            const pointsMap: { x: number, y: number }[] = [];

            wallsToMove.forEach(w => {
                // Start
                const sKey = `${w.points[0].toFixed(4)},${w.points[1].toFixed(4)}`;
                if (!pointsToMove.has(sKey)) {
                    pointsToMove.add(sKey);
                    pointsMap.push({ x: w.points[0], y: w.points[1] });
                }
                // End
                const eKey = `${w.points[2].toFixed(4)},${w.points[3].toFixed(4)}`;
                if (!pointsToMove.has(eKey)) {
                    pointsToMove.add(eKey);
                    pointsMap.push({ x: w.points[2], y: w.points[3] });
                }
            });

            // Apply updates
            pointsMap.forEach(p => {
                state.updateWallPoint(p.x, p.y, p.x + dx, p.y + dy);
            });

            lastDragPos.current = pos;
            return;
        }

        // Tool Mouse Move checks...
        if (activeTool === 'wall' || activeTool === 'wall_rect' || activeTool === 'wall_rect_edge' || activeTool === 'dimension') {
            const state = useProjectStore.getState();
            const snap = (state.layers.walls || state.layers.anchors) ? getSnapPoint(pos, walls, anchors, 20 / ((stage?.scaleX() || 1))) : null;
            setCurrentMousePos(snap ? snap.point : pos);
        } else if (activeTool === 'scale' && points.length > 0) {
            setCurrentMousePos(pos);
        } else if (activeTool === 'select') {
            if (selectionStart && isMouseDown.current) {
                setSelectionRect({
                    x: Math.min(selectionStart.x, pos.x),
                    y: Math.min(selectionStart.y, pos.y),
                    width: Math.abs(pos.x - selectionStart.x),
                    height: Math.abs(pos.y - selectionStart.y)
                });
                setCurrentMousePos(pos);
            }
        } else if (activeTool === 'export_area') {
            if (selectionStart) {
                const x = Math.min(selectionStart.x, pos.x);
                const y = Math.min(selectionStart.y, pos.y);
                const width = Math.abs(pos.x - selectionStart.x);
                const height = Math.abs(pos.y - selectionStart.y);
                setSelectionRect({ x, y, width, height });
            }
        }


    };



    const handleMouseUp = (e: Konva.KonvaEventObject<MouseEvent>) => {
        isMouseDown.current = false;

        // Door Drag End
        if (draggingDoorId) {
            setDraggingDoorId(null);
            useProjectStore.temporal.getState().resume();
            return;
        }

        // Export Area Logic
        if (activeTool === 'export_area' && selectionStart) {
            const pos = getStagePoint();
            if (pos) {
                const x = Math.min(selectionStart.x, pos.x);
                const y = Math.min(selectionStart.y, pos.y);
                const width = Math.abs(pos.x - selectionStart.x);
                const height = Math.abs(pos.y - selectionStart.y);

                if (width > 0 && height > 0) {
                    setExportRegion([
                        { x, y },
                        { x: x + width, y },
                        { x: x + width, y: y + height },
                        { x, y: y + height }
                    ]);
                    setTool('select');
                }
            }
        }

        // Cable Drawing Finalize
        if (isDrawingCable.current) {
            const startId = cableStartId.current; // Capture before reset
            isDrawingCable.current = false;
            cableStartId.current = null;
            setTempCablePath(null);

            const pos = getStagePoint();
            if (pos && startId) {
                const clickRadius = 20 / (stage?.scaleX() || 1);
                let targetId: string | null = null;

                const hitAnchor = anchors.find(a => dist(pos, a) < clickRadius);
                if (hitAnchor) targetId = hitAnchor.id;
                else {
                    const hitHub = hubs.find(h => dist(pos, h) < clickRadius);
                    if (hitHub) targetId = hitHub.id;
                }

                if (targetId && targetId !== startId) {
                    const startObj = anchors.find(a => a.id === startId) || hubs.find(h => h.id === startId);
                    const endObj = anchors.find(a => a.id === targetId) || hubs.find(h => h.id === targetId);

                    if (startObj && endObj) {
                        const start = { x: startObj.x, y: startObj.y };
                        const end = { x: endObj.x, y: endObj.y };
                        // Use empty walls for "Direct" allowOutside logic or default walls
                        // Ideally checking store.allowOutsideConnection but let's default to walls
                        const routingWalls = useProjectStore.getState().allowOutsideConnections ? [] : walls;

                        const path = getOrthogonalPath(start, end, routingWalls);
                        const len = calculateLength(path, useProjectStore.getState().scaleRatio);

                        addCable({
                            id: uuidv4(),
                            fromId: startObj.id,
                            toId: endObj.id,
                            points: path,
                            length: len,
                            color: '#FF9800' // Default orange for manual routes
                        });
                    }
                }
            }
        }

        // Cable Cleanup
        if (dragCableHandle) {
            setDragCableHandle(null);
        }

        try {

            setIsPanning(false);

            // Resume History if we were dragging
            if (dragTextId.current || dragAnchorId.current || dragDimLineId.current || dragWallId.current || dragHubId.current || dragCableHandle) {
                useProjectStore.temporal.getState().resume();

                // FORCE COMMIT: Trigger a state update to save the "End" position in history
                if (hasDragged.current) {
                    if (dragAnchorId.current) {
                        const state = useProjectStore.getState();
                        const updates = state.anchors
                            .filter(a => state.selectedIds.includes(a.id))
                            .map(a => ({ id: a.id, updates: { x: a.x, y: a.y } }));
                        updateAnchors(updates);
                    }

                    if (dragDimLineId.current) {
                        const d = useProjectStore.getState().dimensions.find(x => x.id === dragDimLineId.current);
                        if (d) useProjectStore.getState().updateDimension(d.id, { points: [...d.points] });
                    }

                    if (dragTextId.current) {
                        const d = useProjectStore.getState().dimensions.find(x => x.id === dragTextId.current);
                        if (d) useProjectStore.getState().updateDimension(d.id, { textOffset: { x: d.textOffset?.x || 0, y: d.textOffset?.y || 0 } });
                    }
                }
            }

            dragTextId.current = null;
            dragAnchorId.current = null;
            dragHubId.current = null;
            dragWallId.current = null;
            dragDimLineId.current = null;
            lastDragPos.current = null;

            if (activeTool === 'dimension' && points.length === 1) {
                const stagePos = stage?.getPointerPosition();
                if (!stagePos) return;
                const pos = getStagePoint();
                if (!pos) return;

                const start = points[0];
                const distMoved = dist(start, pos);
                const clickTol = 5 / (stage?.scaleX() || 1);

                if (distMoved < clickTol) {
                    const clickPos = pos;
                    const tol = 10 / (stage?.scaleX() || 1);
                    let hitWall = null;
                    const state = useProjectStore.getState();

                    if (state.layers.walls) {
                        for (const w of walls) {
                            if (isPointNearWall(clickPos, w, tol)) {
                                hitWall = w;
                                break;
                            }
                        }
                    }

                    if (hitWall) {
                        const x1 = hitWall.points[0];
                        const y1 = hitWall.points[1];
                        const x2 = hitWall.points[2];
                        const y2 = hitWall.points[3];
                        const dx = x2 - x1;
                        const dy = y2 - y1;
                        const len = Math.hypot(dx, dy);
                        const nx = -dy / len;
                        const ny = dx / len;
                        const offset = 30 / ((stage?.scaleX() || 1) || 1);

                        const cx = clickPos.x - x1;
                        const cy = clickPos.y - y1;
                        const dot = cx * nx + cy * ny;
                        const dir = dot > 0 ? 1 : -1;

                        const offX = nx * offset * dir;
                        const offY = ny * offset * dir;

                        const dimX1 = x1 + offX;
                        const dimY1 = y1 + offY;
                        const dimX2 = x2 + offX;
                        const dimY2 = y2 + offY;

                        const scaleRatio = useProjectStore.getState().scaleRatio;
                        const distMeters = len / scaleRatio;

                        useProjectStore.getState().addDimension({
                            points: [dimX1, dimY1, dimX2, dimY2],
                            type: 'wall',
                            label: `${distMeters.toFixed(2)}m`
                        });

                        setPoints([]);
                    }
                } else {
                    const state = useProjectStore.getState();
                    const snap = (state.layers.walls || state.layers.anchors) ? getSnapPoint(pos, walls, anchors, 20 / (stage?.scaleX() || 1)) : null;
                    const end = snap ? snap.point : pos;
                    const distPx = Math.hypot(end.x - start.x, end.y - start.y);
                    const scaleRatio = useProjectStore.getState().scaleRatio;
                    const validDist = distPx / scaleRatio;

                    if (validDist > 0) {
                        useProjectStore.getState().addDimension({
                            points: [start.x, start.y, end.x, end.y],
                            type: 'free',
                            label: `${validDist.toFixed(2)}m`
                        });
                    }
                    setPoints([]);
                }
            }

            if (e.evt.button === 0) {
                const pos = getStagePoint();
                if (!pos) return;

                let finalPos = pos;
                let snap: import('../../utils/geometry').SnapResult | null = null;
                const state = useProjectStore.getState();
                if ((activeTool === 'wall_rect' || activeTool === 'wall_rect_edge') && state.layers.walls) {
                    snap = getSnapPoint(pos, walls, anchors, 20 / ((stage?.scaleX() || 1)));
                    if (snap) finalPos = snap.point;
                }

                if (activeTool === 'wall_rect') {
                    if (rectStart) {
                        if (dist(rectStart, finalPos) > 0.2) {
                            const x1 = rectStart.x;
                            const y1 = rectStart.y;
                            const x2 = finalPos.x;
                            const y2 = finalPos.y;

                            if (Math.abs(x1 - x2) > 0.1 || Math.abs(y1 - y2) > 0.1) {
                                if (snap && snap.type === 'edge' && snap.id) {
                                    state.splitWall(snap.id, snap.point);
                                }
                                const p3 = { x: x2, y: y1 };
                                const p4 = { x: x1, y: y2 };

                                const snapP3 = state.layers.walls ? getSnapPoint(p3, walls, anchors, 20 / ((stage?.scaleX() || 1))) : null;
                                if (snapP3 && snapP3.type === 'edge' && snapP3.id) state.splitWall(snapP3.id, snapP3.point);

                                const snapP4 = state.layers.walls ? getSnapPoint(p4, walls, anchors, 20 / ((stage?.scaleX() || 1))) : null;
                                if (snapP4 && snapP4.type === 'edge' && snapP4.id) state.splitWall(snapP4.id, snapP4.point);

                                const params = getWallParams(wallPreset, standardWallThickness, thickWallThickness, wideWallThickness);
                                addWalls([
                                    { points: [x1, y1, x2, y1], ...params as any },
                                    { points: [x2, y1, x2, y2], ...params as any },
                                    { points: [x2, y2, x1, y2], ...params as any },
                                    { points: [x1, y2, x1, y1], ...params as any }
                                ]);
                            }
                            setRectStart(null);
                            setCurrentMousePos(null);
                        }
                    }
                } else if (activeTool === 'wall_rect_edge') {
                    if (rectEdgeBaseEnd) {
                        if (dist(rectEdgeBaseEnd, finalPos) > 0.2) {
                            const p1 = rectEdgeStart;
                            if (!p1) return;
                            const p2 = rectEdgeBaseEnd;

                            const dx = p2.x - p1.x;
                            const dy = p2.y - p1.y;
                            const len = Math.hypot(dx, dy);

                            const nx = -dy / len;
                            const ny = dx / len;

                            const vmx = finalPos.x - p1.x;
                            const vmy = finalPos.y - p1.y;
                            const h = vmx * nx + vmy * ny;

                            const p4x = p1.x + nx * h;
                            const p4y = p1.y + ny * h;
                            const p3x = p2.x + nx * h;
                            const p3y = p2.y + ny * h;

                            if (snap && snap.type === 'edge' && snap.id) state.splitWall(snap.id, snap.point);

                            const p3 = { x: p3x, y: p3y };
                            const p4 = { x: p4x, y: p4y };
                            const snapP3 = state.layers.walls ? getSnapPoint(p3, walls, anchors, 20 / ((stage?.scaleX() || 1))) : null;
                            if (snapP3 && snapP3.type === 'edge' && snapP3.id) state.splitWall(snapP3.id, snapP3.point);
                            const snapP4 = state.layers.walls ? getSnapPoint(p4, walls, anchors, 20 / ((stage?.scaleX() || 1))) : null;
                            if (snapP4 && snapP4.type === 'edge' && snapP4.id) state.splitWall(snapP4.id, snapP4.point);

                            const params = getWallParams(wallPreset, standardWallThickness, thickWallThickness, wideWallThickness);

                            addWalls([
                                { points: [p1.x, p1.y, p2.x, p2.y], ...params as any },
                                { points: [p2.x, p2.y, p3x, p3y], ...params as any },
                                { points: [p3x, p3y, p4x, p4y], ...params as any },
                                { points: [p4x, p4y, p1.x, p1.y], ...params as any }
                            ]);

                            setRectEdgeStart(null);
                            setRectEdgeBaseEnd(null);
                            setCurrentMousePos(null);
                        }
                    }
                }
            }

            if (e.evt.button === 2) {
                if (isPanning) {
                    setIsPanning(false);
                    checkRMBClick(e);
                    lastPanPos.current = null;
                }
            }

            if (e.evt.button === 0 && activeTool === 'select') {
                const hasDragRect = selectionRect && (selectionRect.width > 0.5 || selectionRect.height > 0.5);

                const getIdsInRect = (rect: { minX: number, maxX: number, minY: number, maxY: number }, isCrossing: boolean): string[] => {
                    const foundIds: string[] = [];
                    const state = useProjectStore.getState();
                    const { walls, anchors, hubs, dimensions } = state;

                    if (state.layers.walls && !wallsLocked) {
                        walls.forEach(w => {
                            const wx1 = w.points[0]; const wy1 = w.points[1];
                            const wx2 = w.points[2]; const wy2 = w.points[3];
                            const wMinX = Math.min(wx1, wx2); const wMaxX = Math.max(wx1, wx2);
                            const wMinY = Math.min(wy1, wy2); const wMaxY = Math.max(wy1, wy2);
                            const isEnclosed = wMinX >= rect.minX && wMaxX <= rect.maxX && wMinY >= rect.minY && wMaxY <= rect.maxY;
                            if (!isCrossing) {
                                if (isEnclosed) foundIds.push(w.id);
                            } else {
                                if (wMaxX < rect.minX || wMinX > rect.maxX || wMaxY < rect.minY || wMinY > rect.maxY) return;
                                foundIds.push(w.id);
                            }
                        });
                    }

                    if (state.layers.dimensions) {
                        dimensions.forEach(d => {
                            const dx1 = d.points[0]; const dy1 = d.points[1];
                            const dx2 = d.points[2]; const dy2 = d.points[3];
                            const dMinX = Math.min(dx1, dx2); const dMaxX = Math.max(dx1, dx2);
                            const dMinY = Math.min(dy1, dy2); const dMaxY = Math.max(dy1, dy2);
                            const isEnclosed = dMinX >= rect.minX && dMaxX <= rect.maxX && dMinY >= rect.minY && dMaxY <= rect.maxY;
                            if (!isCrossing) {
                                if (isEnclosed) foundIds.push(d.id);
                            } else {
                                if (dMaxX < rect.minX || dMinX > rect.maxX || dMaxY < rect.minY || dMinY > rect.maxY) return;
                                foundIds.push(d.id);
                            }
                        });
                    }

                    if (state.layers.anchors) {
                        anchors.forEach(a => {
                            const isEnclosed = a.x >= rect.minX && a.x <= rect.maxX && a.y >= rect.minY && a.y <= rect.maxY;
                            if (isEnclosed) foundIds.push(a.id);
                        });
                    }

                    if (state.layers.hubs) {
                        hubs.forEach(h => {
                            const isEnclosed = h.x >= rect.minX && h.x <= rect.maxX && h.y >= rect.minY && h.y <= rect.maxY;
                            if (isEnclosed) foundIds.push(h.id);
                        });
                    }

                    if (e.evt.altKey) {
                        state.importedObjects?.forEach(obj => {
                            if (!obj.visible || obj.locked) return;
                            const w = (obj.width || 0) * obj.scale;
                            const h = (obj.height || 0) * obj.scale;
                            if (w <= 0 || h <= 0) return;
                            const objMinX = obj.x;
                            const objMaxX = obj.x + w;
                            const objMinY = obj.y;
                            const objMaxY = obj.y + h;

                            if (!isCrossing) {
                                const isEnclosed = objMinX >= rect.minX && objMaxX <= rect.maxX && objMinY >= rect.minY && objMaxY <= rect.maxY;
                                if (isEnclosed) state.setActiveImportId(obj.id);
                            } else {
                                if (objMaxX < rect.minX || objMinX > rect.maxX || objMaxY < rect.minY || objMinY > rect.maxY) return;
                                state.setActiveImportId(obj.id);
                            }
                        });
                    }
                    return foundIds;
                };

                if (hasDragRect && selectionStart && currentMousePos && selectionRect) {
                    const isCrossing = currentMousePos.x < selectionStart.x;
                    const rect = {
                        minX: Math.min(selectionStart.x, currentMousePos.x),
                        maxX: Math.max(selectionStart.x, currentMousePos.x),
                        minY: Math.min(selectionStart.y, currentMousePos.y),
                        maxY: Math.max(selectionStart.y, currentMousePos.y)
                    };
                    const foundIds = getIdsInRect(rect, isCrossing);
                    setSelection(foundIds);

                } else if (selectionStart && !hasDragRect) {
                    const clickPos = getStagePoint();
                    if (clickPos) {
                        let idsToSelect: string[] = [];
                        const tol = 10 / ((stage?.scaleX() || 1) || 1);

                        if (e.target.name() === 'dim-text') {
                            const rawId = e.target.id();
                            idsToSelect = [rawId.replace('dim-text-', '')];
                        }

                        if (idsToSelect.length === 0 && useProjectStore.getState().layers.dimensions) {
                            for (const d of dimensions) {
                                if (isPointNearLine(clickPos, d.points[0], d.points[1], d.points[2], d.points[3], tol)) {
                                    idsToSelect = [d.id];
                                    break;
                                }
                            }
                        }

                        if (activeTool === 'select' || activeTool === 'hub') {
                            const hubs = useProjectStore.getState().hubs;
                            const stageScale = stage?.scaleX() || 1;
                            const hubHit = hubs.find(h =>
                                Math.abs(clickPos.x - h.x) < 15 / stageScale &&
                                Math.abs(clickPos.y - h.y) < 15 / stageScale
                            );

                            if (hubHit) {
                                const isSelected = useProjectStore.getState().selectedIds.includes(hubHit.id);
                                if (!isShiftDown) {
                                    if (!isSelected) setSelection([hubHit.id]);
                                } else {
                                    const current = useProjectStore.getState().selectedIds;
                                    if (isSelected) setSelection(current.filter(id => id !== hubHit.id));
                                    else setSelection([...current, hubHit.id]);
                                }
                                return;
                            }
                        }

                        if (idsToSelect.length === 0 && useProjectStore.getState().layers.walls && !wallsLocked) {
                            for (const w of walls) {
                                if (isPointNearWall(clickPos, w, tol)) {
                                    if (e.evt.ctrlKey) {
                                        idsToSelect = getAllConnectedWalls(w.id, walls);
                                    } else {
                                        idsToSelect = [w.id];
                                    }
                                    break;
                                }
                            }
                        }

                        // NOTE: Anchors handle their own clicks, so we typically deselect if nothing found here.
                        // UNLESS we want "Background Click" to deselect anchors too.
                        const current = useProjectStore.getState().selectedIds;
                        const newIds = idsToSelect.filter(id => !current.includes(id));

                        if (newIds.length > 0) {
                            setSelection([...current, ...newIds]);
                        } else {
                            if (idsToSelect.length > 0) {
                                // Clicked something already selected -> toggle off? or keep? 
                                // Standard: if single click on selected without shift, usually selects ONLY that one.
                                // But here we toggle off?
                                setSelection(current.filter(id => !idsToSelect.includes(id)));
                            } else {
                                // Clicked Empty Space
                                if (!isShiftDown) {
                                    setSelection([]);
                                    useProjectStore.getState().setActiveImportId(null);
                                }
                            }
                        }
                    }
                }
            }

        } catch (err) {
            console.error("Error in handleMouseUp:", err);
        } finally {
            setSelectionStart(null);
            setSelectionRect(null);
            setCurrentMousePos(null);
        }
    };




    const lastLoaded = useProjectStore(state => state.lastLoaded);

    const fitScreen = () => {
        const state = useProjectStore.getState();
        const walls = state.walls;
        const anchors = state.anchors;

        if (walls.length === 0 && anchors.length === 0) return;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        walls.forEach(w => {
            minX = Math.min(minX, w.points[0], w.points[2]);
            maxX = Math.max(maxX, w.points[0], w.points[2]);
            minY = Math.min(minY, w.points[1], w.points[3]);
            maxY = Math.max(maxY, w.points[1], w.points[3]);
        });

        anchors.forEach(a => {
            minX = Math.min(minX, a.x);
            maxX = Math.max(maxX, a.x);
            minY = Math.min(minY, a.y);
            maxY = Math.max(maxY, a.y);
        });

        // If nothing found (e.g. initial infinity), skip
        if (minX === Infinity) return;

        const padding = 1.2;
        const w = (maxX - minX) * padding || 10;
        const h = (maxY - minY) * padding || 10;
        if (w === 0 || h === 0) return;

        if (w === 0 || h === 0) return;
        if (!stage) return;

        const stageW = stage.width();
        const stageH = stage.height();
        const scale = Math.min(stageW / w, stageH / h);

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        stage.position({
            x: stageW / 2 - centerX * scale,
            y: stageH / 2 - centerY * scale
        });
        stage.scale({ x: scale, y: scale });
        stage.batchDraw();
    };

    // Auto Fit on Project Load
    useEffect(() => {
        if (lastLoaded > 0 && stage) {
            // Determine bounding box and fit
            // Use setTimeout to ensure all layers (Walls, Anchors) have finished rendering
            const timer = setTimeout(() => {
                fitScreen();
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [lastLoaded, stage]);

    const handleDblClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
        // 1. Cable Split (Add Vertex)
        if (useProjectStore.getState().activeTool === 'cable_edit') {
            const pos = getStagePoint();
            if (pos) {
                const cables = useProjectStore.getState().cables;
                for (const cable of cables) {
                    const hit = isPointNearCable(pos, cable.points, 10 / (stage?.scaleX() || 1));
                    if (hit && hit.type === 'segment') {
                        // Add vertex at pos
                        const newPoints = [...cable.points];
                        // Insert after index
                        newPoints.splice(hit.index + 1, 0, pos);
                        useProjectStore.getState().updateCable(cable.id, { points: newPoints });
                        return;
                    }
                }
            }
        }

        // Existing "Zoom to Fit" logic or similar (if any)
        // ...
        if (e.evt.button === 1) { // MMB
            fitScreen();
        }
    };

    // Helper: Find all connected walls (Chain Selection)
    const getAllConnectedWalls = (startId: string, walls: import('../../types').Wall[]): string[] => {
        const visited = new Set<string>();
        const queue = [startId];
        visited.add(startId);

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            const current = walls.find(w => w.id === currentId);
            if (!current) continue;

            // Check all other walls for connection
            walls.forEach(w => {
                if (!visited.has(w.id)) {
                    // Check if points match (with small epsilon)
                    const epsilon = 0.01; // 1cm
                    const p1 = { x: current.points[0], y: current.points[1] };
                    const p2 = { x: current.points[2], y: current.points[3] };
                    const q1 = { x: w.points[0], y: w.points[1] };
                    const q2 = { x: w.points[2], y: w.points[3] };

                    const isConnected =
                        dist(p1, q1) < epsilon || dist(p1, q2) < epsilon ||
                        dist(p2, q1) < epsilon || dist(p2, q2) < epsilon;

                    if (isConnected) {
                        visited.add(w.id);
                        queue.push(w.id);
                    }
                }
            });
        }
        return Array.from(visited);
    };



    const openAnchorMenu = (pointer: { x: number, y: number }, targetIds: string[]) => {
        if (onOpenMenu) {
            const state = useProjectStore.getState();
            onOpenMenu(pointer.x, pointer.y, [
                {
                    label: 'Set Radius (m)...',
                    action: () => {
                        const r = prompt("Enter Radius in meters:", "5");
                        if (r !== null) {
                            const val = parseFloat(r);
                            if (!isNaN(val) && val > 0) {
                                targetIds.forEach(id => state.updateAnchor(id, { radius: val }));
                            }
                        }
                    }
                },
                {
                    label: 'Shape: Circle',
                    action: () => targetIds.forEach(id => state.updateAnchor(id, { shape: 'circle' }))
                },
                {
                    label: 'Shape: Square',
                    action: () => targetIds.forEach(id => state.updateAnchor(id, { shape: 'square' }))
                },
                {
                    label: 'Reset to System Default',
                    action: () => targetIds.forEach(id => state.updateAnchor(id, { radius: undefined, shape: undefined }))
                },
                { type: 'separator' },
                {
                    label: 'Group Anchors (Ctrl+G)',
                    action: () => state.groupAnchors(targetIds)
                },
                {
                    label: 'Ungroup Anchors (Ctrl+Shift+G)',
                    action: () => state.ungroupAnchors(targetIds)
                }
            ]);
        }
    };

    const handleContextMenu = (e: Konva.KonvaEventObject<PointerEvent>) => {
        e.evt.preventDefault();
        // We rely on MouseUp for the actual trigger to distinguish click vs drag
    };

    const checkRMBClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
        if (!stage) return;
        const pointer = stage.getPointerPosition();
        if (!pointer || !lastPanPos.current) return;

        // Calc distance
        const dx = pointer.x - lastPanPos.current.x;
        const dy = pointer.y - lastPanPos.current.y;
        const dist = Math.hypot(dx, dy);

        const duration = Date.now() - panStartTime.current;

        if (dist < 5 && duration < 500) {
            // It's a CLICK
            const state = useProjectStore.getState();
            const currentSelection = state.selectedIds;

            // If we clicked an anchor directly
            if (e.target.name() === 'anchor') {
                const anchorId = e.target.id();
                // If clicked anchor is not selected, select it (exclusive)
                let targetIds = currentSelection;
                if (!currentSelection.includes(anchorId)) {
                    state.setSelection([anchorId]);
                    targetIds = [anchorId];
                }
                openAnchorMenu(pointer, targetIds);
            } else if (e.target.name() === 'hub-bg' || e.target.name() === 'hub-text') {
                // Clicked a Hub
                const hubId = e.target.id();
                let targetIds = currentSelection;
                if (!currentSelection.includes(hubId)) {
                    state.setSelection([hubId]);
                    targetIds = [hubId];
                }
                // Re-use logic to open selection menu (it's generic)
                openAnchorMenu(pointer, targetIds);
            } else {
                // Clicked background or other
                // If we have selected anchors or hubs, show menu for them
                const selectedAnchors = state.anchors.filter(a => currentSelection.includes(a.id));
                const selectedHubs = state.hubs.filter(h => currentSelection.includes(h.id));

                if (selectedAnchors.length > 0 || selectedHubs.length > 0) {
                    openAnchorMenu(pointer, currentSelection);
                } else {
                    // Default Logic (Wall Loop, etc or just nothing)
                    if (activeTool === 'wall' && points.length > 0) {
                        // Wall Menu
                        if (onOpenMenu) {
                            onOpenMenu(pointer.x, pointer.y, [
                                {
                                    label: 'Close Loop',
                                    action: () => {
                                        if (chainStart && points.length > 0) {
                                            const start = points[0];
                                            const end = chainStart;
                                            if (start.x !== end.x || start.y !== end.y) {
                                                addWall({
                                                    points: [start.x, start.y, end.x, end.y],
                                                    ...getWallParams(wallPreset, standardWallThickness, thickWallThickness, wideWallThickness) as any
                                                });
                                            }
                                        }
                                        setPoints([]);
                                        setChainStart(null);
                                    }
                                },
                                {
                                    label: 'Stop Drawing',
                                    action: () => {
                                        setPoints([]);
                                        setChainStart(null);
                                    }
                                }
                            ]);
                        }
                    } else {
                        setTool('select');
                    }
                }
            }
        }
    };

    // Dedicated Global Keyboard Handler
    useEffect(() => {

        const handleKeyDown = (e: KeyboardEvent) => {

            // Ignore if User is typing in an Input or Textarea
            const activeTag = document.activeElement?.tagName.toLowerCase();
            if (activeTag === 'input' || activeTag === 'textarea') return;
            if (e.key === 'Shift') setIsShiftDown(true);

            // Access fresh state directly to avoid dependency churn
            const state = useProjectStore.getState();
            const { activeTool, setTool, setSelection, setAnchorMode, wallsLocked } = state;

            // Shortcuts
            if (e.code === 'Escape') {
                setPoints([]);
                setChainStart(null);
                setRectStart(null);
                setRectEdgeStart(null);
                setRectEdgeBaseEnd(null);
                setTool('select'); // Escape goes to select
                setSelectionStart(null);
                setSelectionRect(null);
                setSelection([]);
                dragTextId.current = null;
                dragAnchorId.current = null;
            }

            // Delete / Backspace
            if ((e.code === 'Delete' || e.code === 'Backspace')) {
                const currentSelectedIds = state.selectedIds;
                const PLACEMENT_AREA_ID = 'placement_area_poly';

                if (currentSelectedIds.length > 0) {
                    currentSelectedIds.forEach(id => {
                        if (id === PLACEMENT_AREA_ID) {
                            state.setPlacementArea(null);
                        } else {
                            const anchor = state.anchors.find(a => a.id === id);
                            if (anchor && anchor.locked) return;

                            state.removeWall(id);
                            state.removeAnchor(id);
                            state.removeDimension(id);
                            state.removeHub(id);
                        }
                    });

                    // Cleanup selection
                    setSelection([]);
                }

                // Remove Active Import
                if (state.activeImportId) {
                    state.removeImportedObject(state.activeImportId);
                }
            }

            // Tool Shortcuts
            if (activeTool !== 'scale') {
                const code = e.code;

                // Advanced Wall Tool Shortcut (Shift+R)
                if (code === 'KeyR' && e.shiftKey) {
                    if (!wallsLocked) {
                        if (activeTool === 'select' || activeTool.startsWith('wall') || activeTool.startsWith('anchor')) {
                            setTool('wall_rect_edge');
                            return;
                        }
                    }
                }

                // Undo / Redo (Ctrl+Z / Ctrl+Y)
                if ((e.ctrlKey || e.metaKey) && code === 'KeyZ') {
                    e.preventDefault();
                    if (e.shiftKey) {
                        useProjectStore.temporal.getState().redo();
                    } else {
                        // Custom Undo for Wall Tool Chain relies on 'points' state... which is local.
                        // We can't easily access 'points' from here if we want zero deps?
                        // Actually, 'points' is in the closure of this render if we define handleKeyDown inside render?
                        // No, we are inside useEffect with [] deps. 'points' will be stale (initial []).
                        // To fix this, we MUST include 'points' in deps if we want to access it.
                        // OR we make 'points' a ref.
                        // For now, let's just trigger standard undo, and if 'points' is needed, we handle it elsewhere or accept limitation.
                        // Actually simpler: Let's rely on standard undo for now to keep listener stable.
                        useProjectStore.temporal.getState().undo();
                    }
                    return;
                }
                if ((e.ctrlKey || e.metaKey) && (code === 'KeyY')) {
                    e.preventDefault();
                    useProjectStore.temporal.getState().redo();
                    return;
                }

                // Group / Ungroup Anchors
                if ((e.ctrlKey || e.metaKey) && code === 'KeyG') {
                    e.preventDefault();
                    if (e.shiftKey) {
                        const selectedIds = state.selectedIds;
                        state.ungroupAnchors(selectedIds);
                    } else {
                        const selectedIds = state.selectedIds;
                        state.groupAnchors(selectedIds);
                    }
                    return;
                }

                if (code === 'KeyV') setTool('select');
                if (code === 'KeyW') {
                    if (e.shiftKey) {
                        e.preventDefault();
                        state.setWallsLocked(!wallsLocked);
                    } else if (!wallsLocked) {
                        setTool('wall');
                    }
                }
                if (code === 'KeyR' && !wallsLocked) {
                    if (activeTool === 'wall_rect') {
                        setTool('wall_rect_edge');
                    } else if (activeTool === 'wall_rect_edge') {
                        setTool('wall_rect');
                    } else {
                        setTool('wall_rect');
                    }
                }
                if (code === 'KeyD') setTool('dimension');
                if (code === 'KeyS') setTool('scale');

                if (code === 'KeyA') {
                    if (e.shiftKey) {
                        e.preventDefault();
                        setTool('anchor_auto');
                        setAnchorMode('auto');
                        state.setIsAutoPlacementOpen(true);
                    } else {
                        setTool('anchor');
                        setAnchorMode('manual');
                    }
                }
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Shift') setIsShiftDown(false);
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [setPoints, setChainStart, setRectStart, setRectEdgeStart, setRectEdgeBaseEnd, setIsShiftDown]); // Stable setters

    // Bind Events to Stage
    useEffect(() => {
        if (!stage) return;

        stage.on('mousedown', handleMouseDown);
        stage.on('mousemove', handleMouseMove);
        stage.on('mouseup', handleMouseUp);
        stage.on('dblclick', handleDblClick);
        stage.on('contextmenu', handleContextMenu);
        // Optimize Zoom Performance: Debounce re-renders
        let zoomTimeout: any;
        const handleWheel = () => {
            // Clear existing timeout
            if (zoomTimeout) clearTimeout(zoomTimeout);
            // Set new timeout to trigger re-render after zoom stops (e.g., 100ms)
            zoomTimeout = setTimeout(() => {
                setTick(t => t + 1);
            }, 100);
        };

        stage.on('wheel', handleWheel);

        return () => {
            stage.off('mousedown', handleMouseDown);
            stage.off('mousemove', handleMouseMove);
            stage.off('mouseup', handleMouseUp);
            stage.off('dblclick', handleDblClick);
            stage.off('contextmenu', handleContextMenu);
        };
    }, [stage, handleMouseDown, handleMouseMove, handleMouseUp, handleDblClick, handleContextMenu]);

    if (!stage) return null;

    return (
        <React.Fragment>
            {(activeTool === 'wall' || activeTool === 'scale' || activeTool === 'dimension') && points.length > 0 && currentMousePos && (
                <React.Fragment>
                    <Line
                        points={[points[0].x, points[0].y, currentMousePos.x, currentMousePos.y]}
                        stroke={activeTool === 'scale' ? "#ffaa00" : activeTool === 'dimension' ? "#00ff00" : "#00aaff"}
                        strokeWidth={2 / (stage?.scaleX() || 1)}
                        dash={[10, 5]}
                    />
                    <Circle
                        x={currentMousePos.x}
                        y={currentMousePos.y}
                        radius={5 / (stage?.scaleX() || 1)}
                        fill={activeTool === 'scale' ? "#ffaa00" : activeTool === 'dimension' ? "#00ff00" : "#00aaff"}
                    />
                </React.Fragment>
            )}

            {/* Snap Cursor Indicator for Wall & Dimension Tools (Hover) */}
            {currentMousePos && (activeTool === 'wall' || activeTool === 'wall_rect' || activeTool === 'wall_rect_edge' || activeTool === 'dimension') && (
                <Circle
                    x={currentMousePos.x}
                    y={currentMousePos.y}
                    // Radius = Min(5 visual pixels, 0.25m physical radius)
                    // 0.25m physical radius = 0.5m diameter cap
                    radius={Math.min(5 / (stage?.scaleX() || 1), (0.25 * (scaleRatio || 50)))}
                    fill="transparent"
                    stroke="#ff0000"
                    strokeWidth={2 / (stage?.scaleX() || 1)}
                    listening={false}
                />
            )}

            {activeTool === 'wall_rect' && rectStart && currentMousePos && (
                <Rect
                    x={Math.min(rectStart.x, currentMousePos.x)}
                    y={Math.min(rectStart.y, currentMousePos.y)}
                    width={Math.abs(currentMousePos.x - rectStart.x)}
                    height={Math.abs(currentMousePos.y - rectStart.y)}
                    stroke="#00aaff"
                    strokeWidth={2 / (stage?.scaleX() || 1)}
                    dash={[10, 5]}
                />
            )}

            {/* Wall Rect Edge Preview */}
            {activeTool === 'wall_rect_edge' && rectEdgeStart && currentMousePos && (
                <React.Fragment>
                    {/* Phase 2: Drawing Base */}
                    {!rectEdgeBaseEnd && (
                        <Line
                            points={[rectEdgeStart.x, rectEdgeStart.y, currentMousePos.x, currentMousePos.y]}
                            stroke={colors.preview}
                            strokeWidth={2 / (stage?.scaleX() || 1)}
                            dash={[10, 5]}
                        />
                    )}
                    {/* Phase 3: Drawing Height (Rect) */}
                    {rectEdgeBaseEnd && (
                        (() => {
                            // Re-calculate rect points
                            const p1 = rectEdgeStart;
                            const p2 = rectEdgeBaseEnd;
                            const finalPos = currentMousePos;

                            const dx = p2.x - p1.x;
                            const dy = p2.y - p1.y;
                            const len = Math.hypot(dx, dy);

                            const nx = -dy / len;
                            const ny = dx / len;

                            const vmx = finalPos.x - p1.x;
                            const vmy = finalPos.y - p1.y;
                            const h = vmx * nx + vmy * ny;

                            const p4x = p1.x + nx * h;
                            const p4y = p1.y + ny * h;
                            const p3x = p2.x + nx * h;
                            const p3y = p2.y + ny * h;

                            return (
                                <Line
                                    points={[
                                        p1.x, p1.y,
                                        p2.x, p2.y,
                                        p3x, p3y,
                                        p4x, p4y,
                                        p1.x, p1.y
                                    ]}
                                    stroke={colors.preview}
                                    strokeWidth={2 / (stage?.scaleX() || 1)}
                                    dash={[10, 5]}
                                    closed
                                />
                            );
                        })()
                    )}
                    {/* Start Point Marker */}
                    <Circle
                        x={rectEdgeStart.x}
                        y={rectEdgeStart.y}
                        radius={3 / (stage?.scaleX() || 1)}
                        fill="red"
                    />
                    {/* End Point Marker */}
                    {rectEdgeBaseEnd && (
                        <Circle
                            x={rectEdgeBaseEnd.x}
                            y={rectEdgeBaseEnd.y}
                            radius={3 / (stage?.scaleX() || 1)}
                            fill="red"
                        />
                    )}
                </React.Fragment>
            )}

            {activeTool === 'select' && selectionRect && selectionStart && currentMousePos && (
                <Rect
                    x={selectionRect.x}
                    y={selectionRect.y}
                    width={selectionRect.width}
                    height={selectionRect.height}
                    fill={currentMousePos.x < selectionStart.x ? "rgba(0, 255, 0, 0.2)" : "rgba(0, 100, 255, 0.2)"}
                    stroke={currentMousePos.x < selectionStart.x ? "green" : "blue"}
                    strokeWidth={1 / (stage?.scaleX() || 1)}
                    dash={currentMousePos.x < selectionStart.x ? [5, 5] : undefined}
                    listening={false}
                />
            )}

            {/* Export Region Visualization */}
            {exportRegion && (
                <Line
                    name="export-region-visual"
                    points={[
                        exportRegion[0].x, exportRegion[0].y,
                        exportRegion[1].x, exportRegion[1].y,
                        exportRegion[2].x, exportRegion[2].y,
                        exportRegion[3].x, exportRegion[3].y,
                        exportRegion[0].x, exportRegion[0].y
                    ]}
                    stroke="#22c55e"
                    strokeWidth={2 / (stage?.scaleX() || 1)}
                    dash={[10, 5]}
                    listening={false}
                />
            )}

            {/* Selection Rect (Reused for Drawing Export Area) */}
            {selectionRect && activeTool === 'export_area' && (
                <Rect
                    x={selectionRect.x}
                    y={selectionRect.y}
                    width={selectionRect.width}
                    height={selectionRect.height}
                    fill="rgba(34, 197, 94, 0.2)"
                    stroke="#22c55e"
                    strokeWidth={1 / (stage?.scaleX() || 1)}
                    listening={false}
                />
            )}

            {/* Wall Endpoint Handles */}
            {(() => {
                const state = useProjectStore.getState();
                // Check if Wall Layer is visible
                if (!state.layers.walls) return null;

                // const selectedWallIds = state.selectedIds.filter(id => state.walls.some(w => w.id === id));

                const handles: React.ReactElement[] = [];
                const handleRadius = 6 / (stage?.scaleX() || 1);

                // Helper to find connected walls
                const findConnectedWalls = (p: { x: number, y: number }, ignoreWallId: string, walls: Wall[]) => {
                    const connected: { wallId: string, pointIndex: number }[] = [];
                    // const tolerance = 0.1 * scaleRatio; // 10cm tolerance in pixels // This line is removed as per instruction

                    walls.forEach(w => {
                        if (w.id === ignoreWallId) return;
                        // VISUAL tolerance calculation:
                        // 1. Visual: ~10 screen pixels (standard pick radius)
                        const visualTol = 10 / (stage?.scaleX() || 1);

                        // 2. Physical: Cap at 0.5 meters (to prevent grabbing far items when zoomed out)
                        // scaleRatio is px/m. So 0.5 * scaleRatio is 0.5m in pixels.
                        const physicalCap = 0.5 * (state.scaleRatio || 50);

                        const tolerance = Math.min(visualTol, physicalCap);

                        if (Math.hypot(w.points[0] - p.x, w.points[1] - p.y) < tolerance) {
                            connected.push({ wallId: w.id, pointIndex: 0 });
                        }
                        if (Math.hypot(w.points[2] - p.x, w.points[3] - p.y) < tolerance) {
                            connected.push({ wallId: w.id, pointIndex: 2 });
                        }
                    });
                    return connected;
                };

                // Show handles for ALL walls when Select tool is active?
                // The previous code block was iterating `state.walls`.
                // But the VIEW showed `selectedWallIds`.
                // Let's restore iterating ALL walls if we want dragging any handle.
                // Or stick to selected. Start by sticking to what was there but adding helper.

                // Converting back to `state.walls` iteration to match User expectation of "hover and drag"?
                // If I change it to `state.walls.forEach`, I enable dragging ANY wall handle.

                state.walls.forEach(wall => {
                    const id = wall.id;
                    const isSelected = state.selectedIds.includes(id);
                    // Only show handles if selected OR hover? 
                    // Let's just render all handles for now as per previous "walls.map" approach which I apparently replaced with "selectedWallIds" by mistake?
                    // No, line 2391 defines selectedWallIds.
                    // I will change it to iterate `state.walls` to ensure all handles are dragable.

                    // IMPORTANT: Only show handles if the wall is selected (User Request)
                    if (isSelected) {
                        // Start Point
                        handles.push(
                            <Circle
                                key={`${id}-start`}
                                name="wall-handle"
                                x={wall.points[0]}
                                y={wall.points[1]}
                                radius={handleRadius}
                                fill="#00aaff"
                                stroke="white"
                                strokeWidth={2 / ((stage?.scaleX() || 1))}
                                draggable={!wallsLocked}
                                onMouseDown={(e) => {
                                    e.cancelBubble = true;
                                }}
                                onDragStart={(e) => {
                                    e.cancelBubble = true;
                                    draggedWallNodeMap.current = []; // Clear safety
                                    useProjectStore.temporal.getState().pause();

                                    // Explicitly add THIS wall
                                    const connected: { wallId: string, pointIndex: number }[] = [
                                        { wallId: wall.id, pointIndex: 0 }
                                    ];

                                    // Find others
                                    const state = useProjectStore.getState();
                                    const p = { x: wall.points[0], y: wall.points[1] };
                                    const others = findConnectedWalls(p, wall.id, state.walls);
                                    draggedWallNodeMap.current = [...connected, ...others];
                                }}
                                onDragEnd={(e) => {
                                    e.cancelBubble = true;
                                    draggedWallNodeMap.current = [];
                                    useProjectStore.temporal.getState().resume();
                                }}
                                onDragMove={(e) => {
                                    e.cancelBubble = true;
                                    let newPos = { x: e.target.x(), y: e.target.y() };
                                    const state = useProjectStore.getState();
                                    // Snap
                                    if (state.layers.walls) {
                                        const draggedIds = draggedWallNodeMap.current.map(d => d.wallId);
                                        const otherWalls = state.walls.filter(w => !draggedIds.includes(w.id));

                                        const snap = getSnapPoint(newPos, otherWalls, anchors, 20 / ((stage?.scaleX() || 1)));
                                        if (snap) {
                                            newPos = snap.point;
                                            e.target.position(newPos);
                                        }
                                    }

                                    // Update specific connected points
                                    draggedWallNodeMap.current.forEach(item => {
                                        const w = state.walls.find(w => w.id === item.wallId);
                                        if (w) {
                                            const newPoints = [...w.points] as [number, number, number, number];
                                            if (item.pointIndex === 0) {
                                                newPoints[0] = newPos.x;
                                                newPoints[1] = newPos.y;
                                            } else {
                                                newPoints[2] = newPos.x;
                                                newPoints[3] = newPos.y;
                                            }
                                            state.updateWall(w.id, { points: newPoints });
                                        }
                                    });
                                }}
                            />
                        );

                        // End Point
                        handles.push(
                            <Circle
                                key={`${id}-end`}
                                name="wall-handle"
                                x={wall.points[2]}
                                y={wall.points[3]}
                                radius={handleRadius}
                                fill="#00aaff"
                                stroke="white"
                                strokeWidth={2 / ((stage?.scaleX() || 1))}
                                draggable={!wallsLocked}
                                onMouseDown={(e) => {
                                    e.cancelBubble = true;
                                }}
                                onDragStart={(e) => {
                                    e.cancelBubble = true;
                                    draggedWallNodeMap.current = []; // Clear safety
                                    useProjectStore.temporal.getState().pause();

                                    // Explicitly add THIS wall
                                    const connected: { wallId: string, pointIndex: number }[] = [
                                        { wallId: wall.id, pointIndex: 2 }
                                    ];

                                    // Find others
                                    const state = useProjectStore.getState();
                                    const p = { x: wall.points[2], y: wall.points[3] };
                                    const others = findConnectedWalls(p, wall.id, state.walls);
                                    draggedWallNodeMap.current = [...connected, ...others];
                                }}
                                onDragEnd={(e) => {
                                    e.cancelBubble = true;
                                    draggedWallNodeMap.current = [];
                                    useProjectStore.temporal.getState().resume();
                                }}
                                onDragMove={(e) => {
                                    e.cancelBubble = true;
                                    let newPos = { x: e.target.x(), y: e.target.y() };
                                    const state = useProjectStore.getState();
                                    // Snap
                                    if (state.layers.walls) {
                                        const draggedIds = draggedWallNodeMap.current.map(d => d.wallId);
                                        const otherWalls = state.walls.filter(w => !draggedIds.includes(w.id));

                                        const snap = getSnapPoint(newPos, otherWalls, anchors, 20 / ((stage?.scaleX() || 1)));
                                        if (snap) {
                                            newPos = snap.point;
                                            e.target.position(newPos);
                                        }
                                    }

                                    // Update specific connected points
                                    draggedWallNodeMap.current.forEach(item => {
                                        const w = state.walls.find(w => w.id === item.wallId);
                                        if (w) {
                                            const newPoints = [...w.points] as [number, number, number, number];
                                            if (item.pointIndex === 0) {
                                                newPoints[0] = newPos.x;
                                                newPoints[1] = newPos.y;
                                            } else {
                                                newPoints[2] = newPos.x;
                                                newPoints[3] = newPos.y;
                                            }
                                            state.updateWall(w.id, { points: newPoints });
                                        }
                                    });
                                }}
                            />
                        );
                    }
                });

                return handles;
            })()}

            {/* Dimension Endpoint Handles */}
            {(() => {
                const state = useProjectStore.getState();
                if (!state.layers.dimensions) return null;

                const selectedDimIds = state.selectedIds.filter(id => state.dimensions.some(d => d.id === id));
                const handles: React.ReactElement[] = [];
                const handleRadius = 6 / (stage?.scaleX() || 1);

                selectedDimIds.forEach(id => {
                    const dim = state.dimensions.find(d => d.id === id);
                    if (!dim) return;

                    // Start Point
                    handles.push(
                        <Circle
                            key={`${id}-start`}
                            x={dim.points[0]}
                            y={dim.points[1]}
                            radius={handleRadius}
                            fill="#00aaff"
                            stroke="white"
                            strokeWidth={2 / ((stage?.scaleX() || 1))}
                            draggable
                            onDragStart={(e) => {
                                e.cancelBubble = true;
                                useProjectStore.temporal.getState().pause();
                            }}
                            onDragEnd={(e) => {
                                e.cancelBubble = true;
                                useProjectStore.temporal.getState().resume();
                            }}
                            onDragMove={(e) => {
                                e.cancelBubble = true;
                                let newPos = { x: e.target.x(), y: e.target.y() };
                                const state = useProjectStore.getState();
                                // Snap
                                const snap = (state.layers.walls || state.layers.anchors) ? getSnapPoint(newPos, walls, anchors, 20 / ((stage?.scaleX() || 1))) : null;
                                if (snap) {
                                    newPos = snap.point;
                                    e.target.position(newPos);
                                }

                                const currentDim = useProjectStore.getState().dimensions.find(d => d.id === id);
                                if (currentDim) {
                                    const newPoints: [number, number, number, number] = [newPos.x, newPos.y, currentDim.points[2], currentDim.points[3]];
                                    const distPx = Math.hypot(newPoints[2] - newPoints[0], newPoints[3] - newPoints[1]);
                                    const distMeters = distPx / state.scaleRatio;
                                    state.updateDimension(id, { points: newPoints, label: `${distMeters.toFixed(2)}m` });
                                }
                            }}
                        />
                    );

                    // End Point
                    handles.push(
                        <Circle
                            key={`${id}-end`}
                            x={dim.points[2]}
                            y={dim.points[3]}
                            radius={handleRadius}
                            fill="#00aaff"
                            stroke="white"
                            strokeWidth={2 / ((stage?.scaleX() || 1))}
                            draggable
                            onDragStart={(e) => {
                                e.cancelBubble = true;
                                useProjectStore.temporal.getState().pause();
                            }}
                            onDragEnd={(e) => {
                                e.cancelBubble = true;
                                useProjectStore.temporal.getState().resume();
                            }}
                            onDragMove={(e) => {
                                e.cancelBubble = true;
                                let newPos = { x: e.target.x(), y: e.target.y() };
                                const state = useProjectStore.getState();
                                // Snap
                                const snap = (state.layers.walls || state.layers.anchors) ? getSnapPoint(newPos, walls, anchors, 20 / ((stage?.scaleX() || 1))) : null;
                                if (snap) {
                                    newPos = snap.point;
                                    e.target.position(newPos);
                                }

                                const currentDim = useProjectStore.getState().dimensions.find(d => d.id === id);
                                if (currentDim) {
                                    const newPoints: [number, number, number, number] = [currentDim.points[0], currentDim.points[1], newPos.x, newPos.y];
                                    const distPx = Math.hypot(newPoints[2] - newPoints[0], newPoints[3] - newPoints[1]);
                                    const distMeters = distPx / state.scaleRatio;
                                    state.updateDimension(id, { points: newPoints, label: `${distMeters.toFixed(2)}m` });
                                }
                            }}
                        />
                    );
                });

                return handles;
                return handles;
            })()}

            {/* Cable Edit Handles */}
            {activeTool === 'cable_edit' && (() => {
                const state = useProjectStore.getState();
                const handles: React.ReactElement[] = [];
                const handleRadius = 5 / (stage?.scaleX() || 1);

                // Helper to render handle
                const renderHandle = (cableId: string, point: Point, index: number, isEndpoint: boolean) => (
                    <Circle
                        key={`cable-${cableId}-${index}`}
                        x={point.x}
                        y={point.y}
                        radius={handleRadius}
                        fill={isEndpoint ? '#f97316' : '#ffffff'} // Orange for endpoints, White for vertices
                        stroke={isEndpoint ? 'white' : '#f97316'}
                        strokeWidth={2 / ((stage?.scaleX() || 1))}
                        draggable
                        onDragStart={(e) => {
                            e.cancelBubble = true;
                            setDragCableHandle({ id: cableId, handle: { type: 'vertex', index }, startPoint: point });
                            useProjectStore.temporal.getState().pause();
                        }}
                        onDragEnd={(e) => {
                            e.cancelBubble = true;
                            setDragCableHandle(null);
                            useProjectStore.temporal.getState().resume();
                        }}
                        onDragMove={(e) => {
                            e.cancelBubble = true;
                            const newPos = { x: e.target.x(), y: e.target.y() };

                            // Find current cable
                            const cable = useProjectStore.getState().cables.find(c => c.id === cableId);
                            if (!cable) return;

                            const newPoints = [...cable.points];

                            // 1. Endpoint Logic (Re-route snapping)
                            if (isEndpoint) {
                                // Snap to Hub/Anchor
                                const snapDist = 20 / (stage?.scaleX() || 1);
                                const hubs = useProjectStore.getState().hubs; // Get Hubs

                                let snappedToId: string | undefined;

                                // Check Hubs
                                const hitHub = hubs.find(h => dist(newPos, h) < snapDist);
                                if (hitHub) {
                                    newPos.x = hitHub.x;
                                    newPos.y = hitHub.y;
                                    snappedToId = hitHub.id;
                                } else {
                                    // Check Anchors (only if not hub hit)
                                    const hitAnchor = anchors.find(a => dist(newPos, a) < snapDist);
                                    if (hitAnchor) {
                                        newPos.x = hitAnchor.x;
                                        newPos.y = hitAnchor.y;
                                        snappedToId = hitAnchor.id;
                                    }
                                }

                                // Update Cable Points visually
                                newPoints[index] = newPos;

                                // If snapped and index is 0 or last, we update connections?
                                // We should probably do this on DragEnd to avoid constant re-routing calculation churn.
                                // For now, just move the point.
                                if (snappedToId) {
                                    // Store provisional snap target in temp state if needed? 
                                    // Actually dragging "by grabbing cable edge will reroute"
                                    if (index === 0) {
                                        // Changing start
                                        useProjectStore.getState().updateCable(cableId, { fromId: snappedToId, points: newPoints });
                                    } else {
                                        // Changing end
                                        useProjectStore.getState().updateCable(cableId, { toId: snappedToId, points: newPoints });
                                    }
                                } else {
                                    // Just updating geometry (detached?) - Requirement says "didnt detouched from anchor/hub".
                                    // This implies dragging cable *body* keeps attachment. 
                                    // But dragging specific endpoint *can* detach/reroute.
                                    useProjectStore.getState().updateCable(cableId, { points: newPoints });
                                }

                            } else {
                                // 2. Internal Vertex Logic
                                newPoints[index] = newPos;
                                useProjectStore.getState().updateCable(cableId, { points: newPoints });
                            }
                        }}
                    />
                );

                state.cables.forEach(cable => {
                    // Render Vertices
                    cable.points.forEach((p, i) => {
                        const isEndpoint = i === 0 || i === cable.points.length - 1;
                        handles.push(renderHandle(cable.id, p, i, isEndpoint));
                    });
                });

                return handles;
            })()}

            {/* Import Selection Contour */}
            {(() => {
                const state = useProjectStore.getState();
                if (state.activeImportId) {
                    const obj = state.importedObjects.find(o => o.id === state.activeImportId);
                    if (obj && obj.visible && !obj.locked) {
                        const scale = obj.scale || 1;
                        let w = (obj.width || 100) * scale;
                        let h = (obj.height || 100) * scale;
                        // For DXF use calculated extents or defaults
                        if (obj.type === 'dxf') {
                            // If user just imported, we rely on width/height from obj
                            w = (obj.width || 100) * scale;
                            h = (obj.height || 100) * scale;

                            // We need to account for offset if extents.min is non-zero?
                            // Currently importDXF assumes 0,0 for now unless we normalise.
                            // The logic in hit test used (minX derived from obj.x). 
                            // Render Rect at obj.x, obj.y with width w, h.
                        }

                        // Determine Start X/Y
                        // Usually obj.x/y is the Top-Left of the image/dxf on the stage.
                        // However, for DXF, if the content starts at (1000, 1000), 
                        // and we put it at obj.x=0, then content is at 1000,1000.
                        // So the BBox should actully be drawn at obj.x + minX*scale?

                        let renderX = obj.x;
                        let renderY = obj.y;

                        if (obj.type === 'dxf' && (obj.data as any).extents) {
                            const minX = (obj.data as any).extents.min.x;
                            const minY = (obj.data as any).extents.min.y;
                            renderX += minX * scale;
                            renderY += minY * scale;
                        }

                        return (
                            <React.Fragment>
                                <Rect
                                    x={renderX}
                                    y={renderY}
                                    width={w}
                                    height={h}
                                    rotation={obj.rotation}
                                    stroke="#00ff00"
                                    strokeWidth={3 / (stage?.scaleX() || 1)}
                                    dash={[10, 5]}
                                    listening={false}
                                />
                                {/* Resize Handles (Corners) - Could add later */}
                                <Circle
                                    x={renderX}
                                    y={renderY}
                                    radius={5 / (stage?.scaleX() || 1)}
                                    fill="#00ff00"
                                    listening={false}
                                />
                                <Circle
                                    x={renderX + w}
                                    y={renderY + h}
                                    radius={5 / (stage?.scaleX() || 1)}
                                    fill="#00ff00"
                                    listening={false}
                                />
                            </React.Fragment>
                        );
                    }
                }
                return null;
            })()}

            {/* Temp Cable Line (Ghost) */}
            {tempCablePath && (
                <Line
                    points={[tempCablePath.start.x, tempCablePath.start.y, tempCablePath.end.x, tempCablePath.end.y]}
                    stroke="#FF9800"
                    strokeWidth={2}
                    dash={[5, 5]}
                    listening={false}
                />
            )}
        </React.Fragment>
    );
};
export default InteractionLayer;

