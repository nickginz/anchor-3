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

    // Anchor Settings
    anchorRadius: number;
    anchorShape: 'circle' | 'square';
    showAnchorRadius: boolean;

    // Actions
    setScaleRatio: (ratio: number) => void;
    setTool: (tool: ToolType) => void;
    setSelection: (ids: string[]) => void;
    setWallPreset: (preset: 'default' | 'thick' | 'wide') => void;
    setStandardWallThickness: (thickness: number) => void;
    setThickWallThickness: (thickness: number) => void;
    setWideWallThickness: (thickness: number) => void;
    setAnchorMode: (mode: 'manual' | 'auto') => void;

    // Anchor Actions
    setAnchorRadius: (r: number) => void;
    setAnchorShape: (s: 'circle' | 'square') => void;
    setShowAnchorRadius: (v: boolean) => void;
    alignAnchors: (type: 'horizontal' | 'vertical') => void;

    addWall: (wall: Omit<Wall, 'id'>) => void;
    addWalls: (walls: Omit<Wall, 'id'>[]) => void;
    updateWall: (id: string, updates: Partial<Wall>) => void;
    updateWallPoint: (oldX: number, oldY: number, newX: number, newY: number) => void;
    removeWall: (id: string) => void;
    splitWall: (id: string, point: { x: number, y: number }) => void;
    addAnchor: (anchor: Omit<Anchor, 'id'>) => void;
    updateAnchor: (id: string, updates: Partial<Anchor>) => void;
    updateAnchors: (updates: { id: string; updates: Partial<Anchor> }[]) => void;
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
            },
            activeTool: 'select',
            selectedIds: [],
            wallPreset: 'thick',
            standardWallThickness: 0.1, // Default 10cm
            thickWallThickness: 0.1,
            wideWallThickness: 0.3,
            anchorMode: 'manual',

            // Anchor Settings Defaults
            anchorRadius: 5,
            anchorShape: 'circle',
            showAnchorRadius: true,

            setScaleRatio: (ratio) => set({ scaleRatio: ratio }),
            setTool: (tool) => set({ activeTool: tool }),
            setSelection: (ids) => set({ selectedIds: ids }),
            setWallPreset: (preset) => set({ wallPreset: preset }),
            setStandardWallThickness: (thickness) => set({ standardWallThickness: thickness }),
            setThickWallThickness: (t) => set({ thickWallThickness: t }),
            setWideWallThickness: (t) => set({ wideWallThickness: t }),
            setAnchorMode: (mode) => set({ anchorMode: mode }),

            // Anchor Actions
            setAnchorRadius: (r) => set({ anchorRadius: r }),
            setAnchorShape: (s) => set({ anchorShape: s }),
            setShowAnchorRadius: (v) => set({ showAnchorRadius: v }),

            alignAnchors: (type) => set((state) => {
                const selectedAnchors = state.anchors.filter(a => state.selectedIds.includes(a.id));
                if (selectedAnchors.length < 2) return state;

                let updates: Partial<Anchor>[] = [];
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

            addWall: (wall) => set((state) => ({
                walls: [...state.walls, { ...wall, id: uuidv4() }]
            })),

            addWalls: (newWalls) => set((state) => ({
                walls: [...state.walls, ...newWalls.map(w => ({ ...w, id: uuidv4() }))]
            })),

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

            removeWall: (id) => set((state) => ({
                walls: state.walls.filter((w) => w.id !== id),
            })),

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

            toggleLayer: (layer) => set((state) => ({
                layers: { ...state.layers, [layer]: !state.layers[layer] }
            })),

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
                    // Auto-select the new object so Layer Manager works immediately
                    activeImportId: newId
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
