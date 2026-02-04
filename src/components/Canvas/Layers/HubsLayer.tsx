import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Group, Rect, Text, Path, Line } from 'react-konva';
import { useProjectStore } from '../../../store/useProjectStore';
import type { ProjectState } from '../../../store/useProjectStore';
import type { Point } from '../../../types';
import { getHubPortCoordinates, distance } from '../../../utils/routing';



export const HubsLayer: React.FC = () => {
    const { hubs, cables, selectedIds, theme, layers, cableSettings } = useProjectStore(
        useShallow((state: ProjectState) => ({
            hubs: state.hubs,
            cables: state.cables,
            selectedIds: state.selectedIds,
            theme: state.theme,
            layers: state.layers,
            cableSettings: state.cableSettings
        }))
    );

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
            locked: boolean;
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
                    maxY: Math.max(p1.y, p2.y),
                    locked: !!c.locked
                });
            }
        });

        // ---------------------------------------------------------
        // 2. RENDERING PASS
        // ---------------------------------------------------------

        return {
            visuals: (cables || []).map(c => {
                const pts = c.points;
                if (!pts || pts.length < 2) return { id: c.id, data: '' };
                let d = '';
                for (let i = 0; i < pts.length - 1; i++) {
                    const off = getOffset(c.id, pts[i], pts[i + 1]);
                    const p1 = { x: pts[i].x + off.x, y: pts[i].y + off.y };
                    const p2 = { x: pts[i + 1].x + off.x, y: pts[i + 1].y + off.y };
                    if (i === 0) d += `M ${p1.x} ${p1.y}`;
                    d += ` L ${p2.x} ${p2.y}`;
                }
                return { id: c.id, data: d };
            }),
            segments: allSegments
        };

    }, [cables, layers.cables, cableSettings.showParallel]);

    // Ref for stable drag locking
    const dragStartPos = React.useRef<{ x: number, y: number } | null>(null);

    if (!hubs?.length && !cables?.length) return null;
    if (!layers.hubs && !layers.cables) return null;

    // Helper to check orthogonality with tolerance
    const isVertical = (p1: { x: number, y: number }, p2: { x: number, y: number }) => Math.abs(p1.x - p2.x) < 0.1;
    const isHorizontal = (p1: { x: number, y: number }, p2: { x: number, y: number }) => Math.abs(p1.y - p2.y) < 0.1;

    return (
        <Group>
            {/* 1. Visual Cables */}
            {layers.cables && (cablePaths as any).visuals.map((cp: any) => {
                const isSelected = selectedIds.includes(cp.id);
                return (
                    <Path
                        key={cp.id}
                        id={`visual-cable-${cp.id}`} // Visual ID for imperative updates
                        data={cp.data}
                        stroke={isSelected ? '#fde047' : (cables.find(c => c.id === cp.id)?.color || colors.cable)}
                        strokeWidth={isSelected ? 4 : 2}
                        lineCap="round"
                        lineJoin="round"
                        opacity={1}
                        listening={false} // Pass events to segments
                    />
                );
            })}

            {/* 2. Interaction Segments (Invisible but Draggable) */}
            {layers.cables && (cablePaths as any).segments.map((seg: any) => {
                // Determine drag axis based on segment orientation
                // If segment is Horizontal (isHoriz=true), we drag vertically (Lock X).
                // If segment is Vertical, we drag horizontally (Lock Y).
                const dragAxis = seg.isHorizontal ? 'y' : 'x';

                return (
                    <Line
                        key={`${seg.cableId}-${seg.segmentIdx}`}
                        points={[seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y]}
                        stroke="transparent"
                        strokeWidth={14} // Wide hit area
                        draggable={!seg.locked && (useProjectStore.getState().activeTool === 'cable_edit' || useProjectStore.getState().activeTool === 'select')}
                        onMouseEnter={(e) => {
                            if (seg.locked || (useProjectStore.getState().activeTool !== 'cable_edit' && useProjectStore.getState().activeTool !== 'select')) return;
                            const stage = e.target.getStage();
                            if (stage) stage.container().style.cursor = dragAxis === 'y' ? 'ns-resize' : 'ew-resize';
                        }}
                        onMouseLeave={(e) => {
                            const stage = e.target.getStage();
                            if (stage) stage.container().style.cursor = 'default';
                        }}
                        dragBoundFunc={(pos) => {
                            if (!dragStartPos.current || seg.locked) return pos;
                            return {
                                x: dragAxis === 'x' ? pos.x : dragStartPos.current.x,
                                y: dragAxis === 'y' ? pos.y : dragStartPos.current.y
                            };
                        }}
                        onDragStart={(e) => {
                            const state = useProjectStore.getState();
                            if (seg.locked || (state.activeTool !== 'cable_edit' && state.activeTool !== 'select')) {
                                e.target.stopDrag();
                                return;
                            }
                            e.cancelBubble = true;
                            dragStartPos.current = e.target.getAbsolutePosition();
                            useProjectStore.temporal.getState().pause();
                        }}
                        onDragMove={(e) => {
                            if (seg.locked) return;
                            const state = useProjectStore.getState();
                            const cable = state.cables.find(c => c.id === seg.cableId);
                            if (!cable) return;

                            const dx = e.target.x();
                            const dy = e.target.y();

                            const pts = [...cable.points];
                            const u = seg.segmentIdx;
                            const v = u + 1;

                            // Apply Delta
                            let pStart = { x: pts[u].x + dx, y: pts[u].y + dy };
                            let pEnd = { x: pts[u + 1].x + dx, y: pts[u + 1].y + dy };

                            // Visual Patch for connectivity and orthogonality
                            let visualPts = [...pts];
                            visualPts[u] = pStart;
                            visualPts[v] = pEnd;

                            // 1. Connectivity Patches (Ends)
                            if (u === 0 && cable.fromId) {
                                const dev = state.hubs.find(h => h.id === cable.fromId) || state.anchors.find(a => a.id === cable.fromId);
                                if (dev) {
                                    const dPos = { x: dev.x, y: dev.y };
                                    if (Math.abs(dPos.x - pStart.x) > 1 && Math.abs(dPos.y - pStart.y) > 1) {
                                        visualPts.unshift(dPos, { x: pStart.x, y: dPos.y });
                                    } else {
                                        visualPts.unshift(dPos);
                                    }
                                }
                            }
                            if (v === pts.length - 1 && cable.toId) {
                                const dev = state.hubs.find(h => h.id === cable.toId) || state.anchors.find(a => a.id === cable.toId);
                                if (dev) {
                                    const dPos = { x: dev.x, y: dev.y };
                                    const last = visualPts[visualPts.length - 1];
                                    if (Math.abs(dPos.x - last.x) > 1 && Math.abs(dPos.y - last.y) > 1) {
                                        visualPts.push({ x: last.x, y: dPos.y }, dPos);
                                    } else {
                                        visualPts.push(dPos);
                                    }
                                }
                            }

                            // 2. Interior Orthogonality Patches (Live Smart Extension)
                            // Note: index 'u' and 'v' might have shifted due to unshift
                            const addedAtStart = visualPts.length > pts.length && u === 0 && cable.fromId ? (Math.abs(visualPts[0].x - visualPts[1].x) > 1 ? 2 : 1) : 0;
                            const currentU = u + addedAtStart;
                            const currentV = v + addedAtStart;

                            if (currentU > 0) {
                                const pPrev = visualPts[currentU - 1];
                                const pCurr = visualPts[currentU];
                                if (!isVertical(pPrev, pCurr) && !isHorizontal(pPrev, pCurr)) {
                                    visualPts.splice(currentU, 0, { x: pPrev.x, y: pCurr.y });
                                }
                            }
                            // Adjust v if we spliced
                            const shiftedV = currentV + (currentU > 0 && !isVertical(visualPts[currentU - 1], visualPts[currentU]) && !isHorizontal(visualPts[currentU - 1], visualPts[currentU]) ? 1 : 0);
                            if (shiftedV < visualPts.length - 1) {
                                const pCurr = visualPts[shiftedV];
                                const pNext = visualPts[shiftedV + 1];
                                if (!isVertical(pCurr, pNext) && !isHorizontal(pCurr, pNext)) {
                                    visualPts.splice(shiftedV + 1, 0, { x: pNext.x, y: pCurr.y });
                                }
                            }

                            let d = '';
                            visualPts.forEach((p, i) => {
                                d += (i === 0 ? 'M ' : ' L ') + `${p.x} ${p.y}`;
                            });

                            const stage = e.target.getStage();
                            const visualNode = stage?.findOne(`#visual-cable-${cable.id}`);
                            if (visualNode) visualNode.setAttr('data', d);
                        }}
                        onDragEnd={(e) => {
                            e.cancelBubble = true;
                            const state = useProjectStore.getState();
                            const cable = state.cables.find(c => c.id === seg.cableId);
                            if (!cable) return;

                            const dx = e.target.x();
                            const dy = e.target.y();
                            e.target.position({ x: 0, y: 0 });

                            if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

                            const pts = cable.points;
                            const u = seg.segmentIdx;
                            const v = u + 1;

                            // Patching Logic (Same as onDragMove but affects state)
                            let finalPts = [...pts];
                            finalPts[u] = { x: pts[u].x + dx, y: pts[u].y + dy };
                            finalPts[v] = { x: pts[v].x + dx, y: pts[v].y + dy };

                            // 1. Connectivity
                            if (u === 0 && cable.fromId) {
                                const dev = state.hubs.find(h => h.id === cable.fromId) || state.anchors.find(a => a.id === cable.fromId);
                                if (dev) {
                                    const dPos = { x: dev.x, y: dev.y };
                                    if (Math.abs(dPos.x - finalPts[0].x) > 1 && Math.abs(dPos.y - finalPts[0].y) > 1) {
                                        finalPts.unshift(dPos, { x: finalPts[0].x, y: dPos.y });
                                    } else {
                                        finalPts.unshift(dPos);
                                    }
                                }
                            }
                            if (v === pts.length - 1 && cable.toId) {
                                const dev = state.hubs.find(h => h.id === cable.toId) || state.anchors.find(a => a.id === cable.toId);
                                if (dev) {
                                    const dPos = { x: dev.x, y: dev.y };
                                    const last = finalPts[finalPts.length - 1];
                                    if (Math.abs(dPos.x - last.x) > 1 && Math.abs(dPos.y - last.y) > 1) {
                                        finalPts.push({ x: last.x, y: dPos.y }, dPos);
                                    } else {
                                        finalPts.push(dPos);
                                    }
                                }
                            }

                            // 2. Orthogonality
                            // Need to correctly locate U and V in finalPts
                            const startAdjust = u === 0 && cable.fromId ? (finalPts.length > pts.length ? (Math.abs(finalPts[0].x - finalPts[1].x) > 1 ? 2 : 1) : 0) : 0;
                            const curU = u + startAdjust;
                            const curV = v + startAdjust;

                            if (curU > 0) {
                                const pPrev = finalPts[curU - 1];
                                const pCurr = finalPts[curU];
                                if (!isVertical(pPrev, pCurr) && !isHorizontal(pPrev, pCurr)) {
                                    finalPts.splice(curU, 0, { x: pPrev.x, y: pCurr.y });
                                }
                            }
                            const nextIndexV = curV + (curU > 0 && !isVertical(finalPts[curU - 1], finalPts[curU]) && !isHorizontal(finalPts[curU - 1], finalPts[curU]) ? 1 : 0);
                            if (nextIndexV < finalPts.length - 1) {
                                const pCurr = finalPts[nextIndexV];
                                const pNext = finalPts[nextIndexV + 1];
                                if (!isVertical(pCurr, pNext) && !isHorizontal(pCurr, pNext)) {
                                    finalPts.splice(nextIndexV + 1, 0, { x: pNext.x, y: pCurr.y });
                                }
                            }

                            // 3. Clean-up redundant segments
                            const cleanPts: Point[] = [];
                            finalPts.forEach((p, i) => {
                                if (i === 0) cleanPts.push(p);
                                else {
                                    const prev = cleanPts[cleanPts.length - 1];
                                    if (distance(p, prev) > 0.5) {
                                        // Check if collinear with prev-prev
                                        if (cleanPts.length >= 2) {
                                            const pp = cleanPts[cleanPts.length - 2];
                                            const isHoriz = isHorizontal(pp, prev) && isHorizontal(prev, p);
                                            const isVert = isVertical(pp, prev) && isVertical(prev, p);
                                            if (isHoriz || isVert) {
                                                cleanPts[cleanPts.length - 1] = p; // Remove middle man
                                            } else {
                                                cleanPts.push(p);
                                            }
                                        } else {
                                            cleanPts.push(p);
                                        }
                                    }
                                }
                            });

                            state.updateCable(cable.id, { points: cleanPts });
                            useProjectStore.temporal.getState().resume();
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
                    const TOLERANCE_SQ = 15 * 15; // Increased slightly to ensure capture, but we pick BEST match.

                    let bestPortIndex = -1;
                    let minDistanceSq = Infinity;

                    for (let i = 0; i < hub.capacity; i++) {
                        // Calculate Tip (Standard)
                        const tip = getHubPortCoordinates({ x: hub.x, y: hub.y }, hub.capacity, i, hubSize, tickLen);

                        // Calculate Base (Manual)
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

                        // Check Start vs Tip/Base
                        const dStartTip = Math.pow(tip.x - pStart.x, 2) + Math.pow(tip.y - pStart.y, 2);
                        const dStartBase = Math.pow(base.x - pStart.x, 2) + Math.pow(base.y - pStart.y, 2);

                        // Check End vs Tip/Base
                        const dEndTip = Math.pow(tip.x - pEnd.x, 2) + Math.pow(tip.y - pEnd.y, 2);
                        const dEndBase = Math.pow(base.x - pEnd.x, 2) + Math.pow(base.y - pEnd.y, 2);

                        // Find min for this port
                        const distForPort = Math.min(dStartTip, dStartBase, dEndTip, dEndBase);

                        if (distForPort < minDistanceSq) {
                            minDistanceSq = distForPort;
                            bestPortIndex = i;
                        }
                    }

                    if (bestPortIndex !== -1 && minDistanceSq < TOLERANCE_SQ) {
                        portColorMap.set(bestPortIndex, c.color || colors.cable);
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
