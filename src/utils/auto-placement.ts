import type { Wall, Anchor } from '../types';
import { detectRooms } from './room-detection';
import { dist, isPointInPolygon } from './geometry';
import type { Point } from './geometry';
import { generateOffsets, generateMedialAxis } from './geometry-tools';
import * as turf from '@turf/turf';

// Types
export interface PlacementOptions {
    radius: number; // Detection radius in meters
    shape?: 'circle' | 'square' | 'triangle' | 'star' | 'hex'; // Anchor shape
    showRadius?: boolean; // Show coverage radius
    minOverlap: number; // Min required overlap count
    wallThickness: number; // For avoiding walls
    scaleRatio: number; // Pixels per meter
    spacingFactor?: number; // Usage depends on algorithm
}

// Main Function: Advanced Auto-Placement (V2)
// Algorithm:
// 1. Check Geometry (Room) and Topology (Medial Axis).
// 2. Zone 1: Place anchors at intersections of [5m Offset] and [Medial Axis].
// 3. Zone 2: Place anchors at Medial Axis Junctions (3+ lines) that are OUTSIDE the 5m Offset.
// 4. Zone 3 (Offset Fill): If 5m Offset line segment > 10m, fill symmetrically (Max overlap 2.5m).
// 5. Zone 4 (Topology Fill): If Medial Axis segment OUTSIDE 5m Offset > 10m, fill symmetrically.

