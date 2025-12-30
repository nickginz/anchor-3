import { create } from 'zustand';
import { temporal } from 'zundo';
import { v4 as uuidv4 } from 'uuid';
import type { Wall, Anchor, Dimension, ProjectLayers, ToolType, ImportedObject, ImageObject, DXFObject } from '../types';

interface ProjectState {
    scaleRatio: number; // px per meter
    walls: Wall[];
    anchors: Anchor[];
    dimensions: Dimension[];
    layers: ProjectLayers;
    activeTool: ToolType;
    selectedIds: string[];
    wallPreset: 'default' | 'thick' | 'wide';
    standardWallThickness: number;
    thickWallThickness: number;
    wideWallThickness: number;
    anchorMode: 'manual' | 'auto';
    isScaleSet: boolean;
    lastLoaded: number; // Timestamp of last project load

    // Anchor Settings
    anchorRadius: number;
    anchorShape: 'circle' | 'square' | 'triangle' | 'star' | 'hex';
    showAnchorRadius: boolean;

    // Geometry Tools
    showOffsets: boolean;
    offsetStep: number; // Disatnce in meters
    showSkeleton: boolean;
    showMedialAxis: boolean;
    medialAxisStep: number;

    // Heatmap Settings
    showHeatmap: boolean;
    heatmapResolution: number;
    heatmapColorMode: 'test' | 'standard' | 'manual';
    heatmapThresholds: {
        red: number;
        orange: number;
        yellow: number;
        green: number;
        blue: number;
    };

    // Global UI
    theme: 'dark' | 'light';
    isSettingsOpen: boolean;

    // Actions
    setScaleRatio: (ratio: number) => void;
    setTool: (tool: ToolType) => void;
    setSelection: (ids: string[]) => void;
    setWallPreset: (preset: 'default' | 'thick' | 'wide') => void;
    setStandardWallThickness: (thickness: number) => void;
    setThickWallThickness: (thickness: number) => void;
    setWideWallThickness: (thickness: number) => void;
    setAnchorMode: (mode: 'manual' | 'auto') => void;

    setAnchorRadius: (r: number) => void;
    setAnchorShape: (s: 'circle' | 'square') => void;
    setShowAnchorRadius: (v: boolean) => void;


    // Geometry Actions
    setShowOffsets: (v: boolean) => void;
    setOffsetStep: (v: number) => void;
    setShowSkeleton: (v: boolean) => void;
    setShowMedialAxis: (v: boolean) => void;
    setMedialAxisStep: (v: number) => void;

    alignAnchors: (type: 'horizontal' | 'vertical') => void;

    // Heatmap Actions
    setShowHeatmap: (v: boolean) => void;
    setHeatmapResolution: (res: number) => void;
    setHeatmapColorMode: (mode: 'test' | 'standard' | 'manual') => void;
    setHeatmapThresholds: (t: { red: number, orange: number, yellow: number, green: number, blue: number }) => void;

    setTheme: (theme: 'dark' | 'light') => void;
    setIsSettingsOpen: (v: boolean) => void;

    addWall: (wall: Omit<Wall, 'id'>) => void;
    addWalls: (walls: Omit<Wall, 'id'>[]) => void;
    updateWall: (id: string, updates: Partial<Wall>) => void;
    updateWallPoint: (oldX: number, oldY: number, newX: number, newY: number) => void;
    removeWall: (id: string) => void;
    splitWall: (id: string, point: { x: number, y: number }) => void;
    addAnchor: (anchor: Omit<Anchor, 'id'>) => void;
    updateAnchor: (id: string, updates: Partial<Anchor>) => void;
    updateAnchors: (updates: { id: string; updates: Partial<Anchor> }[]) => void;
    addAnchors: (anchors: Omit<Anchor, 'id'>[]) => void;
    removeAnchor: (id: string) => void;

    // Import State (Multi-Object)
    importedObjects: ImportedObject[];
    activeImportId: string | null; // For Alt+Drag operations

