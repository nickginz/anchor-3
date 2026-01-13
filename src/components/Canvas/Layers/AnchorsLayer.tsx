import React from 'react';
import { Group, Circle, Rect, Text } from 'react-konva';
import { useProjectStore } from '../../../store/useProjectStore';

export const AnchorsLayer: React.FC = () => {
    const { anchors, scaleRatio, selectedIds, anchorRadius, anchorShape, showAnchorRadius, layers, theme, showOverlapCounts } = useProjectStore();

    // console.log('Rendering AnchorsLayer. Count:', anchors.length, 'Visible:', layers.anchors);
    if (!layers.anchors || anchors.length === 0) return null;

    return (
        <Group>
            {anchors.map((anchor) => {
                const isSelected = selectedIds.includes(anchor.id);
                // Use individual settings if available, otherwise fallback to global
                const effectiveRadius = anchor.radius !== undefined ? anchor.radius : anchorRadius;
                const effectiveShape = anchor.shape !== undefined ? anchor.shape : anchorShape;
                const radiusPx = effectiveRadius * scaleRatio;

                return (
                    <Group key={anchor.id} x={anchor.x} y={anchor.y}>

                        {/* Coverage Area */}
                        {showAnchorRadius && (
                            <Group name="anchor-radius">
                                {effectiveShape === 'circle' ? (
                                    <Circle
                                        radius={radiusPx}
                                        fill="rgba(0, 120, 212, 0.1)" // Blue transparent
                                        stroke="#0078d4"
                                        strokeWidth={1}
                                        dash={[5, 5]}
                                        listening={false}
                                    />
                                ) : (
                                    <Rect
                                        x={-radiusPx}
                                        y={-radiusPx}
                                        width={radiusPx * 2}
                                        height={radiusPx * 2}
                                        fill="rgba(0, 120, 212, 0.1)"
                                        stroke="#0078d4"
                                        strokeWidth={1}
                                        dash={[5, 5]}
                                        listening={false}
                                    />
                                )}

                            </Group>
                        )}

                        {/* Anchor Center - Orange */}
                        <Group name="anchor-core">
                            <Circle
                                radius={8}
                                fill="#ffaa00" // Orange center
                                stroke={isSelected ? (theme === 'light' ? '#2563eb' : '#00aaff') : (theme === 'light' ? '#000000' : '#ffffff')}
                                strokeWidth={2}
                                // Name for hit detection in InteractionLayer
                                name="anchor"
                                id={anchor.id}
                            />

                            {/* Label */}
                            <Text
                                y={12}
                                text={`${anchor.id.slice(0, 4)}`}
                                fontSize={10}
                                fill={theme === 'light' ? '#111827' : '#00aaff'} // Dark text in light mode, Blue/Cyan in dark
                                align="center"
                                offsetX={15}
                                listening={false}
                            />
                        </Group>

                        {/* Overlap Count Debug */}
                        {showOverlapCounts && (
                            (() => {
                                let count = 0;
                                const r1 = radiusPx;
                                anchors.forEach(other => {
                                    if (other.id === anchor.id) return;
                                    const r2 = (other.radius !== undefined ? other.radius : anchorRadius) * scaleRatio;
                                    const d = Math.sqrt((anchor.x - other.x) ** 2 + (anchor.y - other.y) ** 2);
                                    if (d <= (r1 + r2) * 1.01) count++;
                                });

                                return (
                                    <Text
                                        y={-15}
                                        text={count.toString()}
                                        fontSize={14}
                                        fontStyle="bold"
                                        fill="red"
                                        stroke="white"
                                        strokeWidth={0.5}
                                        align="center"
                                        offsetX={5}
                                        listening={false}
                                    />
                                );
                            })()
                        )}
                    </Group>
                );
            })}
        </Group>
    );
};
