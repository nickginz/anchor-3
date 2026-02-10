import { create } from 'zustand';
import { temporal } from 'zundo';
import { v4 as uuidv4 } from 'uuid';
import type { Wall, Anchor, Dimension, ProjectLayers, ToolType, ImportedObject, ImageObject, DXFObject, Point, Hub, Cable } from '../types';
import { getOrthogonalPath, calculateLength, generateDaisyChain, getHubColor, distance, getHubPortCoordinates } from '../utils/routing';
import { getLineIntersection } from '../utils/geometry';
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
    wallMaterial: 'drywall' | 'concrete' | 'brick' | 'metal' | 'wood' | 'glass'; // RESTORED: Wall Material State
    setWallMaterial: (material: 'drywall' | 'concrete' | 'brick' | 'metal' | 'wood' | 'glass') => void;
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
    showExportBOM: boolean;
    setShowExportBOM: (v: boolean) => void;
    exportBOMPosition: { x: number; y: number } | null;
    setExportBOMPosition: (pos: { x: number; y: number } | null) => void;

    showExportScaleBar: boolean;
    setShowExportScaleBar: (v: boolean) => void;
    exportScalePosition: { x: number; y: number } | null;
    setExportScalePosition: (pos: { x: number; y: number } | null) => void;

    isBOMOpen: boolean;
    setIsBOMOpen: (v: boolean) => void;
    isHelpOpen: boolean; // NEW: Help/About Sidebar
    setIsHelpOpen: (v: boolean) => void;

    // Hub Settings Modal
    isHubSettingsOpen: boolean;
    activeHubId: string | null;
    setIsHubSettingsOpen: (v: boolean) => void;
    setActiveHubId: (id: string | null) => void;

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
    addRectangleWalls: (rectWalls: Partial<Wall>[], splitPoints: { id: string, point: Point }[]) => void;
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
    removeObjects: (ids: string[]) => void;
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
        (set, _get, api) => ({
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
            wallMaterial: 'drywall', // Default Material
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
            showQAMonitor: false, // Default ON
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
            setWallMaterial: (m) => set({ wallMaterial: m }),
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
            showExportBOM: true,
            setShowExportBOM: (v) => set({ showExportBOM: v }),
            exportBOMPosition: null,
            setExportBOMPosition: (pos) => set({ exportBOMPosition: pos }),

            showExportScaleBar: true,
            setShowExportScaleBar: (v: boolean) => set({ showExportScaleBar: v }),
            exportScalePosition: null,
            setExportScalePosition: (pos) => set({ exportScalePosition: pos }),

            isBOMOpen: false,
            setIsBOMOpen: (v) => set({ isBOMOpen: v }),
            isHelpOpen: false,
            setIsHelpOpen: (v) => set({ isHelpOpen: v }),

            isHubSettingsOpen: false,
            activeHubId: null,
            setIsHubSettingsOpen: (v) => set({ isHubSettingsOpen: v }),
            setActiveHubId: (id) => set({ activeHubId: id }),
            exportRegion: null,
            setExportRegion: (region) => set({ exportRegion: region }),

            alignAnchors: (type) => {
                (api as any).temporal.getState().resume();
                set((state) => {
                    const selectedAnchors = state.anchors.filter(a => state.selectedIds.includes(a.id));
                    if (selectedAnchors.length < 2) return state;

                    let targetVal = 0;
                    if (type === 'horizontal') {
                        const leftMost = selectedAnchors.reduce((prev, curr) => (curr.x < prev.x ? curr : prev));
                        targetVal = leftMost.y;
                    } else {
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
                });
                (api as any).temporal.getState().pause();
            },

            addWall: (wall) => {
                (api as any).temporal.getState().resume();
                set((state) => {
                    const { walls } = state;
                    const newWallId = uuidv4();
                    let wallSegments: Wall[] = [{ ...wall, id: newWallId }];

                    // Check for duplicates (on the original segment)
                    const isDuplicate = walls.some(existing => {
                        const p1 = [existing.points[0], existing.points[1]];
                        const p2 = [existing.points[2], existing.points[3]];
                        const newP1 = [wall.points[0], wall.points[1]];
                        const newP2 = [wall.points[2], wall.points[3]];
                        const tol = 0.01;
                        const matchDirect = (Math.abs(p1[0] - newP1[0]) < tol && Math.abs(p1[1] - newP1[1]) < tol &&
                            Math.abs(p2[0] - newP2[0]) < tol && Math.abs(p2[1] - newP2[1]) < tol);
                        const matchReverse = (Math.abs(p1[0] - newP2[0]) < tol && Math.abs(p1[1] - newP2[1]) < tol &&
                            Math.abs(p2[0] - newP1[0]) < tol && Math.abs(p2[1] - newP1[1]) < tol);
                        return matchDirect || matchReverse;
                    });
                    if (isDuplicate) return state;

                    let currentExistingWalls = [...walls];
                    let finalNewSegments: Wall[] = [];

                    const processSegment = (seg: Wall) => {
                        let wasSplit = false;
                        for (let i = 0; i < currentExistingWalls.length; i++) {
                            const existing = currentExistingWalls[i];
                            const inter = getLineIntersection(
                                { x: seg.points[0], y: seg.points[1] },
                                { x: seg.points[2], y: seg.points[3] },
                                { x: existing.points[0], y: existing.points[1] },
                                { x: existing.points[2], y: existing.points[3] }
                            );

                            if (inter) {
                                const scaleRatio = state.scaleRatio || 50;
                                const d1 = Math.hypot(existing.points[0] - inter.x, existing.points[1] - inter.y) / scaleRatio;
                                const d2 = Math.hypot(existing.points[2] - inter.x, existing.points[3] - inter.y) / scaleRatio;
                                const dNew1 = Math.hypot(seg.points[0] - inter.x, seg.points[1] - inter.y) / scaleRatio;
                                const dNew2 = Math.hypot(seg.points[2] - inter.x, seg.points[3] - inter.y) / scaleRatio;

                                // Protection: Only split if the point is not too close to any endpoint (> 5cm)
                                const MIN_SEG = 0.05;

                                if (d1 > MIN_SEG && d2 > MIN_SEG) {
                                    // Split existing wall
                                    const e1: Wall = { ...existing, id: uuidv4(), points: [existing.points[0], existing.points[1], inter.x, inter.y] };
                                    const e2: Wall = { ...existing, id: uuidv4(), points: [inter.x, inter.y, existing.points[2], existing.points[3]] };
                                    currentExistingWalls.splice(i, 1, e1, e2);
                                    // Note: we continue checking THIS segment against other walls (including the new ones)
                                }

                                if (dNew1 > MIN_SEG && dNew2 > MIN_SEG) {
                                    // Split new segment and recurse
                                    const s1: Wall = { ...seg, id: uuidv4(), points: [seg.points[0], seg.points[1], inter.x, inter.y] };
                                    const s2: Wall = { ...seg, id: uuidv4(), points: [inter.x, inter.y, seg.points[2], seg.points[3]] };
                                    processSegment(s1);
                                    processSegment(s2);
                                    wasSplit = true;
                                    break;
                                }
                            }
                        }
                        if (!wasSplit) {
                            finalNewSegments.push(seg);
                        }
                    };

                    processSegment(wallSegments[0]);

                    const scaleRatio = state.scaleRatio || 50;
                    const filterTiny = (w: Wall) => {
                        const len = Math.hypot(w.points[2] - w.points[0], w.points[3] - w.points[1]) / scaleRatio;
                        return len > 0.05;
                    };

                    return {
                        walls: [...currentExistingWalls, ...finalNewSegments.filter(filterTiny)]
                    };
                });
                (api as any).temporal.getState().pause();
            },

            addWalls: (newWalls) => {
                (api as any).temporal.getState().resume();
                set((state) => {
                    let currentWalls = [...state.walls];
                    const addedSegments: Wall[] = [];

                    newWalls.forEach(nw => {
                        const wallWithId = { ...nw, id: uuidv4() };

                        const processSegment = (seg: Wall) => {
                            let wasSplit = false;
                            for (let i = 0; i < currentWalls.length; i++) {
                                const existing = currentWalls[i];
                                const inter = getLineIntersection(
                                    { x: seg.points[0], y: seg.points[1] },
                                    { x: seg.points[2], y: seg.points[3] },
                                    { x: existing.points[0], y: existing.points[1] },
                                    { x: existing.points[2], y: existing.points[3] }
                                );

                                if (inter) {
                                    const scaleRatio = state.scaleRatio || 50;
                                    const d1 = Math.hypot(existing.points[0] - inter.x, existing.points[1] - inter.y) / scaleRatio;
                                    const d2 = Math.hypot(existing.points[2] - inter.x, existing.points[3] - inter.y) / scaleRatio;
                                    const dNew1 = Math.hypot(seg.points[0] - inter.x, seg.points[1] - inter.y) / scaleRatio;
                                    const dNew2 = Math.hypot(seg.points[2] - inter.x, seg.points[3] - inter.y) / scaleRatio;

                                    const MIN_SEG = 0.05;

                                    if (d1 > MIN_SEG && d2 > MIN_SEG) {
                                        const e1: Wall = { ...existing, id: uuidv4(), points: [existing.points[0], existing.points[1], inter.x, inter.y] };
                                        const e2: Wall = { ...existing, id: uuidv4(), points: [inter.x, inter.y, existing.points[2], existing.points[3]] };
                                        currentWalls.splice(i, 1, e1, e2);
                                    }

                                    if (dNew1 > MIN_SEG && dNew2 > MIN_SEG) {
                                        const s1: Wall = { ...seg, id: uuidv4(), points: [seg.points[0], seg.points[1], inter.x, inter.y] };
                                        const s2: Wall = { ...seg, id: uuidv4(), points: [inter.x, inter.y, seg.points[2], seg.points[3]] };
                                        processSegment(s1);
                                        processSegment(s2);
                                        wasSplit = true;
                                        break;
                                    }
                                }
                            }
                            if (!wasSplit) {
                                addedSegments.push(seg);
                            }
                        };
                        processSegment(wallWithId);
                    });

                    const scaleRatio = state.scaleRatio || 50;
                    const filterTiny = (w: Wall) => {
                        const len = Math.hypot(w.points[2] - w.points[0], w.points[3] - w.points[1]) / scaleRatio;
                        return len > 0.05;
                    };

                    return {
                        walls: [...currentWalls.filter(filterTiny), ...addedSegments.filter(filterTiny)]
                    };
                });
                (api as any).temporal.getState().pause();
            },

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

            removeWall: (id) => {
                (api as any).temporal.getState().resume();
                set((state) => {
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
                });
                (api as any).temporal.getState().pause();
            },

            splitWall: (id, point) => {
                (api as any).temporal.getState().resume();
                set((state) => {
                    const wall = state.walls.find(w => w.id === id);
                    if (!wall) return state;

                    const scaleRatio = state.scaleRatio || 50;
                    const d1 = Math.hypot(wall.points[0] - point.x, wall.points[1] - point.y) / scaleRatio;
                    const d2 = Math.hypot(wall.points[2] - point.x, wall.points[3] - point.y) / scaleRatio;

                    // Threshold: 5cm
                    if (d1 < 0.05 || d2 < 0.05) return state;

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
                });
                (api as any).temporal.getState().pause();
            },

            addAnchor: (anchor) => {
                (api as any).temporal.getState().resume();
                set((state) => {
                    const prefix = state.anchorMode === 'manual' ? 'M' : 'A';
                    const existingIds = state.anchors
                        .filter(a => a.id.startsWith(prefix))
                        .map(a => parseInt(a.id.substring(1)))
                        .filter(n => !isNaN(n));

                    const nextNum = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
                    const newId = `${prefix}${nextNum}`;

                    return {
                        anchors: [...state.anchors, { ...anchor, id: newId }]
                    };
                });
                (api as any).temporal.getState().pause();
            },

            addAnchors: (newAnchors: Omit<Anchor, 'id'>[]) => {
                (api as any).temporal.getState().resume();
                set((state) => {
                    const prefix = state.anchorMode === 'manual' ? 'M' : 'A';
                    const existingIds = state.anchors
                        .filter(a => a.id.startsWith(prefix))
                        .map(a => parseInt(a.id.substring(1)))
                        .filter(n => !isNaN(n));

                    let nextNum = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;

                    const anchorsToAdd = newAnchors.map(a => ({
                        ...a,
                        id: `${prefix}${nextNum++} `
                    }));

                    return {
                        anchors: [...state.anchors, ...anchorsToAdd]
                    };
                });
                (api as any).temporal.getState().pause();
            },

            setAnchors: (anchors) => {
                (api as any).temporal.getState().resume();
                set({ anchors });
                (api as any).temporal.getState().pause();
            },

            updateAnchor: (id, updates) => {
                (api as any).temporal.getState().resume();
                set((state) => {
                    const updatedAnchors = state.anchors.map((a) => (a.id === id ? { ...a, ...updates } : a));
                    const anchor = updatedAnchors.find(a => a.id === id);
                    let updatedCables = state.cables;

                    if (anchor && (updates.x !== undefined || updates.y !== undefined)) {
                        updatedCables = state.cables.map(c => {
                            if (c.toId === id || c.fromId === id) {
                                let start: Point | undefined;
                                let end: Point | undefined;

                                if (c.fromId === id) {
                                    start = { x: anchor.x, y: anchor.y };
                                    const targetAnchor = updatedAnchors.find(a => a.id === c.toId);
                                    const targetHub = state.hubs.find(h => h.id === c.toId);
                                    if (targetAnchor) end = { x: targetAnchor.x, y: targetAnchor.y };
                                    else if (targetHub) end = { x: targetHub.x, y: targetHub.y };
                                } else {
                                    end = { x: anchor.x, y: anchor.y };
                                    const sourceAnchor = updatedAnchors.find(a => a.id === c.fromId);
                                    const sourceHub = state.hubs.find(h => h.id === c.fromId);
                                    if (sourceAnchor) start = { x: sourceAnchor.x, y: sourceAnchor.y };
                                    else if (sourceHub) {
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

                                const accPoints = [...c.points];
                                if (start) {
                                    if (accPoints.length > 2) {
                                        const dx = start.x - accPoints[0].x;
                                        const dy = start.y - accPoints[0].y;
                                        accPoints[1] = { x: accPoints[1].x + dx, y: accPoints[1].y + dy };
                                    }
                                    accPoints[0] = { x: start.x, y: start.y };
                                }
                                if (end) {
                                    if (accPoints.length > 2) {
                                        const lastIdx = accPoints.length - 1;
                                        const neighborIdx = accPoints.length - 2;
                                        const dx = end.x - accPoints[lastIdx].x;
                                        const dy = end.y - accPoints[lastIdx].y;
                                        accPoints[neighborIdx] = { x: accPoints[neighborIdx].x + dx, y: accPoints[neighborIdx].y + dy };
                                    }
                                    accPoints[accPoints.length - 1] = { x: end.x, y: end.y };
                                }

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
                });
                (api as any).temporal.getState().pause();
            },

            updateAnchors: (updatesBatch) => {
                (api as any).temporal.getState().resume();
                set((state) => {
                    const updateMap = new Map(updatesBatch.map(u => [u.id, u.updates]));
                    return {
                        anchors: state.anchors.map(a => {
                            const updates = updateMap.get(a.id);
                            return updates ? { ...a, ...updates } : a;
                        })
                    };
                });
                (api as any).temporal.getState().pause();
            },

            removeAnchor: (id) => {
                (api as any).temporal.getState().resume();
                set((state) => {
                    const incomingCables = state.cables.filter(c => c.toId === id);
                    const outgoingCables = state.cables.filter(c => c.fromId === id);
                    const newCables: Cable[] = [];

                    incomingCables.forEach(inc => {
                        outgoingCables.forEach(outc => {
                            let startPos: Point | undefined;
                            const fromHub = state.hubs.find(h => h.id === inc.fromId);
                            const fromAnchor = state.anchors.find(a => a.id === inc.fromId);
                            if (fromHub) startPos = { x: fromHub.x, y: fromHub.y };
                            else if (fromAnchor) startPos = { x: fromAnchor.x, y: fromAnchor.y };

                            const toAnchor = state.anchors.find(a => a.id === outc.toId);
                            let endPos: Point | undefined;
                            if (toAnchor) endPos = { x: toAnchor.x, y: toAnchor.y };

                            if (startPos && endPos) {
                                const routingWalls = state.allowOutsideConnections ? [] : state.walls;
                                const points = getOrthogonalPath(startPos, endPos, routingWalls);
                                const length = calculateLength(points, state.scaleRatio, state.cableSettings);

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

                    const remainingCables = state.cables.filter(c => c.toId !== id && c.fromId !== id);
                    return {
                        anchors: state.anchors.filter((a) => a.id !== id),
                        cables: [...remainingCables, ...newCables]
                    };
                });
                (api as any).temporal.getState().pause();
            },

            addHub: (hub) => {
                (api as any).temporal.getState().resume();
                set((state) => ({ hubs: [...state.hubs, hub] }));
                (api as any).temporal.getState().pause();
            },

            updateHub: (id, updates) => {
                (api as any).temporal.getState().resume();
                set((state) => ({
                    hubs: state.hubs.map(h => h.id === id ? { ...h, ...updates } : h)
                }));
                (api as any).temporal.getState().pause();
            },

            removeHub: (id) => {
                (api as any).temporal.getState().resume();
                set((state) => ({
                    hubs: state.hubs.filter(h => h.id !== id),
                    cables: state.cables.filter(c => c.fromId !== id && c.toId !== id)
                }));
                (api as any).temporal.getState().pause();
            },

            setCables: (cables) => {
                (api as any).temporal.getState().resume();
                set({ cables });
                (api as any).temporal.getState().pause();
            },

            addCable: (cable: Cable) => {
                (api as any).temporal.getState().resume();
                set((state) => ({
                    cables: [...(state.cables || []), cable]
                }));
                (api as any).temporal.getState().pause();
            },

            updateCable: (id, updates) => {
                (api as any).temporal.getState().resume();
                set((state) => ({
                    cables: (state.cables || []).map((c) => c.id === id ? { ...c, ...updates } : c)
                }));
                (api as any).temporal.getState().pause();
            },

            updateCables: (updatesBatch) => {
                (api as any).temporal.getState().resume();
                set((state) => {
                    const updateMap = new Map((updatesBatch || []).map(u => [u.id, u.updates]));
                    return {
                        cables: (state.cables || []).map(c => {
                            const updates = updateMap.get(c.id);
                            return updates ? { ...c, ...updates } : c;
                        })
                    };
                });
                (api as any).temporal.getState().pause();
            },

            removeCable: (id) => {
                (api as any).temporal.getState().resume();
                set((state) => ({ cables: state.cables.filter((c) => c.id !== id) }));
                (api as any).temporal.getState().pause();
            },

            regenerateCables: () => {
                (api as any).temporal.getState().resume();
                set((state) => {
                    const { hubs, anchors, walls, cableSettings, scaleRatio } = state;
                    if (!hubs.length || !anchors.length) return state;

                    const lockedCables = (state.cables || []).filter(c => c.locked);
                    const newCables: Cable[] = [...lockedCables];
                    const updatedHubs = [...hubs];
                    const lockedAnchorIds = new Set<string>();
                    lockedCables.forEach(c => {
                        lockedAnchorIds.add(c.toId);
                        lockedAnchorIds.add(c.fromId);
                    });

                    const freeAnchors = anchors.filter(a => !lockedAnchorIds.has(a.id));
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

                    updatedHubs.forEach((hub, index) => {
                        const groupAnchors = hubGroups.get(hub.id) || [];
                        if (groupAnchors.length === 0) return;

                        if (!hub.color) {
                            hub.color = getHubColor(index);
                        }
                        const groupColor = hub.color!;

                        if (cableSettings.topology === 'daisy') {
                            const paths = generateDaisyChain(
                                { x: hub.x, y: hub.y },
                                groupAnchors.map(a => ({ x: a.x, y: a.y })),
                                state.allowOutsideConnections ? [] : walls
                            );

                            let prevId = hub.id;
                            paths.forEach((pointsPath) => {
                                const endPoint = pointsPath[pointsPath.length - 1];
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
                            const anchorsWithAngles = groupAnchors.map(anchor => {
                                const dx = anchor.x - hub.x;
                                const dy = anchor.y - hub.y;
                                const angle = Math.atan2(dy, dx);
                                return { anchor, angle };
                            });

                            const availablePorts = Array.from({ length: hub.capacity }, (_, i) => i);
                            anchorsWithAngles.forEach(({ anchor, angle }) => {
                                if (availablePorts.length === 0) return;

                                let bestPortIdx = -1;
                                let minDiff = Infinity;
                                let bestIndexInAvailable = -1;

                                availablePorts.forEach((pIdx, arrIdx) => {
                                    const portAngleRad = ((pIdx * 360) / hub.capacity - 90) * (Math.PI / 180);
                                    let diff = Math.abs(angle - portAngleRad);
                                    if (diff > Math.PI) diff = 2 * Math.PI - diff;

                                    if (diff < minDiff) {
                                        minDiff = diff;
                                        bestPortIdx = pIdx;
                                        bestIndexInAvailable = arrIdx;
                                    }
                                });

                                if (bestIndexInAvailable !== -1) {
                                    availablePorts.splice(bestIndexInAvailable, 1);
                                    const targetPort = getHubPortCoordinates({ x: hub.x, y: hub.y }, hub.capacity, bestPortIdx);
                                    const path = getOrthogonalPath(targetPort, { x: anchor.x, y: anchor.y }, state.allowOutsideConnections ? [] : walls);

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
                });
                (api as any).temporal.getState().pause();
            },

            toggleLayer: (layer) => set((state) => {
                const newValue = !state.layers[layer];
                const newLayers = { ...state.layers, [layer]: newValue };
                if (layer === 'walls') {
                    newLayers.rooms = newValue;
                    newLayers.roomLabels = newValue;
                }
                if (layer === 'anchors') {
                    newLayers.heatmap = newValue;
                }
                return { layers: newLayers };
            }),

            activeImportId: null,

            addImportedObject: (obj) => {
                (api as any).temporal.getState().resume();
                set((state) => {
                    const newId = uuidv4();
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
                        } as unknown as ImportedObject]
                    };
                });
                (api as any).temporal.getState().pause();
            },

            updateImportedObject: (id, updates) => {
                (api as any).temporal.getState().resume();
                set((state) => ({
                    importedObjects: state.importedObjects.map((obj) =>
                        obj.id === id ? { ...obj, ...updates } as ImportedObject : obj
                    )
                }));
                (api as any).temporal.getState().pause();
            },

            removeImportedObject: (id) => {
                (api as any).temporal.getState().resume();
                set((state) => ({
                    importedObjects: state.importedObjects.filter((obj) => obj.id !== id),
                    activeImportId: state.activeImportId === id ? null : state.activeImportId
                }));
                (api as any).temporal.getState().pause();
            },

            setActiveImportId: (id) => set({ activeImportId: id }),

            setDxfLayerVisibility: (layerName, visible) => {
                (api as any).temporal.getState().resume();
                set((state) => ({
                    importedObjects: state.importedObjects.map(obj => {
                        if (obj.type === 'dxf') {
                            return {
                                ...obj,
                                layers: { ...obj.layers, [layerName]: visible }
                            };
                        }
                        return obj;
                    })
                }));
                (api as any).temporal.getState().pause();
            },

            setAllDxfLayersVisibility: (visible) => {
                (api as any).temporal.getState().resume();
                set((state) => ({
                    importedObjects: state.importedObjects.map(obj => {
                        if (obj.type === 'dxf') {
                            const newLayers = { ...obj.layers };
                            Object.keys(newLayers).forEach(k => newLayers[k] = visible);
                            return { ...obj, layers: newLayers };
                        }
                        return obj;
                    })
                }));
                (api as any).temporal.getState().pause();
            },

            addDimension: (dim) => {
                (api as any).temporal.getState().resume();
                set((state) => ({
                    dimensions: [...state.dimensions, { ...dim, id: uuidv4() }]
                }));
                (api as any).temporal.getState().pause();
            },

            updateDimension: (id, updates) => {
                (api as any).temporal.getState().resume();
                set((state) => ({
                    dimensions: state.dimensions.map((d) => (d.id === id ? { ...d, ...updates } : d)),
                }));
                (api as any).temporal.getState().pause();
            },

            removeDimension: (id) => {
                (api as any).temporal.getState().resume();
                set((state) => ({
                    dimensions: state.dimensions.filter((d) => d.id !== id)
                }));
                (api as any).temporal.getState().pause();
            },

            groupAnchors: (ids) => {
                (api as any).temporal.getState().resume();
                set((state) => {
                    const validAnchors = state.anchors.filter(a => ids.includes(a.id));
                    if (validAnchors.length < 2) return state;
                    const newGroupId = uuidv4();
                    return {
                        anchors: state.anchors.map(a =>
                            ids.includes(a.id) ? { ...a, groupId: newGroupId } : a
                        )
                    };
                });
                (api as any).temporal.getState().pause();
            },

            ungroupAnchors: (ids) => {
                (api as any).temporal.getState().resume();
                set((state) => {
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
                });
                (api as any).temporal.getState().pause();
            },

            loadProject: (data) => set((state) => {
                if (!data || !data.walls) {
                    console.error("Invalid project data");
                    return state;
                }
                return {
                    version: data.version,
                    lastLoaded: data.timestamp,
                    scaleRatio: data.scaleRatio,
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
                    isScaleSet: true,
                    allowOutsideConnections: data.allowOutsideConnections ?? state.allowOutsideConnections,
                    importedObjects: data.importedObjects || [],
                };
            }),

            newProject: () => {
                const temporal = (api as any).temporal.getState();
                temporal.clear(); // Clear history on new project
                set(() => ({
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
                }));
                (api as any).temporal.getState().pause(); // Ensure it stays paused
            },

            // Clipboard Implementation
            clipboard: null,

            optimizeAnchorCount: (percentage, scope = 'all') => {
                (api as any).temporal.getState().resume();
                set((state) => {
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
                });
                (api as any).temporal.getState().pause();
            },

            copySelection: () => {
                // Clipboard usually doesn't need to be in history, but we wrap it just in case state change is detected.
                // Actually copySelection only sets 'clipboard' state, which is partialize-excluded.
                // But for consistency let's just set it directly.
                set((state) => {
                    const walls = state.walls.filter(w => state.selectedIds.includes(w.id));
                    const anchors = state.anchors.filter(a => state.selectedIds.includes(a.id));

                    if (walls.length === 0 && anchors.length === 0) return state;

                    return {
                        clipboard: { walls, anchors }
                    };
                });
            },

            pasteClipboard: () => {
                (api as any).temporal.getState().resume();
                set((state) => {
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
                        const prefix = a.id.startsWith('M') ? 'M' : 'A';
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
                });
                (api as any).temporal.getState().pause();
            },

            addRectangleWalls: (rectWalls: Partial<Wall>[], splitPoints: { id: string, point: Point }[]) => {
                (api as any).temporal.getState().resume();
                set((state) => {
                    let currentWalls = [...state.walls];

                    // 1. Perform Splits first
                    splitPoints.forEach((sp: { id: string, point: Point }) => {
                        const wallToSplit = currentWalls.find(w => w.id === sp.id);
                        if (!wallToSplit) return;

                        const p1 = { x: wallToSplit.points[0], y: wallToSplit.points[1] };
                        const p2 = { x: wallToSplit.points[2], y: wallToSplit.points[3] };
                        const inter = sp.point;

                        const d1 = Math.hypot(p1.x - inter.x, p1.y - inter.y);
                        const d2 = Math.hypot(p2.x - inter.x, p2.y - inter.y);

                        if (d1 > 0.1 && d2 > 0.1) {
                            const w1: Wall = { ...wallToSplit, id: uuidv4(), points: [p1.x, p1.y, inter.x, inter.y] as [number, number, number, number] };
                            const w2: Wall = { ...wallToSplit, id: uuidv4(), points: [inter.x, inter.y, p2.x, p2.y] as [number, number, number, number] };
                            currentWalls = currentWalls.filter(w => w.id !== wallToSplit.id);
                            currentWalls.push(w1, w2);
                        }
                    });

                    // 2. Add Rectangle Walls (using same logic as addWalls but simplified for internal use)
                    const params = {
                        thickness: rectWalls[0]?.thickness || 0.1,
                        material: rectWalls[0]?.material || 'drywall'
                    };

                    const newIds: string[] = [];
                    rectWalls.forEach((rw: Partial<Wall>) => {
                        const id = uuidv4();
                        newIds.push(id);
                        if (rw.points && rw.points.length === 4) {
                            const pts: [number, number, number, number] = [rw.points[0], rw.points[1], rw.points[2], rw.points[3]];
                            currentWalls.push({
                                ...rw,
                                id,
                                points: pts,
                                thickness: rw.thickness || params.thickness,
                                material: rw.material as any || params.material
                            } as Wall);
                        }
                    });

                    return { walls: currentWalls };
                });
                (api as any).temporal.getState().pause();
            },

            removeObjects: (ids) => {
                (api as any).temporal.getState().resume();
                set((state) => {
                    const idsToRemove = new Set(ids);
                    if (idsToRemove.size === 0) return state;

                    return {
                        walls: state.walls.filter(w => !idsToRemove.has(w.id)),
                        anchors: state.anchors.filter(a => !idsToRemove.has(a.id)),
                        hubs: state.hubs.filter(h => !idsToRemove.has(h.id)),
                        cables: state.cables.filter(c => !idsToRemove.has(c.id) && !idsToRemove.has(c.fromId) && !idsToRemove.has(c.toId)),
                        dimensions: state.dimensions.filter(d => !idsToRemove.has(d.id)),
                        selectedIds: state.selectedIds.filter(id => !idsToRemove.has(id))
                    };
                });
                (api as any).temporal.getState().pause();
            },
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

// Start with history paused. We will manually resume/pause to create save points.
useProjectStore.temporal.getState().pause();