    addImportedObject: (obj: Omit<ImageObject | DXFObject, 'id' | 'visible' | 'locked' | 'opacity' | 'scale' | 'rotation' | 'x' | 'y'>) => void;
    updateImportedObject: (id: string, updates: Partial<ImportedObject>) => void;
    removeImportedObject: (id: string) => void;
    setActiveImportId: (id: string | null) => void;

    // DXF Layer Helper (Updates layers for ALL DXF objects or specific one?)
    // For now, let's keep a global toggle that affects ALL DXFs or specific active one. 
    // To keep it simple based on previous request: "Show/Hide All" -> Update ALL DXFs.
    // Individual toggles -> We might need a UI update later, but for now let's keep basic support.
    setDxfLayerVisibility: (layerName: string, visible: boolean) => void;
    setAllDxfLayersVisibility: (visible: boolean) => void;

    addDimension: (dim: Omit<Dimension, 'id'>) => void;
    updateDimension: (id: string, updates: Partial<Dimension>) => void;
    removeDimension: (id: string) => void;
    toggleLayer: (layer: keyof ProjectLayers) => void;
    groupAnchors: (ids: string[]) => void;
    ungroupAnchors: (ids: string[]) => void;
    // Save/Load
    loadProject: (data: ProjectData) => void;

    // Clipboard
    clipboard: { walls: Wall[], anchors: Anchor[] } | null;
    copySelection: () => void;
    pasteClipboard: () => void;
}

export interface ProjectData {
    version: number;
    timestamp: number;
    scaleRatio: number;
    walls: Wall[];
    anchors: Anchor[];
    dimensions: Dimension[];
    layers: ProjectLayers;
    wallPreset: 'default' | 'thick' | 'wide';
    anchorMode: 'manual' | 'auto';
    theme: 'dark' | 'light';
    anchorsSettings: {
        radius: number;
        shape: 'circle' | 'square';
        showRadius: boolean;
    };
    heatmapSettings: {
        show: boolean;
        resolution: number;
        thresholds: any;
    };
    importedObjects: ImportedObject[];
}

