import React from 'react';
import { Group, Rect, Text, Path, Line } from 'react-konva';
import { useProjectStore } from '../../../store/useProjectStore';
import { getHubPortCoordinates } from '../../../utils/routing';

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

        const RENDER_OFFSET = 6;
        // JUMP_RADIUS removed

        // ---------------------------------------------------------
        // 1. PRE-CALCULATION PASS (Calculate visual segments)
        // ---------------------------------------------------------

        // Helper to get segment key for parallel grouping
        const getSegKey = (p1: { x: number, y: number }, p2: { x: number, y: number }) => {
            const q = (v: number) => Math.round(v * 10) / 10;
            const k1 = `${q(p1.x)},${q(p1.y)}`;
            const k2 = `${q(p2.x)},${q(p2.y)}`;
            return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
        };

        const segmentMap = new Map<string, { cableId: string, segmentIdx: number }[]>();
        if (cableSettings.showParallel) {
            (cables || []).forEach(c => {
                for (let i = 0; i < c.points.length - 1; i++) {
                    const key = getSegKey(c.points[i], c.points[i + 1]);
                    if (!segmentMap.has(key)) segmentMap.set(key, []);
                    segmentMap.get(key)!.push({ cableId: c.id, segmentIdx: i });
                }
            });
        }

        const getOffset = (cableId: string, p1: { x: number, y: number }, p2: { x: number, y: number }) => {
            if (!cableSettings.showParallel) return { x: 0, y: 0 };
            const key = getSegKey(p1, p2);
            const group = segmentMap.get(key);
            if (!group || group.length <= 1) return { x: 0, y: 0 };

            // Sort to ensure deterministic ordering
            group.sort((a, b) => a.cableId.localeCompare(b.cableId));
            const index = group.findIndex(g => g.cableId === cableId);

            // Canonical direction for offset
            const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            if (len < 0.1) return { x: 0, y: 0 };

            const isCanonical = (p1.x < p2.x) || (Math.abs(p1.x - p2.x) < 0.1 && p1.y < p2.y);

            const dx = isCanonical ? p2.x - p1.x : p1.x - p2.x;
            const dy = isCanonical ? p2.y - p1.y : p1.y - p2.y;

            const nx = -dy / len;
            const ny = dx / len;
            const shift = (index - (group.length - 1) / 2) * RENDER_OFFSET;

            return { x: nx * shift, y: ny * shift };
        };

        // Flatten all segments into a structure we can query
        // Structure: { cableId, segmentIdx, p1Opt, p2Opt, isHorizontal, minX, maxX, minY, maxY }
        type RenderSegment = {
            cableId: string;
            segmentIdx: number;
            p1: { x: number, y: number };
            p2: { x: number, y: number };
            isHorizontal: boolean;
            minX: number; maxX: number;
            minY: number; maxY: number;
        };

        const allSegments: RenderSegment[] = [];

        (cables || []).forEach(c => {
            const pts = c.points;
            if (!pts || pts.length < 2) return;
            for (let i = 0; i < pts.length - 1; i++) {
                const off = getOffset(c.id, pts[i], pts[i + 1]);
                // For the very first point of the cable, we might need its own offset calculation if we want perfect corners,
                // but usually p1 uses the offset of the segment p1-p2.
                // However, logic above uses the SAME segment offset for both endpoints of the segment.
                // This creates "disconnected" corners if the offsets differ between segments.
                // For "Electrical View", disjoint corners are often accepted or we'd need complex corner joining.
                // We will stick to the segment-based offset which implies disjoint corners (simple).

                const p1 = { x: pts[i].x + off.x, y: pts[i].y + off.y };
                const p2 = { x: pts[i + 1].x + off.x, y: pts[i + 1].y + off.y };

                const isHoriz = Math.abs(p1.y - p2.y) < 1.0; // Tolerance

                allSegments.push({
                    cableId: c.id,
                    segmentIdx: i,
                    p1, p2,
                    isHorizontal: isHoriz,
                    minX: Math.min(p1.x, p2.x),
                    maxX: Math.max(p1.x, p2.x),
                    minY: Math.min(p1.y, p2.y),
                    maxY: Math.max(p1.y, p2.y)
                });
            }
        });

        // ---------------------------------------------------------
        // 2. RENDERING PASS
        // ---------------------------------------------------------

        return (cables || []).map(c => {
            const pts = c.points;
            if (!pts || pts.length < 2) return { id: c.id, data: '' };

            let d = '';

            for (let i = 0; i < pts.length - 1; i++) {
                const off = getOffset(c.id, pts[i], pts[i + 1]);
                const p1 = { x: pts[i].x + off.x, y: pts[i].y + off.y };
                const p2 = { x: pts[i + 1].x + off.x, y: pts[i + 1].y + off.y };

                // Move to start of segment
                if (i === 0) d += `M ${p1.x} ${p1.y}`;

                // Draw straight line to p2
                d += ` L ${p2.x} ${p2.y}`;
            }

            return { id: c.id, data: d };
        });

    }, [cables, layers.cables, cableSettings.showParallel]);

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

                // Port Ticks (Entries)
                // Port Ticks (Entries)
                const portTicks = [];
                const tickLen = 3;

                // Map Port Index -> Cable Color
                const portColorMap = new Map<number, string>();
                let hubPrimaryColor = colors.hubFill; // Default

                // Find connected cables
                const connectedCables = cables.filter(c => c.fromId === hub.id || c.toId === hub.id);

                // Determine Hub Primary Color (from first connected cable, or default)
                // This corresponds to "bottom part ... in color of cables"
                if (connectedCables.length > 0) {
                    // Try to find a non-default color? Or just the first one?
                    // Usually cables have a set color.
                    if (connectedCables[0].color) {
                        hubPrimaryColor = connectedCables[0].color;
                    }
                }

                // Calculate Geometry Helpers
                // We need to match precise coordinates.
                // Re-implementing logic to get Base and Tip for checking.

                const halfSize = hubSize / 2;
                const baseDist = halfSize + 4;

                connectedCables.forEach(c => {
                    const pStart = c.points[0];
                    const pEnd = c.points[c.points.length - 1];
                    const TOLERANCE_SQ = 10 * 10; // 10px tolerance (very generous)

                    for (let i = 0; i < hub.capacity; i++) {
                        // Calculate Tip (Standard)
                        const tip = getHubPortCoordinates({ x: hub.x, y: hub.y }, hub.capacity, i, hubSize, tickLen);

                        // Calculate Base (Manual)
                        // Base is simply Tip minus the tick length vector? Or calculated from angle.
                        // Let's use the Angle logic to strictly match rendering.
                        const angleDeg = (i * 360) / hub.capacity;
                        const angleRad = (angleDeg - 90) * (Math.PI / 180);
                        const cos = Math.cos(angleRad);
                        const sin = Math.sin(angleRad);
                        const maxComp = Math.max(Math.abs(cos), Math.abs(sin));
                        const rBase = baseDist / maxComp;
                        const base = {
                            x: hub.x + (cos * rBase),
                            y: hub.y + (sin * rBase)
                        };

                        // Check Start vs Tip OR Base
                        const dStartTip = Math.pow(tip.x - pStart.x, 2) + Math.pow(tip.y - pStart.y, 2);
                        const dStartBase = Math.pow(base.x - pStart.x, 2) + Math.pow(base.y - pStart.y, 2);

                        // Check End vs Tip OR Base
                        const dEndTip = Math.pow(tip.x - pEnd.x, 2) + Math.pow(tip.y - pEnd.y, 2);
                        const dEndBase = Math.pow(base.x - pEnd.x, 2) + Math.pow(base.y - pEnd.y, 2);

                        if (dStartTip < TOLERANCE_SQ || dStartBase < TOLERANCE_SQ ||
                            dEndTip < TOLERANCE_SQ || dEndBase < TOLERANCE_SQ) {
                            portColorMap.set(i, c.color || colors.cable);
                            // Don't break immediately if multiple cables map to same port (collision), 
                            // but usually only one.
                            // break; 
                        }
                    }
                });

                // Use shared helper for consistency
                for (let i = 0; i < hub.capacity; i++) {
                    // Start relative calc for rendering
                    const angleDeg = (i * 360) / hub.capacity;
                    const angleRad = (angleDeg - 90) * (Math.PI / 180);

                    const cos = Math.cos(angleRad);
                    const sin = Math.sin(angleRad);

                    const maxComp = Math.max(Math.abs(cos), Math.abs(sin));
                    const rStart = baseDist / maxComp;

                    const x1 = cos * rStart;
                    const y1 = sin * rStart;

                    // Determine orientation based on dominant axis
                    let x2, y2;
                    if (Math.abs(y1) > Math.abs(x1)) {
                        // Vertical Tick
                        x2 = x1;
                        y2 = y1 + (Math.sign(y1) * tickLen);
                    } else {
                        // Horizontal Tick
                        x2 = x1 + (Math.sign(x1) * tickLen);
                        y2 = y1;
                    }

                    const tickColor = portColorMap.get(i) || '#94a3b8'; // Cable color or Gray

                    portTicks.push(
                        <Line
                            key={`tick-${i}`}
                            points={[x1, y1, x2, y2]}
                            stroke={tickColor}
                            strokeWidth={2}
                            lineCap="square"
                        />
                    );
                }

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
                        {/* Hub Body (Top Half) */}
                        <Rect
                            width={hubSize}
                            height={halfSize}
                            x={-halfSize}
                            y={-halfSize}
                            fill={colors.hubFill}
                            stroke={isSelected ? '#fff' : colors.hubStroke}
                            strokeWidth={isSelected ? 3 : 2}
                            cornerRadius={[4, 4, 0, 0]} // Top corners
                            name="hub-top"
                        />

                        {/* Hub Body (Bottom Half) - COLORS MATCH CABLE */}
                        <Rect
                            width={hubSize}
                            height={halfSize}
                            x={-halfSize}
                            y={0}
                            fill={isFull ? '#ef4444' : hubPrimaryColor} // Use Cable Color
                            stroke={isSelected ? '#fff' : colors.hubStroke}
                            strokeWidth={isSelected ? 3 : 2}
                            cornerRadius={[0, 0, 4, 4]} // Bottom corners
                            name="hub-bottom"
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
                            fill={colors.text} // Use Text color (White/Black)
                            align="center"
                            verticalAlign="middle"
                            width={hubSize}
                            height={halfSize}
                            x={-halfSize}
                            y={0}
                            listening={false}
                        />

                        {/* Port Ticks on Perimeter (Rendered LAST to be on top) */}
                        {portTicks}
                    </Group>
                );
            })}
        </Group>
    );
};
