import * as turf from '@turf/turf';
import ClipperLib from 'clipper-lib';
import type { Point } from '../types';

// Helper: Convert to Clipper Path (IntPoint)
// Clipper works with Integers. Scale factor is needed (e.g. 1000).
const SCALE = 1000;

function toClipperPath(points: Point[]): { X: number; Y: number }[] {
    return points.map(p => ({ X: Math.round(p.x * SCALE), Y: Math.round(p.y * SCALE) }));
}

// Generate Offsets using ClipperLib (Robust)
// Postive offset = Expand, Negative = Shrink.
// We expect 'offsetMeters' to be the distance to offset. 
// Standard behavior for "Room Offsets": Shrink (Inner Rings).
// So we apply negative offset.
export function generateOffsets(polygon: Point[], offsetPixels: number): Point[][] {
    if (!polygon || polygon.length < 3) return [];

    // Safety check for Clipper
    if (!ClipperLib) {
        console.warn("ClipperLib not loaded properly.");
        return [];
    }

    // Ensure we handle the library object correctly (Default vs Named)
    // The browser test showed 'ClipperLib' object has 'Clipper', 'ClipperOffset'.
    // const Clipper = ClipperLib.Clipper || (ClipperLib as any).default?.Clipper;

    try {
        const path = toClipperPath(polygon);
        const co = new ClipperLib.ClipperOffset();

        // JoinType: jtMiter=0, jtRound=1, jtSquare=2
        // EndType: etOpenSquare=0, etOpenRound=1, etOpenButt=2, etClosedLine=3, etClosedPolygon=4
        const jtMiter = 0;
        const etClosedPolygon = 4;

        co.AddPath(path, jtMiter, etClosedPolygon);

        const solution: { X: number; Y: number }[][] = [];
        // Execute(delta). Negative for shrink.
        co.Execute(solution, -offsetPixels * SCALE);

        // Convert back to Points
        return solution.map(ring => ring.map(pt => ({
            x: pt.X / SCALE,
            y: pt.Y / SCALE
        })));
    } catch (e) {
        console.error("Clipper Offset Error:", e);
        return [];
    }
}

// Skeleton Visualization: Generate series of offsets until empty
export function generateSkeletonLines(polygon: Point[], stepMeters: number): Point[][] {
    if (!polygon || polygon.length < 3) return [];

    const allPaths: Point[][] = [];
    let currentPoly = [polygon]; // Array of polygons (handles splits)

    // Safety break
    let iterations = 0;
    const MAX_ITERS = 200;

    while (iterations < MAX_ITERS) {
        let hasValidPaths = false;
        const nextPolys: Point[][] = [];

        currentPoly.forEach(poly => {
            const offsets = generateOffsets(poly, stepMeters);

            if (offsets && offsets.length > 0) {
                offsets.forEach(op => {
                    if (op.length > 2) {
                        allPaths.push(op);
                        nextPolys.push(op);
                        hasValidPaths = true;
                    }
                });
            }
        });

        if (!hasValidPaths) break;
        currentPoly = nextPolys;
        iterations++;
    }

    return allPaths;
}

// --- Medial Axis / Skeleton Logic using Voronoi ---

// Helper: Resample polygon boundary to generate dense sites for Voronoi
function resamplePolygon(points: Point[], segmentLength: number): Point[] {
    const resampled: Point[] = [];
    if (points.length < 3) return points;

    for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];

        resampled.push(p1);

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > segmentLength) {
            const numSegments = Math.floor(dist / segmentLength);
            const stepX = dx / dist * segmentLength;
            const stepY = dy / dist * segmentLength;

            for (let j = 1; j <= numSegments; j++) {
                resampled.push({
                    x: p1.x + stepX * j,
                    y: p1.y + stepY * j
                });
            }
        }
    }
    return resampled;
}

export function generateMedialAxis(polygon: Point[], stepPixels: number): Point[][] {
    if (!polygon || polygon.length < 3) return [];

    // 1. Convert to Turf Polygon for "Inside" checks
    const polyPoints = polygon.map(p => [p.x, p.y]);
    if (polyPoints[0][0] !== polyPoints[polyPoints.length - 1][0] || polyPoints[0][1] !== polyPoints[polyPoints.length - 1][1]) {
        polyPoints.push(polyPoints[0]);
    }
    const turfPoly = turf.polygon([polyPoints]);
    const bbox = turf.bbox(turfPoly);
    const expandedBbox: [number, number, number, number] = [bbox[0] - 100, bbox[1] - 100, bbox[2] + 100, bbox[3] + 100];

    // 2. Resample boundary
    // stepPixels is in Pixels. e.g. 50px (1m). 0.25m = 12.5px.
    // Ensure we don't kill performance. Use 2px min for high precision as requested.
    const sampleStep = Math.max(stepPixels, 2); // Minimum 2px step (Very fine)
    const sites = resamplePolygon(polygon, sampleStep);

    // 3. Generate Voronoi
    const turfPoints = turf.featureCollection(sites.map(p => turf.point([p.x, p.y])));
    const voronoi = turf.voronoi(turfPoints, { bbox: expandedBbox });

    // 4. Build Edge Map (Topology)
    // Map edgeKey -> [siteIndex1, siteIndex2]
    const edgeMap = new Map<string, number[]>();

    turf.featureEach(voronoi, (feature, featureIndex) => {
        if (!feature || !feature.geometry || feature.geometry.type !== 'Polygon') return;

        const coords = feature.geometry.coordinates[0];
        // Site Index is featureIndex
        const siteIdx = featureIndex;

        for (let i = 0; i < coords.length - 1; i++) {
            const p1 = coords[i];
            const p2 = coords[i + 1];

            // Normalize edge key
            // Rounding to avoid float precision mismatch?
            // Usually exact coordinates are shared.
            const k1 = `${p1[0].toFixed(3)},${p1[1].toFixed(3)}`;
            const k2 = `${p2[0].toFixed(3)},${p2[1].toFixed(3)}`;
            const edgeKey = k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;

            if (!edgeMap.has(edgeKey)) {
                edgeMap.set(edgeKey, []);
            }
            edgeMap.get(edgeKey)?.push(siteIdx);
        }
    });

    // 5. Filter Edges based on Site Adjacency
    const skeletonEdges: Point[][] = [];
    const numSites = sites.length;

    // Threshold: How many sites apart must they be?
    // 1 = neighbor sites (spokes).
    // Small corner might have 2-3 sites.
    // Robust value: 2.
    // 2 means sites i and i+1, i+2 are filtered (dist <= 2).
    // This keeps local details but removes immediate wall connections.
    const adjacencyThreshold = 2;

    edgeMap.forEach((indices, key) => {
        if (indices.length !== 2) return; // Must separate exactly two sites (internal edge)

        const [i1, i2] = indices;

        // Circular distance on boundary
        const diff = Math.abs(i1 - i2);
        const circularDiff = Math.min(diff, numSites - diff);

        if (circularDiff > adjacencyThreshold) {
            // This is a medial axis edge!
            const [p1Str, p2Str] = key.split('|');
            const [x1, y1] = p1Str.split(',').map(Number);
            const [x2, y2] = p2Str.split(',').map(Number);

            // Safety check: is edge inside polygon?
            // Midpoint check
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;

            // isPointInPolygon (Turf)
            // Note: Turf booleanPointInPolygon is robust
            const inside = turf.booleanPointInPolygon(turf.point([midX, midY]), turfPoly);

            if (inside) {
                skeletonEdges.push([{ x: x1, y: y1 }, { x: x2, y: y2 }]);
            }
        }
    });

    return skeletonEdges;
}
