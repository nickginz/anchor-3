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
    Type // Icon for Labels
} from 'lucide-react';
import { WallDetectionModal } from './WallDetectionModal';

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
        toggleLayer
    } = useProjectStore();

    const [isConfigOpen, setIsConfigOpen] = React.useState<boolean | string>(false);
    const [isLayerManagerOpen, setIsLayerManagerOpen] = React.useState(false);

    // Normalize check
    const shouldShowConfig = isConfigOpen;


    const [isDetectionModalOpen, setIsDetectionModalOpen] = React.useState(false);
    const { addWalls, activeImportId, importedObjects } = useProjectStore();
    const activeImport = activeImportId ? importedObjects.find(o => o.id === activeImportId) : null;

    return (
        <div className="h-16 bg-[#2b2b2b] border-b border-[#1f1f1f] flex items-center px-4 shadow-xl z-20 relative select-none">
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
                            // Use detected scale (meters/pixel) if provided (from Modal calibration)
                            // Otherwise fallback to import scale or 1
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
            <div className="flex flex-col items-center px-2">
                <span className="text-[10px] text-gray-500 mb-1 uppercase">Edit</span>
                <div className="flex space-x-1">
                    <ToolbarButton
                        icon={MousePointer2}
                        label="Select"
                        active={activeTool === 'select'}
                        onClick={() => setTool('select')}
                        tooltip="Select (V / Esc)"
                    />
                    <div className="w-px h-6 bg-[#444] mx-1"></div>
                    <ToolbarButton
                        icon={Undo2}
                        label="Undo"
                        onClick={() => useProjectStore.temporal.getState().undo()}
                        tooltip="Undo (Ctrl+Z)"
                    />
                    <ToolbarButton
                        icon={Redo2}
                        label="Redo"
                        onClick={() => useProjectStore.temporal.getState().redo()}
                        tooltip="Redo (Ctrl+Shift+Z)"
                    />
                </div>
            </div>

            {isLayerManagerOpen && <DXFLayerManager onClose={() => setIsLayerManagerOpen(false)} />}

            <div className="h-10 w-px bg-[#444] mx-2"></div>

            {/* Import Group */}
            <div className="flex flex-col items-center px-2">
                <span className="text-[10px] text-gray-500 mb-1 uppercase">Import</span>
                <div className="flex space-x-1">
                    <label className="cursor-pointer flex flex-col items-center justify-center w-8 h-8 rounded hover:bg-[#333] transition-colors" title="Import File (Image, PDF, DXF)">
                        <span className="text-white font-bold text-xs"><Upload size={18} /></span>
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
                                    if (data && data.tables && data.tables.layer && data.tables.layer.layers) {
                                        Object.keys(data.tables.layer.layers).forEach(name => layers[name] = true);
                                    }

                                    state.addImportedObject({
                                        type: 'dxf',
                                        name: file.name,
                                        data: data,
                                        layers: layers,
                                        width: data.extents ? data.extents.width : 100, // Pass calculated width
                                        height: data.extents ? data.extents.height : 100, // Pass calculated height
                                    } as any);
                                    setIsLayerManagerOpen(true);

                                } else if (ext === 'pdf') {
                                    const { importPDF } = await import('../../utils/importers/importPDF');
                                    const img = await importPDF(file);
                                    state.addImportedObject({
                                        type: 'image',
                                        name: file.name,
                                        src: img.src,
                                        width: img.width,
                                        height: img.height
                                    } as any);

                                } else if (['png', 'jpg', 'jpeg'].includes(ext || '')) {
                                    const { importImage } = await import('../../utils/importers/importImage');
                                    const img = await importImage(file);
                                    state.addImportedObject({
                                        type: 'image',
                                        name: file.name,
                                        src: img.src,
                                        width: img.width,
                                        height: img.height
                                    } as any);

                                } else {
                                    alert('Unsupported file type: ' + ext);
                                }
                            } catch (err) {
                                console.error(err);
                                alert(`Failed to import ${ext?.toUpperCase()} file.`);
                            }
                            e.target.value = '';
                        }} />
                    </label>

                    <button
                        onClick={() => setIsLayerManagerOpen(!isLayerManagerOpen)}
                        className={`w-8 h-8 rounded hover:bg-[#333] transition-colors flex items-center justify-center ${isLayerManagerOpen ? 'bg-[#333] text-blue-400' : 'text-gray-400'}`}
                        title="DXF Layers"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                    </button>

                    {/* Wall Detection Button (Disabled) */}
                    {/* {activeImport && activeImport.type === 'image' && (
                        <button
                            onClick={() => setIsDetectionModalOpen(true)}
                            className="w-8 h-8 rounded hover:bg-[#333] transition-colors flex items-center justify-center text-purple-400 animate-in fade-in"
                            title="Detect Walls (AI)"
                        >
                            <Wand2 size={16} />
                        </button>
                    )} */}
                </div>
            </div>

            <div className="h-10 w-px bg-[#444] mx-2"></div>

            {/* Layers Group */}
            <div className="flex flex-col items-center px-2">
                <span className="text-[10px] text-gray-500 mb-1 uppercase">Layers</span>
                <div className="grid grid-rows-2 grid-flow-col gap-0.5">
                    <button onClick={() => toggleLayer('floorplan')} title="Toggle Imported Drawing" className={`p-1 rounded hover:bg-[#444] ${layers.floorplan ? 'text-blue-400' : 'text-gray-600'}`}> <Upload size={14} /> </button>
                    <button onClick={() => toggleLayer('walls')} title="Toggle Walls" className={`p-1 rounded hover:bg-[#444] ${layers.walls ? 'text-blue-400' : 'text-gray-600'}`}> <Square size={14} /> </button>
                    <button onClick={() => toggleLayer('anchors')} title="Toggle Anchors" className={`p-1 rounded hover:bg-[#444] ${layers.anchors ? 'text-blue-400' : 'text-gray-600'}`}> <Wifi size={14} /> </button>
                    <button onClick={() => toggleLayer('dimensions')} title="Toggle Dimensions" className={`p-1 rounded hover:bg-[#444] ${layers.dimensions ? 'text-blue-400' : 'text-gray-600'}`}> <Ruler size={14} /> </button>
                    <button onClick={() => toggleLayer('rooms')} title="Toggle Room Filling" className={`p-1 rounded hover:bg-[#444] ${layers.rooms ? 'text-blue-400' : 'text-gray-600'}`}> <Grid size={14} /> </button>
                    <button onClick={() => toggleLayer('roomLabels')} title="Toggle Room Area Text" className={`p-1 rounded hover:bg-[#444] ${layers.roomLabels ? 'text-blue-400' : 'text-gray-600'}`}> <Type size={14} /> </button>
                </div>
            </div>

            <div className="h-10 w-px bg-[#444] mx-2"></div>

            {/* Draw Group */}
            <div className="flex items-center space-x-1 px-2">
                <div className="flex flex-col items-center mr-2">
                    <span className="text-[10px] text-gray-500 mb-1 uppercase">Draw</span>
                    <div className="flex space-x-1">
                        <ToolbarButton icon={PenTool} label="Wall" active={activeTool === 'wall'} onClick={() => setTool('wall')} tooltip="Draw Linear Wall (W)" />
                        <ToolbarButton icon={Square} label="Rect" active={activeTool === 'wall_rect'} onClick={() => setTool('wall_rect')} tooltip="Draw Rectangular Wall (R)" />
                    </div>
                </div>
                <div className="flex flex-col space-y-1 justify-center ml-2 border-l border-[#444] pl-2">
                    <button onClick={() => {
                        // Open Config Modal
                        setIsConfigOpen(!isConfigOpen);
                    }} className={`text-[10px] px-2 py-0.5 rounded ${wallPreset === 'default' ? 'bg-[#0078d4] text-white' : 'bg-[#333] text-gray-400'}`}>Standard</button>
                    <div className="flex space-x-1">
                        <button onClick={() => setWallPreset('thick')} className={`text-[10px] px-1 py-0.5 rounded w-12 ${wallPreset === 'thick' ? 'bg-[#0078d4] text-white' : 'bg-[#333] text-gray-400'}`}>Thick</button>
                        <button onClick={() => setWallPreset('wide')} className={`text-[10px] px-1 py-0.5 rounded w-12 ${wallPreset === 'wide' ? 'bg-[#0078d4] text-white' : 'bg-[#333] text-gray-400'}`}>Wide</button>
                    </div>
                </div>
            </div>

            <div className="h-10 w-px bg-[#444] mx-2"></div>

            {/* Measure Group */}
            <div className="flex flex-col items-center px-2">
                <span className="text-[10px] text-gray-500 mb-1 uppercase">Measure</span>
                <div className="flex space-x-1">
                    <ToolbarButton icon={Ruler} label="Dim" active={activeTool === 'dimension'} onClick={() => setTool('dimension')} tooltip="Dimension (D)" />
                    <ToolbarButton icon={Scaling} label="Scale" active={activeTool === 'scale'} onClick={() => setTool('scale')} tooltip="Set Scale (S)" />
                </div>
            </div>

            <div className="h-10 w-px bg-[#444] mx-2"></div>

            {/* Anchor Group */}
            <div className="flex flex-col items-center px-2">
                <span className="text-[10px] text-gray-500 mb-1 uppercase">Network</span>
                <div className="flex space-x-1 relative">
                    <ToolbarButton icon={Wifi} label="Manual" active={activeTool === 'anchor' && anchorMode === 'manual'} onClick={() => { setTool('anchor'); setAnchorMode('manual'); }} tooltip="Manual Anchor (A)" />
                    <ToolbarButton icon={Activity} label="Auto" active={activeTool === 'anchor_auto' || (activeTool === 'anchor' && anchorMode === 'auto')} onClick={() => { setTool('anchor_auto'); setAnchorMode('auto'); }} tooltip="Auto Anchor (Shift+A)" />
                    <button onClick={() => setIsConfigOpen(isConfigOpen === 'anchors' ? false : 'anchors' as any)} className={`p-1.5 rounded hover:bg-[#444] text-gray-400 ${useProjectStore.getState().showAnchorRadius ? 'text-blue-400' : ''}`} title="Anchor Settings">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    </button>
                    {shouldShowConfig === 'anchors' && (
                        <div className="absolute top-12 left-0 w-56 bg-[#333] border border-[#555] p-3 shadow-2xl rounded z-50 text-white animate-in slide-in-from-top-2">
                            {/* ... Anchor Config Content ... */}
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

            <div className="flex-grow"></div>

            {/* File & Info */}
            <div className="flex items-center space-x-1 px-4 border-l border-[#444]">
                <ToolbarButton icon={Upload} label="Import" onClick={() => console.log('Import')} tooltip="Import Project" className="opacity-80 hover:opacity-100" />
                <ToolbarButton icon={Download} label="Export" onClick={() => console.log('Export')} tooltip="Export Project" className="opacity-80 hover:opacity-100" />
                <div className="w-px h-6 bg-[#444] mx-2"></div>
                <ToolbarButton icon={Info} label="Info" onClick={() => console.log('Info')} tooltip="About Anchor Planner" className="text-blue-400 hover:text-blue-300" />
            </div>

        </div>
    );
};
