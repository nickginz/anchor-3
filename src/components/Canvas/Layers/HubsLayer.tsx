import React from 'react';
import { Group, Rect, Text, Path, Line } from 'react-konva';
import { useProjectStore } from '../../../store/useProjectStore';

export const HubsLayer: React.FC = () => {
    const { hubs, cables, selectedIds, theme, layers, allowOutsideConnections, setSelection, cableSettings } = useProjectStore();

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

    // Calculate usage
    const hubUsage: Record<string, number> = {};
    if (cables) {
        cables.forEach(c => {
            if (c.fromId) hubUsage[c.fromId] = (hubUsage[c.fromId] || 0) + 1;
        });
    }

    const cablePaths = React.useMemo(() => {
        if (!layers.cables) return [];

        // 1. Pre-calculate Offsets if Parallel View is enabled
        const RENDER_OFFSET = 6; // px spacing between parallel cables
        const segmentMap = new Map<string, { cableId: string, segmentIdx: number }[]>();

        // Helper Key for Segments
        const getSegKey = (p1: { x: number, y: number }, p2: { x: number, y: number }) => {
            // Quantize to avoid float issues
            const q = (v: number) => Math.round(v * 10) / 10;
            const k1 = `${q(p1.x)},${q(p1.y)}`;
            const k2 = `${q(p2.x)},${q(p2.y)}`;
            return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
        };

        if (cableSettings.showParallel) {
            (cables || []).forEach(c => {
                for (let i = 0; i < c.points.length - 1; i++) {
                    const key = getSegKey(c.points[i], c.points[i + 1]);
                    if (!segmentMap.has(key)) segmentMap.set(key, []);
                    segmentMap.get(key)!.push({ cableId: c.id, segmentIdx: i });
                }
            });
        }

        // Helper to get offset for specific cable segment
        const getOffset = (cableId: string, p1: { x: number, y: number }, p2: { x: number, y: number }) => {
            if (!cableSettings.showParallel) return { x: 0, y: 0 };
            const key = getSegKey(p1, p2);
            const group = segmentMap.get(key);
            if (!group || group.length <= 1) return { x: 0, y: 0 };

            // Sort group by ID to be deterministic
            group.sort((a, b) => a.cableId.localeCompare(b.cableId));

            const index = group.findIndex(g => g.cableId === cableId);

            // Calculate Offset Vector based on CANONICAL direction
            // Determine canonical direction based on key string comparison
            const q = (v: number) => Math.round(v * 10) / 10;
            const k1 = `${q(p1.x)},${q(p1.y)}`;
            const k2 = `${q(p2.x)},${q(p2.y)}`;
            const isCanonical = k1 < k2;

            // Use (p2 - p1) if canonical, else (p1 - p2)
            const dx = isCanonical ? p2.x - p1.x : p1.x - p2.x;
            const dy = isCanonical ? p2.y - p1.y : p1.y - p2.y;

            const len = Math.hypot(dx, dy);
            if (len < 0.1) return { x: 0, y: 0 };

            // Unit Normal (Rotated 90 deg)
            // (-dy, dx)
            const nx = -dy / len;
            const ny = dx / len;

            // Centered Offset: (i - (N-1)/2) * Spacing
            const shift = (index - (group.length - 1) / 2) * RENDER_OFFSET;

            return { x: nx * shift, y: ny * shift };
        };


        return (cables || []).map((cable) => {
            const points = cable.points;
            if (!points || points.length < 2) return { id: cable.id, data: '' };

            // Calculate First Point with Offset
            const offStart = getOffset(cable.id, points[0], points[1]);
            let path = `M ${points[0].x + offStart.x} ${points[0].y + offStart.y}`;

            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];

                const off = getOffset(cable.id, p1, p2);
                const p2x = p2.x + off.x; const p2y = p2.y + off.y;

                // Correction: path M is already at p1+off. L to p2+off.
                // Note: If bends, the offsets might break continuity at corners.
                // Simple View: Just L to next point. The gaps at corners are minor for thin lines.
                // Better: Intersect the offset lines at corners. 
                // For "Electrical View" simple offsets are usually acceptable "diagrammatic" representation.

                // Jumping Logic (Only for non-parallel view usually? Or keep it?)
                // If parallel view is on, jumping is messy. Let's disable jumping in Parallel view or keep it simple.
                // User asked for "Electrical Drawing" -> Parallel lines usually don't have "jumps" if they are bus trunk.
                // We'll skip jump logic if parallel is on for cleaner look.

                const isHorizontal = Math.abs(p1.y - p2.y) < 0.1;
                const shouldJump = isHorizontal && !allowOutsideConnections && !cableSettings.showParallel;

                if (shouldJump) {
                    // Logic ... (Existing Jumps)
                    // We need to re-implement jump logic inside this map context if we want to keep it.
                    // Copying existing logic...
                    const JUMP_RADIUS = 6;
                    // Find intersections with all OTHER Vertical segments
                    const intersections: number[] = [];
                    const minX = Math.min(p1.x, p2.x);
                    const maxX = Math.max(p1.x, p2.x);
                    const y = p1.y;

                    (cables || []).forEach((otherCable) => {
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
                    const uniqueInts = intersections.filter((val, idx, arr) => idx === 0 || val !== arr[idx - 1]);

                    uniqueInts.forEach(xV => {
                        if (isLTR) {
                            path += ` L ${xV - JUMP_RADIUS} ${y}`;
                            path += ` A ${JUMP_RADIUS} ${JUMP_RADIUS} 0 0 1 ${xV + JUMP_RADIUS} ${y}`;
                        } else {
                            path += ` L ${xV + JUMP_RADIUS} ${y}`;
                            path += ` A ${JUMP_RADIUS} ${JUMP_RADIUS} 0 0 0 ${xV - JUMP_RADIUS} ${y}`;
                        }
                    });
                    path += ` L ${p2.x} ${p2.y}`;

                } else {
                    path += ` L ${p2x} ${p2y}`;
                }
            }
            return { id: cable.id, data: path };
        });
    }, [cables, layers.cables, allowOutsideConnections, cableSettings.showParallel]);

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
