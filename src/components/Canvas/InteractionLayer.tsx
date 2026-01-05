import React, { useEffect, useState, useRef } from 'react';
import Konva from 'konva';
import { Line, Circle, Rect } from 'react-konva';
import { useProjectStore } from '../../store/useProjectStore';
import { applyOrthogonal, getSnapPoint, dist } from '../../utils/geometry';
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
const isPointNearWall = (p: Point, w: any, tolerance: number) => {
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
    console.log("InteractionLayer mounted - Force Refresh");
    const { activeTool, addWall, addWalls, addAnchor, setTool, walls, anchors, setSelection, wallPreset, standardWallThickness, thickWallThickness, wideWallThickness, setAnchorMode, removeWall, removeAnchor, updateAnchors, removeDimension, dimensions, anchorRadius, theme } = useProjectStore();

    if (!stage) return null;

    const colors = THEME_COLORS[theme || 'dark'] || THEME_COLORS.dark;

    const [points, setPoints] = useState<Point[]>([]);
    const [chainStart, setChainStart] = useState<Point | null>(null);
    const [currentMousePos, setCurrentMousePos] = useState<Point | null>(null);
    const [isShiftDown, setIsShiftDown] = useState(false);

    // Rectangle Wall State
    const [rectStart, setRectStart] = useState<Point | null>(null);
    const [rectEdgeStart, setRectEdgeStart] = useState<Point | null>(null);
    const [rectEdgeBaseEnd, setRectEdgeBaseEnd] = useState<Point | null>(null);

    // Selection State
    const [selectionStart, setSelectionStart] = useState<Point | null>(null);
    const [selectionRect, setSelectionRect] = useState<{ x: number, y: number, width: number, height: number } | null>(null);

    // Panning State
    const [isPanning, setIsPanning] = useState(false);
    const lastPanPos = useRef<Point | null>(null);
    const panStartTime = useRef<number>(0);
    const lastDragPos = useRef<Point | null>(null);
    const isMouseDown = useRef(false);
    // const isHistoryPaused = useRef(false); // Removed unused


    // Text Drag State (Ref)
    const dragTextId = useRef<string | null>(null);
    // Anchor Drag State (Ref)
    const dragAnchorId = useRef<string | null>(null);
    // Dimension Line Drag State (Ref)
    const dragDimLineId = useRef<string | null>(null);



    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if User is typing in an Input or Textarea
            const activeTag = document.activeElement?.tagName.toLowerCase();
            if (activeTag === 'input' || activeTag === 'textarea') return;
            if (e.key === 'Shift') setIsShiftDown(true);

            // Shortcuts
            if (e.key === 'Escape') {
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
            if ((e.key === 'Delete' || e.key === 'Backspace')) {
                const currentSelectedIds = useProjectStore.getState().selectedIds;
                const PLACEMENT_AREA_ID = 'placement_area_poly'; // Define constant locally or import

                if (currentSelectedIds.length > 0) {
                    currentSelectedIds.forEach(id => {
                        if (id === PLACEMENT_AREA_ID) {
                            useProjectStore.getState().setPlacementArea(null);
                        } else {
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
            if (activeTool !== 'scale') { // Don't interrupt scale calib if typing? (though no typing there)
                const key = e.key.toLowerCase();

                // Undo / Redo
                if ((e.ctrlKey || e.metaKey) && key === 'z') {
                    e.preventDefault();
                    if (e.shiftKey) {
                        useProjectStore.temporal.getState().redo();
                    } else {
                        // Custom Undo for Wall Tool Chain
                        if (activeTool === 'wall' && points.length > 0) {
                            // Capture the wall that is about to be undone (the last one)
                            const wallsBefore = useProjectStore.getState().walls;
                            const wallToUndo = wallsBefore.length > 0 ? wallsBefore[wallsBefore.length - 1] : null;

                            useProjectStore.temporal.getState().undo();

                            if (wallToUndo) {
                                // Set cursor to the START of the undone wall
                                setPoints([{ x: wallToUndo.points[0], y: wallToUndo.points[1] }]);
                                setChainStart({ x: wallToUndo.points[0], y: wallToUndo.points[1] });
                            } else {
                                // Valid reset if we undid the first wall
                                setPoints([]);
                                setChainStart(null);
                            }
                        } else {
                            useProjectStore.temporal.getState().undo();
                        }
                    }
                    return;
                }
                if ((e.ctrlKey || e.metaKey) && key === 'y') {
                    e.preventDefault();
                    useProjectStore.temporal.getState().redo();
                    return;
                }

                // Group / Ungroup Anchors
                if ((e.ctrlKey || e.metaKey) && key === 'g') {
                    e.preventDefault();
                    if (e.shiftKey) {
                        // Ungroup
                        const selectedIds = useProjectStore.getState().selectedIds;
                        useProjectStore.getState().ungroupAnchors(selectedIds);
                    } else {
                        // Group
                        const selectedIds = useProjectStore.getState().selectedIds;
                        useProjectStore.getState().groupAnchors(selectedIds);
                    }
                    return;
                }

                // Delete / Backspace
                if (key === 'delete' || key === 'backspace') {
                    const state = useProjectStore.getState();

                    // Remove Selected Items
                    if (state.selectedIds.length > 0) {
                        state.selectedIds.forEach(id => {
                            state.removeWall(id);
                            state.removeAnchor(id);
                            state.removeDimension(id);
                        });
                        setSelection([]);
                    }

                    // Remove Active Import
                    if (state.activeImportId) {
                        state.removeImportedObject(state.activeImportId);
                    }
                }

                if (key === 'v') setTool('select');
                if (key === 'w') setTool('wall');
                if (key === 'r') setTool('wall_rect');
                if (key === 'd') setTool('dimension');
                if (key === 's') setTool('scale');

                if (key === 'a') {
                    if (e.shiftKey) {
                        setTool('anchor_auto');
                        setAnchorMode('auto');
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
    }, [setTool, setSelection, setAnchorMode, activeTool, points]); // Added points to deps

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (activeTool === 'select' || activeTool.startsWith('wall') || activeTool.startsWith('anchor')) {
                if (e.key.toLowerCase() === 'r' && e.shiftKey) {
                    setTool('wall_rect_edge');
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeTool, setTool]);

    // Interaction Handlers (Moved to Top Level)

    const getStagePoint = (): Point | null => {
        const pos = stage.getPointerPosition();
        if (!pos) return null;
        const scale = stage.scaleX();
        return {
            x: (pos.x - stage.x()) / scale,
            y: (pos.y - stage.y()) / scale,
        };
    };

    const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
        const stagePos = stage.getPointerPosition();
        if (!stagePos) return;
        const pos = getStagePoint();
        if (!pos) return;

        isMouseDown.current = true;

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
                        // So the group is at x,y. The content is at x + v.x, y + v.y.

                        // If calculating extents, we found minX, minY.
                        // Usually we want to normalize so (0,0) is top-left.
                        // BUT CURRENTLY we don't normalize vertices in importDXF.
                        // So the content is drawn at various places.

                        // If we want selection to work nicely, we should probably normalize the DXF content 
                        // so that (0,0) is minX, minY. OR we store minX/minY in the object and use it here.

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

                dragAnchorId.current = anchorId;
                lastDragPos.current = pos;
                useProjectStore.temporal.getState().pause(); // Pause Undo History
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
            const hitWall = getHitWall(pos, state.walls, 10 / stage.scaleX());

            // If we clicked a wall
            if (hitWall) {
                const isSelected = state.selectedIds.includes(hitWall.id);
                let targetIds = isSelected ? state.selectedIds : [hitWall.id];

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
                const snap = (state.layers.walls || state.layers.anchors) ? getSnapPoint(pos, walls, anchors, 20 / stage.scaleX()) : null;
                setPoints([snap ? snap.point : pos]);
            }
            // Wall Tool
        } else if (activeTool === 'wall') {
            if (e.evt.button === 0) {
                let finalPos = pos;
                // Check if snapping allowed (hidden layer = no snap)
                const state = useProjectStore.getState();
                const snap = state.layers.walls ? getSnapPoint(pos, walls, anchors, 20 / (stage.scaleX())) : null;

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
            if (e.evt.button === 0) {
                let finalPos = pos;
                const state = useProjectStore.getState();
                const snap = state.layers.walls ? getSnapPoint(pos, walls, anchors, 20 / (stage.scaleX())) : null;
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

                        const snapP3 = state.layers.walls ? getSnapPoint(p3, walls, anchors, 20 / (stage.scaleX())) : null;
                        if (snapP3 && snapP3.type === 'edge' && snapP3.id) state.splitWall(snapP3.id, snapP3.point);

                        const snapP4 = state.layers.walls ? getSnapPoint(p4, walls, anchors, 20 / (stage.scaleX())) : null;
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
            if (e.evt.button === 0) {
                let finalPos = pos;
                const state = useProjectStore.getState();
                const snap = state.layers.walls ? getSnapPoint(pos, walls, anchors, 20 / (stage.scaleX())) : null;
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

                    const snapP3 = state.layers.walls ? getSnapPoint(p3, walls, anchors, 20 / (stage.scaleX())) : null;
                    if (snapP3 && snapP3.type === 'edge' && snapP3.id) state.splitWall(snapP3.id, snapP3.point);

                    const snapP4 = state.layers.walls ? getSnapPoint(p4, walls, anchors, 20 / (stage.scaleX())) : null;
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

            // Select Tool
        } else if (activeTool === 'select') {
            if (e.evt.button === 0) {
                setSelectionStart(pos);
            }

            // Placement Area Tool (Orange Zone)
        } else if (activeTool === 'placement_area') {
            if (e.evt.button === 0) {
                const state = useProjectStore.getState();
                let currentPoints = state.placementArea?.points || [];

                // If no points, start new
                if (currentPoints.length === 0) {
                    state.setPlacementArea({ points: [pos] });
                    return;
                }

                // Check for Closing (Click near start)
                const start = currentPoints[0];
                const d = dist(pos, start);
                // Tolerance 10px screen space
                const tolerance = 10 / stage.scaleX();

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
        }
    };

    const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
        const pos = getStagePoint();
        if (!pos) return;

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
            const stagePos = stage.getPointerPosition();
            if (stagePos) {
                const dx = stagePos.x - lastPanPos.current.x;
                const dy = stagePos.y - lastPanPos.current.y;
                stage.position({ x: stage.x() + dx, y: stage.y() + dy });
                lastPanPos.current = { x: stagePos.x, y: stagePos.y };
                stage.batchDraw();
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

        // Tool Mouse Move checks...
        if (activeTool === 'wall' || activeTool === 'wall_rect' || activeTool === 'wall_rect_edge' || activeTool === 'dimension') {
            const state = useProjectStore.getState();
            const snap = (state.layers.walls || state.layers.anchors) ? getSnapPoint(pos, walls, anchors, 20 / (stage.scaleX())) : null;
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
        }
    };

    const handleMouseUp = (e: Konva.KonvaEventObject<MouseEvent>) => {
        isMouseDown.current = false;
        setIsPanning(false);

        // Resume History if we were dragging
        if (dragTextId.current || dragAnchorId.current || dragDimLineId.current) {
            useProjectStore.temporal.getState().resume();

            // FORCE COMMIT: Trigger a state update to save the "End" position in history
            // This is needed because changes made while paused are not "pushed" to the stack automatically on resume.

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

        dragTextId.current = null;
        dragAnchorId.current = null;
        dragDimLineId.current = null;
        lastDragPos.current = null;

        // Dimension Tool Click Detection (for Wall Auto-Dim)
        if (activeTool === 'dimension' && points.length === 1) {
            const stagePos = stage.getPointerPosition();
            if (!stagePos) return;
            const pos = getStagePoint();
            if (!pos) return;

            const start = points[0];
            const distMoved = dist(start, pos);

            // If moved very little (< 5px), treat as CLICK (Auto Wall Dim)
            const clickTol = 5 / stage.scaleX();

            if (distMoved < clickTol) {
                // Check logic for Wall Dim
                const clickPos = pos;
                const tol = 10 / stage.scaleX();
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
                    // Found wall on CLICK -> Auto Dim
                    // Create Wall Dimension
                    const x1 = hitWall.points[0];
                    const y1 = hitWall.points[1];
                    const x2 = hitWall.points[2];
                    const y2 = hitWall.points[3];
                    const dx = x2 - x1;
                    const dy = y2 - y1;
                    const len = Math.hypot(dx, dy);
                    const nx = -dy / len;
                    const ny = dx / len;
                    const offset = 30 / (stage.scaleX() || 1);

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

                    // Scale check
                    const scaleRatio = useProjectStore.getState().scaleRatio;
                    const distMeters = len / scaleRatio;

                    useProjectStore.getState().addDimension({
                        points: [dimX1, dimY1, dimX2, dimY2],
                        type: 'wall',
                        label: `${distMeters.toFixed(2)}m`
                    });

                    // Reset points (cancel the free dim start)
                    setPoints([]);
                } else {
                    // Clicked empty space? 
                    // Treat as valid point 1, wait for click 2.
                    // Do nothing, points[0] stays.
                }
            } else {
                // Drags (> clickTol)
                // If we dragged and released, we should FINISH the dim (Drag-to-Measure behavior)
                // "Click and pressing without release" -> Drag behavior.
                // On Release:
                const state = useProjectStore.getState();
                const snap = (state.layers.walls || state.layers.anchors) ? getSnapPoint(pos, walls, anchors, 20 / stage.scaleX()) : null;
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
        // Handle Drag-to-Release for Rect Tools
        if (e.evt.button === 0) {
            const pos = getStagePoint(); // Raw pos
            if (!pos) return;

            // Snap for MouseUp
            let finalPos = pos;
            let snap: import('../../utils/geometry').SnapResult | null = null;
            const state = useProjectStore.getState();
            if ((activeTool === 'wall_rect' || activeTool === 'wall_rect_edge') && state.layers.walls) {
                snap = getSnapPoint(pos, walls, anchors, 20 / (stage.scaleX()));
                if (snap) finalPos = snap.point;
            }

            if (activeTool === 'wall_rect') {
                if (rectStart) {
                    // If we dragged far enough, treat MouseUp as the end click
                    if (dist(rectStart, finalPos) > 0.2) { // 20cm threshold to distinguish click vs drag
                        const x1 = rectStart.x;
                        const y1 = rectStart.y;
                        const x2 = finalPos.x;
                        const y2 = finalPos.y;

                        if (Math.abs(x1 - x2) > 0.1 || Math.abs(y1 - y2) > 0.1) {
                            // Auto-Split for End Point
                            if (snap && snap.type === 'edge' && snap.id) {
                                state.splitWall(snap.id, snap.point);
                            }

                            // Check Implicit Points (p3, p4) for Splitting
                            const p3 = { x: x2, y: y1 };
                            const p4 = { x: x1, y: y2 };

                            const snapP3 = state.layers.walls ? getSnapPoint(p3, walls, anchors, 20 / (stage.scaleX())) : null;
                            if (snapP3 && snapP3.type === 'edge' && snapP3.id) state.splitWall(snapP3.id, snapP3.point);

                            const snapP4 = state.layers.walls ? getSnapPoint(p4, walls, anchors, 20 / (stage.scaleX())) : null;
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
                    // Phase 3: Height (Drag Release)
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

                        // Check Splitting for all 4 corners
                        if (snap && snap.type === 'edge' && snap.id) state.splitWall(snap.id, snap.point);

                        const p3 = { x: p3x, y: p3y };
                        const p4 = { x: p4x, y: p4y };
                        const snapP3 = state.layers.walls ? getSnapPoint(p3, walls, anchors, 20 / (stage.scaleX())) : null;
                        if (snapP3 && snapP3.type === 'edge' && snapP3.id) state.splitWall(snapP3.id, snapP3.point);
                        const snapP4 = state.layers.walls ? getSnapPoint(p4, walls, anchors, 20 / (stage.scaleX())) : null;
                        if (snapP4 && snapP4.type === 'edge' && snapP4.id) state.splitWall(snapP4.id, snapP4.point);

                        // Note: P1 and P2 splits were handled in previous steps/clicks, but could re-check if dragged? 
                        // P1 was set at start. P2 set at Phase 2. Height drag only changes P3/P4.
                        // But wait, the MouseUp here is defining the final pos. 
                        // If snap is valid, it's splitting at the *mouse* position, which is on the P3-P4 line.
                        // Actually, finalPos is strictly the mouse. The P3/P4 are projected.
                        // So snap.point might not be exactly P3 or P4 if we project.
                        // Nevermind, for now let's apply standard logic.

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
                // Check if it was a CLICK (short distance pan)
                checkRMBClick(e);
                lastPanPos.current = null;
            }
        }

        if (e.evt.button === 0 && activeTool === 'select') {
            const hasDragRect = selectionRect && (selectionRect.width > 0.5 || selectionRect.height > 0.5);

            const getIdsInRect = (rect: { minX: number, maxX: number, minY: number, maxY: number }, isCrossing: boolean): string[] => {
                const foundIds: string[] = [];
                const state = useProjectStore.getState();

                // Check Walls
                if (state.layers.walls) {
                    walls.forEach(w => {
                        const wx1 = w.points[0]; const wy1 = w.points[1];
                        const wx2 = w.points[2]; const wy2 = w.points[3];
                        const wMinX = Math.min(wx1, wx2); const wMaxX = Math.max(wx1, wx2);
                        const wMinY = Math.min(wy1, wy2); const wMaxY = Math.max(wy1, wy2);

                        const isEnclosed = wMinX >= rect.minX && wMaxX <= rect.maxX &&
                            wMinY >= rect.minY && wMaxY <= rect.maxY;

                        if (!isCrossing) {
                            if (isEnclosed) foundIds.push(w.id);
                        } else {
                            if (wMaxX < rect.minX || wMinX > rect.maxX || wMaxY < rect.minY || wMinY > rect.maxY) return;
                            foundIds.push(w.id);
                        }
                    });
                }

                // Check Dimensions
                if (state.layers.dimensions) {
                    dimensions.forEach(d => {
                        const dx1 = d.points[0]; const dy1 = d.points[1];
                        const dx2 = d.points[2]; const dy2 = d.points[3];
                        const dMinX = Math.min(dx1, dx2); const dMaxX = Math.max(dx1, dx2);
                        const dMinY = Math.min(dy1, dy2); const dMaxY = Math.max(dy1, dy2);

                        const isEnclosed = dMinX >= rect.minX && dMaxX <= rect.maxX &&
                            dMinY >= rect.minY && dMaxY <= rect.maxY;

                        if (!isCrossing) {
                            if (isEnclosed) foundIds.push(d.id);
                        } else {
                            if (dMaxX < rect.minX || dMinX > rect.maxX || dMaxY < rect.minY || dMinY > rect.maxY) return;
                            foundIds.push(d.id);
                        }
                    });
                }

                // Check Anchors (Point check)
                if (state.layers.anchors) {
                    anchors.forEach(a => {
                        const ax = a.x;
                        const ay = a.y;
                        // Treat anchor as small point/box
                        const isEnclosed = ax >= rect.minX && ax <= rect.maxX &&
                            ay >= rect.minY && ay <= rect.maxY;

                        if (isEnclosed) {
                            foundIds.push(a.id);
                        }
                    });
                }

                // Check Imported Objects (Image / DXF) - ONLY if Alt + Drag (Box Selection)
                // If regular selection box, we can also include them if we want unified selection.
                // User request: "alt+squere select". But usually imports are passive unless alt is held? or just selection tool?
                // Let's assume selection tool selects everything.

                // Check Imported Objects (Image / DXF) - ONLY if Alt + Drag (Box Selection)
                // If regular selection box, we can also include them if we want unified selection.
                // User request: "alt+squere select". But usually imports are passive unless alt is held? or just selection tool?
                // Let's assume selection tool selects everything.

                if (e.evt.altKey) {
                    state.importedObjects.forEach(obj => {
                        if (!obj.visible || obj.locked) return;

                        // We need width/height. If not present (legacy DXF), we skip or treat as point?
                        // Images have width/height.
                        const w = (obj.width || 0) * obj.scale;
                        const h = (obj.height || 0) * obj.scale;

                        if (w <= 0 || h <= 0) return;

                        const objMinX = obj.x;
                        const objMaxX = obj.x + w;
                        const objMinY = obj.y;
                        const objMaxY = obj.y + h;

                        if (!isCrossing) {
                            // Enclosed (Window Select)
                            const isEnclosed = objMinX >= rect.minX && objMaxX <= rect.maxX &&
                                objMinY >= rect.minY && objMaxY <= rect.maxY;
                            if (isEnclosed) {
                                // We don't have multi-select for imports yet effectively in UI (only activeImportId).
                                // But we can set the LAST found one as active?
                                // Or if multiple found?
                                // Store only supports one activeImportId.
                                // So we pick the first or last one.
                                // Let's modify logic: if found, set activeImportId.
                                // But this function returns IDs for main selection (walls/anchors).
                                // Imports are separate state.
                                // We should handle imports separately outside this loop or mix them?
                                // Current requirement: "dxf will be selected"
                                // Let's add a side effect or return it.
                                state.setActiveImportId(obj.id);
                                // NOTE: This sets it immediately during loop. 
                                // If multiple, last one wins. This works for now.
                            }
                        } else {
                            // Crossing (Crossing Select)
                            // AABB Intersection
                            if (objMaxX < rect.minX || objMinX > rect.maxX || objMaxY < rect.minY || objMinY > rect.maxY) return;
                            state.setActiveImportId(obj.id);
                        }
                    });
                }

                return foundIds;
            };

            if (hasDragRect && selectionStart && currentMousePos && selectionRect) {
                // Box Select
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
                // Single Click Logic
                const clickPos = getStagePoint();
                if (clickPos) {
                    let idsToSelect: string[] = [];
                    const tol = 10 / (stage.scaleX() || 1);

                    // Check Direct Click on Text
                    if (e.target.name() === 'dim-text') {
                        const rawId = e.target.id();
                        idsToSelect = [rawId.replace('dim-text-', '')];
                    }

                    // Check Dimensions Line if text not hit
                    if (idsToSelect.length === 0 && useProjectStore.getState().layers.dimensions) {
                        for (const d of dimensions) {
                            if (isPointNearLine(clickPos, d.points[0], d.points[1], d.points[2], d.points[3], tol)) {
                                idsToSelect = [d.id];
                                break;
                            }
                        }
                    }

                    // If no dim, check walls
                    if (idsToSelect.length === 0 && useProjectStore.getState().layers.walls) {
                        for (const w of walls) {
                            if (isPointNearWall(clickPos, w, tol)) {
                                // Found a wall! 
                                // Ctrl+Click -> Select Chain
                                // Simple Click -> Select Single
                                if (e.evt.ctrlKey) {
                                    idsToSelect = getAllConnectedWalls(w.id, walls);
                                } else {
                                    idsToSelect = [w.id];
                                }
                                break;
                            }
                        }
                    }

                    // Check Anchors (if still nothing found?) 
                    // Actually original logic didn't check anchors here??
                    // Wait, previous code ended at check walls...
                    // Let's verify if anchors were checked. 
                    // Ah, line 1400 (context menu) checks anchors. InteractionLayer might rely on Anchor Object click bubbling?
                    // Or maybe I missed anchor check in the viewing.
                    // But let's stick to replacing what I see.
                    // If logic was missing anchor check here, maybe anchors handle their own clicks?
                    // "AnchorsLayer" renders Circle/Rect.
                    // Usually they have onClick handlers?
                    // Let's assume Anchors handle themselves OR this block is for "background" items.
                    // I will preserve the logic I'm replacing (Dims & Walls).

                    // Wait, looking at lines 1250-1300 I viewed earlier, I didn't see Anchor check.
                    // Maybe Anchors are handled separately?
                    // But walls needed this manual check because `WallsLayer` has `listening={false}` on boundary?
                    // Anchors usually have `listening={true}`.
                    // So if I click an anchor, it might fire its own event?
                    // But `InteractionLayer` covers everything?
                    // `InteractionLayer` is a `Layer`. It is above or below?
                    // Usually Interaction is TOP.
                    // If it catches the event, it stops propagation?
                    // `handleMouseUp` uses `e.target`.
                    // If I click an anchor, `e.target` is the anchor.
                    // But `isPointNearWall` uses geometry.

                    // Let's just implement the logic for Dims and Walls as seen.

                    if (idsToSelect.length > 0) {
                        if (isShiftDown) {
                            const current = useProjectStore.getState().selectedIds;
                            // Add new ones that aren't already selected
                            const newIds = idsToSelect.filter(id => !current.includes(id));
                            // If all already selected, maybe deselect them?
                            // Standard behavior: Toggle.
                            // If I click a group, and ANY are new, add them.
                            // If ALL are present, remove them?
                            if (newIds.length > 0) {
                                setSelection([...current, ...newIds]);
                            } else {
                                // All present, remove them
                                setSelection(current.filter(id => !idsToSelect.includes(id)));
                            }
                        } else {
                            setSelection(idsToSelect);
                        }
                    } else {
                        // If clicking on empty space (and not handled by other layers?):
                        // But wait, if I click an Anchor, `e.target` would be the anchor.
                        // This block runs if `activeTool === 'select'`.
                        // If e.target is NOT the stage, maybe we shouldn't deselect?
                        // But InteractionLayer is a transparent Rect?
                        // If `e.target` is the InteractionLayer rect, then we clicked 'nothing'.
                        // If `e.target` is an Anchor, we should respect it?
                        // But my manual check didn't check anchors.
                        // If I click an anchor, `idsToSelect` is empty.
                        // Then I deselect.
                        // THIS IS A BUG if anchors rely on bubbling.
                        // If interaction layer covers them, bubbling doesn't reach them?
                        // Or `InteractionLayer` IS the listener.

                        // Let's check `e.target`.
                        // If `e.target` has a specific name/id?
                        // `handleMouseUp` is on `Stage`? No, `onMouseUp` on `Stage`.
                        // So `e.target` works.
                        // If `e.target` is an anchor, we should identify it.

                        // BUT, I'll defer fixing "Anchor Selection" if it's not broken.
                        // The existing code at 1280 deselected everything if no wall/dim found.
                        // If anchors were working, they must be checked elsewhere or I missed the code.
                        // Re-reading code around 1280...
                        // `if (foundId) ... else { if (!isShiftDown) setSelection([]); }`
                        // This implies clicking an anchor (if not detected here) would DESELECT everything.
                        // So anchors MUST be detecting here OR `e.target` check handles them?

                        // Wait, I see "Check Direct Click on Text".
                        // Maybe anchors are checked too?
                        // I'll assume they are handled by their own onClick handlers which might set selection?
                        // But verify: Does `onClick` run before `onMouseUp` on Stage?
                        // Konva event order...

                        // Safe bet: Only deselect if we are sure we hit "nothing".
                        // Simply changing `foundId` logic to `idsToSelect` usage keeps behavior same for walls/dims.
                        // I will keep the `else { setSelection([]) }`.

                        if (!isShiftDown) {
                            setSelection([]);
                            useProjectStore.getState().setActiveImportId(null);
                        }
                    }
                }
            }
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

    // Helper to check if we should show menu
    const checkRMBClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
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
            } else {
                // Clicked background or other
                // If we have selected anchors, show menu for them
                const selectedAnchors = state.anchors.filter(a => currentSelection.includes(a.id));
                if (selectedAnchors.length > 0) {
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

    // Bind Events to Stage
    useEffect(() => {
        if (!stage) return;

        stage.on('mousedown', handleMouseDown);
        stage.on('mousemove', handleMouseMove);
        stage.on('mouseup', handleMouseUp);
        stage.on('dblclick', handleDblClick);
        stage.on('contextmenu', handleContextMenu);

        // Global key handler is attached to window in useEffect (above)

        return () => {
            stage.off('mousedown', handleMouseDown);
            stage.off('mousemove', handleMouseMove);
            stage.off('mouseup', handleMouseUp);
            stage.off('dblclick', handleDblClick);
            stage.off('contextmenu', handleContextMenu);
        };
    }, [stage, handleMouseDown, handleMouseMove, handleMouseUp, handleDblClick, handleContextMenu]);

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
                    radius={5 / (stage?.scaleX() || 1)}
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

            {/* Wall Endpoint Handles */}
            {(() => {
                const state = useProjectStore.getState();
                // Check if Wall Layer is visible
                if (!state.layers.walls) return null;

                const selectedWallIds = state.selectedIds.filter(id => state.walls.some(w => w.id === id));

                const handles: JSX.Element[] = [];
                const handleRadius = 6 / (stage?.scaleX() || 1);

                selectedWallIds.forEach(id => {
                    const wall = state.walls.find(w => w.id === id);
                    if (!wall) return;

                    // Start Point
                    handles.push(
                        <Circle
                            key={`${id}-start`}
                            x={wall.points[0]}
                            y={wall.points[1]}
                            radius={handleRadius}
                            fill="#00aaff"
                            stroke="white"
                            strokeWidth={2 / (stage.scaleX())}
                            draggable
                            onDragStart={(e) => {
                                e.cancelBubble = true;
                            }}
                            onDragMove={(e) => {
                                e.cancelBubble = true;
                                let newPos = { x: e.target.x(), y: e.target.y() };
                                const state = useProjectStore.getState();
                                // Snap
                                if (state.layers.walls) {
                                    const otherWalls = state.walls.filter(w => w.id !== id);
                                    const snap = getSnapPoint(newPos, otherWalls, anchors, 20 / (stage.scaleX()));
                                    if (snap) {
                                        newPos = snap.point;
                                        e.target.position(newPos);
                                    }
                                }

                                const currentWall = useProjectStore.getState().walls.find(w => w.id === id);
                                if (currentWall) {
                                    // This handle is START [0,1]
                                    state.updateWallPoint(currentWall.points[0], currentWall.points[1], newPos.x, newPos.y);
                                }
                            }}
                        />
                    );

                    // End Point
                    handles.push(
                        <Circle
                            key={`${id}-end`}
                            x={wall.points[2]}
                            y={wall.points[3]}
                            radius={handleRadius}
                            fill={colors.preview}
                            stroke={colors.anchorStroke}
                            strokeWidth={2 / (stage.scaleX())}
                            draggable
                            onDragStart={(e) => e.cancelBubble = true}
                            onDragMove={(e) => {
                                e.cancelBubble = true;
                                let newPos = { x: e.target.x(), y: e.target.y() };
                                const state = useProjectStore.getState();
                                // Snap
                                if (state.layers.walls) {
                                    const otherWalls = state.walls.filter(w => w.id !== id);
                                    const snap = getSnapPoint(newPos, otherWalls, anchors, 20 / (stage.scaleX()));
                                    if (snap) {
                                        newPos = snap.point;
                                        e.target.position(newPos);
                                    }
                                }

                                const currentWall = useProjectStore.getState().walls.find(w => w.id === id);
                                if (currentWall) {
                                    // This handle is END [2,3]
                                    state.updateWallPoint(currentWall.points[2], currentWall.points[3], newPos.x, newPos.y);
                                }
                            }}
                        />
                    );
                });

                return handles;
            })()}

            {/* Dimension Endpoint Handles */}
            {(() => {
                const state = useProjectStore.getState();
                if (!state.layers.dimensions) return null;

                const selectedDimIds = state.selectedIds.filter(id => state.dimensions.some(d => d.id === id));
                const handles: JSX.Element[] = [];
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
                            strokeWidth={2 / (stage.scaleX())}
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
                                const snap = (state.layers.walls || state.layers.anchors) ? getSnapPoint(newPos, walls, anchors, 20 / (stage.scaleX())) : null;
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
                            strokeWidth={2 / (stage.scaleX())}
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
                                const snap = (state.layers.walls || state.layers.anchors) ? getSnapPoint(newPos, walls, anchors, 20 / (stage.scaleX())) : null;
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
        </React.Fragment>
    );
};
export default InteractionLayer;
