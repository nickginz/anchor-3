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
    Activity,
    Undo2,
    Redo2,
    Wand2, // Icon for Detection
    Grid, // Icon for Rooms
    Type, // Icon for Labels
    Signal // Icon for Heatmap
} from 'lucide-react';
import { WallDetectionModal } from './WallDetectionModal';
import { SettingsPanel } from './SettingsPanel';
import { Settings } from 'lucide-react';

import { AutoPlacementModal } from './AutoPlacementModal';

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
        <path d="M2 21h20" stroke="currentColor" strokeOpacity="0.5" />
        <rect x="5" y="5" width="14" height="12" />
        <circle cx="5" cy="21" r="3" fill="#ef4444" stroke="none" />
        <circle cx="19" cy="21" r="3" fill="#ef4444" stroke="none" />
        <path d="M5 17v4 M19 17v4" stroke="currentColor" strokeDasharray="2 2" />
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
        isScaleSet
    } = useProjectStore();

    const [isConfigOpen, setIsConfigOpen] = React.useState<boolean | string>(false);
    const [isLayerManagerOpen, setIsLayerManagerOpen] = React.useState(false);
    const [isAutoPlacementOpen, setIsAutoPlacementOpen] = React.useState(false);

    // Normalize check
    const shouldShowConfig = isConfigOpen;

    const [isDetectionModalOpen, setIsDetectionModalOpen] = React.useState(false);
    const { addWalls, activeImportId, importedObjects } = useProjectStore();
    const activeImport = activeImportId ? importedObjects.find(o => o.id === activeImportId) : null;

    return (
        <div className="h-16 bg-[#2b2b2b] border-b border-[#1f1f1f] flex items-center px-4 shadow-xl z-20 relative select-none">
            {/* Auto Placement Modal */}
            {isAutoPlacementOpen && <AutoPlacementModal onClose={() => setIsAutoPlacementOpen(false)} />}

            {/* Config Modal Overlay */}
            {isConfigOpen === true && (
                <div className="absolute top-16 left-0 w-64 bg-[#333] border border-[#555] p-3 shadow-2xl rounded-b-lg z-50 text-white animate-in slide-in-from-top-2">
                    <h3 className="text-xs font-bold mb-2 uppercase text-gray-400">Wall Settings</h3>
                    <div className="flex flex-col space-y-2 mb-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-300">Standard (m):</span>
                            <input
                                type="number"
                                step="0.05"
                                value={useProjectStore.getState().standardWallThickness}
                                onChange={(e) => setStandardWallThickness(parseFloat(e.target.value) || 0.1)}
                                className="bg-[#222] border border-[#444] rounded px-2 py-1 text-xs w-16 focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-300">Thick (m):</span>
                            <input
                                type="number"
                                step="0.05"
                                value={useProjectStore.getState().thickWallThickness}
                                onChange={(e) => useProjectStore.getState().setThickWallThickness(parseFloat(e.target.value) || 0.2)}
                                className="bg-[#222] border border-[#444] rounded px-2 py-1 text-xs w-16 focus:outline-none focus:border-blue-500"
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
            <div className="mr-6 flex flex-col justify-center">
                <h1 className="text-white font-bold text-lg leading-none tracking-tight">ANCHOR<span className="text-[#0078d4]">CAD</span></h1>
                <span className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Planner 3.0</span>
            </div>

            <div className="h-10 w-px bg-[#444] mx-2"></div>

            {/* Edit Group */}
            <div className="flex flex-col items-center px-1">
                <span className="text-[10px] text-gray-500 mb-1 uppercase scale-90">Edit</span>
                <div className="flex space-x-0.5">
                    <ToolbarButton icon={MousePointer2} label="Select" active={activeTool === 'select'} onClick={() => setTool('select')} tooltip="Select (V / Esc)" iconSize={16} className="p-1.5" />
                    <div className="w-px h-6 bg-[#444] mx-1"></div>
                    <ToolbarButton icon={Undo2} label="Undo" onClick={() => useProjectStore.temporal.getState().undo()} tooltip="Undo (Ctrl+Z)" iconSize={16} className="p-1.5" />
                    <ToolbarButton icon={Redo2} label="Redo" onClick={() => useProjectStore.temporal.getState().redo()} tooltip="Redo (Ctrl+Shift+Z)" iconSize={16} className="p-1.5" />
                </div>
            </div>

            <div className="h-10 w-px bg-[#444] mx-2"></div>

            {/* Draw Group */}
            <div className="flex flex-col items-center px-1">
                <span className="text-[10px] text-gray-500 mb-1 uppercase scale-90">Draw</span>
                <div className="flex items-center space-x-2">
                    <div className="flex space-x-0.5">
                        <ToolbarButton icon={PenTool} label="Wall" active={activeTool === 'wall'} onClick={() => setTool('wall')} tooltip="Draw Linear Wall (W)" iconSize={16} className="p-1.5" />
                        <ToolbarButton icon={RectWallIcon as any} label="Rect" active={activeTool === 'wall_rect'} onClick={() => setTool('wall_rect')} tooltip="Draw Rectangular Wall (R)" iconSize={16} className="p-1.5" />
                        <ToolbarButton icon={RectFromWallIcon as any} label="3-Pt Rect" active={activeTool === 'wall_rect_edge'} onClick={() => setTool('wall_rect_edge')} tooltip="3-Point Rectangle (Start, Base End, Height)" iconSize={16} className="p-1.5" />
                    </div>

                    {/* Presets - Vertical Stack */}
                    <div className="flex flex-col space-y-0.5 justify-center border-l border-[#444] pl-2 h-full">
                        <button onClick={() => setWallPreset('thick')} className={`text-[9px] px-1 py-0.5 rounded w-10 text-center leading-none ${wallPreset === 'thick' ? 'bg-[#0078d4] text-white' : 'bg-[#333] text-gray-400'}`}>Thick</button>
                        <button onClick={() => setWallPreset('wide')} className={`text-[9px] px-1 py-0.5 rounded w-10 text-center leading-none ${wallPreset === 'wide' ? 'bg-[#0078d4] text-white' : 'bg-[#333] text-gray-400'}`}>Wide</button>
                    </div>
                </div>
            </div>

            <div className="h-10 w-px bg-[#444] mx-2"></div>

            {/* Measure Group */}
            <div className="flex flex-col items-center px-1">
                <span className="text-[10px] text-gray-500 mb-1 uppercase scale-90">Measure</span>
                <div className="flex space-x-0.5">
                    <ToolbarButton icon={Ruler} label="Dim" active={activeTool === 'dimension'} onClick={() => setTool('dimension')} tooltip="Dimension (D)" iconSize={16} className="p-1.5" />
                    <ToolbarButton icon={Scaling} label="Scale" active={activeTool === 'scale'} onClick={() => setTool('scale')} tooltip="Set Scale (S)" iconSize={16} className={`p-1.5 ${isScaleSet && activeTool !== 'scale' ? 'text-[#ffaa00]' : ''}`} />
                </div>
            </div>

            <div className="h-10 w-px bg-[#444] mx-2"></div>

            {/* Import Group */}
            <div className="flex flex-col items-center px-1">
                <span className="text-[10px] text-gray-500 mb-1 uppercase scale-90">Import</span>
                <div className="flex space-x-0.5">
                    <label className="cursor-pointer flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#333] transition-colors" title="Import File">
                        <span className="text-gray-300"><Upload size={16} /></span>
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
                        className={`p-1.5 rounded hover:bg-[#333] transition-colors flex items-center justify-center ${isLayerManagerOpen ? 'bg-[#333] text-blue-400' : 'text-gray-400'}`}
                        title="DXF Layers"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                    </button>
                </div>
            </div>

            <div className="h-10 w-px bg-[#444] mx-2"></div>

            {/* Add Devices Group */}
            <div className="flex flex-col items-center px-1">
                <span className="text-[10px] text-gray-500 mb-1 uppercase scale-90">Add Devices</span>
                <div className="flex space-x-0.5 relative">
                    <ToolbarButton icon={Wifi} label="Manual" active={activeTool === 'anchor' && anchorMode === 'manual'} onClick={() => { setTool('anchor'); setAnchorMode('manual'); }} tooltip="Manual Anchor (A)" iconSize={16} className="p-1.5" />
                    <ToolbarButton icon={Activity} label="Auto" active={activeTool === 'anchor_auto' || (activeTool === 'anchor' && anchorMode === 'auto')} onClick={() => { setTool('anchor_auto'); setAnchorMode('auto'); }} tooltip="Click-to-Place (Shift+A)" iconSize={16} className="p-1.5" />

                    {/* NEW Auto Place Button */}
                    <button
                        onClick={() => setIsAutoPlacementOpen(true)}
                        className="p-1.5 rounded hover:bg-[#444] text-blue-400 flex flex-col items-center"
                        title="Auto-Place All (Magic Wand)"
                    >
                        <Wand2 size={16} />
                    </button>

                    <div className="w-px h-6 bg-[#444] mx-1"></div>

                    <button onClick={() => setIsConfigOpen(isConfigOpen === 'anchors' ? false : 'anchors' as any)} className={`p-1.5 rounded hover:bg-[#444] text-gray-400 ${useProjectStore.getState().showAnchorRadius ? 'text-blue-400' : ''}`} title="Anchor Settings">
                        <Settings size={16} />
                    </button>
                    {shouldShowConfig === 'anchors' && (
                        <div className="absolute top-12 left-0 w-56 bg-[#333] border border-[#555] p-3 shadow-2xl rounded z-50 text-white animate-in slide-in-from-top-2">
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

            <div className="h-10 w-px bg-[#444] mx-2"></div>

            {/* Layers Group - Unified & Reorganized */}
            <div className="flex flex-col items-center px-1">
                <span className="text-[10px] text-gray-500 mb-1 uppercase scale-90">Layers</span>
                <div className="grid grid-rows-2 grid-flow-col gap-0.5">
                    {/* Col 1 */}
                    <button onClick={() => toggleLayer('floorplan')} title="Toggle Imported Drawing" className={`p-0.5 rounded hover:bg-[#444] ${layers.floorplan ? 'text-blue-400' : 'text-gray-600'}`}> <Upload size={14} /> </button>
                    <button onClick={() => toggleLayer('dimensions')} title="Toggle Dimensions" className={`p-0.5 rounded hover:bg-[#444] ${layers.dimensions ? 'text-blue-400' : 'text-gray-600'}`}> <Ruler size={14} /> </button>

                    {/* Col 2 */}
                    <button onClick={() => toggleLayer('walls')} title="Toggle Walls" className={`p-0.5 rounded hover:bg-[#444] ${layers.walls ? 'text-blue-400' : 'text-gray-600'}`}> <Square size={14} /> </button>
                    <div className="w-4 h-4"></div> {/* Empty Spacer for bottom slot */}

                    {/* Col 3 */}
                    <button onClick={() => toggleLayer('roomLabels')} title="Toggle Room Area Text" className={`p-0.5 rounded hover:bg-[#444] ${layers.roomLabels ? 'text-blue-400' : 'text-gray-600'}`}> <Type size={14} /> </button>
                    <button onClick={() => toggleLayer('rooms')} title="Toggle Room Filling" className={`p-0.5 rounded hover:bg-[#444] ${layers.rooms ? 'text-blue-400' : 'text-gray-600'}`}> <Grid size={14} /> </button>
                </div>
            </div>

            <div className="h-10 w-px bg-[#444] mx-2"></div>

            {/* Anchors View Group - Modified */}
            <div className="flex flex-col items-center px-2">
                <span className="text-[10px] text-gray-500 mb-1 uppercase">Anchors</span>
                <div className="flex space-x-1 items-center h-full pb-1">
                    {/* 1. Stacked Toggle: Anchor (Top) / Radius (Bottom) */}
                    <div className="flex flex-col space-y-0.5">
                        <button
                            onClick={() => toggleLayer('anchors')}
                            title="Toggle Anchors Visibility"
                            className={`flex justify-center items-center h-4 w-8 rounded hover:bg-[#333] ${layers.anchors ? 'text-blue-400' : 'text-gray-600'}`}
                        >
                            <Wifi size={14} />
                        </button>
                        <button
                            onClick={() => useProjectStore.getState().setShowAnchorRadius(!useProjectStore.getState().showAnchorRadius)}
                            title="Toggle Radius/Coverage Area"
                            className={`flex justify-center items-center h-4 w-8 rounded hover:bg-[#333] ${useProjectStore.getState().showAnchorRadius ? 'text-blue-400' : 'text-gray-600'}`}
                        >
                            <div className={`w-3 h-3 border rounded-full ${useProjectStore.getState().showAnchorRadius ? 'border-blue-400' : 'border-gray-600'}`}></div>
                        </button>
                    </div>

                    <div className="w-px h-6 bg-[#444] mx-1"></div>

                    {/* 3. Toggle Heatmap */}
                    <button
                        onClick={() => useProjectStore.getState().setShowHeatmap(!useProjectStore.getState().showHeatmap)}
                        className={`flex flex-col items-center justify-center w-8 h-8 rounded hover:bg-[#333] transition-colors ${useProjectStore.getState().showHeatmap ? 'bg-[#333] text-green-400' : 'text-gray-400'}`}
                        title="Toggle Signal Heatmap"
                    >
                        <Signal size={18} />
                    </button>

                    {/* Resolution Toggle (Small) - Increased Size x1.3 */}
                    <div className="flex flex-col justify-center space-y-0.5">
                        <button onClick={() => useProjectStore.getState().setHeatmapResolution(50)} className={`text-[10px] px-1 rounded ${useProjectStore.getState().heatmapResolution === 50 ? 'bg-blue-600 text-white' : 'bg-[#333] text-gray-500'}`}>Low</button>
                        <button onClick={() => useProjectStore.getState().setHeatmapResolution(20)} className={`text-[10px] px-1 rounded ${useProjectStore.getState().heatmapResolution === 20 ? 'bg-blue-600 text-white' : 'bg-[#333] text-gray-500'}`}>High</button>
                    </div>

                </div>
            </div>

            <div className="flex-grow"></div>

            {/* File & Info */}
            <div className="flex items-center space-x-1 px-4 border-l border-[#444]">
                <ToolbarButton icon={Upload} label="Import" onClick={() => console.log('Import')} tooltip="Import Project" className="opacity-80 hover:opacity-100" iconSize={16} className="p-1.5" />
                <ToolbarButton icon={Download} label="Export" onClick={() => console.log('Export')} tooltip="Export Project" className="opacity-80 hover:opacity-100" iconSize={16} className="p-1.5" />
                <div className="w-px h-6 bg-[#444] mx-2"></div>
                <ToolbarButton icon={Settings} label="Global" active={useProjectStore.getState().isSettingsOpen} onClick={() => useProjectStore.getState().setIsSettingsOpen(!useProjectStore.getState().isSettingsOpen)} tooltip="Global Settings" iconSize={16} className="p-1.5" />
                <ToolbarButton icon={Info} label="Info" onClick={() => console.log('Info')} tooltip="About Anchor Planner" className="text-blue-400 hover:text-blue-300" iconSize={16} />
            </div>

            <SettingsPanel />

            {/* Render DXF Layer Manager floating */}
            {isLayerManagerOpen && <DXFLayerManager onClose={() => setIsLayerManagerOpen(false)} />}
        </div>
    );
};
