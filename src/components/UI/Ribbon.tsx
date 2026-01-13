import React from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { ToolbarButton } from './ToolbarButton';
import { DXFLayerManager } from './DXFLayerManager';
import {
    MousePointer2,
    Square,
    Ruler,
    Scaling,
    Wifi,
    Download,
    Upload,
    Info,
    PenTool,
    Undo2,
    Redo2,
    Wand2, // Icon for Detection
    Grid, // Icon for Rooms
    Type, // Icon for Labels
    Signal, // Icon for Heatmap
    Map, // Icon for Offsets
    Network, // Icon for Skeleton
    FileUp // NEW Icon
} from 'lucide-react';
import { WallDetectionModal } from './WallDetectionModal';
import { SettingsPanel } from './SettingsPanel';
import { Settings } from 'lucide-react';



// Custom Icons
const RectWallIcon = ({ size, ...props }: any) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="5" cy="7" r="3" fill="#ef4444" stroke="none" />
        <circle cx="19" cy="17" r="3" fill="#ef4444" stroke="none" />
    </svg>
);

const RectFromWallIcon = ({ size, ...props }: any) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <rect x="4" y="4" width="16" height="16" rx="1" />
        <circle cx="4" cy="20" r="3" fill="#ef4444" stroke="none" />
        <circle cx="20" cy="20" r="3" fill="#ef4444" stroke="none" />
        <circle cx="20" cy="4" r="3" fill="#ef4444" stroke="none" />
    </svg>
);

