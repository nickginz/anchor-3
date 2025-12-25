
import React, { useMemo } from 'react';
import { Line, Text, Group } from 'react-konva';
import { useProjectStore } from '../../../store/useProjectStore';
import { detectRooms, calculatePolygonArea } from '../../../utils/room-detection';

export const RoomsLayer: React.FC = () => {
    const { walls, layers, scaleRatio } = useProjectStore();

    const rooms = useMemo(() => {
        // Run detection if either Rooms OR Labels are enabled
        if (!layers.rooms && !layers.roomLabels) return [];
        try {
            return detectRooms(walls);
        } catch (e) {
            console.error("Room detection failed:", e);
            return [];
        }
    }, [walls, layers.rooms, layers.roomLabels]);

    if (!layers.rooms && !layers.roomLabels) return null;

    return (
        <React.Fragment>
            {rooms.map((poly, i) => {
                // Calculate Centroid for Label
                let cx = 0, cy = 0;
                poly.forEach(p => { cx += p.x; cy += p.y; });
                cx /= poly.length;
                cy /= poly.length;

                const areaSqMeters = Math.abs(calculatePolygonArea(poly)) / (scaleRatio * scaleRatio);
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
                    </Group>
                );
            })}
        </React.Fragment>
    );
};
