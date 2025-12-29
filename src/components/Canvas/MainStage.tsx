import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import Konva from 'konva';
import { WallsLayer } from './Layers/WallsLayer';
import { FloorplanImageLayer } from './Layers/FloorplanImageLayer';
import { DXFLayer } from './Layers/DXFLayer';
import { HeatmapLayer } from './Layers/HeatmapLayer';
import { RoomsLayer } from './Layers/RoomsLayer';
import { ValidationLayer } from './Layers/ValidationLayer';
import InteractionLayer from './InteractionLayer';
import { DimensionsLayer } from './Layers/DimensionsLayer';
import { AnchorsLayer } from './Layers/AnchorsLayer';
import { ContextMenu } from '../UI/ContextMenu';
import { SelectionMenu } from '../UI/SelectionMenu';
import { useProjectStore } from '../../store/useProjectStore';

export const MainStage: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });
    const [stage, setStage] = useState<Konva.Stage | null>(null);
    const [menu, setMenu] = useState<{ x: number; y: number; options: any[] } | null>(null);

    // Initial resize handler
    useEffect(() => {
        const updateSize = () => {
            if (containerRef.current) {
                setSize({
                    width: containerRef.current.offsetWidth,
                    height: containerRef.current.offsetHeight
                });
            }
        };
        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    const handleWheel = (e: any) => {
        e.evt.preventDefault();
        const scaleBy = 1.1;
        if (!stage) return;

        const oldScale = stage.scaleX();
        const pointer = stage.getPointerPosition();
        if (!pointer) return;

        const mousePointTo = {
            x: (pointer.x - stage.x()) / oldScale,
            y: (pointer.y - stage.y()) / oldScale,
        };

        const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;

        // Limit scale
        if (newScale < 0.1 || newScale > 20) return;

        stage.scale({ x: newScale, y: newScale });

        const newPos = {
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale,
        };
        stage.position(newPos);
    };

    // Grid rendering (simple visual aid)
    const { scaleRatio, setScaleRatio } = useProjectStore();
    const gridSize = scaleRatio; // 1 meter = scaleRatio pixels
    const gridLines = [];

    // Render grid for +/- 50 meters
    for (let i = -50; i <= 50; i++) {
        const pos = i * gridSize;
        // Vertical
        gridLines.push(<Line key={`v${i}`} points={[pos, -2500, pos, 2500]} stroke="#333" strokeWidth={1} opacity={0.2} />);
        // Horizontal
        gridLines.push(<Line key={`h${i}`} points={[-2500, pos, 2500, pos]} stroke="#333" strokeWidth={1} opacity={0.2} />);
    }

    // Grid rendering (simple visual aid)
    // ... (existing grid code logic handled dynamically or statically)

    // We can use a large group for grid or individual lines. 
    // Optimization: Cache grid or use a single shape if performance is key.

    // Scale Modal State
    const [isScaleModalOpen, setIsScaleModalOpen] = useState(false);
    const [scalePixelDistance, setScalePixelDistance] = useState(0);
    const [scaleRealDistance, setScaleRealDistance] = useState('1'); // meters

    const handleOpenScaleModal = (dist: number) => {
        setScalePixelDistance(dist);
        setIsScaleModalOpen(true);
    };

    // const { setScaleRatio } = useProjectStore(); // Removed duplicate call

    const handleApplyScale = () => {
        const meters = parseFloat(scaleRealDistance);
        if (!isNaN(meters) && meters > 0) {
            // scaleRatio = pixels / meters
            const newScaleRatio = scalePixelDistance / meters;
            setScaleRatio(newScaleRatio);
            console.log(`Calibrated: ${newScaleRatio} px/m`);
            setIsScaleModalOpen(false);
        } else {
            alert("Invalid Distance");
        }
    };

    return (
        <div ref={containerRef} className="w-full h-full bg-[#1a1a1a] overflow-hidden relative" onContextMenu={(e) => e.preventDefault()}>
            {menu && (
                <ContextMenu
                    x={menu.x}
                    y={menu.y}
                    options={menu.options}
                    onClose={() => setMenu(null)}
                />
            )}

            {/* Scale Modal Overlay */}
            {isScaleModalOpen && (
                <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm">
                    <div className="bg-[#2b2b2b] border border-[#444] p-6 rounded-lg shadow-2xl text-white w-80">
                        <h3 className="text-sm font-bold mb-4 uppercase text-gray-400">Calibrate Scale</h3>
                        <div className="mb-4">
                            <p className="text-xs text-gray-500 mb-2">Measured Distance: {scalePixelDistance.toFixed(1)} px</p>
                            <label className="text-xs block mb-1">Real World Distance (meters):</label>
                            <input
                                type="number"
                                value={scaleRealDistance}
                                onChange={(e) => setScaleRealDistance(e.target.value)}
                                className="w-full bg-[#222] border border-[#444] rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                                autoFocus
                            />
                        </div>
                        <div className="flex justify-end space-x-2">
                            <button
                                onClick={() => setIsScaleModalOpen(false)}
                                className="px-3 py-1.5 rounded bg-[#444] hover:bg-[#555] text-xs"
                            >Cancel</button>
                            <button
                                onClick={handleApplyScale}
                                className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-xs"
                            >Calibrate</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Selection Menu Overlay */}
            <SelectionMenu />

            {size.width > 0 && (
                <Stage
                    ref={setStage}
                    width={size.width}
                    height={size.height}
                    onWheel={handleWheel}
                    // Prevent context menu on stage (handled in interaction layer)
                    onContextMenu={(e) => e.evt.preventDefault()}
                    className="cursor-crosshair"
                >
                    {/* Layer 1: Background & Heavy Renders */}
                    <Layer key="layer-bg">
                        {gridLines}
                        <Line points={[-20, 0, 20, 0]} stroke="#666" strokeWidth={2} />
                        <Line points={[0, -20, 0, 20]} stroke="#666" strokeWidth={2} />
                        <FloorplanImageLayer />
                        <DXFLayer />
                        <HeatmapLayer key="heatmap" stage={stage} />
                        <RoomsLayer />
                    </Layer>

                    {/* Layer 2: Geometry & Validation */}
                    <Layer key="layer-geo">
                        <WallsLayer />
                        <ValidationLayer stage={stage} />
                    </Layer>

                    {/* Layer 3: Overlay, Interaction, Anchors (Must be Top) */}
                    <Layer key="layer-top">
                        <DimensionsLayer />
                        <AnchorsLayer key="anchors" />
                        <InteractionLayer
                            stage={stage}
                            onOpenMenu={(x, y, options) => setMenu({ x, y, options })}
                            onOpenScaleModal={handleOpenScaleModal}
                        />
                    </Layer>
                </Stage>
            )}
        </div>
    );
};