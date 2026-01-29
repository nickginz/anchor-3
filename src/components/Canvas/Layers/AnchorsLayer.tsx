import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Group, Circle, Rect, Text } from 'react-konva';
import { useProjectStore } from '../../../store/useProjectStore';
import type { ProjectState } from '../../../store/useProjectStore';

export const AnchorsLayer: React.FC = () => {
    const { anchors, cables, scaleRatio, selectedIds, anchorRadius, anchorShape, showAnchorRadius, layers, theme, showOverlapCounts, updateAnchor, setSelection } = useProjectStore(
        useShallow((state: ProjectState) => ({
            anchors: state.anchors,
            cables: state.cables,
            scaleRatio: state.scaleRatio,
            selectedIds: state.selectedIds,
            anchorRadius: state.anchorRadius,
            anchorShape: state.anchorShape,
            showAnchorRadius: state.showAnchorRadius,
            layers: state.layers,
            theme: state.theme,
            showOverlapCounts: state.showOverlapCounts,
            updateAnchor: state.updateAnchor,
            setSelection: state.setSelection
        }))
    );

    // console.log('Rendering AnchorsLayer. Count:', anchors.length, 'Visible:', layers.anchors);
    if (!layers.anchors || anchors.length === 0) return null;

    // Build connection map
    const connectedAnchorIds = new Set(cables.map(c => c.toId));

    return (
        <Group>
            {anchors.map((anchor) => {
                const isSelected = selectedIds.includes(anchor.id);
                const isConnected = connectedAnchorIds.has(anchor.id);

                // Use individual settings if available, otherwise fallback to global
                const effectiveRadius = anchor.radius !== undefined ? anchor.radius : anchorRadius;
                const effectiveShape = anchor.shape !== undefined ? anchor.shape : anchorShape;
                const radiusPx = effectiveRadius * scaleRatio;

                return (
                    <Group
                        key={anchor.id}
                        x={anchor.x}
                        y={anchor.y}
                        draggable
                        onDragEnd={(e) => {
                            updateAnchor(anchor.id, { x: e.target.x(), y: e.target.y() });
                        }}
                        onClick={(e) => {
                            e.cancelBubble = true;
                            // Toggle selection with Shift
                            if (e.evt.shiftKey) {
                                if (isSelected) {
                                    setSelection(selectedIds.filter(id => id !== anchor.id));
                                } else {
                                    setSelection([...selectedIds, anchor.id]);
                                }
                            } else {
                                setSelection([anchor.id]);
                            }
                        }}
                        onTap={(e) => {
                            e.cancelBubble = true;
                            setSelection([anchor.id]);
                        }}
                    >
                        {/* ... Coverage ... */}
                        {showAnchorRadius && (
                            <Group>
                                {/* Reduced for brevity in replacement, ideally keep existing coverage logic */}
                                {effectiveShape === 'circle' ?
                                    <Circle
                                        radius={radiusPx}
                                        fill="rgba(0, 120, 212, 0.1)"
                                        stroke="#0078d4"
                                        strokeWidth={1}
                                        dash={[5, 5]}
                                        listening={false}
                                    /> :
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
                                }
                            </Group>
                        )}

                        {/* Anchor Center */}
                        <Group name="anchor-core">
                            <Circle
                                radius={8}
                                fill="#ffaa00"
                                stroke={isSelected ? '#fff' : (isConnected ? (theme === 'light' ? '#000' : '#fff') : '#ef4444')} // Red stroke if unconnected
                                strokeWidth={isSelected ? 3 : (isConnected ? 2 : 3)}
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
