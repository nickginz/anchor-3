import type { Wall, Anchor } from '../types';
import { detectRooms, calculatePolygonArea } from './room-detection';
import { dist } from './geometry';

// Types
export interface PlacementOptions {
    radius: number; // Detection radius in meters
    minOverlap: number; // Min required overlap count
    wallThickness: number; // For avoiding walls
    scaleRatio: number; // Pixels per meter
}

interface Point { x: number; y: number; }

// Main Function
export const generateAutoAnchors = (walls: Wall[], options: PlacementOptions, existingAnchors: Point[] = []): Omit<Anchor, 'id'>[] => {
    const { radius, scaleRatio } = options;
    const radiusPx = radius * scaleRatio;

    const rooms = detectRooms(walls);
    let potentialAnchors: Point[] = [];

    // 1. Process each detected room
    rooms.forEach(roomPoly => {
        const classification = classifyRoom(roomPoly, radiusPx);

        switch (classification) {
            case 'small_room':
                potentialAnchors.push(getCentroid(roomPoly));
                break;
            case 'large_room':
                potentialAnchors.push(...placeGrid(roomPoly, radiusPx, false));
                break;
            case 'corridor':
                // Use Grid for corridors too to handle non-linear shapes
                potentialAnchors.push(...placeGrid(roomPoly, radiusPx, true));
                break;
        }
    });

    // Wall Avoidance Filter
    const minWallDistPx = 0.5 * scaleRatio; // 0.5 meters
    potentialAnchors = potentialAnchors.filter(p => !isTooCloseToWalls(p, walls, minWallDistPx));

    // Existing Anchor Duplication Filter
    if (existingAnchors.length > 0) {
        // Prevent placing NEW anchor if an EXISTING anchor is within 1x Radius (or smaller thresh?)
        // User request: "if on auto placmet in same poin there is anchor do not place new"
        // Let's use a reasonable duplicate threshold, e.g. 2 meters or 0.2*radius
        const DUPLICATE_THRESH = 2 * scaleRatio;
        potentialAnchors = potentialAnchors.filter(p => {
            return !existingAnchors.some(existing => dist(p, existing) < DUPLICATE_THRESH);
        });
    }

    // 2. Convert to Anchors
    const anchorObjects = potentialAnchors.map(p => ({
        x: p.x,
        y: p.y,
        power: -40, // Default dBm
        range: radius,
        radius: radius,
        shape: 'circle' as const,
        txPower: 0
    }));

    // 3. Merge Nearby (using pixel distance)
    return mergeAnchors(anchorObjects, radiusPx);
};

// --- Helpers ---

// Classification
// Wall Distance Check
function isTooCloseToWalls(p: Point, walls: Wall[], minPx: number): boolean {
    // Simple segment distance check
    for (const w of walls) {
        const x1 = w.points[0], y1 = w.points[1], x2 = w.points[2], y2 = w.points[3];

        const A = p.x - x1;
        const B = p.y - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const len_sq = C * C + D * D;
        let param = -1;
        if (len_sq !== 0) param = dot / len_sq;

        let xx, yy;

        if (param < 0) {
            xx = x1; yy = y1;
        } else if (param > 1) {
            xx = x2; yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        const dx = p.x - xx;
        const dy = p.y - yy;
        const distSq = dx * dx + dy * dy;

        if (distSq < minPx * minPx) return true;
    }
    return false;
}

// Unified Placement Strategy
function placeGrid(poly: Point[], radius: number, isCorridor: boolean): Point[] {
    const bbox = getBoundingBox(poly);
    // Corridors need denser/linear placement? Or just standard grid?
    // Usage of 1.4 radius is good for overlapping coverage.
    const step = radius * 1.4;
    const points: Point[] = [];

    // Attempt Grid with Offset 0
    // If that fails (points=0), try offset=step/2 (staggered)
    const tryGrid = (offsetX: number, offsetY: number) => {
        const found: Point[] = [];
        for (let x = bbox.minX + step / 2 + offsetX; x < bbox.maxX; x += step) {
            for (let y = bbox.minY + step / 2 + offsetY; y < bbox.maxY; y += step) {
                const pt = { x, y };
                if (isPointInPolygon(pt, poly)) {
                    found.push(pt);
                }
            }
        }
        return found;
    };

    let candidates = tryGrid(0, 0);

    // If room is large/odd but grid aligned poorly, try offset
    if (candidates.length === 0) {
        candidates = tryGrid(step / 2, step / 2);
    }

    // Last ditch: Centroid if inside
    if (candidates.length === 0) {
        const c = getCentroid(poly);
        if (isPointInPolygon(c, poly)) candidates.push(c);
    }

    return candidates;
}

// Classification (Simplified)
function classifyRoom(poly: Point[], radius: number): 'small_room' | 'large_room' | 'corridor' {
    const area = Math.abs(calculatePolygonArea(poly));
    const bbox = getBoundingBox(poly);
    const width = bbox.maxX - bbox.minX;
    const height = bbox.maxY - bbox.minY;
    const aspectRatio = Math.max(width, height) / Math.min(width, height);

    if (aspectRatio > 3.0) return 'corridor';
    if (area > (2 * radius * 2 * radius)) return 'large_room';
    return 'small_room';
}

function getCentroid(poly: Point[]): Point {
    let cx = 0, cy = 0, signedArea = 0;
    for (let i = 0; i < poly.length; i++) {
        const p1 = poly[i];
        const p2 = poly[(i + 1) % poly.length];
        const a = p1.x * p2.y - p2.x * p1.y;
        signedArea += a;
        cx += (p1.x + p2.x) * a;
        cy += (p1.y + p2.y) * a;
    }
    signedArea *= 0.5;
    cx /= (6 * signedArea);
    cy /= (6 * signedArea);
    return { x: cx, y: cy };
}

function getBoundingBox(poly: Point[]) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    poly.forEach(p => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
        return { minX, minY, maxX, maxY };
    });
    return { minX, minY, maxX, maxY };
}

// Simple Ray Casting
export function isPointInPolygon(pt: Point, poly: Point[]): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i].x, yi = poly[i].y;
        const xj = poly[j].x, yj = poly[j].y;
        const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
            (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}



// Merging
const mergeAnchors = (anchors: Omit<Anchor, 'id'>[], radius: number): Omit<Anchor, 'id'>[] => {
    const result: Omit<Anchor, 'id'>[] = [];
    const MERGE_DIST = radius * 0.4; // If closer than 40% of radius, merge

    anchors.forEach(a => {
        // Check if close to any existing result
        const existing = result.find(r => dist({ x: r.x, y: r.y }, { x: a.x, y: a.y }) < MERGE_DIST);
        if (!existing) {
            result.push(a);
        } else {
            // Optional: Move existing to midpoint? For now simplify: First come first serve
        }
    });

    return result;
};
