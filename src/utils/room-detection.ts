
import type { Wall } from '../types';

interface Point { x: number; y: number; }
interface Edge {
    u: number; // Node index start
    v: number; // Node index end
    wallId: string;
    reverse: boolean; // True if this edge is end->start of wall
    angle: number; // Angle for sorting
}

// Tolerance for node merging (meters)
const EPSILON = 0.05; // 5cm

export const detectRooms = (walls: Wall[]): Point[][] => {
    // 1. Build Graph
    // Nodes = Unique Endpoints
    const nodes: Point[] = [];
    const adj: Edge[][] = [];

    const getNodeIndex = (p: { x: number, y: number }) => {
        for (let i = 0; i < nodes.length; i++) {
            if (Math.hypot(nodes[i].x - p.x, nodes[i].y - p.y) < EPSILON) {
                return i;
            }
        }
        nodes.push({ x: p.x, y: p.y });
        adj.push([]);
        return nodes.length - 1;
    };

    walls.forEach(w => {
        const u = getNodeIndex({ x: w.points[0], y: w.points[1] });
        const v = getNodeIndex({ x: w.points[2], y: w.points[3] });

        // Add Directed Edges (u->v and v->u)
        // We compute angle for "Left Turn" logic
        const angleUV = Math.atan2(w.points[3] - w.points[1], w.points[2] - w.points[0]);
        const angleVU = Math.atan2(w.points[1] - w.points[3], w.points[0] - w.points[2]);

        adj[u].push({ u, v, wallId: w.id, reverse: false, angle: angleUV });
        adj[v].push({ u: v, v: u, wallId: w.id, reverse: true, angle: angleVU });
    });

    // 2. Sort Outgoing Edges by Angle (CCW)
    adj.forEach(edges => {
        edges.sort((a, b) => a.angle - b.angle);
    });

    // 3. Find Cycles (Faces)
    const visited = new Set<string>();
    const faces: Point[][] = [];

    for (let u = 0; u < nodes.length; u++) {
        for (const e of adj[u]) {
            const key = `${e.u},${e.v}`;
            if (visited.has(key)) continue;

            const cycle: Point[] = [];
            let curr = e;
            let safetyCount = 0; // Prevent Infinite Loop
            const MAX_ITER = 2000;

            while (!visited.has(`${curr.u},${curr.v}`)) {
                safetyCount++;
                if (safetyCount > MAX_ITER) {
                    // Break cycle if infinite (should not happen in valid graph traversal)
                    break;
                }

                visited.add(`${curr.u},${curr.v}`);
                cycle.push(nodes[curr.u]);

                const v = curr.v;
                const outgoing = adj[v];
                if (outgoing.length === 0) break; // Dead end

                let entryAngle = curr.angle + Math.PI;
                if (entryAngle > Math.PI) entryAngle -= 2 * Math.PI;

                let bestNextIdx = -1;
                let minDiff = Infinity;

                for (let i = 0; i < outgoing.length; i++) {
                    let diff = outgoing[i].angle - entryAngle;
                    // Normalize to 0..2PI interval
                    while (diff <= 1e-5) diff += 2 * Math.PI;
                    while (diff > 2 * Math.PI) diff -= 2 * Math.PI;

                    if (diff < minDiff) {
                        minDiff = diff;
                        bestNextIdx = i;
                    }
                }

                if (bestNextIdx !== -1) {
                    curr = outgoing[bestNextIdx];
                } else {
                    break;
                }

                if (curr.u === e.u && curr.v === e.v) break; // Loop closed
            }

            // Check if valid cycle
            if (safetyCount <= MAX_ITER && cycle.length > 2 && curr.u === e.u) {
                // Closed Loop
                faces.push(cycle);
            }
        }
    }

    // 4. Calculate Areas and Filter
    const validRooms: Point[][] = [];
    faces.forEach(poly => {
        const area = calculatePolygonArea(poly);
        if (Math.abs(area) < 0.1) return;

        // Filter Outer Face (usually positive area if CCW is negative in Y-down?)
        // Let's rely on standard logic: Keep "Internal" faces.
        // In Screen Y-Down, CCW = Negative Area.
        if (area < 0) {
            validRooms.push(poly);
        }
    });

    return validRooms;
};

export const calculatePolygonArea = (points: Point[]): number => {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        area += points[i].x * points[j].y;
        area -= points[j].x * points[i].y;
    }
    return area / 2.0;
};
