import { create } from 'zustand';
import { temporal } from 'zundo';
import { v4 as uuidv4 } from 'uuid';
import type { Wall, Anchor, Dimension, ProjectLayers, ToolType, ImportedObject, ImageObject, DXFObject, Point, Hub, Cable } from '../types';
import { getOrthogonalPath, calculateLength, generateDaisyChain, getHubColor, distance, getHubPortCoordinates } from '../utils/routing';
import { reduceAnchors } from '../utils/optimizer-reduction';
import equals from 'fast-deep-equal';



export interface ProjectState {
    scaleRatio: number; // px per meter
    walls: Wall[];
    anchors: Anchor[];
    hubs: Hub[];
    cables: Cable[];
    dimensions: Dimension[];
    layers: ProjectLayers;
    activeTool: ToolType;
    selectedIds: string[];
    rooms: boolean;
    roomLabels: boolean;
    centroids: boolean; // Debug Layer
    standardWallThickness: number;
    thickWallThickness: number;
    wideWallThickness: number;
    anchorMode: 'manual' | 'auto';
    isScaleSet: boolean;

    lastLoaded: number; // Timestamp of last project load
    wallPreset: 'default' | 'thick' | 'wide';
    wallsLocked: boolean; // NEW: Lock walls from editing/selection
    toolbarSize: 'small' | 'big'; // NEW: Global Toolbar Size

    // Anchor Settings
    anchorRadius: number;
    anchorShape: 'circle' | 'square' | 'triangle' | 'star' | 'hex';
    showAnchorRadius: boolean;

    // Hub Settings
    activeHubCapacity: 2 | 6 | 12 | 24;
    activeTopology: 'star' | 'daisy';


    // Global Cable Settings
    cableSettings: {
        ceilingHeight: number;
        serviceLoop: number;
        defaultCableType: 'cat6' | 'fiber' | 'power';
        avoidObstacles: boolean;
        topology: 'star' | 'daisy';
        showParallel: boolean; // Electrical View
    };
    setCableSettings: (settings: Partial<ProjectState['cableSettings']>) => void;
    isCableSidebarOpen: boolean;
    setIsCableSidebarOpen: (v: boolean) => void;

    // Geometry Tools
    showOffsets: boolean;
    offsetStep: number; // Disatnce in meters
    showSkeleton: boolean;
    showOverlapCounts: boolean;
    skeletonMode: 'none' | 'full' | 'simplified'; // New Mode
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

    // QA / Debug Settings
    showQAMonitor: boolean;

    // Auto Placement UI & Optimization
    isAutoPlacementOpen: boolean;
    optimizationSettings: {
        radius: number;
        coverageTarget: number;
        minSignalStrength: number;
        targetScope: 'small' | 'large' | 'all';
    };
    theme: 'dark' | 'light';
    isSettingsOpen: boolean;

    // Export Tool State
    isExportSidebarOpen: boolean;
    setIsExportSidebarOpen: (v: boolean) => void;
    isBOMOpen: boolean;
    setIsBOMOpen: (v: boolean) => void;
    isHelpOpen: boolean; // NEW: Help/About Sidebar
    setIsHelpOpen: (v: boolean) => void;
    exportRegion: Point[] | null;
    setExportRegion: (region: Point[] | null) => void;


    // Placement Area Tool
    placementArea: { points: Point[] } | null;
    setPlacementArea: (area: { points: Point[] } | null) => void;
    placementAreaEnabled: boolean;
    setPlacementAreaEnabled: (enabled: boolean) => void;

    // Actions
    setScaleRatio: (ratio: number) => void;

    setTool: (tool: ToolType) => void;
    setSelection: (ids: string[]) => void;
    setWallPreset: (preset: 'default' | 'thick' | 'wide') => void;
    setStandardWallThickness: (thickness: number) => void;
    setThickWallThickness: (thickness: number) => void;
    setWideWallThickness: (thickness: number) => void;
    setAnchorMode: (mode: 'manual' | 'auto') => void;
    regenerateCables: () => void;