export const Ribbon: React.FC = () => {
    const {
        activeTool,
        setTool,
        wallPreset,
        setWallPreset,
        setStandardWallThickness,
        anchorMode,
        setAnchorMode,
        layers,
        toggleLayer,
        isScaleSet,
        // Geometry
        showOffsets, setShowOffsets,
        offsetStep, setOffsetStep,
        showSkeleton, setShowSkeleton,
        showMedialAxis, setShowMedialAxis,
        medialAxisStep, setMedialAxisStep
    } = useProjectStore();

    const [isConfigOpen, setIsConfigOpen] = React.useState<boolean | string>(false);
    const [isLayerManagerOpen, setIsLayerManagerOpen] = React.useState(false);
    const { isAutoPlacementOpen, setIsAutoPlacementOpen } = useProjectStore();
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Normalize check
    const shouldShowConfig = isConfigOpen;

    const [isDetectionModalOpen, setIsDetectionModalOpen] = React.useState(false);
    const { addWalls, activeImportId, importedObjects } = useProjectStore();
    const activeImport = activeImportId ? importedObjects.find(o => o.id === activeImportId) : null;

    return (
        <div className="h-16 panel-bg border-b panel-border flex items-center px-4 shadow-xl z-20 relative select-none">


            {/* Config Modal Overlay */}
            {isConfigOpen === true && (
                <div className="absolute top-16 left-0 w-64 panel-bg border panel-border p-3 shadow-2xl rounded-b-lg z-50 text-white animate-in slide-in-from-top-2">
                    <h3 className="text-xs font-bold mb-2 uppercase text-secondary">Wall Settings</h3>
                    <div className="flex flex-col space-y-2 mb-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-secondary">Standard (m):</span>
                            <input
                                type="number"
                                step="0.05"
                                value={useProjectStore.getState().standardWallThickness}
                                onChange={(e) => setStandardWallThickness(parseFloat(e.target.value) || 0.1)}
                                className="input-bg border panel-border rounded px-2 py-1 text-xs w-16 focus:outline-none focus:border-blue-500 text-primary"
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-secondary">Thick (m):</span>
                            <input
                                type="number"
                                step="0.05"
                                value={useProjectStore.getState().thickWallThickness}
                                onChange={(e) => useProjectStore.getState().setThickWallThickness(parseFloat(e.target.value) || 0.2)}
                                className="input-bg border panel-border rounded px-2 py-1 text-xs w-16 focus:outline-none focus:border-blue-500 text-primary"
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-300">Wide (m):</span>
                            <input
                                type="number"
                                step="0.05"
                                value={useProjectStore.getState().wideWallThickness}
                                onChange={(e) => useProjectStore.getState().setWideWallThickness(parseFloat(e.target.value) || 0.3)}
                                className="bg-[#222] border border-[#444] rounded px-2 py-1 text-xs w-16 focus:outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end space-x-2">
                        <button
                            onClick={() => setIsConfigOpen(false)}
                            className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-500"
                        >Done</button>
                    </div>
                </div>
            )}

            {/* Wall Detection Modal */}
            {isDetectionModalOpen && activeImport && activeImport.type === 'image' && (
                <div className="absolute z-50">
                    <WallDetectionModal
                        imageSrc={activeImport.src!}
                        onClose={() => setIsDetectionModalOpen(false)}
                        onImport={(lines, detectedScale) => {
                            const scale = detectedScale || activeImport.scale || 1;
                            const offsetX = activeImport.x || 0;
                            const offsetY = activeImport.y || 0;

                            const newWalls = lines.map(line => ({
                                points: [
                                    line.x1 * scale + offsetX,
                                    line.y1 * scale + offsetY,
                                    line.x2 * scale + offsetX,
                                    line.y2 * scale + offsetY
                                ] as [number, number, number, number],
                                material: 'concrete' as const,
                                thickness: useProjectStore.getState().standardWallThickness,
                                attenuation: 0
                            }));
                            addWalls(newWalls);
                            setIsDetectionModalOpen(false);
                        }}
                    />
                </div>
            )}

            {/* Title / Logo */}
            <div className="mr-1 flex flex-col justify-center">
                <h1 className="text-primary font-bold text-xs leading-none tracking-widest">ANCHOR<span className="text-accent">CAD</span></h1>
                <span className="text-[10px] text-secondary uppercase tracking-widest">Planner 3.0</span>
            </div>

            <div className="h-10 w-px bg-[var(--border-color)] mx-1"></div>

            {/* Edit Group */}
            <div className="flex flex-col items-center px-1">
                <span className="text-[10px] text-secondary mb-1 uppercase scale-90">Edit</span>
                <div className="flex space-x-0.5">
                    <ToolbarButton icon={MousePointer2} label="Select" active={activeTool === 'select'} onClick={() => setTool('select')} tooltip="Select (V / Esc)" iconSize={16} className="p-1.5" />
                    <div className="w-px h-6 bg-[var(--border-color)] mx-1"></div>
                    <ToolbarButton icon={Undo2} label="Undo" onClick={() => useProjectStore.temporal.getState().undo()} tooltip="Undo (Ctrl+Z)" iconSize={16} className="p-1.5" />
                    <ToolbarButton icon={Redo2} label="Redo" onClick={() => useProjectStore.temporal.getState().redo()} tooltip="Redo (Ctrl+Shift+Z)" iconSize={16} className="p-1.5" />
                </div>
            </div>

            <div className="h-10 w-px bg-[var(--border-color)] mx-2"></div>

            {/* Draw Group */}
            <div className="flex flex-col items-center px-1">
                <span className="text-[10px] text-secondary mb-1 uppercase scale-90">Draw</span>
                <div className="flex items-center space-x-2">
                    <div className="flex space-x-0.5">
                        <ToolbarButton icon={PenTool} label="Wall" active={activeTool === 'wall'} onClick={() => setTool('wall')} tooltip="Draw Linear Wall (W)" iconSize={16} className="p-1.5" />
                        <ToolbarButton icon={RectWallIcon as any} label="Rect" active={activeTool === 'wall_rect'} onClick={() => setTool('wall_rect')} tooltip="Draw Rectangular Wall (R)" iconSize={16} className="p-1.5" />
                        <ToolbarButton icon={RectFromWallIcon as any} label="3-Pt Rect" active={activeTool === 'wall_rect_edge'} onClick={() => setTool('wall_rect_edge')} tooltip="3-Point Rectangle (Start, Base End, Height)" iconSize={16} className="p-1.5" />
                    </div>

                    {/* Presets - Vertical Stack - IMPROVED LAYOUT */}
                    <div className="flex flex-col space-y-1 justify-center border-l panel-border pl-2 h-full py-1">
                        <button onClick={() => setWallPreset('thick')} className={`text-[10px] px-2 py-0.5 rounded leading-none transition-colors ${wallPreset === 'thick' ? 'bg-[#0078d4] text-white' : 'hover:bg-[#333] text-secondary'}`}>Thick</button>
                        <button onClick={() => setWallPreset('wide')} className={`text-[10px] px-2 py-0.5 rounded leading-none transition-colors ${wallPreset === 'wide' ? 'bg-[#0078d4] text-white' : 'hover:bg-[#333] text-secondary'}`}>Wide</button>
                    </div>
                </div>
            </div>

            <div className="h-10 w-px bg-[var(--border-color)] mx-2"></div>

            {/* Measure Group */}
            <div className="flex flex-col items-center px-1">
                <span className="text-[10px] text-secondary mb-1 uppercase scale-90">Measure</span>
                <div className="flex space-x-0.5">
                    <ToolbarButton icon={Ruler} label="Dim" active={activeTool === 'dimension'} onClick={() => setTool('dimension')} tooltip="Dimension (D)" iconSize={16} className="p-1.5" />
                    <ToolbarButton icon={Scaling} label="Scale" active={activeTool === 'scale'} onClick={() => setTool('scale')} tooltip="Set Scale (S)" iconSize={16} className={`p-1.5 ${!isScaleSet ? 'text-orange-500 dark:text-[#ffaa00]' : ''}`} />
                </div>
            </div>

            <div className="h-10 w-px bg-[var(--border-color)] mx-2"></div>





            {/* Import Group */}
            <div className="flex flex-col items-center px-1">
                <span className="text-[10px] text-secondary mb-1 uppercase scale-90">Import</span>
                <div className="flex space-x-0.5">
                    <label className="cursor-pointer flex items-center justify-center p-1.5 rounded hover:bg-[#333] transition-colors text-secondary hover:text-white" title="Import File (DXF, PDF, IMG)">
                        <Upload size={16} />
                        <input type="file" accept=".png, .jpg, .jpeg, .pdf, .dxf" className="hidden" onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const ext = file.name.split('.').pop()?.toLowerCase();
                            try {
                                const state = useProjectStore.getState();
                                if (ext === 'dxf') {
                                    const { importDXF } = await import('../../utils/importers/importDXF');
                                    const data = await importDXF(file);
                                    const layers: Record<string, boolean> = {};
                                    if (data && data.tables?.layer?.layers) {
                                        Object.keys(data.tables.layer.layers).forEach(name => layers[name] = true);
                                    }
                                    state.addImportedObject({ type: 'dxf', name: file.name, data, layers, width: data.extents?.width || 100, height: data.extents?.height || 100 } as any);
                                    setIsLayerManagerOpen(true);
                                } else if (ext === 'pdf') {
                                    const { importPDF } = await import('../../utils/importers/importPDF');
                                    const img = await importPDF(file);
                                    state.addImportedObject({ type: 'image', name: file.name, src: img.src, width: img.width, height: img.height } as any);
                                } else if (['png', 'jpg', 'jpeg'].includes(ext || '')) {
                                    const { importImage } = await import('../../utils/importers/importImage');
                                    const img = await importImage(file);
                                    state.addImportedObject({ type: 'image', name: file.name, src: img.src, width: img.width, height: img.height } as any);
                                } else {
                                    alert('Unsupported file type: ' + ext);
                                }
                            } catch (err) { console.error(err); alert(`Failed to import ${ext?.toUpperCase()} file.`); }
                            e.target.value = '';
                        }} />
                    </label>

                    <button
                        onClick={() => setIsLayerManagerOpen(!isLayerManagerOpen)}
                        className={`p-1.5 rounded hover:bg-[#333] transition-colors flex items-center justify-center ${isLayerManagerOpen ? 'bg-[#333] text-blue-400' : 'text-secondary'}`}
                        title="DXF Layers Manager"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                    </button>
                </div>
            </div>

            <div className="h-10 w-px bg-[var(--border-color)] mx-2"></div>



            {/* Add Devices Group */}
            <div className="flex flex-col items-center px-1">
                <span className="text-[10px] text-secondary mb-1 uppercase scale-90">Add Devices</span>
                <div className="flex space-x-0.5 relative">
                    <ToolbarButton icon={Wifi} label="Manual" active={activeTool === 'anchor' && anchorMode === 'manual'} onClick={() => { setTool('anchor'); setAnchorMode('manual'); }} tooltip="Manual Anchor (A)" iconSize={16} className="p-1.5" />


                    <button
                        onClick={() => {
                            if (isAutoPlacementOpen) {
                                setIsAutoPlacementOpen(false);
                            } else {
                                setIsAutoPlacementOpen(true);
                                useProjectStore.getState().setIsExportSidebarOpen(false);
                            }
                        }}
                        className={`p-1.5 rounded hover:bg-[#333] transition-colors flex flex-col items-center ${isAutoPlacementOpen ? 'bg-[#333] text-white shadow-inner' : 'text-blue-400'}`}
                        title="Auto-Place Sidebar"
                    >
                        <Wand2 size={16} />
                    </button>

                    <div className="w-px h-6 bg-[var(--border-color)] mx-1"></div>

                    <button onClick={() => setIsConfigOpen(isConfigOpen === 'anchors' ? false : 'anchors' as any)} className={`p-1.5 rounded hover:bg-[#333] ${useProjectStore.getState().showAnchorRadius ? 'text-blue-400' : 'text-gray-400'}`} title="Anchor Settings">
                        <Settings size={16} />
                    </button>
                    {shouldShowConfig === 'anchors' && (
                        <div className="absolute top-12 left-0 w-56 bg-[#333] border border-[#555] p-3 shadow-2xl rounded z-50 text-white animate-in slide-in-from-top-2">
                            {/* ... Anchor Settings Content (Unchanged) ... */}
                            {/* Re-implementing compact settings if needed or keep existing popup */}
                            <h3 className="text-xs font-bold mb-2 uppercase text-gray-400">Anchor Settings</h3>
                            <div className="flex flex-col space-y-3">
                                <div className="flex flex-col space-y-1">
                                    <span className="text-xs text-gray-300">Radius (m)</span>
                                    <input type="number" value={useProjectStore.getState().anchorRadius} onChange={(e) => useProjectStore.getState().setAnchorRadius(parseFloat(e.target.value) || 0)} className="bg-[#222] border border-[#444] rounded px-2 py-1 text-xs w-full" />
                                </div>
                                <div className="flex flex-col space-y-1">
                                    <span className="text-xs text-gray-300">Coverage Shape</span>
                                    <div className="flex space-x-1">
                                        <button onClick={() => useProjectStore.getState().setAnchorShape('circle')} className={`flex-1 py-1 rounded text-[10px] ${useProjectStore.getState().anchorShape === 'circle' ? 'bg-blue-600' : 'bg-[#444]'}`}>Circle</button>
                                        <button onClick={() => useProjectStore.getState().setAnchorShape('square')} className={`flex-1 py-1 rounded text-[10px] ${useProjectStore.getState().anchorShape === 'square' ? 'bg-blue-600' : 'bg-[#444]'}`}>Square</button>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pt-2 border-t border-[#444]">
                                    <span className="text-xs text-gray-300">Show Radius</span>
                                    <button onClick={() => useProjectStore.getState().setShowAnchorRadius(!useProjectStore.getState().showAnchorRadius)} className={`w-8 h-4 rounded-full relative transition-colors ${useProjectStore.getState().showAnchorRadius ? 'bg-green-500' : 'bg-[#555]'}`}>
                                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${useProjectStore.getState().showAnchorRadius ? 'left-4.5' : 'left-0.5'}`} style={{ left: useProjectStore.getState().showAnchorRadius ? '18px' : '2px' }}></div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="h-10 w-px bg-[var(--border-color)] mx-2"></div>

            {/* Layers Group */}
            <div className="flex flex-col items-center px-1">
                <span className="text-[10px] text-secondary mb-1 uppercase scale-90">Layers</span>
                <div className="grid grid-rows-2 grid-flow-col gap-0.5">
                    <button onClick={() => toggleLayer('floorplan')} title="Show/Hide Floorplan" className={`p-0.5 rounded hover:bg-[#333] ${layers.floorplan ? 'text-blue-400' : 'text-secondary'}`}> <Upload size={14} /> </button>
                    <button onClick={() => toggleLayer('dimensions')} title="Show/Hide Dimensions" className={`p-0.5 rounded hover:bg-[#333] ${layers.dimensions ? 'text-blue-400' : 'text-secondary'}`}> <Ruler size={14} /> </button>
                    <button onClick={() => toggleLayer('walls')} title="Show/Hide Walls" className={`p-0.5 rounded hover:bg-[#333] ${layers.walls ? 'text-blue-400' : 'text-secondary'}`}> <Square size={14} /> </button>
                    <div className="w-4 h-4"></div>
                    <button onClick={() => toggleLayer('roomLabels')} title="Show/Hide Room Labels" className={`p-0.5 rounded hover:bg-[#333] ${layers.roomLabels ? 'text-blue-400' : 'text-secondary'}`}> <Type size={14} /> </button>
                    <button onClick={() => toggleLayer('rooms')} title="Show/Hide Rooms" className={`p-0.5 rounded hover:bg-[#333] ${layers.rooms ? 'text-blue-400' : 'text-secondary'}`}> <Grid size={14} /> </button>
                </div>
            </div>

            <div className="h-10 w-px bg-[var(--border-color)] mx-2"></div>

            {/* Anchors View Group - FIXED */}
            <div className="flex flex-col items-center px-1">
                <span className="text-[10px] text-secondary mb-1 uppercase scale-90">Anchors</span>
                <div className="flex space-x-1 items-center h-full pb-1">
                    {/* Stacked Toggles */}
                    <div className="flex flex-col space-y-1 justify-center border-r panel-border pr-2 mr-1 h-full py-1">
                        <button
                            onClick={() => toggleLayer('anchors')}
                            title="Toggle Anchors Visibility"
                            className={`flex items-center justify-center w-6 h-3.5 rounded transition-colors ${layers.anchors ? 'bg-[#0078d4] text-white' : 'hover:bg-[#333] text-secondary'}`}
                        >
                            <Wifi size={12} />
                        </button>
                        <button
                            onClick={() => useProjectStore.getState().setShowAnchorRadius(!useProjectStore.getState().showAnchorRadius)}
                            title="Toggle Radius Circles"
                            className={`flex items-center justify-center w-6 h-3.5 rounded transition-colors ${useProjectStore.getState().showAnchorRadius ? 'bg-[#0078d4] text-white' : 'hover:bg-[#333] text-secondary'}`}
                        >
                            <div className="w-2.5 h-2.5 border rounded-full border-current"></div>
                        </button>
                    </div>

                    {/* Heatmap Toggle */}
                    <button
                        onClick={() => useProjectStore.getState().setShowHeatmap(!useProjectStore.getState().showHeatmap)}
                        className={`flex items-center justify-center p-1.5 rounded hover:bg-[#333] transition-colors ${useProjectStore.getState().showHeatmap ? 'bg-[#222] text-green-500' : 'text-secondary'}`}
                        title="Toggle Signal Heatmap"
                    >
                        <Signal size={18} />
                    </button>

                    {/* Heatmap Resolution Stack */}
                    <div className="flex flex-col space-y-1 justify-center border-l panel-border pl-2 h-full py-1">
                        <button onClick={() => useProjectStore.getState().setHeatmapResolution(50)} className={`text-[10px] px-2 py-0.5 rounded leading-none transition-colors ${useProjectStore.getState().heatmapResolution === 50 ? 'bg-[#0078d4] text-white' : 'hover:bg-[#333] text-secondary'}`}>Low</button>
                        <button onClick={() => useProjectStore.getState().setHeatmapResolution(20)} className={`text-[10px] px-2 py-0.5 rounded leading-none transition-colors ${useProjectStore.getState().heatmapResolution === 20 ? 'bg-[#0078d4] text-white' : 'hover:bg-[#333] text-secondary'}`}>High</button>
                    </div>
                </div>
            </div>

            <div className="h-10 w-px bg-[var(--border-color)] mx-2"></div>



            <div className="flex-grow"></div>

            {/* ... File & Info Groups (Unchanged) ... */}
            <div className="flex items-center space-x-1 px-4 border-l panel-border">
                {/* LOAD Button (Triggered via Ref) */}
                <div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;

                            console.log("Loading file:", file.name);
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                                try {
                                    const content = ev.target?.result as string;
                                    console.log("File content length:", content.length);
                                    const json = JSON.parse(content);

                                    // Basic validation
                                    if (!json || (!json.walls && !json.anchors)) {
                                        throw new Error("Invalid project file format");
                                    }

                                    useProjectStore.getState().loadProject(json);
                                    console.log("Project loaded successfully");

                                    // Reset file input so same file can be selected again
                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                } catch (err) {
                                    alert("Failed to load project: " + (err instanceof Error ? err.message : String(err)));
                                    console.error("Load Error:", err);
                                }
                            };
                            reader.readAsText(file);
                        }}
                    />
                    <ToolbarButton
                        icon={Upload}
                        label="Load"
                        onClick={() => fileInputRef.current?.click()}
                        tooltip="Load Project (JSON)..."
                        className="opacity-80 hover:opacity-100 p-1.5"
                        iconSize={16}
                    />
                </div>

                {/* SAVE AS Button */}
                <ToolbarButton
                    icon={Download}
                    label="Save As"
                    onClick={async () => {
                        const state = useProjectStore.getState();
                        const data = {
                            version: 1,
                            timestamp: Date.now(),
                            scaleRatio: state.scaleRatio,
                            walls: state.walls,
                            anchors: state.anchors,
                            dimensions: state.dimensions,
                            layers: state.layers,
                            wallPreset: state.wallPreset,
                            anchorMode: state.anchorMode,
                            theme: state.theme,
                            anchorsSettings: {
                                radius: state.anchorRadius,
                                shape: state.anchorShape,
                                showRadius: state.showAnchorRadius
                            },
                            heatmapSettings: {
                                show: state.showHeatmap,
                                resolution: state.heatmapResolution,
                                thresholds: state.heatmapThresholds
                            },
                            importedObjects: state.importedObjects
                        };

                        try {
                            // 1. Try Native File System API (Chrome/Edge)
                            if ('showSaveFilePicker' in window) {
                                const handle = await (window as any).showSaveFilePicker({
                                    suggestedName: `project-${new Date().toISOString().slice(0, 10)}.json`,
                                    types: [{
                                        description: 'Anchor Project',
                                        accept: { 'application/json': ['.json'] },
                                    }],
                                });
                                const writable = await handle.createWritable();
                                await writable.write(JSON.stringify(data, null, 2));
                                await writable.close();
                            } else {
                                // 2. Fallback: Prompt for name and Auto-Download
                                const name = prompt("Enter file name:", `project-${new Date().toISOString().slice(0, 10)}`);
                                if (!name) return; // Cancelled

                                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `${name}.json`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                            }
                        } catch (err: any) {
                            if (err.name !== 'AbortError') {
                                console.error('Save failed:', err);
                                alert('Failed to save project.');
                            }
                        }
                    }}
                    tooltip="Save Project As..."
                    className="opacity-80 hover:opacity-100 p-1.5"
                    iconSize={16}
                />

                <div className="w-px h-6 bg-[var(--border-color)] mx-2"></div>
                <ToolbarButton
                    icon={FileUp}
                    label="Export"
                    active={useProjectStore.getState().isExportSidebarOpen}
                    onClick={() => {
                        const { isExportSidebarOpen, setIsExportSidebarOpen, setIsAutoPlacementOpen } = useProjectStore.getState();
                        if (isExportSidebarOpen) {
                            setIsExportSidebarOpen(false);
                        } else {
                            setIsExportSidebarOpen(true);
                            setIsAutoPlacementOpen(false);
                        }
                    }}
                    tooltip="Export Image/PDF"
                    className={`opacity-80 hover:opacity-100 p-1.5 ${useProjectStore.getState().isExportSidebarOpen ? 'text-blue-400' : ''}`}
                    iconSize={16}
                />

                <div className="w-px h-6 bg-[var(--border-color)] mx-2"></div>
                <ToolbarButton icon={Settings} label="Global" active={useProjectStore.getState().isSettingsOpen} onClick={() => useProjectStore.getState().setIsSettingsOpen(!useProjectStore.getState().isSettingsOpen)} tooltip="Global Settings" iconSize={16} className="p-1.5" />
                <ToolbarButton icon={Info} label="Info" onClick={() => console.log('Info')} tooltip="About Anchor Planner" className="text-blue-400 hover:text-blue-300" iconSize={16} />
            </div>

            <SettingsPanel />

            {/* Render DXF Layer Manager floating */}
            {isLayerManagerOpen && <DXFLayerManager onClose={() => setIsLayerManagerOpen(false)} />}
        </div>
    );
};
