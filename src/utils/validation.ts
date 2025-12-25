
import type { Wall } from '../types';

interface Point { x: number; y: number; }

export const findOpenEndpoints = (walls: Wall[]): Point[] => {
    // Coordinate Key -> Count
    const counts = new Map<string, number>();
    const coords = new Map<string, Point>();
    // Removed unused EPSILON

    // Helper to snap to grid/epsilon to avoid float issues
    // Actually we should use the same tolerance as Node Merging
    const getKey = (x: number, y: number) => {
        // Round to 3 decimals ~1mm
        const rx = Math.round(x * 1000) / 1000;
        const ry = Math.round(y * 1000) / 1000;
        return `${rx},${ry}`;
    };

    walls.forEach(w => {
        const startKey = getKey(w.points[0], w.points[1]);
        const endKey = getKey(w.points[2], w.points[3]);

        counts.set(startKey, (counts.get(startKey) || 0) + 1);
        counts.set(endKey, (counts.get(endKey) || 0) + 1);

        if (!coords.has(startKey)) coords.set(startKey, { x: w.points[0], y: w.points[1] });
        if (!coords.has(endKey)) coords.set(endKey, { x: w.points[2], y: w.points[3] });
    });

    const openPoints: Point[] = [];
    counts.forEach((count, key) => {
        if (count === 1) {
            openPoints.push(coords.get(key)!);
        }
    });

    return openPoints;
};
