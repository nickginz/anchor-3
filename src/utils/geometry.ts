
export const SNAP_DISTANCE_Pixels = 10;

export interface Point {
    x: number;
    y: number;
}

export const dist = (p1: Point, p2: Point) => Math.hypot(p2.x - p1.x, p2.y - p1.y);

export const getNearestPoint = (
    cursor: Point,
    snapPoints: Point[],
    threshold: number
): Point | null => {
    let nearest: Point | null = null;
    let minDist = threshold;

    for (const p of snapPoints) {
        const d = dist(cursor, p);
        if (d < minDist) {
            minDist = d;
            nearest = p;
        }
    }
    return nearest;
};

// Generates a rectangle polygon from a centerline
export const generateWallPolygon = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    thicknessPixels: number
): number[] => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);

    if (len === 0) return [x1, y1];

    // Unit normal vector
    const nx = -dy / len;
    const ny = dx / len;

    // Half thickness
    const half = thicknessPixels / 2;

    // Four corners
    const p1x = x1 + nx * half;
    const p1y = y1 + ny * half;

    const p2x = x2 + nx * half;
    const p2y = y2 + ny * half;

    const p3x = x2 - nx * half;
    const p3y = y2 - ny * half;

    const p4x = x1 - nx * half;
    const p4y = y1 - ny * half;

    return [p1x, p1y, p2x, p2y, p3x, p3y, p4x, p4y];
};

export const applyOrthogonal = (start: Point, current: Point): Point => {
    const dx = current.x - start.x;
    const dy = current.y - start.y;

    if (Math.abs(dx) > Math.abs(dy)) {
        return { x: current.x, y: start.y };
    } else {
        return { x: start.x, y: current.y };
    }
};

// Distance from point p to line segment v-w
export const distToSegmentSquared = (p: Point, v: Point, w: Point): { dist2: number, proj: Point } => {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return { dist2: dist(p, v) ** 2, proj: v };
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const proj = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
    return { dist2: dist(p, proj) ** 2, proj };
};

// Enhanced Snap Point Return Type
export interface SnapResult {
    point: Point;
    type: 'vertex' | 'edge';
    wallId?: string; // ID of the wall snapped to (if edge or vertex belong to one) - for vertex it might be hard to verify uniqueness if multiple walls share it, so we might just use it for Edge mainly.
}

export const getSnapPoint = (
    cursor: Point,
    walls: import('../types').Wall[],
    threshold: number
): SnapResult | null => {
    let nearest: Point | null = null;
    let nearestType: 'vertex' | 'edge' | null = null;
    let nearestWallId: string | undefined = undefined;

    let minDist = threshold;

    // 1. Check Vertices
    // Note: A vertex can belong to multiple walls. We just need the point.
    // If we want to be strict, we can iterate walls and check endpoints.

    for (const w of walls) {
        // Start Point
        const p1 = { x: w.points[0], y: w.points[1] };
        const d1 = dist(cursor, p1);
        if (d1 < minDist) {
            minDist = d1;
            nearest = p1;
            nearestType = 'vertex';
            nearestWallId = w.id; // Just take one
        }

        // End Point
        const p2 = { x: w.points[2], y: w.points[3] };
        const d2 = dist(cursor, p2);
        if (d2 < minDist) {
            minDist = d2;
            nearest = p2;
            nearestType = 'vertex';
            nearestWallId = w.id;
        }
    }

    if (nearest && nearestType === 'vertex') {
        return { point: nearest, type: 'vertex', wallId: nearestWallId };
    }

    // 2. Check Edges (Centerlines)
    for (const w of walls) {
        const p1 = { x: w.points[0], y: w.points[1] };
        const p2 = { x: w.points[2], y: w.points[3] };
        const { dist2, proj } = distToSegmentSquared(cursor, p1, p2);
        const d = Math.sqrt(dist2);

        if (d < minDist) {
            minDist = d;
            nearest = proj;
            nearestType = 'edge';
            nearestWallId = w.id;
        }
    }

    if (nearest && nearestType) {
        return { point: nearest, type: nearestType, wallId: nearestWallId };
    }

    return null;
};
