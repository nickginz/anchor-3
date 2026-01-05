
import { MATERIAL_PROPERTIES } from '../types';
import type { Wall, WallMaterial } from '../types';

export const FREQUENCY = 2.4e9; // 2.4 GHz
export const REFERENCE_DISTANCE = 1.0; // 1 meter
export const REFERENCE_LOSS_2_4_GHZ = 40; // ~40dB loss at 1m for 2.4GHz
export const PATH_LOSS_EXPONENT = 2.0; // Free space (2.0) to Office (3.0)

/**
 * Calculates RSSI at a distance d from a transmitter.
 * Formula: RSSI = TxPower - PL(d0) - 10 * n * log10(d/d0) - ObstacleLoss
 */
export const calculateRSSI = (
    txPower: number, // dBm
    distance: number, // meters
    obstacleLoss: number, // dB
    n: number = PATH_LOSS_EXPONENT
): number => {
    if (distance <= 0.1) return txPower; // Cap at close range
    const pathLoss = REFERENCE_LOSS_2_4_GHZ + 10 * n * Math.log10(distance);
    return txPower - pathLoss - obstacleLoss;
    return txPower - pathLoss - obstacleLoss;
};

/**
 * Calculates Free Space RSSI for a given distance.
 * Used for Color Threshold calibration.
 */
export const calculateFreeSpaceRSSI = (txPower: number, distance: number): number => {
    return calculateRSSI(txPower, distance, 0);
};

/**
 * Checks if line segment (p1-p2) intersects with wall (p3-p4).
 * Returns true if they intersect.
 */
const intersects = (
    p1: { x: number, y: number },
    p2: { x: number, y: number },
    p3: { x: number, y: number },
    p4: { x: number, y: number }
): boolean => {
    const det = (p2.x - p1.x) * (p4.y - p3.y) - (p4.x - p3.x) * (p2.y - p1.y);
    if (det === 0) return false;

    const lambda = ((p4.y - p3.y) * (p4.x - p1.x) + (p3.x - p4.x) * (p4.y - p1.y)) / det;
    const gamma = ((p1.y - p2.y) * (p4.x - p1.x) + (p2.x - p1.x) * (p4.y - p1.y)) / det;

    return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
};

/**
 * Calculates total attenuation from walls between transmitter and receiver.
 */
export const calculateObstacleLoss = (
    tx: { x: number, y: number },
    rx: { x: number, y: number },
    walls: Wall[]
): number => {
    let totalLoss = 0;
    const REFERENCE_THICKNESS = 0.1; // 10cm standard reference

    for (const wall of walls) {
        const p1 = { x: wall.points[0], y: wall.points[1] };
        const p2 = { x: wall.points[2], y: wall.points[3] };

        if (intersects(tx, rx, p1, p2)) {
            // 1. Determine Base Attenuation (Instance override or Material default)
            const mat = MATERIAL_PROPERTIES[wall.material as WallMaterial] || MATERIAL_PROPERTIES.concrete;
            const baseAttenuation = wall.attenuation ?? mat.attenuationDb;

            // 2. Calculate Thickness Factor (Linear scaling)
            // Ensure we don't divide by zero or get negative loss
            const thickness = Math.max(0.01, wall.thickness);
            const factor = thickness / REFERENCE_THICKNESS;

            let loss = baseAttenuation * factor;

            // Calculate Angle of Incidence Logic
            const rayVector = { x: rx.x - tx.x, y: rx.y - tx.y };
            const wallVector = { x: p2.x - p1.x, y: p2.y - p1.y };

            // Dot Product 2D: x1*x2 + y1*y2
            const dotProd = rayVector.x * wallVector.x + rayVector.y * wallVector.y;
            const magRay = Math.hypot(rayVector.x, rayVector.y);
            const magWall = Math.hypot(wallVector.x, wallVector.y);

            if (magRay > 0 && magWall > 0) {
                const cosTheta = Math.abs(dotProd) / (magRay * magWall);

                // If |cosTheta| > 0.707 (Angle < 45 deg or > 135 deg to wall vector)
                // This corresponds to Angle from Normal > 45 deg (Glancing blow)
                if (Math.abs(cosTheta) > 0.707) {
                    loss *= 2.0; // Double the loss for steep angles
                }
            }

            totalLoss += loss;
        }
    }

    return totalLoss;
};

/**
 * Convert dBm to milliWatts
 */
export const dBmToMW = (dBm: number): number => {
    return Math.pow(10, dBm / 10);
};

/**
 * Convert milliWatts to dBm
 */
export const mWToDBm = (mW: number): number => {
    if (mW <= 0) return -120; // Floor
    return 10 * Math.log10(mW);
};

/**
 * Sums multiple RSSI values (in dBm) by converting to mW, summing, and converting back.
 * Represents non-coherent power summation (Interference).
 */