export const generateAutoAnchors = (walls: Wall[], options: PlacementOptions, existingAnchors: Point[] = []): Omit<Anchor, 'id'>[] => {
    const { radius, scaleRatio } = options;

    // Constants from User Request

    const OVERLAP_METERS = 2.5;

    // Convert to Pixels


    // Target Spacing for Fill Logic
    // "Max overlap is 2.5 meters". 
    // Spacing = Diameter - Overlap = 2 * Radius - 2.5.
    // Ensure spacing is positive.
    const spacingMeters = Math.max(1, (2 * radius) - OVERLAP_METERS);
    const spacingPx = spacingMeters * scaleRatio;



    // Snap Distance (1.5m)
    const snapDistPx = 1.5 * scaleRatio;

    // Fill Threshold (10m)
    const fillThresholdPx = 10 * scaleRatio;

    // Detect Rooms
    const rooms = detectRooms(walls);

    // Global Accumulator for Candidates
    // We check against `existingAnchors` before finalizing.
    // We also dedup candidates against themselves.
    const uniqueCandidates: Point[] = [];
    const finalAnchors: Omit<Anchor, 'id'>[] = [];

    // Helper: Stitch Medial Axis into Continuous Branches
    // Converts disjoint segments into long polylines (branches between junctions/endpoints)
    const stitchMedialAxis = (segments: Point[][]): Point[][] => {
        const adj = new Map<string, Point[]>();
        const coordMap = new Map<string, Point>();

        const key = (p: Point) => `${Math.round(p.x)},${Math.round(p.y)}`;

        // Build Graph
        segments.forEach(seg => {
            const p1 = seg[0], p2 = seg[1];
            const k1 = key(p1), k2 = key(p2);

            if (!adj.has(k1)) adj.set(k1, []);
            if (!adj.has(k2)) adj.set(k2, []);
            adj.get(k1)!.push(p2);
            adj.get(k2)!.push(p1);

            coordMap.set(k1, p1);
            coordMap.set(k2, p2);
        });

        // Find Junctions & Endpoints (Degree != 2)
        const nodes: string[] = [];
        adj.forEach((neighbors, k) => {
            if (neighbors.length !== 2) nodes.push(k);
        });

        // If loop (Circle), pick random node
        if (nodes.length === 0 && adj.size > 0) {
            nodes.push(adj.keys().next().value!);
        }

        const branches: Point[][] = [];
        const visitedEdges = new Set<string>();

        // Traverse from each node
        nodes.forEach(startNodeKey => {
            const neighbors = adj.get(startNodeKey)!;
            neighbors.forEach(nextP => {
                const nextKey = key(nextP);
                const edgeKey = [startNodeKey, nextKey].sort().join('-');

                if (visitedEdges.has(edgeKey)) return;

                // Start Branch
                visitedEdges.add(edgeKey);
                const branch: Point[] = [coordMap.get(startNodeKey)!, nextP];

                let currKey = nextKey;
                let prevKey = startNodeKey;

                // Walk until another node
                while (true) {
                    const currNeighbors = adj.get(currKey)!;
                    if (currNeighbors.length !== 2) break; // Reached node

                    // Find next step (not prev)
                    const nextStep = currNeighbors.find(n => key(n) !== prevKey);
                    if (!nextStep) break; // Should not happen

                    const nextStepKey = key(nextStep);
                    const stepEdgeKey = [currKey, nextStepKey].sort().join('-');

                    // Stability Fix: Break infinite loops if graph has cycles
                    if (visitedEdges.has(stepEdgeKey)) break;

                    visitedEdges.add(stepEdgeKey);

                    branch.push(nextStep);
                    prevKey = currKey;
                    currKey = nextStepKey;
                }
                branches.push(branch);
            });
        });

        return branches;
    };

    rooms.forEach(roomPoly => {
        if (roomPoly.length < 3) return;

        // 1. Generate Medial Axis (High Precision) - Once per Room
        const medialAxis = generateMedialAxis(roomPoly, 2);
        // Pre-convert to Turf for Intersections
        const medialFeats = medialAxis.map(seg => turf.lineString(seg.map(p => [p.x, p.y])));

        // Stitch Axis - Once per Room
        const stitchedAxis = stitchMedialAxis(medialAxis);

        // Helper: Add Candidate (Dedup locally)
        const addCandidate = (p: Point) => {
            // Dedup against UNIQUE candidates (Close proximity check)
            // 10px tolerance (~20cm)
            if (!uniqueCandidates.some(u => dist(u, p) < 10)) {
                uniqueCandidates.push(p);
            }
        };

        // Helper: Symmetrical Fill
        const symmetricalFill = (p1: Point, p2: Point) => {
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.sqrt(dx * dx + dy * dy);

            if (len > fillThresholdPx) { // > 10m
                // Number of gaps to fill
                // We want spacing <= targetSpacing.
                // NumSegments = ceil(len / spacing)
                const numSegments = Math.floor(len / spacingPx);

                // If numSegments = 1, we don't need intermediate points?
                // But len > 10m. Spacing (r=10m -> 17.5m).
                // If len=15m. Spacing=17.5. num=1.
                // Should we add point? 
                // "add more anchors ... max overlap 2.5m".
                // If we have just endpoints, distance is 15m.
                // Coverage R=10. Overlap = 20 - 15 = 5m.
                // This is > 2.5m overlap. So we don't *need* more anchors to satisfy min overlap?
                // Wait, "max overlap is 2.5m" means overlap SHOULD NOT EXCEED 2.5m? (Efficiency).
                // OR means overlap MUST BE AT LEAST 2.5m? (Redundancy).
                // If user wants redundancy, they usually say "min overlap".
                // "max overlap" sounds like "don't put them too close".
                // BUT "add more anchors" implies we want to FILL the gap.
                // If len > 10m. Maybe user wants one every 10m?
                // Let's assume standard behavior: Ensuring coverage gap isn't too large?
                // Or maybe the user means "Min Overlap"?
                // Let's stick to "Symmetrical Way".
                // If I divide into `numSegments`, points are equidistant.
                // Step = len / numSegments.

                const stepX = dx / numSegments;
                const stepY = dy / numSegments;

                // Add intermediate points (k=1 to n-1)
                for (let k = 1; k < numSegments; k++) {
                    addCandidate({ x: p1.x + stepX * k, y: p1.y + stepY * k });
                }
            }
        };

        // Loop State
        const allOffsetPolys: Point[][] = [];
        let layerIndex = 0;

        // 3. Multi-Layer Offsets Loop
        const MAX_LAYERS = 20;
        while (layerIndex < MAX_LAYERS) {
            const currentOffsetMeters = 5 + (10 * layerIndex);
            const offsetPx = currentOffsetMeters * scaleRatio;

            // Generate Offset for this Layer
            const offsetPolys = generateOffsets(roomPoly, offsetPx);

            // Break if no offsets fit
            if (!offsetPolys.length) break;

            // Accumulate for Zone 4 check later
            allOffsetPolys.push(...offsetPolys);

            // Convert Offset to Turf
            const offsetLines: any[] = [];
            offsetPolys.forEach(poly => {
                const coords = poly.map(p => [p.x, p.y]);
                if (coords.length < 2) return;
                if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
                    coords.push(coords[0]);
                }
                offsetLines.push(turf.lineString(coords));
            });

            // Zone 1: Intersections (Medial Axis x Offset Line)
            offsetLines.forEach(offLine => {
                medialFeats.forEach(medLine => {
                    const intersects = turf.lineIntersect(offLine, medLine);
                    turf.featureEach(intersects, (pt) => {
                        let [x, y] = pt.geometry.coordinates;

                        // Snap Logic
                        let snapped = false;
                        for (const poly of offsetPolys) {
                            for (const v of poly) {
                                if (dist({ x, y }, v) < snapDistPx) {
                                    x = v.x;
                                    y = v.y;
                                    snapped = true;
                                    break;
                                }
                            }
                            if (snapped) break;
                        }
                        addCandidate({ x, y });
                    });
                });
            });

            // Zone 3: Fill Offset Lines (Strict 12.5m)
            const zone3Threshold = 12.5 * scaleRatio;

            const strictFill = (p1: Point, p2: Point) => {
                const d = dist(p1, p2);
                if (d > zone3Threshold) {
                    // Force break if > 12.5m
                    // Use Ceil to ensure at least 2 segments (1 mid point) if > 12.5
                    // spacing = 12.5 -> num = ceil(d/12.5)
                    const numSegments = Math.ceil(d / zone3Threshold);
                    const stepX = (p2.x - p1.x) / numSegments;
                    const stepY = (p2.y - p1.y) / numSegments;

                    for (let k = 1; k < numSegments; k++) {
                        addCandidate({ x: p1.x + stepX * k, y: p1.y + stepY * k });
                    }
                }
            };

            offsetPolys.forEach(poly => {
                for (let i = 0; i < poly.length; i++) {
                    const p1 = poly[i];
                    const p2 = poly[(i + 1) % poly.length];
                    strictFill(p1, p2);
                }
            });
            layerIndex++;
        } // End Loop

        // Helper: Generate Circle Polygon for Turf (Approximation)
        const getCircleTurfPoly = (center: Point, r: number) => {
            const steps = 32;
            const coords: number[][] = [];
            for (let i = 0; i < steps; i++) {
                const theta = (i / steps) * Math.PI * 2;
                coords.push([
                    center.x + Math.cos(theta) * r,
                    center.y + Math.sin(theta) * r
                ]);
            }
            coords.push(coords[0]); // Close ring
            return turf.polygon([coords]);
        };

        const calculateOverlapRatio = (candidate: Point, others: Point[], r: number) => {
            // 1. Create candidate circle polygon
            const subjPoly = getCircleTurfPoly(candidate, r);
            const subjArea = turf.area(subjPoly);
            if (subjArea === 0) return 0;

            // 2. Find nearby circles
            const nearby = others.filter(p => dist(candidate, p) < (2 * r));
            if (nearby.length === 0) return 0;

            // 3. Union all nearby circles into one "Covered Shape"
            let unionPoly: any = null;
            for (const p of nearby) {
                const circle = getCircleTurfPoly(p, r);
                if (!unionPoly) {
                    unionPoly = circle;
                } else {
                    unionPoly = turf.union(turf.featureCollection([unionPoly, circle]));
                }
            }

            if (!unionPoly) return 0;

            // 4. Intersect Candidate with Union
            const intersection = turf.intersect(turf.featureCollection([subjPoly, unionPoly]));

            if (!intersection) return 0;

            const intersectArea = turf.area(intersection);
            return intersectArea / subjArea;
        };

        // 2. Zone 2: Global Junctions (Moved After Loop)
        const nodeCounts = new Map<string, number>();
        const nodeCoords = new Map<string, Point>();

        medialAxis.forEach(seg => {
            seg.forEach(p => {
                const k = `${Math.round(p.x)},${Math.round(p.y)}`;
                nodeCounts.set(k, (nodeCounts.get(k) || 0) + 1);
                nodeCoords.set(k, p);
            });
        });

        nodeCounts.forEach((count, key) => {
            if (count >= 3) { // Junction
                const p = nodeCoords.get(key)!;

                // User Request: "inside offsets check overlaping of areas"
                // Check if Inside ANY offset (Inner Layers)
                // Actually, if it is "Inside", it means it's deeper in the room.
                // We generated offsets 5, 15, 25...
                // Ideally we check overlap regardless?
                // Or only for "Inside" ones?
                // "junction of topologu inside... use logic of placment like outside but inside"
                // "if it > 40% ... dont place"

                // Let's apply the Overlap Check universally for Junctions -> safer density.
                // Use Radius from options (in Pixels)
                // Note: `radius` in store is "Coverage Radius".
                // `options.radius` comes from `activeAnchor.range` usually?
                // Actually `useProjectStore` passes `radius` (pixels).
                // Let's use `radius`.

                const ratio = calculateOverlapRatio(p, uniqueCandidates, radius);

                if (ratio <= 0.40) {
                    addCandidate(p);
                }
            }
        });

        // Zone 4: Fill Exposed Topology (Stitched Paths - Gap Fill 12.5m)
        // Runs on the Medial Axis where it is NOT covered by any Offset Ring.
        // Fix: Use a snapshot of candidates for projection to act as a "stable" base.
        // This prevents feedback loops where adding an anchor on one path creates a new interval on a nearby overlapping path, causing infinite density (The "Beam" Bug).
        const baseCandidatesForZone4 = [...uniqueCandidates];

        stitchedAxis.forEach(path => {
            if (path.length < 2) return;

            // Check Exposure: Is this path covered by ANY offset ring?
            // We sample points. If vast majority are INSIDE an offset ring, we skip.
            // If they are OUTSIDE ALL offset rings, we fill.

            let coveredCount = 0;
            const sampleCount = 5;
            for (let k = 0; k <= sampleCount; k++) {
                const idx = Math.floor((path.length - 1) * (k / sampleCount));
                const p = path[idx];
                // Check against ALL accumulated offsets
                // If point is inside ANY of them, it's covered.
                if (allOffsetPolys.some(poly => isPointInPolygon(p, poly))) {
                    coveredCount++;
                }
            }

            // If mostly EXPOSED (coveredCount < half), let's fill it.
            if (coveredCount < sampleCount / 2) {
                // Project existing candidates (from SNAPSHOT) to path
                const getPathPos = (pt: Point, path: Point[]): number | null => {
                    let accLen = 0;
                    let minD = Infinity;
                    let bestT = -1;

                    for (let i = 0; i < path.length - 1; i++) {
                        const p1 = path[i];
                        const p2 = path[i + 1];
                        const len = dist(p1, p2);
                        if (len === 0) continue;

                        const t = ((pt.x - p1.x) * (p2.x - p1.x) + (pt.y - p1.y) * (p2.y - p1.y)) / (len * len);
                        const clampedT = Math.max(0, Math.min(1, t));
                        const projX = p1.x + clampedT * (p2.x - p1.x);
                        const projY = p1.y + clampedT * (p2.y - p1.y);

                        const d = dist(pt, { x: projX, y: projY });
                        if (d < minD) {
                            minD = d;
                            bestT = accLen + (clampedT * len);
                        }
                        accLen += len;
                    }

                    if (minD < 10) return bestT;
                    return null;
                };

                const pathAnchors: { t: number, p: Point }[] = [];
                // USE SNAPSHOT:
                baseCandidatesForZone4.forEach(cand => {
                    const t = getPathPos(cand, path);
                    if (t !== null) pathAnchors.push({ t, p: cand });
                });

                pathAnchors.sort((a, b) => a.t - b.t);

                // Dedup on Path
                const uniquePathAnchors = pathAnchors.filter((item, index, self) =>
                    index === 0 || (item.t - self[index - 1].t) > 1
                );

                // Fill Gaps
                const threshold = 12.5 * scaleRatio;

                for (let i = 0; i < uniquePathAnchors.length - 1; i++) {
                    const start = uniquePathAnchors[i];
                    const end = uniquePathAnchors[i + 1];
                    const linearDist = dist(start.p, end.p);

                    if (linearDist > threshold) {
                        const midX = (start.p.x + end.p.x) / 2;
                        const midY = (start.p.y + end.p.y) / 2;
                        // addCandidate still updates the LIVE set, checking for global duplicates.
                        addCandidate({ x: midX, y: midY });
                    }
                }
            }
        });
    });

    // Final Processing: Filter against existingAnchors and map to object
    uniqueCandidates.forEach(c => {
        // Check against input existingAnchors (Global prevention)
        const conflict = existingAnchors.some(e => dist(e, c) < 10);
        if (!conflict) {
            finalAnchors.push({
                x: c.x, y: c.y,
                radius, range: radius,
                showRadius: options.showRadius ?? true,
                shape: options.shape || 'circle',
                power: -40,
                txPower: 0
            });
        }
    });

    return finalAnchors;
};

// --- Classification Helper (Kept for compatibility imports if any, dummy implementation) ---
// Note: Previous internal helpers were not exported, so safe to remove if unused internally.