    setAnchorRadius: (r: number) => void;
    setAnchorShape: (s: 'circle' | 'square') => void;
    setShowAnchorRadius: (v: boolean) => void;
    setWallsLocked: (v: boolean) => void;
    setToolbarSize: (size: 'small' | 'big') => void;
    setHubCapacity: (c: 2 | 6 | 12 | 24) => void;
    setTopology: (t: 'star' | 'daisy') => void;





    // Geometry Actions
    setShowOffsets: (v: boolean) => void;
    setOffsetStep: (v: number) => void;
    setShowSkeleton: (v: boolean) => void;
    setShowMedialAxis: (show: boolean) => void;
    setMedialAxisStep: (step: number) => void;
    setSkeletonMode: (mode: 'none' | 'full' | 'simplified') => void;
    alignAnchors: (type: 'horizontal' | 'vertical') => void;

    // Heatmap Actions
    setShowHeatmap: (v: boolean) => void;
    setHeatmapResolution: (res: number) => void;
    setHeatmapColorMode: (mode: 'test' | 'standard' | 'manual') => void;
    setHeatmapThresholds: (t: { red: number, orange: number, yellow: number, green: number, blue: number }) => void;
    setShowQAMonitor: (v: boolean) => void;

    setTheme: (theme: 'dark' | 'light') => void;
    setIsSettingsOpen: (v: boolean) => void;
    setIsAutoPlacementOpen: (v: boolean) => void;
    setCentroids: (v: boolean) => void;
    setShowOverlapCounts: (v: boolean) => void;
    setOptimizationSettings: (settings: Partial<ProjectState['optimizationSettings']>) => void;

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
    setAnchors: (anchors: Anchor[]) => void;
    removeAnchor: (id: string) => void;
    addHub: (hub: Hub) => void;
    updateHub: (id: string, updates: Partial<Hub>) => void;
    removeHub: (id: string) => void;
    updateCable: (id: string, updates: Partial<Cable>) => void;
    updateCables: (updates: { id: string; updates: Partial<Cable> }[]) => void;

    setCables: (cables: Cable[]) => void;
    addCable: (cable: Cable) => void;
    removeCable: (id: string) => void;

    // Optimization Actions
    optimizeAnchorCount: (percentage: number, scope?: 'small' | 'large' | 'all') => void;

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
    // Save/Load
    loadProject: (data: ProjectData) => void;
    newProject: () => void;

    // Clipboard
    clipboard: { walls: Wall[], anchors: Anchor[] } | null;
    copySelection: () => void;
    pasteClipboard: () => void;

    allowOutsideConnections: boolean;
    setAllowOutsideConnections: (allow: boolean) => void;
}

export interface ProjectData {
    version: number;
    timestamp: number;
    scaleRatio: number;
    walls: Wall[];
    anchors: Anchor[];
    hubs?: Hub[];
    cables?: Cable[];
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
    optimizationSettings?: {
        radius: number;
        coverageTarget: number;
        minSignalStrength: number;
        targetScope: 'small' | 'large' | 'all';
    };
    isAutoPlacementOpen?: boolean;
    importedObjects: ImportedObject[];
    allowOutsideConnections?: boolean;
}