export const sumSignalStrengths = (rssiList: number[]): number => {
    if (rssiList.length === 0) return -120;

    let totalMW = 0;
    for (const rssi of rssiList) {
        // Ignore signals below noise floor to avoid precision issues
        if (rssi > -100) {
            totalMW += dBmToMW(rssi);
        }
    }

    return mWToDBm(totalMW);
};
// Reflection Interface
interface VirtualAnchor {
    pos: { x: number, y: number };
    originalTxPower: number;
    generatingWall: Wall;
    reflectionMaterialLoss: number;
}

// Geometric Helpres
const getMirrorPoint = (p: { x: number, y: number }, wStart: { x: number, y: number }, wEnd: { x: number, y: number }) => {
    const dx = wEnd.x - wStart.x;
    const dy = wEnd.y - wStart.y;
    const a = (dx * dx - dy * dy) / (dx * dx + dy * dy);
    const b = 2 * dx * dy / (dx * dx + dy * dy);
    const x2 = a * (p.x - wStart.x) + b * (p.y - wStart.y) + wStart.x;
    const y2 = b * (p.x - wStart.x) - a * (p.y - wStart.y) + wStart.y;
    return { x: x2, y: y2 };
};

const getLineIntersection = (p1: { x: number, y: number }, p2: { x: number, y: number }, p3: { x: number, y: number }, p4: { x: number, y: number }) => {
    const det = (p2.x - p1.x) * (p4.y - p3.y) - (p4.x - p3.x) * (p2.y - p1.y);
    if (det === 0) return null;
    const lambda = ((p4.y - p3.y) * (p4.x - p1.x) + (p3.x - p4.x) * (p4.y - p1.y)) / det;
    const gamma = ((p1.y - p2.y) * (p4.x - p1.x) + (p2.x - p1.x) * (p4.y - p1.y)) / det;
    if ((0 < lambda && lambda < 1) && (0 < gamma && gamma < 1)) return { x: p1.x + lambda * (p2.x - p1.x), y: p1.y + lambda * (p2.y - p1.y) };
    return null;
};

// Generate Virtual Anchors (Pre-Pass)
export const generateVirtualAnchors = (anchors: { x: number, y: number, txPower?: number }[], walls: Wall[]): VirtualAnchor[] => {
    const virtuals: VirtualAnchor[] = [];
    anchors.forEach(anchor => {
        walls.forEach(wall => {
            const p1 = { x: wall.points[0], y: wall.points[1] };
            const p2 = { x: wall.points[2], y: wall.points[3] };

            const mirrorPos = getMirrorPoint(anchor, p1, p2);
            const mat = MATERIAL_PROPERTIES[wall.material as WallMaterial] || MATERIAL_PROPERTIES.concrete;

            virtuals.push({
                pos: mirrorPos,
                originalTxPower: anchor.txPower || 0,
                generatingWall: wall,
                reflectionMaterialLoss: mat.reflectionLoss || 6.0 // Default fallback
            });
        });
    });
    return virtuals;
};


/**
 * Calculates Total Power at Pixel including Reflections
 */
export const calculateTotalPowerAtPixel = (
    pixel: { x: number, y: number },
    anchors: { x: number, y: number, txPower?: number }[],
    virtualAnchors: VirtualAnchor[],
    walls: Wall[]
): number => {
    let totalMW = 0;

    // 1. Direct Paths
    for (const anchor of anchors) {
        const dist = Math.hypot(pixel.x - anchor.x, pixel.y - anchor.y);
        const obsLoss = calculateObstacleLoss(anchor, pixel, walls);
        const tx = anchor.txPower || 0;
        const rssi = calculateRSSI(tx, dist, obsLoss);

        // Add K-Factor for peak sharpening (Logic from previous step)
        // We do K-Factor scaling later or here? simpler to do direct sum first.
        // Actually, previous implementation applied K-Factor 1.2 at display time or to the dBm?
        // Let's stick to pure physics here: Linear sum.
        totalMW += dBmToMW(rssi);
    }

    // 2. Reflected Paths
    for (const vAnchor of virtualAnchors) {
        const wall = vAnchor.generatingWall;
        const wStart = { x: wall.points[0], y: wall.points[1] };
        const wEnd = { x: wall.points[2], y: wall.points[3] };

        // A. Validity Check: Ray from Virtual -> Pixel MUST intersect the Generating Wall
        const intersection = getLineIntersection(vAnchor.pos, pixel, wStart, wEnd);

        if (intersection) {
            // B. Total Path Distance
            const dist = Math.hypot(pixel.x - vAnchor.pos.x, pixel.y - vAnchor.pos.y);

            // C. Path Loss
            // Using same calculation as direct
            let rssi = calculateRSSI(vAnchor.originalTxPower, dist, 0);

            // D. Reflection Penalty
            rssi -= vAnchor.reflectionMaterialLoss;

            // E. Obstacle Penetration (From Intersection to Pixel only)
            // We only care about walls between the bounce point and the user
            const obsLoss = calculateObstacleLoss(intersection, pixel, walls);
            rssi -= obsLoss;

            totalMW += dBmToMW(rssi);
        }
    }

    return mWToDBm(totalMW);
};
