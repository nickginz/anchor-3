import React from 'react';
import { Group, Rect, Text, Path, Line } from 'react-konva';
import { useProjectStore } from '../../../store/useProjectStore';

export const HubsLayer: React.FC = () => {
    const { hubs, cables, selectedIds, theme, layers, allowOutsideConnections, setSelection } = useProjectStore();

    const colors = theme === 'light' ? {
        hubFill: '#9333ea', // Purple
        hubStroke: '#ffffff',
        hubSelected: '#2563eb', // Blue
        text: '#ffffff',
        cable: '#2563eb' // Blue for orthogonal lines
    } : {
        hubFill: '#c084fc', // Light Purple
        hubStroke: '#ffffff',
        hubSelected: '#3b82f6', // Light Blue
        text: '#000000',
        cable: '#3b82f6'
    };

    const hubSize = 24; // Px
    const halfSize = hubSize / 2;
    const JUMP_RADIUS = 6;

    // Calculate usage
    const hubUsage: Record<string, number> = {};
    if (cables) {
        cables.forEach(c => {
            if (c.fromId) hubUsage[c.fromId] = (hubUsage[c.fromId] || 0) + 1;
        });
    }

    // Move hooks to top level, before conditional returns
    const cablePaths = React.useMemo(() => {
        if (!layers.cables) return [];

        return (cables || []).map((cable) => {
            const points = cable.points;
            if (!points || points.length < 2) return { id: cable.id, data: '' };

            let path = `M ${points[0].x} ${points[0].y}`;

            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];

                // Check if current segment is Horizontal
                const isHorizontal = Math.abs(p1.y - p2.y) < 0.1;
                const shouldJump = isHorizontal && !allowOutsideConnections;

                if (shouldJump) {
                    // Find intersections with all OTHER Vertical segments
                    const intersections: number[] = [];
                    const minX = Math.min(p1.x, p2.x);
                    const maxX = Math.max(p1.x, p2.x);
                    const y = p1.y;

                    (cables || []).forEach((otherCable) => {
                        // Skip checking against itself? 
                        // Actually, a cable can cross itself, so we check self too, but effectively skip self-segment
                        // But strictly: Horizontal jumps over Vertical.
                        // We check ALL vertical segments of ALL cables.

                        // Optimization: if strictly orthogonal, we only check V segments
                        const opoints = otherCable.points;
                        if (!opoints) return;
                        for (let j = 0; j < opoints.length - 1; j++) {
                            const q1 = opoints[j];
                            const q2 = opoints[j + 1];

                            // Check if q is Vertical
                            if (Math.abs(q1.x - q2.x) < 0.1) {
                                const xV = q1.x;
                                const minY = Math.min(q1.y, q2.y);
                                const maxY = Math.max(q1.y, q2.y);

                                // Check overlap
                                if (xV > minX + JUMP_RADIUS && xV < maxX - JUMP_RADIUS &&
                                    y > minY && y < maxY) {
                                    intersections.push(xV);
                                }
                            }
                        }
                    });

                    // Sort intersections based on direction
                    const isLTR = p2.x > p1.x;
                    intersections.sort((a, b) => isLTR ? a - b : b - a);

                    // Remove duplicates just in case
                    const uniqueInts = intersections.filter((val, idx, arr) => idx === 0 || val !== arr[idx - 1]);

                    // Draw segment with jumps
                    uniqueInts.forEach(xV => {
                        if (isLTR) {
                            // Jump Up (Negative Y in Canvas implies "Up" visually? No, Y increases down.)
                            // We want a visual "bump". "Up" in user pic typically means away from gravity or just a bulge.
                            // Let's do a bulge towards negative Y (Top of screen).
                            // L->R. Start x-r. End x+r. 
                            // Center x, y-r.
                            // CW: Sweep 1.
                            path += ` L ${xV - JUMP_RADIUS} ${y}`;
                            path += ` A ${JUMP_RADIUS} ${JUMP_RADIUS} 0 0 1 ${xV + JUMP_RADIUS} ${y}`;
                        } else {
                            // R->L. Start x+r. End x-r.
                            // To bulge "Up" (Negative Y):
                            // Center x, y-r.
                            // Start (3 o'clock). End (9 o'clock).
                            // CCW: Sweep 0.
                            path += ` L ${xV + JUMP_RADIUS} ${y}`;
                            path += ` A ${JUMP_RADIUS} ${JUMP_RADIUS} 0 0 0 ${xV - JUMP_RADIUS} ${y}`;
                        }
                    });

                    // Finish segment
                    path += ` L ${p2.x} ${p2.y}`;

                } else {
                    // Vertical segment: just draw line
                    // (Verticals don't jump, they get jumped over)
                    path += ` L ${p2.x} ${p2.y}`;
                }
            }
            return { id: cable.id, data: path };
        });
    }, [cables, layers.cables, allowOutsideConnections]);

    if (!hubs?.length && !cables?.length) return null;
    // If both hidden, return null early? Or just render empty groups?
    if (!layers.hubs && !layers.cables) return null;

    return (
        <Group>
            {/* Render Cables */}
            {/* Render Cables */}
            {layers.cables && cablePaths.map(cp => {
                const isSelected = selectedIds.includes(cp.id);
                return (
                    <Path
                        key={cp.id}
                        data={cp.data}
                        stroke={isSelected ? '#fde047' : (cables.find(c => c.id === cp.id)?.color || colors.cable)} // Yellow if selected, else custom or theme blue
                        strokeWidth={isSelected ? 4 : 2}
                        lineCap="round"
                        lineJoin="round"
                        opacity={1}
                        listening={true}
                        onClick={(e) => {
                            e.cancelBubble = true;
                            // Toggle selection with Shift
                            if (e.evt.shiftKey) {
                                if (isSelected) {
                                    setSelection(selectedIds.filter(id => id !== cp.id));
                                } else {
                                    setSelection([...selectedIds, cp.id]);
                                }
                            } else {
                                setSelection([cp.id]);
                            }
                        }}
                        onTap={(e) => {
                            e.cancelBubble = true;
                            setSelection([cp.id]);
                        }}
                    />
                );
            })}

            {/* Render Hubs */}
            {layers.hubs && hubs.map(hub => {
                const isSelected = selectedIds.includes(hub.id);
                const used = hubUsage[hub.id] || 0;
                const isFull = used >= hub.capacity;

                return (
                    <Group
                        key={hub.id}
                        x={hub.x}
                        y={hub.y}
                        draggable
                        onDragEnd={(e) => {
                            useProjectStore.getState().updateHub(hub.id, { x: e.target.x(), y: e.target.y() });
                        }}
                    >
                        {/* Hub Body */}
                        <Rect
                            width={hubSize}
                            height={hubSize}
                            offsetX={halfSize}
                            offsetY={halfSize}
                            fill={isFull ? '#ef4444' : colors.hubFill} // Red if full
                            stroke={isSelected ? '#fff' : colors.hubStroke}
                            strokeWidth={isSelected ? 3 : 2}
                            cornerRadius={4}
                            shadowColor="black"
                            shadowBlur={5}
                            shadowOpacity={0.3}
                            name="hub"
                            id={hub.id}
                        />

                        {/* Divider Line */}
                        <Line
                            points={[-halfSize, 0, halfSize, 0]}
                            stroke={colors.hubStroke}
                            strokeWidth={1}
                            listening={false}
                        />

                        {/* Used Count (Top Half) */}
                        <Text
                            text={used.toString()}
                            fontSize={11}
                            fontStyle="bold"
                            fill={colors.text}
                            align="center"
                            verticalAlign="middle"
                            width={hubSize}
                            height={halfSize}
                            x={-halfSize}
                            y={-halfSize}
                            listening={false}
                        />

                        {/* Capacity (Bottom Half) */}
                        <Text
                            text={hub.capacity.toString()}
                            fontSize={11}
                            fontStyle="bold"
                            fill={colors.text}
                            align="center"
                            verticalAlign="middle"
                            width={hubSize}
                            height={halfSize}
                            x={-halfSize}
                            y={0}
                            listening={false}
                        />
                    </Group>
                );
            })}
        </Group>
    );
};