export const useProjectStore = create<ProjectState>()(
    temporal(
        (set) => ({
            scaleRatio: 50, // Default 50px = 1m
            walls: [],
            anchors: [],
            dimensions: [],
            layers: {
                walls: true,
                heatmap: true,
                floorplan: true,
                dimensions: true,
                anchors: true,
                rooms: true,
                roomLabels: true,
            },
            activeTool: 'select',
            selectedIds: [],
            wallPreset: 'thick',
            standardWallThickness: 0.1, // Default 10cm
            thickWallThickness: 0.1,
            wideWallThickness: 0.2,
            anchorMode: 'manual',
            isScaleSet: false,
            lastLoaded: 0, // Timestamp of last project load

            // Anchor Settings Defaults
            anchorRadius: 5,
            anchorShape: 'circle',
            showAnchorRadius: true,

            // Geometry Tools
            showOffsets: false,
            offsetStep: 5, // Default 5 (meters?) as requested
            showSkeleton: false,
            showMedialAxis: false,
            medialAxisStep: 5,

            // Heatmap Defaults
            showHeatmap: false,
            heatmapResolution: 50, // 50cm grid by default
            heatmapColorMode: 'standard',
            heatmapThresholds: {
                red: 3,    // < 3m
                orange: 6, // < 6m
                yellow: 9, // < 9m
                green: 12, // < 12m
                blue: 15,  // < 15m
            },

            // Global UI
            isSettingsOpen: false,
            theme: 'dark', // Default

            // Actions
            setScaleRatio: (ratio) => set({ scaleRatio: ratio, isScaleSet: true }),
            setTheme: (t) => set({ theme: t }),
            setTool: (tool) => set({ activeTool: tool }),
            setSelection: (ids) => set({ selectedIds: ids }),
            setWallPreset: (preset) => set({ wallPreset: preset }),
            setStandardWallThickness: (thickness) => set({ standardWallThickness: thickness }),
            setThickWallThickness: (t) => set({ thickWallThickness: t }),
            setWideWallThickness: (t) => set({ wideWallThickness: t }),
            setAnchorMode: (mode) => set({ anchorMode: mode }),

            // Anchor Actions - UPDATED: Apply to ALL existing anchors
            setAnchorRadius: (r) => set((state) => ({
                anchorRadius: r,
                anchors: state.anchors.map(a => ({ ...a, radius: r, range: r }))
            })),
            setAnchorShape: (s) => set((state) => ({
                anchorShape: s,
                anchors: state.anchors.map(a => ({ ...a, shape: s }))
            })),
            setShowAnchorRadius: (v) => set((state) => ({
                showAnchorRadius: v,
                anchors: state.anchors.map(a => ({ ...a, showRadius: v }))
            })),

            // Geometry Tools Actions
            setShowOffsets: (v) => set({ showOffsets: v }),
            setOffsetStep: (v) => set({ offsetStep: v }),
            setShowSkeleton: (v) => set({ showSkeleton: v }),
            setShowMedialAxis: (v) => set({ showMedialAxis: v }),
            setMedialAxisStep: (v) => set({ medialAxisStep: v }),

            setShowHeatmap: (v) => set({ showHeatmap: v }),
            setHeatmapResolution: (res) => set({ heatmapResolution: res }),
            setHeatmapColorMode: (mode) => set({ heatmapColorMode: mode }),
            setHeatmapThresholds: (t) => set({ heatmapThresholds: t }),

            setIsSettingsOpen: (v) => set({ isSettingsOpen: v }),


            alignAnchors: (type) => set((state) => {
                const selectedAnchors = state.anchors.filter(a => state.selectedIds.includes(a.id));
                if (selectedAnchors.length < 2) return state;

                // We need to map updates to specific IDs. 
                // Easier to map over all anchors and update matches.

                let targetVal = 0;
                if (type === 'horizontal') {
                    // Align Vertically to share the same Y.
                    // Reference: Left-most anchor (Smallest X).
                    const leftMost = selectedAnchors.reduce((prev, curr) => (curr.x < prev.x ? curr : prev));
                    targetVal = leftMost.y;
                } else {
                    // Align Horizontally to share the same X.
                    // Reference: Top-most anchor (Smallest Y).
                    const topMost = selectedAnchors.reduce((prev, curr) => (curr.y < prev.y ? curr : prev));
                    targetVal = topMost.x;
                }

                return {
                    anchors: state.anchors.map(a => {
                        if (state.selectedIds.includes(a.id)) {
                            if (type === 'horizontal') return { ...a, y: targetVal };
                            if (type === 'vertical') return { ...a, x: targetVal };
                        }
                        return a;
                    })
                };
            }),

            addWall: (wall) => set((state) => {
                // Check for duplicates
                const isDuplicate = state.walls.some(existing => {
                    const p1 = [existing.points[0], existing.points[1]];
                    const p2 = [existing.points[2], existing.points[3]];
                    const newP1 = [wall.points[0], wall.points[1]];
                    const newP2 = [wall.points[2], wall.points[3]];

                    const tol = 0.01; // 1cm tolerance
                    const matchDirect = (Math.abs(p1[0] - newP1[0]) < tol && Math.abs(p1[1] - newP1[1]) < tol &&
                        Math.abs(p2[0] - newP2[0]) < tol && Math.abs(p2[1] - newP2[1]) < tol);
                    const matchReverse = (Math.abs(p1[0] - newP2[0]) < tol && Math.abs(p1[1] - newP2[1]) < tol &&
                        Math.abs(p2[0] - newP1[0]) < tol && Math.abs(p2[1] - newP1[1]) < tol);
                    return matchDirect || matchReverse;
                });

                if (isDuplicate) return state;

                return {
                    walls: [...state.walls, { ...wall, id: uuidv4() }]
                };
            }),

            addWalls: (newWalls) => set((state) => {
                const uniqueNewWalls = newWalls.filter(newWall => {
                    const isDuplicate = state.walls.some(existing => {
                        const p1 = [existing.points[0], existing.points[1]];
                        const p2 = [existing.points[2], existing.points[3]];
                        const newP1 = [newWall.points[0], newWall.points[1]];
                        const newP2 = [newWall.points[2], newWall.points[3]];

                        const tol = 0.01;
                        const matchDirect = (Math.abs(p1[0] - newP1[0]) < tol && Math.abs(p1[1] - newP1[1]) < tol &&
                            Math.abs(p2[0] - newP2[0]) < tol && Math.abs(p2[1] - newP2[1]) < tol);
                        const matchReverse = (Math.abs(p1[0] - newP2[0]) < tol && Math.abs(p1[1] - newP2[1]) < tol &&
                            Math.abs(p2[0] - newP1[0]) < tol && Math.abs(p2[1] - newP1[1]) < tol);
                        return matchDirect || matchReverse;
                    });

                    // Also check against other new walls in this batch (simple O(N^2) for batch is fine usually)
                    // But usually newWalls come from detection which shouldn't have self-duplicates. 
                    // Let's just solve the "add to existing" case mostly.
                    return !isDuplicate;
                });

                if (uniqueNewWalls.length === 0) return state;

                return {
                    walls: [...state.walls, ...uniqueNewWalls.map(w => ({ ...w, id: uuidv4() }))]
                };
            }),

            updateWall: (id, updates) => set((state) => ({
                walls: state.walls.map((w) => (w.id === id ? { ...w, ...updates } : w)),
            })),

            updateWallPoint: (oldX, oldY, newX, newY) => set((state) => ({
                walls: state.walls.map(w => {
                    const tol = 0.001; // 1mm tolerance
                    let p = [...w.points] as [number, number, number, number];
                    let changed = false;

                    // Check Start Point
                    if (Math.abs(p[0] - oldX) < tol && Math.abs(p[1] - oldY) < tol) {
                        p[0] = newX;
                        p[1] = newY;
                        changed = true;
                    }
                    // Check End Point
                    if (Math.abs(p[2] - oldX) < tol && Math.abs(p[3] - oldY) < tol) {
                        p[2] = newX;
                        p[3] = newY;
                        changed = true;
                    }

                    return changed ? { ...w, points: p } : w;
                })
            })),

            removeWall: (id) => set((state) => {
                const wallToRemove = state.walls.find(w => w.id === id);
                if (!wallToRemove) return state;

                let currentWalls = state.walls.filter((w) => w.id !== id);

                // Helper to get connected walls at a point
                const getConnectedWalls = (walls: Wall[], p: { x: number, y: number }) => {
                    return walls.filter(w => {
                        const dist1 = Math.hypot(w.points[0] - p.x, w.points[1] - p.y);
                        const dist2 = Math.hypot(w.points[2] - p.x, w.points[3] - p.y);
                        return dist1 < 0.001 || dist2 < 0.001;
                    });
                };

                // Helper to check collinearity (slope check)
                const areCollinear = (w1: Wall, w2: Wall) => {
                    const angle1 = Math.atan2(w1.points[3] - w1.points[1], w1.points[2] - w1.points[0]);
                    const angle2 = Math.atan2(w2.points[3] - w2.points[1], w2.points[2] - w2.points[0]);

                    // Normalize angles 0-PI (since wall direction doesn't matter for collinearity)
                    let a1 = angle1 < 0 ? angle1 + Math.PI : angle1;
                    let a2 = angle2 < 0 ? angle2 + Math.PI : angle2;

                    // Check if close (or close to PI diff which is same line) - handled by normalization? 
                    // Actually atan2 returns -PI to PI. wall direction (p1->p2) vs (p2->p1) flips angle by PI.
                    // We just care if they lie on same line. 
                    const diff = Math.abs(a1 - a2);
                    return diff < 0.01 || Math.abs(diff - Math.PI) < 0.01;
                };

                // Check endpoints of removed wall for healing opportunities
                const checkPoints = [
                    { x: wallToRemove.points[0], y: wallToRemove.points[1] },
                    { x: wallToRemove.points[2], y: wallToRemove.points[3] }
                ];

                checkPoints.forEach(p => {
                    const connected = getConnectedWalls(currentWalls, p);

                    if (connected.length === 2) {
                        const w1 = connected[0];
                        const w2 = connected[1];

                        if (areCollinear(w1, w2) && w1.thickness === w2.thickness && w1.material === w2.material) {
                            // Merge w1 and w2
                            // Find the extreme points (far ends)
                            // The shared point is 'p'.
                            // Get far point of w1
                            let start = { x: w1.points[0], y: w1.points[1] };
                            if (Math.hypot(start.x - p.x, start.y - p.y) < 0.001) start = { x: w1.points[2], y: w1.points[3] };

                            // Get far point of w2
                            let end = { x: w2.points[0], y: w2.points[1] };
                            if (Math.hypot(end.x - p.x, end.y - p.y) < 0.001) end = { x: w2.points[2], y: w2.points[3] };

                            const newWall: Wall = {
                                ...w1,
                                id: uuidv4(),
                                points: [start.x, start.y, end.x, end.y]
                            };

                            // Remove w1, w2 and add newWall
                            currentWalls = currentWalls.filter(w => w.id !== w1.id && w.id !== w2.id);
                            currentWalls.push(newWall);
                        }
                    }
                });

                return { walls: currentWalls };
            }),

            splitWall: (id, point) => set((state) => {
                const wall = state.walls.find(w => w.id === id);
                if (!wall) return state;

                // Create two new walls
                const w1: Wall = {
                    ...wall,
                    id: uuidv4(),
                    points: [wall.points[0], wall.points[1], point.x, point.y]
                };

                const w2: Wall = {
                    ...wall,
                    id: uuidv4(),
                    points: [point.x, point.y, wall.points[2], wall.points[3]]
                };

                return {
                    walls: [...state.walls.filter(w => w.id !== id), w1, w2]
                };
            }),

            addAnchor: (anchor) => set((state) => {
                // Determine prefix based on anchorMode or passed type (logic currently relies on global anchorMode or just checking context)
                // Let's assume we use state.anchorMode as default, or we can check the ID if provided (but here we generate it).
                // Actually, the UI usually switches anchorMode when selecting tool.

                const prefix = state.anchorMode === 'manual' ? 'M' : 'A';

                // Find next number
                const existingIds = state.anchors
                    .filter(a => a.id.startsWith(prefix))
                    .map(a => parseInt(a.id.substring(1)))
                    .filter(n => !isNaN(n));

                const nextNum = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
                const newId = `${prefix}${nextNum}`;

                return {
                    anchors: [...state.anchors, { ...anchor, id: newId }]
                };
            }),

            addAnchors: (newAnchors: Omit<Anchor, 'id'>[]) => set((state) => {
                const prefix = state.anchorMode === 'manual' ? 'M' : 'A';
                // Find highest current ID to continue sequence
                const existingIds = state.anchors
                    .filter(a => a.id.startsWith(prefix))
                    .map(a => parseInt(a.id.substring(1)))
                    .filter(n => !isNaN(n));

                let nextNum = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;

                const anchorsToAdd = newAnchors.map(a => ({
                    ...a,
                    id: `${prefix}${nextNum++}`
                }));

                return {
                    anchors: [...state.anchors, ...anchorsToAdd]
                };
            }),

            updateAnchor: (id, updates) => set((state) => ({
                anchors: state.anchors.map((a) => (a.id === id ? { ...a, ...updates } : a)),
            })),

            updateAnchors: (updatesBatch) => set((state) => {
                const updateMap = new Map(updatesBatch.map(u => [u.id, u.updates]));
                return {
                    anchors: state.anchors.map(a => {
                        const updates = updateMap.get(a.id);
                        return updates ? { ...a, ...updates } : a;
                    })
                };
            }),

            removeAnchor: (id) => set((state) => ({
                anchors: state.anchors.filter((a) => a.id !== id),
            })),

            toggleLayer: (layer) => set((state) => {
                const newValue = !state.layers[layer];
                const newLayers = { ...state.layers, [layer]: newValue };

                // Unified Toggle: Walls controls Rooms & Labels
                if (layer === 'walls') {
                    newLayers.rooms = newValue;
                    newLayers.roomLabels = newValue;
                }

                // Unified Toggle: Anchors controls Heatmap
                if (layer === 'anchors') {
                    newLayers.heatmap = newValue;
                }

                return { layers: newLayers };
            }),

            importedObjects: [],
            activeImportId: null,

            addImportedObject: (obj) => set((state) => {
                const newId = uuidv4();

                // SINGLE DXF POLICY: If adding a DXF, remove all existing DXFs first.
                let newObjects = state.importedObjects;
                if (obj.type === 'dxf') {
                    newObjects = newObjects.filter(o => o.type !== 'dxf');
                }

                return {
                    importedObjects: [...newObjects, {
                        ...obj,
                        id: newId,
                        x: 0,
                        y: 0,
                        scale: 1,
                        rotation: 0,
                        opacity: 0.5,
                        visible: true,
                        locked: false,
                    } as unknown as ImportedObject],
                    // Auto-select removed per user request (Step 756)
                    // activeImportId: newId 
                };
            }),

            updateImportedObject: (id, updates) => set((state) => ({
                importedObjects: state.importedObjects.map((obj) =>
                    obj.id === id ? { ...obj, ...updates } as ImportedObject : obj
                )
            })),

            removeImportedObject: (id) => set((state) => ({
                importedObjects: state.importedObjects.filter((obj) => obj.id !== id),
                activeImportId: state.activeImportId === id ? null : state.activeImportId
            })),

            setActiveImportId: (id) => set({ activeImportId: id }),

            // DXF Helpers - Target Active Import ID if it's a DXF, or the single DXF if exists
            setDxfLayerVisibility: (layerName, visible) => set((state) => ({
                importedObjects: state.importedObjects.map(obj => {
                    // Only update if it's the active one (or simply if it's a DXF, since we enforce single DXF now)
                    if (obj.type === 'dxf') {
                        // Check if this is the active one OR if we just want to update the single DXF
                        // Given "Single DXF Policy", updating "all DXFs" is effectively updating "the DXF".
                        return {
                            ...obj,
                            layers: { ...obj.layers, [layerName]: visible }
                        };
                    }
                    return obj;
                })
            })),

            setAllDxfLayersVisibility: (visible) => set((state) => ({
                importedObjects: state.importedObjects.map(obj => {
                    if (obj.type === 'dxf') {
                        const newLayers = { ...obj.layers };
                        Object.keys(newLayers).forEach(k => newLayers[k] = visible);
                        return { ...obj, layers: newLayers };
                    }
                    return obj;
                })
            })),

            addDimension: (dim) => set((state) => ({
                dimensions: [...state.dimensions, { ...dim, id: uuidv4() }]
            })),

            updateDimension: (id, updates) => set((state) => ({
                dimensions: state.dimensions.map((d) => (d.id === id ? { ...d, ...updates } : d)),
            })),

            removeDimension: (id) => set((state) => ({
                dimensions: state.dimensions.filter((d) => d.id !== id)
            })),

            // Grouping Actions
            groupAnchors: (ids) => set((state) => {
                const validAnchors = state.anchors.filter(a => ids.includes(a.id));
                if (validAnchors.length < 2) return state; // Need at least 2 to group

                const newGroupId = uuidv4();
                return {
                    anchors: state.anchors.map(a =>
                        ids.includes(a.id) ? { ...a, groupId: newGroupId } : a
                    )
                };
            }),

            ungroupAnchors: (ids) => set((state) => {
                // Find groupIds of selected anchors
                const targetGroupIds = new Set<string>();
                state.anchors.forEach(a => {
                    if (ids.includes(a.id) && a.groupId) {
                        targetGroupIds.add(a.groupId);
                    }
                });

                if (targetGroupIds.size === 0) return state;

                return {
                    anchors: state.anchors.map(a =>
                        (a.groupId && targetGroupIds.has(a.groupId))
                            ? { ...a, groupId: undefined }
                            : a
                    )
                };
            }),

            loadProject: (data) => set((state) => {
                // Basic validation could happen here
                if (!data || !data.walls) {
                    console.error("Invalid project data");
                    return state;
                }

                return {
                    ...state,
                    scaleRatio: data.scaleRatio || 50,
                    walls: data.walls || [],
                    anchors: data.anchors || [],
                    dimensions: data.dimensions || [],
                    layers: data.layers || state.layers,
                    wallPreset: data.wallPreset || state.wallPreset,
                    anchorMode: data.anchorMode || state.anchorMode,
                    theme: data.theme || state.theme,

                    // Restore Settings
                    anchorRadius: data.anchorsSettings?.radius ?? state.anchorRadius,
                    anchorShape: data.anchorsSettings?.shape ?? state.anchorShape,
                    showAnchorRadius: data.anchorsSettings?.showRadius ?? state.showAnchorRadius,

                    showHeatmap: data.heatmapSettings?.show ?? state.showHeatmap,
                    heatmapResolution: data.heatmapSettings?.resolution ?? state.heatmapResolution,
                    heatmapThresholds: data.heatmapSettings?.thresholds || { red: -65, orange: -70, yellow: -75, green: -80, blue: -85 },
                    importedObjects: data.importedObjects || [],
                    activeImportId: null,
                    selectedIds: [], // Clear selection
                    isScaleSet: true, // Assume loaded project has scale set
                    lastLoaded: Date.now()
                };
            }),

            // Clipboard Implementation
            clipboard: null,

            copySelection: () => set((state) => {
                const walls = state.walls.filter(w => state.selectedIds.includes(w.id));
                const anchors = state.anchors.filter(a => state.selectedIds.includes(a.id));

                if (walls.length === 0 && anchors.length === 0) return state;

                return {
                    clipboard: { walls, anchors }
                };
            }),

            pasteClipboard: () => set((state) => {
                if (!state.clipboard) return state;

                const { walls, anchors } = state.clipboard;
                const offsetPx = 50; // 1 meter offset (assuming 50px/m default, but visual offset is key)

                // Regenerate Wall IDs
                const newWalls = walls.map(w => ({
                    ...w,
                    id: uuidv4(),
                    points: [
                        w.points[0] + offsetPx,
                        w.points[1] + offsetPx,
                        w.points[2] + offsetPx,
                        w.points[3] + offsetPx
                    ] as [number, number, number, number]
                }));

                // Regenerate Anchor IDs
                const newAnchors = anchors.map(a => {
                    // Try to preserve prefix "A" or "M" but with new number
                    const prefix = a.id.startsWith('M') ? 'M' : 'A';
                    // We need unique IDs. Let's just use UUID for uniqueness or simple random suffix if we want to keep short names?
                    // User prefers sortable names usually. 
                    // Let's use simple logic: Just append "-copy" or generate new sequence?
                    // Safe bet: Generate proper new sequence ID logic or UUID.
                    // Given our `addAnchor` logic does auto-increment, let's try to reuse that logic or just use UUID if ID is string.
                    // Actually `addAnchor` handles ID gen. But we are doing bulk add.
                    // Let's just append random suffix for now to avoid collision, or re-calc entire sequence?
                    // Re-calcing sequence for 10 pasted anchors is tricky in reducer.
                    // Let's use uuidv4() for pasted anchors to ensure robustness, or just random suffix.
                    return {
                        ...a,
                        id: `${prefix}${uuidv4().slice(0, 4)}`, // Short unique suffix
                        x: a.x + offsetPx,
                        y: a.y + offsetPx
                    };
                });

                const newSelectedIds = [...newWalls.map(w => w.id), ...newAnchors.map(a => a.id)];

                return {
                    walls: [...state.walls, ...newWalls],
                    anchors: [...state.anchors, ...newAnchors],
                    selectedIds: newSelectedIds // Select the pasted items
                };
            }),
        }),
        {
            limit: 100,
            partialize: (state) => {
                const { activeTool, ...rest } = state;
                return rest;
            },
        }
    )
);
