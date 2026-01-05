import React, { useMemo } from 'react';
import { Line, Text, Group, Circle } from 'react-konva';
import { useProjectStore } from '../../../store/useProjectStore';
import { detectRooms, calculatePolygonArea } from '../../../utils/room-detection';
import { getPolygonCentroid, getPolygonBBox } from '../../../utils/geometry';

export const RoomsLayer: React.FC = () => {
    const { walls, layers, scaleRatio } = useProjectStore();

    const rooms = useMemo(() => {
        // Run detection if either Rooms OR Labels are enabled
        if (!layers.rooms && !layers.roomLabels && !layers.centroids) return [];
        try {
            return detectRooms(walls);
        } catch (e) {
            console.error("Room detection failed:", e);
            return [];
        }
    }, [walls, layers.rooms, layers.roomLabels, layers.centroids]);

    if (!layers.rooms && !layers.roomLabels && !layers.centroids) return null;

    return (
        <React.Fragment>
            {rooms.map((poly, i) => {
                // Determine best center point
                const areaPx = Math.abs(calculatePolygonArea(poly));

                // Use Geometric Centroid for all small rooms to match Auto-Placement logic strictly
                const c = getPolygonCentroid(poly);
                const cx = c.x;
                const cy = c.y;
                console.log(`[RoomsLayer] Room ${i} (Poly): Center: ${cx}, ${cy}`);

                const areaSqMeters = areaPx / (scaleRatio * scaleRatio);
                const label = `${areaSqMeters.toFixed(1)} m²`;

                return (
                    <Group key={i}>
                        {layers.rooms && (
                            <Line
                                points={poly.flatMap(p => [p.x, p.y])}
                                closed={true}
                                fill="rgba(100, 200, 255, 0.2)" // Light transparent blue
                                stroke="transparent"
                                listening={false}
                            />
                        )}

                        {layers.roomLabels && (() => {
                            // Bounding Box
                            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                            poly.forEach(p => {
                                minX = Math.min(minX, p.x);
                                maxX = Math.max(maxX, p.x);
                                minY = Math.min(minY, p.y);
                                maxY = Math.max(maxY, p.y);
                            });
                            const width = maxX - minX;

                            // Dynamic scaling
                            const baseFontSize = 14;
                            const maxFontSize = (width * 0.8) / (label.length * 0.6);
                            const finalFontSize = Math.min(baseFontSize, maxFontSize);

                            if (finalFontSize < 4) return null;

                            return (
                                <Text
                                    x={cx}
                                    y={cy}
                                    text={label}
                                    fontSize={finalFontSize}
                                    scaleX={1}
                                    scaleY={1}
                                    offsetX={(label.length * finalFontSize * 0.3)}
                                    offsetY={finalFontSize / 2}
                                    fill="#006699"
                                    listening={false}
                                />
                            );
                        })()}
                        {/* Centroid for All Rooms */}
                        {layers.centroids && (
                            <Circle
                                x={cx}
                                y={cy}
                                radius={4} // Visible dot
                                fill="#22c55e" // Green-500
                                stroke="white"
                                strokeWidth={1}
                                listening={false}
                            />
                        )}
                    </Group>
                );
            })}
        </React.Fragment>
    );
};
