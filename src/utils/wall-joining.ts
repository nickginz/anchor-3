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

            const nextW = neighbors?.find(w => !processedWalls.has(w.id));
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
            const nextW = neighbors?.find(w => !processedWalls.has(w.id));
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
        let curr = path[0];
        let p1 = { x: curr.points[0], y: curr.points[1] };
        let p2 = { x: curr.points[2], y: curr.points[3] };

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

        // (Manual Extension Removed)

        const co = new ClipperLib.ClipperOffset();
        const startP = { x: points[0].X / SCALE, y: points[0].Y / SCALE };
        const endP = { x: points[points.length - 1].X / SCALE, y: points[points.length - 1].Y / SCALE };
        const isLoop = (distSq(startP, endP) < EPS && path.length > 2);

        const joinType = ClipperLib.JoinType.jtMiter;
        const endType = isLoop ? ClipperLib.EndType.etClosedLine : ClipperLib.EndType.etOpenButt;

        co.AddPath(points, joinType, endType);
        co.MiterLimit = 5.0;

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











            // To ensure Clipper merges the polygons, we expand the wedge slightly into adjacent walls
            const ov = 2.0; // 2 pixels overlap (roughly)

            // Calculate Bisector Vector for Center Nudge
            // We want to pull Center inwards (away from miter tip) to cover the "butt" gap area fully
            const bisectX = dirCx + dirNx;
            const bisectY = dirCy + dirNy;
            const bLen = Math.hypot(bisectX, bisectY);
            let bX = 0, bY = 0;
            if (bLen > 0.001) {
                bX = bisectX / bLen;
                bY = bisectY / bLen;
            }

            // Center pushed IN (away from miter tip, into the junction heart)
            const C_in = { x: cx - bX * ov, y: cy - bY * ov };

            // Edge points pushed BACK (along the wall direction into the wall body)
            // P_c is on the edge of Current wall. 
            // OLD incorrect calc: const P_c_in = { x: P_c.x - dirCx * ov, y: P_c.y - dirCy * ov };

            // P_n is on the edge of Next wall. We move it -dirNx (forwards relative to wall, but backwards relative to junction start)
            // Wait, dirNx is Vector Next. Next starts at Center. So dirNx points INTO the wall.
            // P_n is at Center + Width offset.
            // Moving along +dirNx moves INTO the wall.
            // So we want +dirNx * ov?
            // "Next" wall starts at Center? Yes.
            // "Current" wall ends at Center? No, we normalized all vectors to point OUT from Center in 'stats' map.
            // `vx = pEnd - pStart` (if pStart near center). So `vx` points AWAY from center.
            // So `dirCx` and `dirNx` BOTH point OUTWARD from Center into the wall bodies.
            // Correct.
            // So to overlap, we move P_c and P_n along +dir (further into the wall).
            // No, wait. P_c is the corner. The wall polygon ends at Center (perpendicular).
            // The Wedge is [Center, P_c, Miter, P_n].
            // If we move P_c along +dir, we are moving away from Center.
            // We want to create overlap with the wall which exists from Center -> Outwards.
            // The Wall's 'butt' cap is the line through Center perpendicular to Dir.
            // P_c lies ON that line.
            // If we move P_c OUT (+dir), we are just tracing the edge of the wall?
            // No, the Wall Polygon covers `(Center + WidthNormal) -> (End + WidthNormal)`.
            // Our Wedge covers `(Center) -> (P_c)`.
            // They join at the line `Center -> P_c`.
            // To overlap, we want the Wedge to cross that line.
            // Moving P_c along -dir (INTO the "void" behind center?) No.
            // Moving P_c along +dir (parallel to wall edge) doesn't help cross the butt line.
            // Moving P_c along -Normal? (Towards Center axis).

            // Actually, simply pulling the CENTER point "backwards" (negative bisector) makes the wedge start "before" the center.
            // Since the Walls start AT the center, this new Wedge area overlaps both wall ends.
            // That is sufficient.
            // But to be super safe against floating point EPS, let's also push P_c/P_n INWARDS (negative Normal) slightly? 
            // No, that narrows the wedge.
            // Let's just push Center back.
            // And maybe push P_c/P_n BACK along vector?
            // If I push "back" (-dir), I go into the empty space of the junction "before" the walls start?
            // Since walls radiate from center, "back" is inside the junction core.
            // Yes.

            // Just using C_in (pushed back) is good.
            // And use P_c, P_n as is?
            // Construct polygon: C_in -> P_c -> Ix -> P_n.
            // Is convex? Yes.
            // Does it cover `Center -> P_c` line?
            // C_in is "behind" Center.
            // So `C_in -> P_c` crosses `Center -> P_c`? No, they share P_c.
            // But `C_in` is separate from `Center`.
            // The segment `C_in -> P_c` is not collinear with `Center -> P_c` (which is perpendicular).
            // So it creates a triangle `C_in, Center, P_c` which is added area.
            // Since `Center` is on the wall butt line, and `C_in` is "behind", this triangle overlaps the OTHER wall?
            // Or the void?
            // It effectively fills the center hole.

            // Let's do it.

            // Correcting Overlap Direction:
            // Walls go OUT from center. `dirCx` points INTO the wall body.
            // To overlap, we must move P_c and P_n ALONG the direction vector (Positive).
            // Previous attempt used Negative (moving away from wall), creating a gap.




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
