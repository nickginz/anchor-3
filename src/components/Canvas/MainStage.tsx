import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Stage, Layer, Line, Group } from 'react-konva';
import Konva from 'konva';
import { WallsLayer } from './Layers/WallsLayer';
import { FloorplanImageLayer } from './Layers/FloorplanImageLayer';
import { DXFLayer } from './Layers/DXFLayer';
import { HeatmapLayer } from './Layers/HeatmapLayer';
import { RoomsLayer } from './Layers/RoomsLayer';
import { PlacementAreaLayer } from './Layers/PlacementAreaLayer';
import { ValidationLayer } from './Layers/ValidationLayer';
import InteractionLayer from './InteractionLayer';
import { DimensionsLayer } from './Layers/DimensionsLayer';
import { AnchorsLayer } from './Layers/AnchorsLayer';
import { ContextMenu } from '../UI/ContextMenu';
import { detectRooms } from '../../utils/room-detection';
import { generateOffsets, generateSkeletonLines, generateMedialAxis, generateSimplifiedSkeleton } from '../../utils/geometry-tools';
import type { Point } from '../../types';
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

        // Ensure focus is on the container so keyboard events bubble correctly/window is active context
        // Use timeout to ensure it happens after paint/mount
        setTimeout(() => {
            if (containerRef.current) {
                containerRef.current.focus();
            }
        }, 100);

        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    const {
        scaleRatio,
        setScaleRatio,
        theme,
        walls, // Need walls from store
        showOffsets,
        offsetStep,
        showSkeleton,
        skeletonMode,
        showMedialAxis,
        medialAxisStep
    } = useProjectStore();

    // --- Geometry Tools Calculation ---
    // Combined memo for all geometry lines to avoid redundant 'detectRooms' calls
    const { geometryLines, medialAxisLines } = useMemo(() => {
        const lines: Point[][] = [];
        let maLines: Point[][] = [];

        try {
            if (!showOffsets && !showSkeleton && skeletonMode === 'none' && !showMedialAxis) return { geometryLines: [], medialAxisLines: [] };

            // Use detectRooms from auto-placement which should return Point[][]
            const roomsList = detectRooms(walls);

            roomsList.forEach(roomPoly => {
                if (showOffsets) {
                    const stepPx = offsetStep * scaleRatio;
                    // Limit iterations to prevent freeze, e.g. 50 layers max
                    for (let i = 1; i <= 50; i++) {
                        const currentDist = stepPx * i;
                        const offsets = generateOffsets(roomPoly, currentDist);
                        if (!offsets || offsets.length === 0) break;
                        offsets.forEach(poly => lines.push(poly));
                    }
                }

                if (showSkeleton) {
                    const skel = generateSkeletonLines(roomPoly, offsetStep * scaleRatio);
                    skel.forEach(poly => lines.push(poly));
                }

                // Handle Skeleton Mode (Replaces showMedialAxis logic effectively)
                // Use medialAxisStep (pixels) for generation
                if (skeletonMode !== 'none' || showMedialAxis) {
                    // Use default step if not set?
                    // medialAxisStep default is 5.
                    const axis = generateMedialAxis(roomPoly, medialAxisStep);

                    if (skeletonMode === 'simplified') {
                        // Simplify!
                        // Min length 1 meter = 1 * scaleRatio pixels?
                        // generateSimplifiedSkeleton takes pixels if points are pixels
                        // Wait, points are in PIXELS in MainStage usually?
                        // Yes, Stage uses pixels. scaleRatio converts meters to pixels.
                        // So 1 meter = scaleRatio.
                        const simplified = generateSimplifiedSkeleton(axis, 1.0 * scaleRatio);
                        simplified.forEach(poly => maLines.push(poly));
                    } else {
                        axis.forEach(poly => maLines.push(poly));
                    }
                }
            });
            return { geometryLines: lines, medialAxisLines: maLines };
        } catch (error) {
            console.error("Geometry Generation Error:", error);
            return { geometryLines: [], medialAxisLines: [] };
        }
    }, [walls, showOffsets, showSkeleton, skeletonMode, showMedialAxis, offsetStep, medialAxisStep, scaleRatio]);

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
    const gridSize = scaleRatio; // 1 meter = scaleRatio pixels
    const gridLines = [];

    // Theme Colors
    const axisColor = theme === 'light' ? '#6b7280' : '#666';

    // Render grid for +/- 500 meters (Functionally "everywhere" for most floorplans)
    const gridSizeMeters = 1; // 1 meter grid
    const gridRange = 500;

    // Theme Colors
    const gridColor = theme === 'light' ? '#e5e7eb' : '#333'; // Light mode: gray-200 (very light)

    for (let i = -gridRange; i <= gridRange; i += gridSizeMeters) {
        const pos = i * gridSize; // gridSize is px per meter

        // Vertical
        gridLines.push(<Line key={`v${i}`} points={[pos, -gridRange * gridSize, pos, gridRange * gridSize]} stroke={gridColor} strokeWidth={1} listening={false} />);
        // Horizontal
        gridLines.push(<Line key={`h${i}`} points={[-gridRange * gridSize, pos, gridRange * gridSize, pos]} stroke={gridColor} strokeWidth={1} listening={false} />);
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
        <div
            ref={containerRef}
            className="w-full h-full bg-[var(--bg-canvas)] overflow-hidden relative outline-none"
            onContextMenu={(e) => e.preventDefault()}
            tabIndex={-1} // Make focusable for keyboard shortcuts
        >
            {menu && (
                <ContextMenu
                    x={menu.x}
                    y={menu.y}
                    options={menu.options}
                    onClose={() => setMenu(null)}
                />
            )}
            {/* Scale Modal */}
            {isScaleModalOpen && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-800 p-4 rounded shadow-lg border border-gray-700 flex flex-col gap-3">
                    <h3 className="text-white text-sm font-medium">Calibrate Scale</h3>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-400">Real World Distance (m)</label>
                        <input
                            type="number"
                            value={scaleRealDistance}
                            onChange={(e) => setScaleRealDistance(e.target.value)}
                            className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-sm"
                            min="0.1"
                            step="0.1"
                            autoFocus
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setIsScaleModalOpen(false)} className="px-3 py-1 text-xs text-gray-400 hover:text-white">Cancel</button>
                        <button onClick={handleApplyScale} className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-500">Apply</button>
                    </div>
                </div>
            )}

            {/* Selection Menu Overlay */}
            <SelectionMenu />

            {size.width > 0 && (
                <Stage
                    ref={node => setStage(node)}
                    width={size.width}
                    height={size.height}
                    onWheel={handleWheel}
                    onContextMenu={(e) => e.evt.preventDefault()}
                    className="cursor-crosshair"
                >
                    {/* Layer 1: Background & Heavy Renders */}
                    <Layer key="layer-bg" name="background-layer">
                        <Group name="grid-lines">
                            {gridLines}
                            <Line points={[-20, 0, 20, 0]} stroke={axisColor} strokeWidth={2} />
                            <Line points={[0, -20, 0, 20]} stroke={axisColor} strokeWidth={2} />
                        </Group>
                        <FloorplanImageLayer />
                        <DXFLayer />
                        <HeatmapLayer stage={stage} />
                        <RoomsLayer />
                        <PlacementAreaLayer />
                    </Layer>

                    {/* Layer 2: Geometry & Validation */}
                    <Layer key="layer-geo">
                        <WallsLayer />
                        {/* Geometry Debug Lines (Red Offsets) */}
                        {geometryLines.length > 0 && geometryLines.map((poly, i) => (
                            <Line
                                key={`geo-${i}`}
                                points={poly.flatMap(p => [p.x, p.y])}
                                stroke="red"
                                strokeWidth={2} // thicker
                                closed={true}
                                opacity={0.8}
                                listening={false}
                            />
                        ))}
                        {/* Medial Axis (Magenta or Custom) */}
                        {medialAxisLines.length > 0 && medialAxisLines.map((poly, i) => (
                            <Line
                                key={`ma-${i}`}
                                points={poly.flatMap(p => [p.x, p.y])}
                                stroke={skeletonMode === 'simplified' ? '#f97316' : '#ff00ff'} // Orange for Simplified, Magenta for Full
                                strokeWidth={skeletonMode === 'simplified' ? 3 : 2} // Thicker for simplified
                                closed={false} // Skeleton lines are open paths usually
                                opacity={0.8}
                                listening={false}
                                dash={skeletonMode === 'simplified' ? [] : [10, 5]} // Solid for simplified
                            />
                        ))}
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
            )
            }
        </div >
    );
};