export const useProjectStore = create<ProjectState>()(
    temporal(
        (set) => ({
            scaleRatio: 50, // Default 50px = 1m
            walls: [],
            wallsLocked: false, // Default unlocked
            toolbarSize: 'small',
            anchors: [],
            hubs: [],
            cables: [],
            importedObjects: [], // Initialize empty array
            activeHubCapacity: 12, // Default
            activeTopology: 'star',

            // Default Cable Settings
            cableSettings: {
                defaultCableType: 'cat6',
                avoidObstacles: true,
                topology: 'star',
                showParallel: false,
                ceilingHeight: 3,
                serviceLoop: 5,
            },
            setCableSettings: (settings) => set((state) => ({ cableSettings: { ...state.cableSettings, ...settings } })),
            isCableSidebarOpen: false,
            setIsCableSidebarOpen: (v) => set({ isCableSidebarOpen: v }),

            dimensions: [],
            layers: {
                walls: true,
                heatmap: true,
                floorplan: true,
                dimensions: true,
                anchors: true,
                rooms: true,
                roomLabels: true,
                centroids: false, // New Centroid Layer
                hubs: true,
                cables: true,
            },
            rooms: true,
            roomLabels: true,
            centroids: false,
            showOverlapCounts: false,
            activeTool: 'select',
            selectedIds: [],
            wallPreset: 'thick',
            standardWallThickness: 0.1, // Default 10cm
            thickWallThickness: 0.1,
            wideWallThickness: 0.2,
            anchorMode: 'manual',
            isScaleSet: false,

            placementArea: null,
            setPlacementArea: (area) => set({ placementArea: area }),
            placementAreaEnabled: false,
            setPlacementAreaEnabled: (enabled) => set({ placementAreaEnabled: enabled }),
            setToolbarSize: (size) => set({ toolbarSize: size }),
            lastLoaded: 0, // Timestamp of last project load

            // Anchor Settings Defaults
            anchorRadius: 5,
            anchorShape: 'circle',
            showAnchorRadius: true,

            // Door Settings Removed


            // Hub Defaults

            // Geometry Tools
            showOffsets: false,
            offsetStep: 5, // Default 5 (meters?) as requested
            skeletonMode: 'none', // NEW: 'none' | 'full' | 'simplified'
            showSkeleton: false, // Deprecated, sync with mode
            showMedialAxis: false,
            medialAxisStep: 5,

            // Heatmap Defaults
            showHeatmap: false,
            heatmapResolution: 200, // Low resolution by default
            heatmapColorMode: 'standard',
            heatmapThresholds: {
                red: 3,    // < 3m
                orange: 6, // < 6m
                yellow: 9, // < 9m
                green: 12, // < 12m
                blue: 15,  // < 15m
            },

            // QA Monitor
            showQAMonitor: true, // Default ON
            setShowQAMonitor: (v) => set({ showQAMonitor: v }),

            // Global UI
            isSettingsOpen: false,
            isAutoPlacementOpen: false,
            optimizationSettings: {
                radius: 5,
                coverageTarget: 90,
                minSignalStrength: -80,
                targetScope: 'all',
            },
            theme: 'dark', // Default
            allowOutsideConnections: true, // Default to allowing pass-through

            // Actions
            setAllowOutsideConnections: (v) => set({ allowOutsideConnections: v }),

            setScaleRatio: (ratio) => set({ scaleRatio: ratio, isScaleSet: true }),
            setTheme: (t) => set({ theme: t }),
            setTool: (tool) => set({ activeTool: tool }),
            setSelection: (ids) => set({ selectedIds: ids }),
            setWallPreset: (preset) => set({ wallPreset: preset }),
            setWallsLocked: (locked: boolean) => set({ wallsLocked: locked }),

            setStandardWallThickness: (val) => set({ standardWallThickness: val }),
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
            setHubCapacity: (c) => set({ activeHubCapacity: c }),
            setTopology: (t) => set({ activeTopology: t }),


            // Geometry Tools Actions
            setShowOffsets: (v) => set({ showOffsets: v }),
            setOffsetStep: (v) => set({ offsetStep: v }),
            setShowSkeleton: (v) => set({ showSkeleton: v }),
            setShowMedialAxis: (show) => set({ showMedialAxis: show }),
            setMedialAxisStep: (step) => set({ medialAxisStep: step }),
            setSkeletonMode: (mode) => set({ skeletonMode: mode }),

            setShowHeatmap: (v) => set({ showHeatmap: v }),
            setHeatmapResolution: (res) => set({ heatmapResolution: res }),
            setHeatmapColorMode: (mode) => set({ heatmapColorMode: mode }),
            setHeatmapThresholds: (t) => set({ heatmapThresholds: t }),

            setIsSettingsOpen: (v) => set({ isSettingsOpen: v }),
            setIsAutoPlacementOpen: (v) => set({ isAutoPlacementOpen: v }),
            setCentroids: (v) => set((state) => ({
                centroids: v,
                layers: { ...state.layers, centroids: v }
            })),
            setShowOverlapCounts: (v) => set({ showOverlapCounts: v }),
            setOptimizationSettings: (settings) => set((state) => ({
                optimizationSettings: { ...state.optimizationSettings, ...settings }
            })),


            isExportSidebarOpen: false,
            setIsExportSidebarOpen: (v) => set({ isExportSidebarOpen: v }),
            isBOMOpen: false,
            setIsBOMOpen: (v) => set({ isBOMOpen: v }),
            isHelpOpen: false,
            setIsHelpOpen: (v) => set({ isHelpOpen: v }),
            exportRegion: null,
            setExportRegion: (region) => set({ exportRegion: region }),

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
                    const p = [...w.points] as [number, number, number, number];
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
                    const a1 = angle1 < 0 ? angle1 + Math.PI : angle1;
                    const a2 = angle2 < 0 ? angle2 + Math.PI : angle2;

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

            setAnchors: (anchors) => set({ anchors }),

            updateAnchor: (id, updates) => set((state) => {
                // 1. Update the Anchor
                const updatedAnchors = state.anchors.map((a) => (a.id === id ? { ...a, ...updates } : a));
                const anchor = updatedAnchors.find(a => a.id === id);

                // 2. Re-route connected cables (Fix Drag Connectivity)
                // If position changed, we must re-calculate paths for connected cables
                let updatedCables = state.cables;

                if (anchor && (updates.x !== undefined || updates.y !== undefined)) {
                    // Start of Drag/Move logic
                    updatedCables = state.cables.map(c => {
                        if (c.toId === id || c.fromId === id) {
                            // Find the other end
                            let start: Point | undefined;
                            let end: Point | undefined;

                            if (c.fromId === id) {
                                start = { x: anchor.x, y: anchor.y };
                                // Find target
                                const targetAnchor = updatedAnchors.find(a => a.id === c.toId);
                                const targetHub = state.hubs.find(h => h.id === c.toId);
                                if (targetAnchor) end = { x: targetAnchor.x, y: targetAnchor.y };
                                else if (targetHub) end = { x: targetHub.x, y: targetHub.y }; // Should be port?
                            } else {
                                end = { x: anchor.x, y: anchor.y };
                                // Find Source
                                const sourceAnchor = updatedAnchors.find(a => a.id === c.fromId);
                                const sourceHub = state.hubs.find(h => h.id === c.fromId);
                                if (sourceAnchor) start = { x: sourceAnchor.x, y: sourceAnchor.y };
                                else if (sourceHub) {
                                    // Complex: If connected to Hub, we need the specific Port.
                                    // Re-calculating *best* port might be expensive or jumpy?
                                    // For now, let's just use Hub Center -> getOrthogonalPath will snap or valid?
                                    // Ideally we want to keep the SAME port.
                                    // But we don't store Port Index in Cable.
                                    // So we default to Hub Center -> getOrthogonalPath logic?
                                    // Actually, getOrthogonalPath doesn't know about ports. 
                                    // It takes start/end.
                                    // If we use Hub Center, the cable visually connects to center.
                                    // We need to re-run the "Find Best Port" logic if we want perfection.
                                    // But "Find Best Port" is in regenerateCables or InteractionLayer manual logic.
                                    // Let's use the Hub Position for now, similar to how removeAnchor did it?
                                    // Wait, removeAnchor logic used Hub Center.
                                    // Let's improve this: If dragging anchor connected to Hub, 
                                    // re-evaluating the port IS desirable because the angle changes!
                                    // So finding the NEW best port is actually correct for standard behavior.

                                    // Re-use logic:
                                    // const bestPort = getHubPortCoordinates(
                                    //     { x: sourceHub.x, y: sourceHub.y },
                                    //     sourceHub.capacity,
                                    //     0 
                                    // );
                                    // Actually, let's copy the port selection logic inline or make a helper?
                                    // Too much code duplication. 
                                    // Let's do a simplified approach: 
                                    // Use getOrthogonalPath from Hub Center, then unshift the first point to be the port?
                                    // No, pathfinding needs to know obstacle avoidance from the start.

                                    // For now, let's iterate ports to find closest to the NEW anchor position.
                                    let bestPIdx = 0;
                                    let minD = Infinity;
                                    for (let i = 0; i < sourceHub.capacity; i++) {
                                        const p = getHubPortCoordinates({ x: sourceHub.x, y: sourceHub.y }, sourceHub.capacity, i);
                                        const d = Math.pow(p.x - anchor.x, 2) + Math.pow(p.y - anchor.y, 2);
                                        if (d < minD) { minD = d; bestPIdx = i; }
                                    }
                                    start = getHubPortCoordinates({ x: sourceHub.x, y: sourceHub.y }, sourceHub.capacity, bestPIdx);
                                }
                            }

                            // Simplified Drag Logic: Stretch the segment (Diagonal is OK)
                            // "Move With" Logic: If cable has >2 points, move the neighbor point too.
                            // This translates the entire segment bonded to the anchor.

                            const accPoints = [...c.points]; // Shallow copy points array

                            if (start) {
                                // Logic for Start (Index 0)
                                if (accPoints.length > 2) {
                                    // Calculate Delta: Target - Current
                                    const dx = start.x - accPoints[0].x;
                                    const dy = start.y - accPoints[0].y;
                                    // Move Neighbor
                                    accPoints[1] = { x: accPoints[1].x + dx, y: accPoints[1].y + dy };
                                }
                                // Update Start Point
                                accPoints[0] = { x: start.x, y: start.y };
                            }

                            if (end) {
                                // Logic for End (Index Last)
                                if (accPoints.length > 2) {
                                    const lastIdx = accPoints.length - 1;
                                    const neighborIdx = accPoints.length - 2;
                                    // Calculate Delta: Target - Current
                                    const dx = end.x - accPoints[lastIdx].x;
                                    const dy = end.y - accPoints[lastIdx].y;
                                    // Move Neighbor
                                    accPoints[neighborIdx] = { x: accPoints[neighborIdx].x + dx, y: accPoints[neighborIdx].y + dy };
                                }
                                // Update End Point
                                accPoints[accPoints.length - 1] = { x: end.x, y: end.y };
                            }

                            // Re-calculate length (Euclidean sum of segments)
                            const newLength = calculateLength(accPoints, state.scaleRatio, state.cableSettings);
                            return { ...c, points: accPoints, length: newLength };
                        }
                        return c;
                    });
                }

                return {
                    anchors: updatedAnchors,
                    cables: updatedCables
                };
            }),

            updateAnchors: (updatesBatch) => set((state) => {
                const updateMap = new Map(updatesBatch.map(u => [u.id, u.updates]));
                return {
                    anchors: state.anchors.map(a => {
                        const updates = updateMap.get(a.id);
                        return updates ? { ...a, ...updates } : a;
                    })
                };
            }),

            removeAnchor: (id) => set((state) => {
                // 1. Find connected cables
                const incomingCables = state.cables.filter(c => c.toId === id);
                const outgoingCables = state.cables.filter(c => c.fromId === id);

                // 2. Prepare new cables (healing)
                const newCables: Cable[] = [];

                incomingCables.forEach(inc => {
                    outgoingCables.forEach(outc => {
                        // Create connection from inc.fromId to outc.toId
                        let startPos: Point | undefined;
                        const fromHub = state.hubs.find(h => h.id === inc.fromId);
                        const fromAnchor = state.anchors.find(a => a.id === inc.fromId);
                        if (fromHub) startPos = { x: fromHub.x, y: fromHub.y };
                        else if (fromAnchor) startPos = { x: fromAnchor.x, y: fromAnchor.y };

                        const toAnchor = state.anchors.find(a => a.id === outc.toId);
                        let endPos: Point | undefined;
                        if (toAnchor) endPos = { x: toAnchor.x, y: toAnchor.y };

                        if (startPos && endPos) {
                            // If allowed outside connections, pass empty walls to simulate no obstacles
                            const routingWalls = state.allowOutsideConnections ? [] : state.walls;
                            const points = getOrthogonalPath(startPos, endPos, routingWalls);
                            const length = calculateLength(points, state.scaleRatio);

                            newCables.push({
                                id: uuidv4(),
                                fromId: inc.fromId,
                                toId: outc.toId,
                                points,
                                length
                            });
                        }
                    });
                });

                // 3. Remove old cables and add new ones
                const remainingCables = state.cables.filter(c => c.toId !== id && c.fromId !== id);

                return {
                    anchors: state.anchors.filter((a) => a.id !== id),
                    cables: [...remainingCables, ...newCables]
                };
            }),

            addHub: (hub) => set((state) => ({
                hubs: [...state.hubs, hub]
            })),

            updateHub: (id, updates) => set((state) => ({
                hubs: state.hubs.map(h => h.id === id ? { ...h, ...updates } : h)
            })),

            removeHub: (id) => set((state) => ({
                hubs: state.hubs.filter(h => h.id !== id),
                // Remove connecting cables? Yes, conceptually.
                cables: state.cables.filter(c => c.fromId !== id && c.toId !== id)
            })),

            setCables: (cables) => set({ cables }),

            addCable: (cable: Cable) => set((state) => ({
                cables: [...(state.cables || []), cable]
            })),
            updateCable: (id: string, updates: Partial<Cable>) => set((state) => ({
                cables: (state.cables || []).map((c) => c.id === id ? { ...c, ...updates } : c)
            })),
            updateCables: (updatesBatch: { id: string; updates: Partial<Cable> }[]) => set((state) => {
                const updateMap = new Map(updatesBatch.map(u => [u.id, u.updates]));
                return {
                    cables: (state.cables || []).map(c => {
                        const updates = updateMap.get(c.id);
                        return updates ? { ...c, ...updates } : c;
                    })
                };
            }),
            removeCable: (id: string) => set((state) => ({
                cables: (state.cables || []).filter((c) => c.id !== id)
            })),

            regenerateCables: () => set((state) => {
                const { hubs, anchors, walls, cableSettings, scaleRatio } = state;
                if (!hubs.length || !anchors.length) return state;

                // Filter out Locked Cables - they should NOT be regenerated
                const lockedCables = (state.cables || []).filter(c => c.locked);
                const newCables: Cable[] = [...lockedCables];

                const updatedHubs = [...hubs];

                // 1. Assign Anchors to Nearest Hub
                // EXCLUDE anchors that are already covered by locked cables?
                // Yes, if an anchor has a locked cable, it shouldn't get a NEW cable.
                const lockedAnchorIds = new Set<string>();
                lockedCables.forEach(c => {
                    lockedAnchorIds.add(c.toId);
                    lockedAnchorIds.add(c.fromId);
                });

                // Filter anchors that need cables
                const freeAnchors = anchors.filter(a => !lockedAnchorIds.has(a.id));
                // Note: If an anchor has one locked cable but needs redundancy? 
                // Current logic is 1 cable per anchor usually. 
                // So skipping 'locked' anchors is correct for auto-gen.

                const hubGroups = new Map<string, Anchor[]>();
                hubs.forEach(h => hubGroups.set(h.id, []));

                freeAnchors.forEach(a => {
                    let nearestHubId = hubs[0].id;
                    let minD = Infinity;
                    hubs.forEach(h => {
                        const d = distance({ x: a.x, y: a.y }, { x: h.x, y: h.y });
                        if (d < minD) {
                            minD = d;
                            nearestHubId = h.id;
                        }
                    });
                    hubGroups.get(nearestHubId)?.push(a);
                });

                // 2. Generate Cables per Hub
                updatedHubs.forEach((hub, index) => {
                    const groupAnchors = hubGroups.get(hub.id) || [];
                    if (groupAnchors.length === 0) return;

                    // Assign Hub Color if not set
                    if (!hub.color) {
                        hub.color = getHubColor(index);
                    }
                    const groupColor = hub.color!;

                    if (cableSettings.topology === 'daisy') {
                        // Daisy Chain
                        const paths = generateDaisyChain(
                            { x: hub.x, y: hub.y },
                            groupAnchors.map(a => ({ x: a.x, y: a.y })),
                            state.allowOutsideConnections ? [] : walls
                        );

                        // Map paths back to IDs... This is tricky because generateDaisyChain returns points.
                        // We need to know WHICH anchor corresponds to WHICH point to set IDs correctly.
                        // Actually generateDaisyChain logic (Nearest Neighbor) sorts the points.
                        // We need to re-match the sorted points to the anchors.
                        // OR, better: `generateDaisyChain` should handle objects?
                        // Let's assume for now we just create cables between the points and try to find the anchor at that point to get ID.

                        let prevId = hub.id;
                        paths.forEach((pointsPath) => {
                            // The end of this path is likely an anchor.
                            const endPoint = pointsPath[pointsPath.length - 1];
                            // Find anchor at endPoint
                            const targetAnchor = groupAnchors.find(a => Math.abs(a.x - endPoint.x) < 1 && Math.abs(a.y - endPoint.y) < 1);

                            if (targetAnchor) {
                                newCables.push({
                                    id: uuidv4(),
                                    fromId: prevId,
                                    toId: targetAnchor.id,
                                    points: pointsPath,
                                    length: calculateLength(pointsPath, scaleRatio, cableSettings),
                                    color: groupColor,
                                    type: cableSettings.defaultCableType,
                                    topology: 'daisy',
                                    verticalDrop: cableSettings.ceilingHeight ? (cableSettings.ceilingHeight - 1.0) * 2 : 0,
                                    serviceLoop: cableSettings.serviceLoop
                                });
                                prevId = targetAnchor.id;
                            }
                        });


                    } else {
                        // Star Topology
                        // Star Topology - Smart Port Assignment

                        // 1. Calculate angle for each anchor relative to Hub
                        const anchorsWithAngles = groupAnchors.map(anchor => {
                            const dx = anchor.x - hub.x;
                            const dy = anchor.y - hub.y;
                            const angle = Math.atan2(dy, dx); // -PI to PI
                            return { anchor, angle };
                        });

                        // 2. Track available ports
                        const availablePorts = Array.from({ length: hub.capacity }, (_, i) => i);

                        // 3. Greedy Assignment: Find nearest port for each anchor
                        // Optimization: Process anchors that have "obvious" choices first? 
                        // Or just process arbitrary order? Let's process arbitrary for now.
                        // Better: Sort anchors by angle? No, specific order doesn't guarantee global optimum without complexity.
                        // Simple greedy is usually sufficient for visual clarity.

                        anchorsWithAngles.forEach(({ anchor, angle }) => {
                            if (availablePorts.length === 0) return; // Should not happen if capacity >= anchors

                            let bestPortIdx = -1;
                            let minDiff = Infinity;
                            let bestIndexInAvailable = -1;

                            availablePorts.forEach((pIdx, arrIdx) => {
                                // Calculate Port Angle (matching getHubPortCoordinates logic)
                                // deg = (i * 360) / cap
                                // rad = (deg - 90) * PI/180
                                const portAngleRad = ((pIdx * 360) / hub.capacity - 90) * (Math.PI / 180);

                                // Angular difference (normalized to 0..PI)
                                let diff = Math.abs(angle - portAngleRad);
                                // Handle Wrap-around (e.g. PI vs -PI is distance 0)
                                if (diff > Math.PI) diff = 2 * Math.PI - diff;

                                if (diff < minDiff) {
                                    minDiff = diff;
                                    bestPortIdx = pIdx;
                                    bestIndexInAvailable = arrIdx;
                                }
                            });

                            // Assign best port
                            if (bestIndexInAvailable !== -1) {
                                availablePorts.splice(bestIndexInAvailable, 1);

                                // Generate Cable
                                const targetPort = getHubPortCoordinates(
                                    { x: hub.x, y: hub.y },
                                    hub.capacity,
                                    bestPortIdx
                                );

                                const path = getOrthogonalPath(
                                    targetPort, // START from Hub Port
                                    { x: anchor.x, y: anchor.y },
                                    state.allowOutsideConnections ? [] : walls
                                );

                                newCables.push({
                                    id: uuidv4(),
                                    fromId: hub.id,
                                    toId: anchor.id,
                                    points: path,
                                    length: calculateLength(path, scaleRatio, cableSettings),
                                    color: groupColor,
                                    type: cableSettings.defaultCableType,
                                    topology: 'star',
                                    verticalDrop: cableSettings.ceilingHeight ? (cableSettings.ceilingHeight - 1.0) * 2 : 0,
                                    serviceLoop: cableSettings.serviceLoop
                                });
                            }
                        });


                    }
                });

                return {
                    hubs: updatedHubs,
                    cables: newCables
                };
            }),

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
                    version: data.version,
                    lastLoaded: data.timestamp,
                    scaleRatio: data.scaleRatio,
                    // Migration: Normalize materials (lowercase, valid check)
                    walls: data.walls.map(w => {
                        const mat = (w.material || 'concrete').toLowerCase();
                        const validMaterials = ['concrete', 'brick', 'drywall', 'glass', 'wood', 'metal'];
                        return {
                            ...w,
                            material: validMaterials.includes(mat) ? mat : 'concrete'
                        } as Wall;
                    }),
                    anchors: data.anchors,
                    hubs: data.hubs || [],
                    cables: data.cables || [],
                    dimensions: data.dimensions,
                    layers: { ...state.layers, ...(data.layers || {}) },
                    wallPreset: data.wallPreset,
                    anchorMode: data.anchorMode,
                    // Restore Settings
                    anchorRadius: data.anchorsSettings?.radius ?? state.anchorRadius,
                    anchorShape: data.anchorsSettings?.shape ?? state.anchorShape,
                    showAnchorRadius: data.anchorsSettings?.showRadius ?? state.showAnchorRadius,

                    showHeatmap: data.heatmapSettings?.show ?? state.showHeatmap,
                    heatmapResolution: data.heatmapSettings?.resolution ?? state.heatmapResolution,
                    heatmapThresholds: data.heatmapSettings?.thresholds || { red: -65, orange: -70, yellow: -75, green: -80, blue: -85 },
                    optimizationSettings: data.optimizationSettings || {
                        radius: 5,
                        coverageTarget: 90,
                        minSignalStrength: -80,
                        targetScope: 'all',
                    },

                    isScaleSet: true, // Assume loaded project has scale set
                    allowOutsideConnections: data.allowOutsideConnections ?? state.allowOutsideConnections,
                    importedObjects: data.importedObjects || [], // Restore imported images/DXFs
                };
            }),

            newProject: () => set(() => ({
                walls: [],
                anchors: [],
                hubs: [],
                cables: [],
                dimensions: [],
                importedObjects: [],
                selectedIds: [],
                scaleRatio: 50,
                isScaleSet: false,
                activeTool: 'select',
                lastLoaded: 0,
                placementArea: null,
                activeImportId: null,
                // Keep settings/theme
            })),

            // Clipboard Implementation
            clipboard: null,

            optimizeAnchorCount: (percentage, scope = 'all') => set((state) => {
                const { anchors, removedCount } = reduceAnchors(
                    state.anchors,
                    state.walls,
                    percentage,
                    state.scaleRatio,
                    scope
                );

                if (removedCount > 0) {
                    console.log(`[Optimization] Removed ${removedCount} anchors. Scope: ${scope}`);
                }

                return { anchors };
            }),

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
            limit: 50,
            equality: equals, // Deep equality check to prevent identical states from being saved
            partialize: (state) => {
                // Whitelist only Model State (Visual changes)
                // Exclude: activeTool, selectedIds, UI flags, settings that don't change model
                return {
                    walls: state.walls,
                    anchors: state.anchors,
                    hubs: state.hubs,
                    cables: state.cables,
                    dimensions: state.dimensions,
                    layers: state.layers,
                    scaleRatio: state.scaleRatio,
                    placementArea: state.placementArea,
                    exportRegion: state.exportRegion,
                    // Optionally include defaults if they affect future drawing? 
                    // Usually preferences are not undoable.
                };
            },
        }
    )
);
