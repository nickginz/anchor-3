
import type { Anchor, Wall, Point } from '../types';
import { detectRooms, calculatePolygonArea } from './room-detection';
import { isPointInPolygon, dist, getPolygonCentroid } from './geometry';

interface ReductionResult {
    anchors: Anchor[];
    removedCount: number;
}

export const reduceAnchors = (
    currentAnchors: Anchor[],
    walls: Wall[],
    percentage: number,
    scaleRatio: number,
    scope: 'small' | 'large' | 'all' = 'all'
): ReductionResult => {
    // 1. Filter Scope: Auto-placed AND Not Locked
    const scopeAnchors = currentAnchors.filter(a => a.isAuto && !a.locked);
    const preservedAnchors = currentAnchors.filter(a => !a.isAuto || a.locked);

    if (scopeAnchors.length === 0) {
        return { anchors: currentAnchors, removedCount: 0 };
    }

    // 2. Room Detection & Classification
    const rooms = detectRooms(walls);
    const smallRooms: Point[][] = [];
    const bigRooms: Point[][] = [];
    const roomAreas = new Map<Point[], number>(); // Poly ref -> Area

    rooms.forEach(poly => {
        const areaPx = Math.abs(calculatePolygonArea(poly));
        const areaM2 = areaPx / (scaleRatio * scaleRatio);
        roomAreas.set(poly, areaM2);
        if (areaM2 < 80) {
            smallRooms.push(poly);
        } else {
            bigRooms.push(poly);
        }
    });

    // 3. Map Anchors to Rooms
    const smallRoomAnchors: Anchor[] = [];
    const bigRoomAnchors: Anchor[] = [];
    const anchorRoomMap = new Map<string, Point[]>(); // AnchorId -> RoomPoly

    scopeAnchors.forEach(a => {
        const p = { x: a.x, y: a.y };
        // Check Small First
        let found = false;
        for (const room of smallRooms) {
            if (isPointInPolygon(p, room)) {
                smallRoomAnchors.push(a);
                anchorRoomMap.set(a.id, room);
                found = true;
                break;
            }
        }
        if (!found) {
            for (const room of bigRooms) {
                if (isPointInPolygon(p, room)) {
                    bigRoomAnchors.push(a);
                    anchorRoomMap.set(a.id, room);
                    found = true;
                    break;
                }
            }
        }
        // If not in any room (e.g. outside), treat as "Big" for general pruning or ignoring?
        // Let's treat valid anchors as those inside known rooms.
        // If an anchor is outside all rooms, it's likely a stray. 
        // Logic says "divide... proportionaly to sum anchors in small and big".
        // If it's effectively "outside", we'll default to Big for safety or generic pool?
        // Let's add standard "Big" behavior for outliers to ensure they are processed.
        if (!found) {
            bigRoomAnchors.push(a);
        }
    });

    // 4. Calculate Removal Targets
    const totalScope = scopeAnchors.length;
    const countSmall = smallRoomAnchors.length;
    const countBig = bigRoomAnchors.length; // Includes outliers

    // Proportional Split or Scoped Target
    let targetRemoveSmall = 0;
    let targetRemoveBig = 0;

    if (scope === 'all') {
        const totalToRemove = Math.floor(totalScope * percentage);
        if (totalToRemove === 0) return { anchors: currentAnchors, removedCount: 0 };
        targetRemoveSmall = Math.floor(totalToRemove * (countSmall / totalScope));
        targetRemoveBig = Math.floor(totalToRemove * (countBig / totalScope));
    } else if (scope === 'small') {
        targetRemoveSmall = Math.floor(countSmall * percentage);
        if (targetRemoveSmall === 0) return { anchors: currentAnchors, removedCount: 0 };
    } else if (scope === 'large') {
        targetRemoveBig = Math.floor(countBig * percentage);
        if (targetRemoveBig === 0) return { anchors: currentAnchors, removedCount: 0 };
    }

    // Note: Due to floor steps, targetRemoveSmall + targetRemoveBig <= totalToRemove.
    // We strictly follow the result of the floor calculation per prompt.

    // 5. Execute Small Room Reduction
    // Strategy: "find smallest room with largest overlaps from anchors form small rooms... remove it"

    let currentSmallAnchors = [...smallRoomAnchors];
    const removedSmallIds = new Set<string>();

    // Initialize Big Anchors early for context usage
    let currentBigAnchors = [...bigRoomAnchors];
    const removedBigIds = new Set<string>();

    for (let i = 0; i < targetRemoveSmall; i++) {
        if (currentSmallAnchors.length === 0) break;

        // Calculate Metrics for current set
        // Metric 1: Signal strength at room centroid (Sum of 1/d to all anchors)
        // Metric 2: Sum of distance to 2 closest *small room* anchors (Crowding)
        // Metric 3: Room Area
        // Metric 4: Overlaps (Neighbors in range)

        const allActiveAnchors = [
            ...preservedAnchors,
            ...currentBigAnchors, // Big room anchors are "static" context for this loop
            ...currentSmallAnchors
        ];

        const candidates = currentSmallAnchors.map(anchor => {
            const room = anchorRoomMap.get(anchor.id);
            let area = 9999;
            let centroid = { x: anchor.x, y: anchor.y };

            if (room) {
                area = (roomAreas.get(room) || 9999);
                centroid = getPolygonCentroid(room);
            }

            // Metric 1: Average Signal Strength (Proxy: Sum of Inverse Distances to Centroid)
            // Check against ALL anchors
            let signalScore = 0;
            allActiveAnchors.forEach(a => {
                const d = dist(a, centroid);
                // Avoid singularity and cap effectiveness range (e.g. 50m max influence?)
                // Use simple 1 / max(d, 10px).
                signalScore += 1 / Math.max(d, 10);
            });

            // Metric 2: Neighbor Crowding (Sum of dist to 2 closest SMALL room neighbors)
            // "less sum of distance to 2 closest anchors" -> Smaller sum means CLOSER means MORE CROWDED -> Prioritize Removal.
            const dists = currentSmallAnchors
                .filter(other => other.id !== anchor.id)
                .map(other => dist(anchor, other))
                .sort((a, b) => a - b);

            let neighborDistSum = 0;
            if (dists.length >= 2) {
                neighborDistSum = dists[0] + dists[1];
            } else if (dists.length === 1) {
                neighborDistSum = dists[0];
            } else {
                neighborDistSum = Number.MAX_VALUE; // Solitary
            }

            // Metric 4: Overlaps (Classic density)
            const r = anchor.radius || 10;
            const rangePx = r * scaleRatio;
            let overlaps = 0;
            currentSmallAnchors.forEach(other => {
                if (anchor.id !== other.id) {
                    if (dist(anchor, other) < (rangePx * 2)) {
                        overlaps++;
                    }
                }
            });

            return { anchor, area, overlaps, signalScore, neighborDistSum };
        });

        // Priority Sort as requested:
        // 1. Strongest Signal (DESC)
        // 2. Smallest Sum Dist (ASC) - Closer Neighbors -> Remove
        // 3. Smallest Area (ASC)
        // 4. Max Overlap (DESC)

        candidates.sort((a, b) => {
            // 1. Signal (DESC)
            if (Math.abs(a.signalScore - b.signalScore) > 0.0001) {
                return b.signalScore - a.signalScore;
            }
            // 2. Neighbor Dist Sum (ASC)
            if (Math.abs(a.neighborDistSum - b.neighborDistSum) > 1) {
                return a.neighborDistSum - b.neighborDistSum;
            }
            // 3. Area (ASC)
            if (Math.abs(a.area - b.area) > 0.1) {
                return a.area - b.area;
            }
            // 4. Overlaps (DESC)
            return b.overlaps - a.overlaps;
        });

        // Remove top candidate
        const toRemove = candidates[0].anchor;
        removedSmallIds.add(toRemove.id);
        currentSmallAnchors = currentSmallAnchors.filter(a => a.id !== toRemove.id);
    }

    // 6. Execute Big Room Reduction
    // Strategy: "find anchor that have smallest sum of distantaces for to closest 2 anchors in that big room"

    for (let i = 0; i < targetRemoveBig; i++) {
        if (currentBigAnchors.length === 0) break;

        // Calculate Crowding Metric
        const candidates = currentBigAnchors.map(anchor => {
            // Find distances to all other big room anchors
            const dists = currentBigAnchors
                .filter(other => other.id !== anchor.id)
                .map(other => dist(anchor, other))
                .sort((a, b) => a - b); // Ascending distance

            // Sum closest 2
            // If less than 2 neighbors, take what we have or max?
            // "closest 2 anchors". If only 1 neighbor, sum is dist. If 0, sum is Infinity (don't remove solitary).
            let sumDist = 0;
            if (dists.length >= 2) {
                sumDist = dists[0] + dists[1];
            } else if (dists.length === 1) {
                sumDist = dists[0]; // Still removable if crowded by 1?
            } else {
                sumDist = Number.MAX_VALUE; // Solitary
            }

            return { anchor, sumDist };
        });

        // Sort by SumDist ASC (Smallest sum = closest neighbors = most crowded)
        candidates.sort((a, b) => a.sumDist - b.sumDist);

        const toRemove = candidates[0].anchor;
        removedBigIds.add(toRemove.id);
        currentBigAnchors = currentBigAnchors.filter(a => a.id !== toRemove.id);
    }

    // 7. Reassemble
    const finalAnchors = [
        ...preservedAnchors,
        ...currentSmallAnchors,
        ...currentBigAnchors
    ];

    return {
        anchors: finalAnchors,
        removedCount: removedSmallIds.size + removedBigIds.size
    };
};
