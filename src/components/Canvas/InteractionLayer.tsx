import React, { useEffect, useState, useRef } from 'react';
import Konva from 'konva';
import { Line, Circle, Rect } from 'react-konva';
import { useProjectStore } from '../../store/useProjectStore';
import { applyOrthogonal, getSnapPoint } from '../../utils/geometry';
import type { Point } from '../../utils/geometry';

interface InteractionLayerProps {
    stage: Konva.Stage | null;
    onOpenMenu?: (x: number, y: number, options: { label?: string; action?: () => void; type?: 'separator' }[]) => void;
    onOpenScaleModal?: (pixelDistance: number) => void;
}

const getWallParams = (preset: string, standard: number, thick: number, wide: number) => {
    switch (preset) {
        case 'thick': return { thickness: thick, attenuation: 20 };
        case 'wide': return { thickness: wide, attenuation: 25 };
        default: return { thickness: standard, attenuation: 15 };
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

export const InteractionLayer: React.FC<InteractionLayerProps> = ({ stage, onOpenMenu, onOpenScaleModal }) => {
    const { activeTool, addWall, addWalls, addAnchor, setTool, walls, anchors, setSelection, wallPreset, standardWallThickness, thickWallThickness, wideWallThickness, selectedIds, setAnchorMode, removeWall, removeAnchor, updateAnchors, removeDimension, dimensions, anchorRadius } = useProjectStore();
    const [points, setPoints] = useState<Point[]>([]);
    const [chainStart, setChainStart] = useState<Point | null>(null);
    const [currentMousePos, setCurrentMousePos] = useState<Point | null>(null);
    const [isShiftDown, setIsShiftDown] = useState(false);

    // Rectangle Wall State
    // const [rectStart, setRectStart] = useState<Point | null>(null); // keeping previous state var
    const [rectStart, setRectStart] = useState<Point | null>(null);

    // Selection State
    const [selectionStart, setSelectionStart] = useState<Point | null>(null);
    const [selectionRect, setSelectionRect] = useState<{ x: number, y: number, width: number, height: number } | null>(null);

    // Panning State
    const [isPanning, setIsPanning] = useState(false);
    const lastPanPos = useRef<Point | null>(null);
    const panStartTime = useRef<number>(0);
    const lastDragPos = useRef<Point | null>(null);
    const isMouseDown = useRef(false);
    const isHistoryPaused = useRef(false);


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
                setTool('select'); // Escape goes to select
                setSelectionStart(null);
                setSelectionRect(null);
                setSelection([]);
                dragTextId.current = null;
                dragAnchorId.current = null;
            }

            // Delete / Backspace
            if ((e.key === 'Delete' || e.key === 'Backspace')) {
                // Fix: Access fresh state directly
                const currentSelectedIds = useProjectStore.getState().selectedIds;
                if (currentSelectedIds.length > 0) {
                    currentSelectedIds.forEach(id => {
                        removeWall(id);
                        removeAnchor(id);
                        removeDimension(id);
                    });
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
        if (!stage) return;

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



            // RMB Pan Start
            if (e.evt.button === 2) {
                // If hitting anchor, don't pan, let context menu handle it
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
                if (!points.length) {
                    // Smart Dim Logic
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

                        // Recalculate dist for label
                        const scaleRatio = useProjectStore.getState().scaleRatio;
                        const distMeters = len / scaleRatio;

                        useProjectStore.getState().addDimension({
                            points: [dimX1, dimY1, dimX2, dimY2],
                            type: 'wall',
                            label: `${distMeters.toFixed(2)}m`
                        });

                        // Continuous Drawing: Stay in 'dimension' tool
                        setTool('dimension');
                    } else {
                        // Start Free Dim
                        setPoints([pos]);
                    }
                } else {
                    // End Free Dim
                    const start = points[0];
                    const end = pos;
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
                    // Continuous Drawing
                }

                // Wall Tool
            } else if (activeTool === 'wall') {
                if (e.evt.button === 0) {
                    let finalPos = pos;
                    // Check if snapping allowed (hidden layer = no snap)
                    const state = useProjectStore.getState();
                    const snap = state.layers.walls ? getSnapPoint(pos, walls, 20 / (stage.scaleX())) : null;

                    if (snap) {
                        finalPos = snap.point;

                        // Auto-Split Logic
                        if (snap.type === 'edge' && snap.wallId) {
                            state.splitWall(snap.wallId, snap.point);
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
                                material: 'concrete',
                                ...getWallParams(wallPreset, standardWallThickness, thickWallThickness, wideWallThickness)
                            });
                        }
                        // Continue chain
                        setPoints([end]);
                    }
                }

                // Rect Tool
            } else if (activeTool === 'wall_rect') {
                if (e.evt.button === 0) {
                    if (!rectStart) {
                        setRectStart(pos);
                        setCurrentMousePos(pos);
                    } else {
                        const x1 = rectStart.x;
                        const y1 = rectStart.y;
                        const x2 = pos.x;
                        const y2 = pos.y;

                        if (Math.abs(x1 - x2) > 0.1 && Math.abs(y1 - y2) > 0.1) {
                            const params = getWallParams(wallPreset, standardWallThickness, thickWallThickness, wideWallThickness);
                            const material = 'concrete';

                            addWalls([
                                { points: [x1, y1, x2, y1], material, ...params },
                                { points: [x2, y1, x2, y2], material, ...params },
                                { points: [x2, y2, x1, y2], material, ...params },
                                { points: [x1, y2, x1, y1], material, ...params }
                            ]);
                        }
                        setRectStart(null);
                        setCurrentMousePos(null);
                        // Continuous Drawing
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
            if (activeTool === 'wall') {
                const state = useProjectStore.getState();
                const snap = state.layers.walls ? getSnapPoint(pos, walls, 20 / (stage.scaleX())) : null;
                setCurrentMousePos(snap ? snap.point : pos);
            } else if (activeTool === 'scale' && points.length > 0) {
                setCurrentMousePos(pos);
            } else if (activeTool === 'dimension' && points.length > 0) {
                setCurrentMousePos(pos);
            } else if (activeTool === 'wall_rect') {
                if (rectStart) setCurrentMousePos(pos);
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
                    if (d) useProjectStore.getState().updateDimension(d.id, { textOffset: { ...d.textOffset } });
                }
            }

            dragTextId.current = null;
            dragAnchorId.current = null;
            dragDimLineId.current = null;
            lastDragPos.current = null;

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
                        let foundId: string | null = null;
                        const tol = 10 / (stage.scaleX() || 1);

                        // Check Direct Click on Text
                        if (e.target.name() === 'dim-text') {
                            const rawId = e.target.id();
                            foundId = rawId.replace('dim-text-', '');
                        }

                        // Check Dimensions Line if text not hit
                        if (!foundId && useProjectStore.getState().layers.dimensions) {
                            for (const d of dimensions) {
                                if (isPointNearLine(clickPos, d.points[0], d.points[1], d.points[2], d.points[3], tol)) {
                                    foundId = d.id;
                                    break;
                                }
                            }
                        }

                        // If no dim, check walls
                        if (!foundId && useProjectStore.getState().layers.walls) {
                            for (const w of walls) {
                                if (isPointNearWall(clickPos, w, tol)) {
                                    foundId = w.id;
                                    break;
                                }
                            }
                        }

                        if (foundId) {
                            if (isShiftDown) {
                                const current = useProjectStore.getState().selectedIds;
                                if (current.includes(foundId)) {
                                    setSelection(current.filter(id => id !== foundId));
                                } else {
                                    setSelection([...current, foundId]);
                                }
                            } else {
                                setSelection([foundId]);
                            }
                        } else {
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


        const handleDblClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
            if (e.evt.button === 1) { // MMB
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
            }
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
                                                        material: 'concrete',
                                                        ...getWallParams(wallPreset, standardWallThickness, thickWallThickness, wideWallThickness)
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

        stage.on('mousedown', handleMouseDown);
        stage.on('mousemove', handleMouseMove);
        stage.on('mouseup', handleMouseUp);
        stage.on('dblclick', handleDblClick);
        stage.on('contextmenu', handleContextMenu);

        // Global key handler is attached to window in useEffect

        return () => {
            stage.off('mousedown', handleMouseDown);
            stage.off('mousemove', handleMouseMove);
            stage.off('mouseup', handleMouseUp);
            stage.off('dblclick', handleDblClick);
            stage.off('contextmenu', handleContextMenu);
        };
    }, [stage, activeTool, points, addWall, addAnchor, isShiftDown, setTool, walls, onOpenMenu, chainStart, selectionStart, selectionRect, isPanning, setSelection, rectStart, wallPreset, selectedIds, setAnchorMode, onOpenScaleModal, anchorRadius]);

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
                            strokeWidth={2 / (stage?.scaleX() || 1)}
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
                                    const snap = getSnapPoint(newPos, otherWalls, 20 / (stage?.scaleX() || 1));
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
                            fill="#00aaff"
                            stroke="white"
                            strokeWidth={2 / (stage?.scaleX() || 1)}
                            draggable
                            onDragStart={(e) => e.cancelBubble = true}
                            onDragMove={(e) => {
                                e.cancelBubble = true;
                                let newPos = { x: e.target.x(), y: e.target.y() };
                                const state = useProjectStore.getState();
                                // Snap
                                if (state.layers.walls) {
                                    const otherWalls = state.walls.filter(w => w.id !== id);
                                    const snap = getSnapPoint(newPos, otherWalls, 20 / (stage?.scaleX() || 1));
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
