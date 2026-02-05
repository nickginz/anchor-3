import type { Wall } from '../types';
import ClipperLib from 'clipper-lib';

const SCALE = 1000;
const EPS = 0.1;

export const generateJoinedWalls = (walls: Wall[], scaleRatio: number, allWalls: Wall[] = []): { x: number, y: number }[][] => {
    if (walls.length === 0) return [];

    // Use allWalls for connectivity if provided, otherwise default to the subset 'walls'
    // This allows a subset (e.g. thin walls) to know they are connected to thick walls
    const graphWalls = allWalls.length > 0 ? allWalls : walls;

    // 1. Build Adjacency Graph: Endpoint Key -> Wall[]
    const adj = new Map<string, Wall[]>();
    const getKey = (x: number, y: number) => `${Math.round(x * 100)},${Math.round(y * 100)}`;

    // Track degree of each vertex
    const degrees = new Map<string, number>();

    graphWalls.forEach(w => {
        const k1 = getKey(w.points[0], w.points[1]);
        const k2 = getKey(w.points[2], w.points[3]);

        if (!adj.has(k1)) adj.set(k1, []);
        if (!adj.has(k2)) adj.set(k2, []);
        adj.get(k1)!.push(w);
        adj.get(k2)!.push(w);

        degrees.set(k1, (degrees.get(k1) || 0) + 1);
        degrees.set(k2, (degrees.get(k2) || 0) + 1);
    });

    const resultPolys: { x: number, y: number }[][] = [];
    const processedWalls = new Set<string>(); // Keep local processed set for the subset loop

    // However, if we traverse the *subset*, we must ensure we don't traverse outside of it
    // But we DO want to see the neighbors for extension.

    const allOffsetPaths = new ClipperLib.Paths();

    const subsetIds = new Set(walls.map(w => w.id));

    const getNextPath = (): Wall[] | null => {
        let startWall: Wall | null = null;
        for (const w of walls) { // Iterate over the SUBSET
            if (!processedWalls.has(w.id)) {
                startWall = w;
                break;
            }
        }

        if (!startWall) return null;

        const path: Wall[] = [startWall];
        processedWalls.add(startWall.id);

        // Extend Forward
        let currW = startWall;
        let pEndKey = getKey(currW.points[2], currW.points[3]);

        while (true) {
            const neighbors = adj.get(pEndKey);
            if ((degrees.get(pEndKey) || 0) !== 2) break;

            const nextW = neighbors?.find(w => !processedWalls.has(w.id) && subsetIds.has(w.id));
            if (!nextW) break;

            // Break chain if thickness changes (handle visual join via extension instead)
            if (Math.abs(nextW.thickness - currW.thickness) > 0.001) break;

            path.push(nextW);
            processedWalls.add(nextW.id);
            currW = nextW;

            const k1 = getKey(nextW.points[0], nextW.points[1]);
            const k2 = getKey(nextW.points[2], nextW.points[3]);
            pEndKey = (k1 === pEndKey) ? k2 : k1;
        }

        // Extend Backward
        let pStartKey = getKey(startWall.points[0], startWall.points[1]);
        while (true) {
            if ((degrees.get(pStartKey) || 0) !== 2) break;

            const neighbors = adj.get(pStartKey);
            const nextW = neighbors?.find(w => !processedWalls.has(w.id) && subsetIds.has(w.id));
            if (!nextW) break;

            // Break chain if thickness changes
            if (Math.abs(nextW.thickness - startWall.thickness) > 0.001) break;

            path.unshift(nextW);
            processedWalls.add(nextW.id);

            const k1 = getKey(nextW.points[0], nextW.points[1]);
            const k2 = getKey(nextW.points[2], nextW.points[3]);
            pStartKey = (k1 === pStartKey) ? k2 : k1;
        }

        return path;
    };

    let path;
    while ((path = getNextPath())) {
        if (path.length === 0) continue;

        const points: { X: number, Y: number }[] = [];
        const curr = path[0];
        const p1 = { x: curr.points[0], y: curr.points[1] };
        const p2 = { x: curr.points[2], y: curr.points[3] };

        if (path.length === 1) {
            points.push({ X: p1.x * SCALE, Y: p1.y * SCALE });
            points.push({ X: p2.x * SCALE, Y: p2.y * SCALE });
        } else {
            const nextW = path[1];
            const n1 = { x: nextW.points[0], y: nextW.points[1] };
            const n2 = { x: nextW.points[2], y: nextW.points[3] };

            const sharedIsP2 = (distSq(p2, n1) < EPS || distSq(p2, n2) < EPS);

            if (sharedIsP2) {
                points.push({ X: p1.x * SCALE, Y: p1.y * SCALE });
                points.push({ X: p2.x * SCALE, Y: p2.y * SCALE });
            } else {
                points.push({ X: p2.x * SCALE, Y: p2.y * SCALE });
                points.push({ X: p1.x * SCALE, Y: p1.y * SCALE });
            }

            let lastP = { x: points[points.length - 1].X / SCALE, y: points[points.length - 1].Y / SCALE };

            for (let i = 1; i < path.length; i++) {
                const w = path[i];
                const ws = { x: w.points[0], y: w.points[1] };
                const we = { x: w.points[2], y: w.points[3] };

                if (distSq(ws, lastP) < EPS) {
                    points.push({ X: we.x * SCALE, Y: we.y * SCALE });
                    lastP = we;
                } else {
                    points.push({ X: ws.x * SCALE, Y: ws.y * SCALE });
                    lastP = ws;
                }
            }
        }

        const startP = { x: points[0].X / SCALE, y: points[0].Y / SCALE };
        const endP = { x: points[points.length - 1].X / SCALE, y: points[points.length - 1].Y / SCALE };
        const isLoop = (distSq(startP, endP) < EPS && path.length > 2);

        // Extension for clean junctions
        const startKey = getKey(startP.x, startP.y);
        const endKey = getKey(endP.x, endP.y);
        const startDeg = degrees.get(startKey) || 0;
        const endDeg = degrees.get(endKey) || 0;

        // Extension amount: half width + small overlap (e.g. 5cm)
        const extAmount = (path[0].thickness * scaleRatio * SCALE) / 2 + (0.05 * SCALE);

        if (!isLoop && startDeg !== 2 && points.length >= 2) {
            const p1 = points[0];
            const p2 = points[1];
            const dx = p1.X - p2.X;
            const dy = p1.Y - p2.Y;
            const len = Math.hypot(dx, dy);
            if (len > 0.001) {
                p1.X += (dx / len) * extAmount;
                p1.Y += (dy / len) * extAmount;
            }
        }
        if (!isLoop && endDeg !== 2 && points.length >= 2) {
            const pN = points[points.length - 1];
            const pN1 = points[points.length - 2];
            const dx = pN.X - pN1.X;
            const dy = pN.Y - pN1.Y;
            const len = Math.hypot(dx, dy);
            if (len > 0.001) {
                pN.X += (dx / len) * extAmount;
                pN.Y += (dy / len) * extAmount;
            }
        }

        const co = new ClipperLib.ClipperOffset();

        const joinType = ClipperLib.JoinType.jtMiter;
        const endType = isLoop ? ClipperLib.EndType.etClosedLine : ClipperLib.EndType.etOpenButt;

        co.AddPath(points, joinType, endType);
        co.MiterLimit = 2.5; // Reduced from 5.0 to flatten sharp spikes

        const halfWidth = (path[0].thickness * scaleRatio * SCALE) / 2;
        const solution = new ClipperLib.Paths();
        co.Execute(solution, halfWidth);

        // Accumulate for Union
        for (let i = 0; i < solution.length; i++) {
            allOffsetPaths.push(solution[i]);
        }
    }

    // Capture the orientation of the first non-empty wall polygon to use as reference
    let referenceOrientation = true;
    if (allOffsetPaths.length > 0) {
        referenceOrientation = ClipperLib.Clipper.Orientation(allOffsetPaths[0]); // Usually true (CCW?)
    }

    // --- Joint Filler Logic ---
    const subsetSet = new Set(walls.map(w => w.id));

    // Iterate all vertices in the graph and "fill" the corners between adjacent walls
    adj.forEach((connectedWalls, key) => {
        if (connectedWalls.length < 2) return;

        // SKIP simple corners (2 walls, same thickness) because they are handled by Clipper Offset paths naturally
        if (connectedWalls.length === 2) {
            const w1 = connectedWalls[0];
            const w2 = connectedWalls[1];
            if (Math.abs(w1.thickness - w2.thickness) < 0.001) return;
        }

        // SKIP complex junctions (>2 walls) to avoid spiky artifacts. 
        // Clipper Union usually handles the T-junction overlap well enough without manual wedges.
        if (connectedWalls.length > 2) return;

        // Optimization: Only fill corners involving the current wall group
        if (!connectedWalls.some(w => subsetSet.has(w.id))) return;


        // Parse Center
        const [cx, cy] = key.split(',').map(Number).map(n => n / 100);
        const center = { x: cx, y: cy };

        // Sort walls by angle relative to center
        const stats = connectedWalls.map(w => {
            // Determine w's vector OUT from center
            const pStart = { x: w.points[0], y: w.points[1] };
            const pEnd = { x: w.points[2], y: w.points[3] };

            let vx = 0, vy = 0;
            if (distSq(pStart, center) < EPS) {
                vx = pEnd.x - pStart.x;
                vy = pEnd.y - pStart.y;
            } else {
                vx = pStart.x - pEnd.x;
                vy = pStart.y - pEnd.y;
            }
            const angle = Math.atan2(vy, vx);
            const halfThick = (w.thickness * scaleRatio); // Scaled units (Pixels), effectively Width.
            return { w, angle, vx, vy, halfThick };
        });

        stats.sort((a, b) => a.angle - b.angle);

        // Process adjacent pairs
        for (let i = 0; i < stats.length; i++) {
            const current = stats[i];
            const next = stats[(i + 1) % stats.length];

            // 1. Calculate Angle Difference
            // We need angle from Current -> Next in CCW direction
            let diff = next.angle - current.angle;
            if (diff < 0) diff += 2 * Math.PI;

            // If angle is Reflex (> 180), we are on the "Inner" side of a corner (concave).
            // Actually, we want to fill the "Valley" between LEFT of Current and RIGHT of Next.
            // If diff > 180, that valley is HUGE (it's the reflex part).
            // Usually we only fill sharp/convex corners (diff < 180).
            // If diff ~ 180, straight line, no fill needed.

            if (diff > Math.PI - 0.01) continue;

            // Normalize Directions
            // Normalize Directions
            const lenC = Math.hypot(current.vx, current.vy);
            const lenN = Math.hypot(next.vx, next.vy);

            if (lenC < 0.001 || lenN < 0.001) continue;

            const dirCx = current.vx / lenC;
            const dirCy = current.vy / lenC;

            const dirNx = next.vx / lenN;
            const dirNy = next.vy / lenN;

            const hwC = current.halfThick / 2;
            const hwN = next.halfThick / 2;

            // Determine Turn Direction and Outer Side
            // Cross product z-component: det = dirCx * dirNy - dirCy * dirNx ??
            // Using standard det for intersection: det = Ax*By - Ay*Bx.
            // dirCx/Cy is Current vector. dirNx/Ny is Next vector.
            // But line equations form matters.

            // Let's use simple 2D Cross Product of (Current -> Next)
            // Current vector is (dirCx, dirCy). Next vector is (dirNx, dirNy).
            // Cross = dirCx * dirNy - dirCy * dirNx.
            // If Cross > 0, it's a Left Turn (CCW). Outer side is Right (-1).
            // If Cross < 0, it's a Right Turn (CW). Outer side is Left (1).

            const cross = dirCx * dirNy - dirCy * dirNx;

            // If cross is near zero, parallel.
            if (Math.abs(cross) < 0.001) continue;

            const outerSide = cross > 0 ? -1 : 1;

            // Generate Wedge ONLY for the Outer Side
            // Inner side is naturally handled by the wall overlap (or doesn't need filling)
            const sides = [outerSide];

            sides.forEach(side => {
                const normCx = side * current.vy / lenC;
                const normCy = side * -current.vx / lenC;

                const normNx = side * next.vy / lenN;
                const normNy = side * -next.vx / lenN;

                const P_c = { x: cx + normCx * hwC, y: cy + normCy * hwC };
                const P_n = { x: cx + normNx * hwN, y: cy + normNy * hwN };

                // Intersect Lines
                const det = dirCx * (-dirNy) - dirCy * (-dirNx);
                if (Math.abs(det) < 0.0001) return;

                const dx = P_n.x - P_c.x;
                const dy = P_n.y - P_c.y;
                const t = (dx * (-dirNy) - dy * (-dirNx)) / det;

                const Ix = P_c.x + t * dirCx;
                const Iy = P_c.y + t * dirCy;

                // Clamp
                const distToCenter = Math.hypot(Ix - cx, Iy - cy);
                const limit = Math.max(hwC, hwN) * 6;
                let finalIx = Ix;
                let finalIy = Iy;
                if (distToCenter > limit) {
                    const scale = limit / distToCenter;
                    finalIx = cx + (Ix - cx) * scale;
                    finalIy = cy + (Iy - cy) * scale;
                }

                // Overlap Fix
                const ov = 2.0;
                // Using same overlap offset

                // Construct points. Inner "C_in" needs to be derived.
                // We actually don't need complex bisector for single sided anymore?
                // But let's keep the logic stable as it works for the outer side.
                // However, without B_in, we need a base.
                // Re-calculating Bisector just for this wedge.

                const bisectX = dirCx + dirNx;
                const bisectY = dirCy + dirNy;
                const bLen = Math.hypot(bisectX, bisectY);
                let bX = 0, bY = 0;
                if (bLen > 0.001) { bX = bisectX / bLen; bY = bisectY / bLen; }

                // Determine "Backwards" direction.
                // If this is outer side, center should be pushed INWARDS to the wall junction core.
                // The bisector points OUTWARDS for outer side?
                // Vector sum (dirC + dirN) points "Middle".
                // If Left Turn (Outer Right), `dirC + dirN` points roughly forward-right. 
                // We want to go BACK into the junction.

                const C_in = { x: cx - bX * ov, y: cy - bY * ov };
                const P_c_in = { x: P_c.x + dirCx * ov, y: P_c.y + dirCy * ov };
                const P_n_in = { x: P_n.x + dirNx * ov, y: P_n.y + dirNy * ov };

                const poly = [
                    { X: C_in.x * SCALE, Y: C_in.y * SCALE },
                    { X: P_n_in.x * SCALE, Y: P_n_in.y * SCALE },
                    { X: finalIx * SCALE, Y: finalIy * SCALE },
                    { X: P_c_in.x * SCALE, Y: P_c_in.y * SCALE }
                ];

                // VALIDATION: Check for NaNs
                const hasNaN = poly.some(p => isNaN(p.X) || isNaN(p.Y));
                if (hasNaN) return;

                const polyOrientation = ClipperLib.Clipper.Orientation(poly);
                if (polyOrientation !== referenceOrientation) {
                    poly.reverse();
                }

                allOffsetPaths.push(poly);
            });
















        }
    });

    // Union all paths to merge overlaps (fixing T-junctions)
    const clip = new ClipperLib.Clipper();
    clip.AddPaths(allOffsetPaths, ClipperLib.PolyType.ptSubject, true);
    const unioned = new ClipperLib.Paths();

    try {
        const success = clip.Execute(ClipperLib.ClipType.ctUnion, unioned, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
        if (!success) {
            console.warn("Clipper Union failed, returning raw paths");
            // Fallback: copy allOffsetPaths to unioned if execution returns false?
            // Usually returns true. If false, something bad happened.
            // But if 'unioned' is empty, we definitely want fallback.
        }
    } catch (e) {
        console.error("Clipper Execute Exception:", e);
    }

    // If Union produced nothing (and we had inputs), fallback to raw paths
    const finalPaths = (unioned.length > 0) ? unioned : allOffsetPaths;

    // Convert back to our point format and scale down
    for (let i = 0; i < finalPaths.length; i++) {
        const poly = finalPaths[i].map((p: { X: number, Y: number }) => ({ x: p.X / SCALE, y: p.Y / SCALE }));
        resultPolys.push(poly);
    }

    return resultPolys;
};

export const generateUnionBoundary = (walls: Wall[], scaleRatio: number): { x: number, y: number }[][] => {
    // 1. Get all polygons (using the same logic as joined walls to correctly handle offsets)
    // We can reuse generateJoinedWalls(walls, scaleRatio, walls) to get the pieces with correct joins
    const pieces = generateJoinedWalls(walls, scaleRatio, walls);
    if (pieces.length === 0) return [];

    // 2. Convert to Clipper Paths
    const subj = new ClipperLib.Paths();
    pieces.forEach(poly => {
        const p = poly.map(pt => ({ X: pt.x * SCALE, Y: pt.y * SCALE }));
        subj.push(p);
    });

    // 3. Union All
    const clip = new ClipperLib.Clipper();
    clip.AddPaths(subj, ClipperLib.PolyType.ptSubject, true);
    const solution = new ClipperLib.Paths();
    // Use NonZero fill to handle standard merged shapes
    clip.Execute(ClipperLib.ClipType.ctUnion, solution, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);

    // 4. Convert back
    return solution.map((path: any) => path.map((pt: { X: number, Y: number }) => ({ x: pt.X / SCALE, y: pt.Y / SCALE })));
};

const distSq = (p1: { x: number, y: number }, p2: { x: number, y: number }) => (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;
