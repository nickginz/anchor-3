import type { Point, Wall, Anchor } from '../types';

// Configuration
const GRID_SIZE = 20;
const TRACK_SPACING = 4; // px separation between parallel cables
const MAX_ITERATIONS = 5000;

interface Node {
    x: number;
    y: number;
    g: number;
    h: number;
    f: number;
    parent: Node | null;
}

interface PathRequest {
    id: string; // Cable ID (temp or real)
    start: Point;
    end: Point;
    fromId: string;
    toId: string;
}

interface RoutedPath {
    id: string;
    points: Point[];
}

// ------------------------------------------------------------------
// 1. Topology Routing (Base A*)
// ------------------------------------------------------------------

const heuristic = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const pointKey = (x: number, y: number) => `${x},${y}`;

const isWalkable = (x: number, y: number, walls: Wall[], anchors: Anchor[], padding: number = 10): boolean => {
    const wallBuffer = 5;
    for (const wall of walls) {
        // Point to Segment distance logic
        const p1 = { x: wall.points[0], y: wall.points[1] };
        const p2 = { x: wall.points[2], y: wall.points[3] };
        const A = x - p1.x; const B = y - p1.y;
        const C = p2.x - p1.x; const D = p2.y - p1.y;
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        if (lenSq !== 0) param = dot / lenSq;
        let xx, yy;
        if (param < 0) { xx = p1.x; yy = p1.y; }
        else if (param > 1) { xx = p2.x; yy = p2.y; }
        else { xx = p1.x + param * C; yy = p1.y + param * D; }
        const dx = x - xx; const dy = y - yy;
        if ((dx * dx + dy * dy) < (wallBuffer * wallBuffer)) return false;
    }
    // Anchors
    for (const anc of anchors) {
        const r = (anc.radius || 10) + padding;
        const dx = x - anc.x; const dy = y - anc.y;
        if ((dx * dx + dy * dy) < (r * r)) return false;
    }
    return true;
};

const findBasePath = (
    start: Point,
    end: Point,
    walls: Wall[],
    anchors: Anchor[],
    bounds: { minX: number, minY: number, maxX: number, maxY: number }
): Point[] => {
    // Snap to Grid
    const sX = Math.round(start.x / GRID_SIZE) * GRID_SIZE;
    const sY = Math.round(start.y / GRID_SIZE) * GRID_SIZE;
    const eX = Math.round(end.x / GRID_SIZE) * GRID_SIZE;
    const eY = Math.round(end.y / GRID_SIZE) * GRID_SIZE;

    // A*
    const startNode: Node = { x: sX, y: sY, g: 0, h: heuristic({ x: sX, y: sY }, { x: eX, y: eY }), f: 0, parent: null };
    const openList: Node[] = [startNode];
    const closedKeys = new Set<string>();

    // Target Anchor Filtering: We allow entering the Start and End anchors, so we shouldn't fail Walkability there.
    // The passed 'anchors' list should ideally EXCLUDE start/end anchors.
    // We'll handle this in the caller or assume checking happens elsewhere. 
    // Actually, checking radius: if start/end are INSIDE anchor radius, they fail.
    // We assume strict grid walkability here.

    let iterations = 0;
    while (openList.length > 0 && iterations < MAX_ITERATIONS) {
        iterations++;
        openList.sort((a, b) => a.f - b.f);
        const current = openList.shift()!;

        if (Math.abs(current.x - eX) < 1 && Math.abs(current.y - eY) < 1) {
            // Reconstruct
            const path: Point[] = [];
            let curr: Node | null = current;
            while (curr) {
                path.push({ x: curr.x, y: curr.y });
                curr = curr.parent;
            }
            return path.reverse();
        }

        closedKeys.add(pointKey(current.x, current.y));

        const neighbors = [
            { x: current.x + GRID_SIZE, y: current.y },
            { x: current.x - GRID_SIZE, y: current.y },
            { x: current.x, y: current.y + GRID_SIZE },
            { x: current.x, y: current.y - GRID_SIZE }
        ];

        for (const n of neighbors) {
            if (n.x < bounds.minX || n.x > bounds.maxX || n.y < bounds.minY || n.y > bounds.maxY) continue;
            if (closedKeys.has(pointKey(n.x, n.y))) continue;

            // Check Walkability
            // Special exemption: If n is practically the End Point, allow it (entering anchor)
            if (!(Math.abs(n.x - eX) < 1 && Math.abs(n.y - eY) < 1)) {
                if (!isWalkable(n.x, n.y, walls, anchors)) continue;
            }

            const g = current.g + GRID_SIZE; // Uniform cost
            // Turn Penalty (small preference for straight)
            let turnPenalty = 0;
            if (current.parent) {
                if ((current.x - current.parent.x !== n.x - current.x) || (current.y - current.parent.y !== n.y - current.y)) {
                    turnPenalty = 2;
                }
            }

            const existing = openList.find(node => Math.abs(node.x - n.x) < 1 && Math.abs(node.y - n.y) < 1);
            if (!existing) {
                openList.push({ x: n.x, y: n.y, g: g + turnPenalty, h: heuristic(n, { x: eX, y: eY }), f: 0, parent: current });
                // Calc f after
                openList[openList.length - 1].f = openList[openList.length - 1].g + openList[openList.length - 1].h;
            } else if (g + turnPenalty < existing.g) {
                existing.g = g + turnPenalty;
                existing.f = existing.g + existing.h;
                existing.parent = current;
            }
        }
    }

    // Fallback: L-shape
    return [{ x: sX, y: sY }, { x: eX, y: sY }, { x: eX, y: eY }];
};

