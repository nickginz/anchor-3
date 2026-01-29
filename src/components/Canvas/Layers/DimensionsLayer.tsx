import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Group, Line, Text, Circle } from 'react-konva';
import { useProjectStore } from '../../../store/useProjectStore';
import type { ProjectState } from '../../../store/useProjectStore';

export const DimensionsLayer: React.FC = () => {
    const { dimensions, scaleRatio, layers, theme } = useProjectStore(
        useShallow((state: ProjectState) => ({
            dimensions: state.dimensions,
            scaleRatio: state.scaleRatio,
            layers: state.layers,
            theme: state.theme
        }))
    );

    if (!layers.dimensions) return null;

    return (
        <Group name="dimensions-group">
            {dimensions.map((dim) => {
                const [x1, y1, x2, y2] = dim.points;
                const isSelected = useProjectStore.getState().selectedIds.includes(dim.id);
                // Theme-aware colors: Green-400 (Dark) vs Green-700 (Light)
                const defaultColor = theme === 'light' ? '#15803d' : '#4ade80';
                const color = isSelected ? '#ffaa00' : defaultColor;

                // Calculate midpoint
                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;

                // Calculate distance in pixels
                const distPixels = Math.hypot(x2 - x1, y2 - y1);

                // Calculate scale-aware label
                // We ignore the stored 'dim.label' for measurements to ensure they update with scale calibration
                const distMeters = distPixels / scaleRatio;
                const labelText = `${distMeters.toFixed(2)}m`;

                // Calculate angle relative to x-axis
                let angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);

                // Perpendicular Vector (Normal)
                const nx = -(y2 - y1) / distPixels;
                const ny = (x2 - x1) / distPixels;

                // Readability adjustment: keep text upright
                if (angle > 90 || angle < -90) {
                    angle += 180;
                }

                // Text Position
                let tx, ty;
                if (dim.textOffset) {
                    tx = midX + dim.textOffset.x;
                    ty = midY + dim.textOffset.y;
                } else {
                    // Default offset standard
                    tx = midX + nx * 20;
                    ty = midY + ny * 20;
                }

                // Tick Logic (unchanged simplified for conciseness in this replacement but keeping ticks)
                const tickLen = 5;
                const t1x1 = x1 + nx * tickLen; const t1y1 = y1 + ny * tickLen;
                const t1x2 = x1 - nx * tickLen; const t1y2 = y1 - ny * tickLen;
                const t2x1 = x2 + nx * tickLen; const t2y1 = y2 + ny * tickLen;
                const t2x2 = x2 - nx * tickLen; const t2y2 = y2 - ny * tickLen;

                return (
                    <Group key={dim.id}>
                        {/* Main Line */}
                        <Line
                            name="dimension-line"
                            id={dim.id}
                            points={[x1, y1, x2, y2]}
                            stroke={color}
                            strokeWidth={isSelected ? 2 : 1}
                            hitStrokeWidth={20} // Easy to grab
                            dash={[5, 5]}
                            onMouseEnter={(e) => {
                                const container = e.target.getStage()?.container();
                                if (container) container.style.cursor = 'move';
                            }}
                            onMouseLeave={(e) => {
                                const container = e.target.getStage()?.container();
                                if (container) container.style.cursor = 'default';
                            }}
                        />
                        {/* Ticks */}
                        <Line points={[t1x1, t1y1, t1x2, t1y2]} stroke={color} strokeWidth={1} />
                        <Line points={[t2x1, t2y1, t2x2, t2y2]} stroke={color} strokeWidth={1} />

                        {/* Text */}
                        <Text
                            id={`dim-text-${dim.id}`}
                            name="dim-text"
                            x={tx}
                            y={ty}
                            text={labelText}
                            fontSize={14} // Keep readable
                            fontFamily="Arial"
                            fill={color}
                            align="center"
                            verticalAlign="middle"
                            rotation={angle}
                            offsetX={labelText.length * 3.5}
                            offsetY={7}
                            onMouseEnter={(e) => {
                                const container = e.target.getStage()?.container();
                                if (container) container.style.cursor = isSelected ? 'move' : 'pointer';
                            }}
                            onMouseLeave={(e) => {
                                const container = e.target.getStage()?.container();
                                if (container) container.style.cursor = 'default';
                            }}
                        />

                        {/* Drag Handle */}
                        {isSelected && (
                            <Circle
                                name="dim-text-handle"
                                id={dim.id}
                                x={tx}
                                y={ty}
                                radius={6}
                                fill="#ffffff"
                                stroke={color}
                                strokeWidth={2}
                                opacity={0.8}
                                hitStrokeWidth={15}
                                onMouseEnter={(e) => {
                                    const container = e.target.getStage()?.container();
                                    if (container) container.style.cursor = 'move';
                                }}
                                onMouseLeave={(e) => {
                                    const container = e.target.getStage()?.container();
                                    if (container) container.style.cursor = 'default';
                                }}
                            />
                        )}
                    </Group>
                );
            })}
        </Group>
    );
};
