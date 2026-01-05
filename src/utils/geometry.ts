
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
    type: 'vertex' | 'edge' | 'anchor';
    id?: string; // ID of the object snapped to
}

export const getSnapPoint = (
    cursor: Point,
    walls: import('../types').Wall[],
    anchors: import('../types').Anchor[],
    threshold: number
): SnapResult | null => {
    let nearest: Point | null = null;
    let nearestType: 'vertex' | 'edge' | 'anchor' | null = null;
    let nearestId: string | undefined = undefined;

    let minDist = threshold;

    // 1. Check Anchors (Highest Priority for dimensioning)
    for (const a of anchors) {
        const p = { x: a.x, y: a.y };
        const d = dist(cursor, p);
        if (d < minDist) {
            minDist = d;
            nearest = p;
            nearestType = 'anchor';
            nearestId = a.id;
        }
    }

    // 2. Check Vertices
    for (const w of walls) {
        // Start Point
        const p1 = { x: w.points[0], y: w.points[1] };
        const d1 = dist(cursor, p1);
        if (d1 < minDist) {
            minDist = d1;
            nearest = p1;
            nearestType = 'vertex';
            nearestId = w.id;
        }

        // End Point
        const p2 = { x: w.points[2], y: w.points[3] };
        const d2 = dist(cursor, p2);
        if (d2 < minDist) {
            minDist = d2;
            nearest = p2;
            nearestType = 'vertex';
            nearestId = w.id;
        }
    }

    if (nearest && (nearestType === 'vertex' || nearestType === 'anchor')) {
        return { point: nearest, type: nearestType, id: nearestId };
    }

    // 3. Check Edges (Centerlines)
    for (const w of walls) {
        const p1 = { x: w.points[0], y: w.points[1] };
        const p2 = { x: w.points[2], y: w.points[3] };
        const { dist2, proj } = distToSegmentSquared(cursor, p1, p2);
        const d = Math.sqrt(dist2);

        if (d < minDist) {
            minDist = d;
            nearest = proj;
            nearestType = 'edge';
            nearestId = w.id;
        }
    }

    if (nearest && nearestType) {
        return { point: nearest, type: nearestType, id: nearestId };
    }

    return null;
};

// Simple Ray Casting
export const isPointInPolygon = (pt: Point, poly: Point[]): boolean => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i].x, yi = poly[i].y;
        const xj = poly[j].x, yj = poly[j].y;
        const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
            (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
};

// Robust Geometric Centroid (Center of Mass)
export const getPolygonCentroid = (poly: Point[]): Point => {
    let A = 0;
    let Cx = 0;
    let Cy = 0;
    for (let i = 0; i < poly.length; i++) {
        const j = (i + 1) % poly.length;
        const p1 = poly[i];
        const p2 = poly[j];
        const cross = (p1.x * p2.y - p2.x * p1.y);
        A += cross;
        Cx += (p1.x + p2.x) * cross;
        Cy += (p1.y + p2.y) * cross;
    }
    A /= 2;
    if (A === 0) {
        // Fallback to vertex average if area is zero (collinear/degenerate)
        let sumX = 0, sumY = 0;
        poly.forEach(p => { sumX += p.x; sumY += p.y; });
        return { x: sumX / poly.length, y: sumY / poly.length };
    }
    Cx /= (6 * A);
    Cy /= (6 * A);
    return { x: Cx, y: Cy };
};

export const getPolygonBBox = (poly: Point[]) => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    poly.forEach(p => {
        const px = Number(p.x);
        const py = Number(p.y);
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
    });
    return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
};

export const getBBoxCenter = (bbox: { minX: number, maxX: number, minY: number, maxY: number }): Point => {
    return {
        x: (Number(bbox.minX) + Number(bbox.maxX)) / 2,
        y: (Number(bbox.minY) + Number(bbox.maxY)) / 2
    };
};