// ------------------------------------------------------------------
// 2. Track Assignment
// ------------------------------------------------------------------

interface Segment {
    pathIndex: number; // Which cable this belongs to
    segIndex: number;  // Index in path point array
    start: number;     // Start coordinate along axis
    end: number;       // End coordinate along axis
    track: number;     // Assigned track
}

const assignTracks = (basePaths: Point[][]): Map<string, number> => {
    // Map of "Hash(PathIndex, SegIndex)" -> TrackNumber
    const assignments = new Map<string, number>();

    // Storage for all segments on critical Grid Lines
    const gridLines = new Map<string, Segment[]>();

    basePaths.forEach((path, pIdx) => {
        if (path.length < 2) return;
        for (let i = 0; i < path.length - 1; i++) {
            const p1 = path[i];
            const p2 = path[i + 1];

            // Determine orientation
            if (Math.abs(p1.x - p2.x) < 0.1) {
                // Vertical
                const x = Math.round(p1.x);
                const key = `V:${x}`;
                if (!gridLines.has(key)) gridLines.set(key, []);
                gridLines.get(key)!.push({
                    pathIndex: pIdx,
                    segIndex: i,
                    start: Math.min(p1.y, p2.y),
                    end: Math.max(p1.y, p2.y),
                    track: 0
                });
            } else {
                // Horizontal
                const y = Math.round(p1.y);
                const key = `H:${y}`;
                if (!gridLines.has(key)) gridLines.set(key, []);
                gridLines.get(key)!.push({
                    pathIndex: pIdx,
                    segIndex: i,
                    start: Math.min(p1.x, p2.x),
                    end: Math.max(p1.x, p2.x),
                    track: 0
                });
            }
        }
    });

    // Process each Grid Line Channel
    gridLines.forEach((segments) => {
        // Sort segments by start position
        segments.sort((a, b) => a.start - b.start);

        // Greedy Allocation
        // Tracks: Array of "End Positions" for each track. 
        // We want to put a segment on a track where (TrackEnd <= SegmentStart).
        // Since we want bundles, we might want to pack tightly.
        // But actually, for visual stacking, we want to assign indices 0, 1, 2...
        // For segments that OVERLAP.

        // Let's use simple Interval Coloring.
        // activeSegments: List of segments currently "open" as we sweep
        // But since we want consistent tracks for longer runs, interval coloring is good.

        // Simpler approach for "Tracks":
        // For each segment, try Track 0. If it overlaps with any *already assigned* segment on Track 0, try Track 1.
        const tracks: Segment[][] = []; // TrackIndex -> List of segments on that track

        segments.forEach(seg => {
            let t = 0;
            while (true) {
                if (!tracks[t]) tracks[t] = [];
                // Check collision
                const collision = tracks[t].some(s => {
                    // Overlap if (Start1 < End2) and (Start2 < End1)
                    // We add a small buffer? No, exact is fine for grid.
                    return (seg.start < s.end && s.start < seg.end);
                });

                if (!collision) {
                    tracks[t].push(seg);
                    seg.track = t;
                    break;
                }
                t++;
            }
        });

        // Store assignments
        segments.forEach(seg => {
            // Center the bundle?
            // If MaxTrack is 3, we have 0, 1, 2, 3. 
            // We can center them: Offset = (Track - (MaxTrack/2)) * Spacing
            // Wait, we need to know MaxTrack for this *Channel* later. 
            // Better to store just the Track Index now, and post-process centering if desired.
            // Or just store the raw track index.
            const k = `${seg.pathIndex}:${seg.segIndex}`;

            // Optimization: Centering
            // Let's store a centered offset value directly?
            // No, we return the track index, but we need to know the total width to center it.
            // Let's store the raw index and the total count for this channel?
            // We can't easily return metadata per channel in the Map.
            // Let's just return raw track and calculate centering during render.
            // Or simpler: Just offset from center. Center = 0.
            // Tracks: 0, 1, 2 -> -1, 0, 1.
            // Total tracks used: tracks.length.

            const totalTracks = tracks.length;
            const centeredOffset = (seg.track - (totalTracks - 1) / 2) * TRACK_SPACING;

            // We'll store the literal offset in pixels to apply
            // But we need to distinguish Axis.
            // The segment knows its orientation from the caller context (looping paths).
            // Actually, let's just return the Offset in Pixels.

            assignments.set(k, centeredOffset);
        });
    });

    return assignments;
};


