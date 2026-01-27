import type { Point, Wall } from '../types';

// Helper to check line vs line intersection
export const linesIntersect = (p1: Point, p2: Point, p3: Point, p4: Point): boolean => {
    const ccw = (a: Point, b: Point, c: Point) => (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
    return (ccw(p1, p3, p4) !== ccw(p2, p3, p4)) && (ccw(p1, p2, p3) !== ccw(p1, p2, p4));
};

export const distance = (p1: Point, p2: Point) => Math.hypot(p2.x - p1.x, p2.y - p1.y);

// Hub Colors Palette (12 distinct colors)
export const HUB_COLORS = [
    '#ef4444', // Red
    '#f97316', // Orange
    '#f59e0b', // Amber
    '#84cc16', // Lime
    '#10b981', // Emerald
    '#06b6d4', // Cyan
    '#3b82f6', // Blue
    '#6366f1', // Indigo
    '#8b5cf6', // Violet
    '#d946ef', // Fuchsia
    '#f43f5e', // Rose
    '#64748b'  // Slate
];

export const getHubColor = (index: number) => HUB_COLORS[index % HUB_COLORS.length];

// Count wall intersections for a path
export const countIntersections = (path: Point[], walls: Wall[]): number => {
    let count = 0;
    for (let i = 0; i < path.length - 1; i++) {
        const p1 = path[i];
        const p2 = path[i + 1];

        // Skip tiny segments
        if (Math.abs(p1.x - p2.x) < 0.1 && Math.abs(p1.y - p2.y) < 0.1) continue;

        for (const wall of walls) {
            // Wall geometry
            const w1 = { x: wall.points[0], y: wall.points[1] };
            const w2 = { x: wall.points[2], y: wall.points[3] };
            if (linesIntersect(p1, p2, w1, w2)) {
                count++;
            }
        }
    }
    return count;
};

// Smart Orthogonal Routing (L-Shapes and Z-Shapes)
export const getOrthogonalPath = (start: Point, end: Point, walls: Wall[] = []): Point[] => {
    // 0. Trivial Case
    if (walls.length === 0) {
        return [start, { x: end.x, y: start.y }, end];
    }

    const candidates: { path: Point[], intersections: number, bends: number }[] = [];

    // Helper to evaluate a path
    const evaluate = (path: Point[], bends: number) => {
        const intersections = countIntersections(path, walls);
        candidates.push({ path, intersections, bends });
    };

    // 1. L-Shapes (1 Bend)
    // Option 1A: Horiz -> Vert
    evaluate([start, { x: end.x, y: start.y }, end], 1);
    // Option 1B: Vert -> Horiz
    evaluate([start, { x: start.x, y: end.y }, end], 1);

    // Optimization: If any L-path has 0 intersections, pick it immediately (shortest bends)
    // Note: If both have 0, we can pick either.
    const cleanLPath = candidates.find(c => c.intersections === 0 && c.bends === 1);
    if (cleanLPath) return cleanLPath.path;

    // 2. Z-Shapes (2 Bends)
    // We scan intermediate positions to find a "gap"
    // Type A: Horiz -> Vert -> Horiz (Scan x_mid)
    // Type B: Vert -> Horiz -> Vert (Scan y_mid)

    // We can try a few split ratios.
    // Denser scan to find gaps (doors) that might be missed by sparse steps
    const steps: number[] = [];
    for (let t = 0.05; t < 1.0; t += 0.05) {
        steps.push(t);
    }

    steps.forEach(t => {
        // Type A: Split X
        const x_mid = start.x + (end.x - start.x) * t;
        evaluate([
            start,
            { x: x_mid, y: start.y },
            { x: x_mid, y: end.y },
            end
        ], 2);

        // Type B: Split Y
        const y_mid = start.y + (end.y - start.y) * t;
        evaluate([
            start,
            { x: start.x, y: y_mid },
            { x: end.x, y: y_mid },
            end
        ], 2);
    });


    // 3. Selection
    // Sort by: 
    // 1. Intersections (Ascending)
    // 2. Bends (Ascending) - Prefer simpler paths
    // 3. Length? (Manhattan is constant for these monotonic paths, so ignored)

    candidates.sort((a, b) => {
        if (a.intersections !== b.intersections) return a.intersections - b.intersections;
        return a.bends - b.bends;
    });

    return candidates[0].path;
};

// Daisy Chain Logic (Nearest Neighbor)
export const generateDaisyChain = (start: Point, points: Point[], walls: Wall[]): Point[][] => {
    const paths: Point[][] = [];
    let current = start;
    const remaining = [...points];

    while (remaining.length > 0) {
        // Find nearest
        let nearestIdx = -1;
        let minDist = Infinity;
        for (let i = 0; i < remaining.length; i++) {
            const d = distance(current, remaining[i]);
            if (d < minDist) {
                minDist = d;
                nearestIdx = i;
            }
        }

        if (nearestIdx !== -1) {
            const next = remaining[nearestIdx];
            paths.push(getOrthogonalPath(current, next, walls));
            current = next;
            remaining.splice(nearestIdx, 1);
        }
    }

    return paths;
};

export const calculateLength = (
    points: Point[],
    scaleRatio: number,
    _settings?: { ceilingHeight?: number, serviceLoop?: number, deviceHeight?: number }
): number => {
    let lengthPx = 0;
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        lengthPx += Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    }

    // Horizontal Length (m)
    const lengthMeters = lengthPx / scaleRatio;

    return lengthMeters;
}

export const getHubPortCoordinates = (
    hubCenter: Point,
    capacity: number,
    portIndex: number,
    hubSize: number = 24,
    tickLen: number = 3
): Point => {
    // Match visual logic from HubsLayer
    const halfSize = hubSize / 2;
    const baseDist = halfSize + 4;

    // Start from -90 (Top) and go Clockwise
    const angleDeg = (portIndex * 360) / capacity;
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

    // Absolute Coordinates
    return {
        x: hubCenter.x + x2,
        y: hubCenter.y + y2
    };
};
