import React from 'react';
import { Rect, Group, Text, Line } from 'react-konva';
import { useProjectStore } from '../../../store/useProjectStore';
import { useShallow } from 'zustand/react/shallow';
import type { Point } from '../../../types';

export const ExportPreviewLayer: React.FC<{ stage: any }> = ({ stage }) => {
    const {
        isExportSidebarOpen,
        exportRegion,
        showExportBOM,
        showExportScaleBar,
        theme,
        walls, anchors, hubs, cables,
        scaleRatio
    } = useProjectStore(useShallow(state => ({
        isExportSidebarOpen: state.isExportSidebarOpen,
        exportRegion: state.exportRegion,
        showExportBOM: state.showExportBOM,
        showExportScaleBar: state.showExportScaleBar,
        theme: state.theme,
        walls: state.walls,
        anchors: state.anchors,
        hubs: state.hubs,
        cables: state.cables,
        scaleRatio: state.scaleRatio
    })));

    if (!isExportSidebarOpen || !stage) return null;

    // Calculate Bounds (Default Region)
    const getBounds = () => {
        let pointsToBound: Point[] = [];

        if (exportRegion && exportRegion.length > 0) {
            pointsToBound = exportRegion;
        } else {
            // Calculate bounding box of all items
            pointsToBound = [
                ...walls.flatMap(w => [{ x: w.points[0], y: w.points[1] }, { x: w.points[2], y: w.points[3] }]),
                ...anchors,
                ...hubs,
                ...cables.flatMap(c => c.points)
            ];
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        if (pointsToBound.length === 0) {
            // Default Viewport if empty?
            return { x: 0, y: 0, width: stage.width(), height: stage.height() };
        }

        pointsToBound.forEach(p => {
            if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
                if (p.x < minX) minX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.x > maxX) maxX = p.x;
                if (p.y > maxY) maxY = p.y;
            }
        });

        // Safety check if no valid points found despite array not empty
        if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
            return { x: 0, y: 0, width: stage.width(), height: stage.height() };
        }

        // Add padding if not using explicit exportRegion
        const padding = exportRegion ? 0 : 50;
        return {
            x: minX - padding,
            y: minY - padding,
            width: (maxX - minX) + (padding * 2),
            height: (maxY - minY) + (padding * 2)
        };
    };

    const bounds = getBounds();
    const isDark = theme === 'dark';
    const textColor = isDark ? '#fff' : '#000';
    const overlayColor = 'rgba(0, 150, 255, 0.1)';
    const strokeColor = 'rgba(0, 150, 255, 0.8)';

    // Check Area Constraint
    const area = bounds.width * bounds.height;
    const isTooSmall = area < 90000;

    // Positioning
    const bomPos = useProjectStore.getState().exportBOMPosition || { x: bounds.x + bounds.width - 220, y: bounds.y + 20 };
    const scalePos = useProjectStore.getState().exportScalePosition || { x: bounds.x + 20, y: bounds.y + bounds.height - 60 };

    // Calculate Cable Length
    const totalCablePixels = cables.reduce((acc, cable) => {
        if (!cable || !cable.points || cable.points.length < 2) return acc;
        let len = 0;
        for (let i = 0; i < cable.points.length - 1; i++) {
            const p1 = cable.points[i];
            const p2 = cable.points[i + 1];
            if (p1 && p2 && Number.isFinite(p1.x) && Number.isFinite(p1.y) && Number.isFinite(p2.x) && Number.isFinite(p2.y)) {
                len += Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
            }
        }
        return acc + len;
    }, 0);
    const totalCableMeters = scaleRatio > 0 ? (totalCablePixels / scaleRatio).toFixed(1) : "0.0";

    return (
        <Group>
            {/* 1. Export Region Overlay */}
            <Group name="export-region-visual" listening={false}>
                <Rect
                    x={bounds.x}
                    y={bounds.y}
                    width={bounds.width}
                    height={bounds.height}
                    stroke={strokeColor}
                    strokeWidth={2}
                    dash={[10, 5]}
                    fill={overlayColor}
                />
                <Text
                    x={bounds.x + 10}
                    y={bounds.y - 20}
                    text="Export Region"
                    fontSize={12}
                    fill={strokeColor}
                    fontStyle="bold"
                />
            </Group>

            {/* 2. BOM Overlay */}
            {showExportBOM && !isTooSmall && (() => {
                const bomTitle = "Bill of Materials";
                const bomLines = [
                    `• Walls: ${walls.length}`,
                    `• Anchors: ${anchors.length}`,
                    `• Hubs: ${hubs.length}`,
                    `• Cables: ${cables.length} (${totalCableMeters}m)`
                ];

                // Estimate widths (roughly 5.5px per char for 12px text, 6.2px for 14px bold title)
                const titleWidth = bomTitle.length * 6.2;
                const maxLineLength = Math.max(...bomLines.map(l => l.length));
                const maxLineWidth = maxLineLength * 5.5;

                const padding = 20; // 10px each side
                const dynamicWidth = Math.max(100, Math.max(titleWidth, maxLineWidth) + padding);
                const dynamicHeight = 115; // Increased for better bottom padding

                return (
                    <Group
                        name="export-bom-group"
                        x={bomPos.x}
                        y={bomPos.y}
                        draggable
                        onDragStart={(e) => {
                            e.cancelBubble = true;
                        }}
                        onDragEnd={(e) => {
                            // Ensure we persist the position relative to the stage/bounds
                            useProjectStore.getState().setExportBOMPosition({ x: e.target.x(), y: e.target.y() });
                        }}
                        dragBoundFunc={(pos) => {
                            const scale = stage.scaleX();
                            const stageX = stage.x();
                            const stageY = stage.y();

                            const localX = (pos.x - stageX) / scale;
                            const localY = (pos.y - stageY) / scale;

                            const clampedLocalX = Math.max(bounds.x, Math.min(localX, bounds.x + bounds.width - dynamicWidth));
                            const clampedLocalY = Math.max(bounds.y, Math.min(localY, bounds.y + bounds.height - dynamicHeight));

                            return {
                                x: clampedLocalX * scale + stageX,
                                y: clampedLocalY * scale + stageY
                            };
                        }}
                    >
                        <Rect
                            width={dynamicWidth}
                            height={dynamicHeight}
                            fill={isDark ? "rgba(30,30,30,0.9)" : "rgba(255,255,255,0.9)"}
                            stroke={textColor}
                            strokeWidth={1}
                            shadowBlur={5}
                            cornerRadius={4}
                        />
                        <Text
                            x={10} y={10}
                            text={bomTitle}
                            fontSize={14}
                            fontStyle="bold"
                            fill={textColor}
                            listening={false}
                        />
                        <Line
                            points={[10, 30, dynamicWidth - 10, 30]}
                            stroke={textColor}
                            strokeWidth={1}
                            listening={false}
                            opacity={0.3}
                        />
                        <Text
                            x={10} y={40}
                            text={bomLines.join('\n')}
                            fontSize={12}
                            fill={textColor}
                            lineHeight={1.4}
                            listening={false}
                        />
                        {/* Hidden Rect for better drag interaction surface */}
                        <Rect width={dynamicWidth} height={dynamicHeight} fill="transparent" />
                    </Group>
                );
            })()}

            {/* 3. Scale Bar Overlay */}
            {showExportScaleBar && !isTooSmall && (
                <Group
                    name="export-scale-group"
                    x={scalePos.x}
                    y={scalePos.y}
                    draggable
                    onDragStart={(e) => {
                        e.cancelBubble = true;
                    }}
                    onDragEnd={(e) => {
                        useProjectStore.getState().setExportScalePosition({ x: e.target.x(), y: e.target.y() });
                    }}
                    dragBoundFunc={(pos) => {
                        // Transform Absolute (pos) to Local
                        const scale = stage.scaleX();
                        const stageX = stage.x();
                        const stageY = stage.y();

                        const localX = (pos.x - stageX) / scale;
                        const localY = (pos.y - stageY) / scale;

                        // Clamp in Local Space
                        const clampedLocalX = Math.max(bounds.x, Math.min(localX, bounds.x + bounds.width - 100));
                        const clampedLocalY = Math.max(bounds.y, Math.min(localY, bounds.y + bounds.height - 50));

                        // Transform back to Absolute
                        return {
                            x: clampedLocalX * scale + stageX,
                            y: clampedLocalY * scale + stageY
                        };
                    }}
                >
                    <Rect
                        width={100}
                        height={50}
                        fill={isDark ? "rgba(30,30,30,0.9)" : "rgba(255,255,255,0.9)"}
                        stroke={textColor}
                        strokeWidth={1}
                        cornerRadius={4}
                    />
                    {/* Scale Line and Ticks */}
                    <Line points={[20, 25, 80, 25]} stroke={textColor} strokeWidth={2} listening={false} />
                    <Line points={[20, 20, 20, 30]} stroke={textColor} strokeWidth={2} listening={false} />
                    <Line points={[80, 20, 80, 30]} stroke={textColor} strokeWidth={2} listening={false} />
                    <Text
                        x={40} y={32}
                        text="5m"
                        fontSize={11}
                        fill={textColor}
                        listening={false}
                    />
                    {/* Move Handle Hint */}
                    <Rect width={100} height={50} fill="transparent" stroke="transparent" />
                </Group>
            )}
        </Group>
    );
};