// ------------------------------------------------------------------
// 3. Main Export
// ------------------------------------------------------------------

export const routeMultipleCables = (
    requests: PathRequest[],
    walls: Wall[],
    anchors: Anchor[],
    bounds: { minX: number, minY: number, maxX: number, maxY: number }
): RoutedPath[] => {
    // 1. Calculate Base Paths (Topology)
    const basePaths: Point[][] = requests.map(req => {
        // Exclude start/end anchors from obstacles?
        // We pass ALL anchors. 
        // findBasePath has logic to perform Walkability check.
        // Ideally we pass specific obstacles. 
        // Optimization: Filter obstacles once? No, A* is per cable.
        const obstacles = anchors.filter(a => a.id !== req.fromId && a.id !== req.toId);

        const path = findBasePath(req.start, req.end, walls, obstacles, bounds);

        // Orthogonal connections to Grid
        // Ensure path connects to float Start/End
        // Reuse legacy logic or simple snap?
        // findBasePath returns grid points.
        // We need to connect req.start to path[0].
        // The path returned is Grid Points.
        // We just prepend start and append end.

        // Fix orthogonals
        // Logic from previous code:
        const pStart = path[0];
        const pEnd = path[path.length - 1];

        const prefix: Point[] = [];
        if (Math.abs(req.start.x - pStart.x) > 0.1 && Math.abs(req.start.y - pStart.y) > 0.1) {
            // L-shape
            prefix.push({ x: pStart.x, y: req.start.y });
        }

        const suffix: Point[] = [];
        if (Math.abs(req.end.x - pEnd.x) > 0.1 && Math.abs(req.end.y - pEnd.y) > 0.1) {
            // L-shape
            suffix.push({ x: req.end.x, y: pEnd.y });
        }

        return [req.start, ...prefix, ...path, ...suffix, req.end];
    });

    // 2. Assign Tracks
    const offsets = assignTracks(basePaths);

    // 3. Render
    const finalPaths: RoutedPath[] = requests.map((req, i) => {
        const basePath = basePaths[i];
        const newPoints: Point[] = [];

        // We need to apply offsets to segments. 
        // Corners need to be handled (intersection of two offset segments).

        // Naive approach: Apply offset to segment, then intersect lines.
        // Or simpler: Just shift the points?
        // Careful: A point is shared by two segments (Incoming, Outgoing).
        // Each segment might have a DIFFERENT offset!
        // So Point[j] becomes intersection of Segment[j-1]'s shifted line and Segment[j]'s shifted line.

        // Start and End are fixed.
        newPoints.push(basePath[0]);

        for (let j = 1; j < basePath.length - 1; j++) {
            const pPrev = basePath[j - 1];
            const pCurr = basePath[j];
            const pNext = basePath[j + 1];

            // Segment 1: pPrev -> pCurr
            // Segment 2: pCurr -> pNext

            // Get Offsets
            const off1 = offsets.get(`${i}:${j - 1}`) || 0;
            const off2 = offsets.get(`${i}:${j}`) || 0;

            // Determine orientation
            const isSeg1Vert = Math.abs(pPrev.x - pCurr.x) < 0.1;
            const isSeg2Vert = Math.abs(pCurr.x - pNext.x) < 0.1;

            let newX = pCurr.x;
            let newY = pCurr.y;

            // Apply Offsets
            // Vertical Segment: Offset applied to X
            // Horizontal Segment: Offset applied to Y

            if (isSeg1Vert) newX += off1; else newY += off1; // From incoming

            // BUT, if Seg1 and Seg2 are perpendicular (Corner), we coordinate them.
            // If Seg1 is Vert (Offset X) and Seg2 is Horiz (Offset Y).
            // The intersection is simply (pCurr.x + off1, pCurr.y + off2).

            if (isSeg1Vert && !isSeg2Vert) {
                newPoints.push({ x: pCurr.x + off1, y: pCurr.y + off2 });
            } else if (!isSeg1Vert && isSeg2Vert) {
                newPoints.push({ x: pCurr.x + off2, y: pCurr.y + off1 });
            } else {
                // Collinear or irregular. Use avg? Or just Seg1?
                // If collinear, offsets "should" be same if tracks merged, but maybe not if density changes.
                // Just stepping?
                // Let's construct mid-points.
                if (isSeg1Vert) newPoints.push({ x: pCurr.x + off1, y: pCurr.y });
                else newPoints.push({ x: pCurr.x, y: pCurr.y + off1 });
            }
        }

        newPoints.push(basePath[basePath.length - 1]);

        // Remove redundant collinear points
        const simplified = [newPoints[0]];
        for (let k = 1; k < newPoints.length - 1; k++) {
            const prev = simplified[simplified.length - 1];
            const curr = newPoints[k];
            const next = newPoints[k + 1];

            const dx1 = curr.x - prev.x; const dy1 = curr.y - prev.y;
            const dx2 = next.x - curr.x; const dy2 = next.y - curr.y;

            // If both horizontal or both vertical
            if ((Math.abs(dy1) < 0.1 && Math.abs(dy2) < 0.1) || (Math.abs(dx1) < 0.1 && Math.abs(dx2) < 0.1)) {
                // Skip curr
                continue;
            }
            simplified.push(curr);
        }
        simplified.push(newPoints[newPoints.length - 1]);

        return {
            id: req.id,
            points: simplified
        };
    });

    return finalPaths;
};

// Legacy Export for single path (fallback/compatibility)
export const findAStarPath = (
    start: Point, end: Point, walls: Wall[], anchors: Anchor[], bounds: any
): Point[] => {
    // Wrapper to use new engine for 1 path
    const res = routeMultipleCables(
        [{ id: 'temp', start, end, fromId: 'temp', toId: 'temp' }],
        walls, anchors, bounds
    );
    return res[0].points;
};
