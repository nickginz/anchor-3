import React, { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Image as KonvaImage } from 'react-konva';
import { useProjectStore } from '../../../store/useProjectStore';
import type { ProjectState } from '../../../store/useProjectStore';

import { calculateFreeSpaceRSSI, calculateTotalPowerAtPixel, generateVirtualAnchors } from '../../../utils/signal-physics';

// Interpolate between two colors
const lerpColor = (c1: { r: number, g: number, b: number }, c2: { r: number, g: number, b: number }, t: number) => {
    return {
        r: Math.round(c1.r + (c2.r - c1.r) * t),
        g: Math.round(c1.g + (c2.g - c1.g) * t),
        b: Math.round(c1.b + (c2.b - c1.b) * t),
        a: 150
    };
};

const COLORS = {
    red: { r: 255, g: 0, b: 0 },
    orange: { r: 255, g: 165, b: 0 },
    yellow: { r: 255, g: 255, b: 0 },
    green: { r: 0, g: 255, b: 0 },
    blue: { r: 0, g: 0, b: 255 }
};

const getHeatmapColor = (
    dbm: number,
    mode: 'test' | 'standard' | 'manual',
    thresholds?: { red: number, orange: number, yellow: number, green: number, blue: number }
): { r: number, g: number, b: number, a: number } => {

    if (mode === 'test') {
        // Test Mode: Fixed -90 to -30 Gradient (Red->Blue)
        if (dbm < -95) return { r: 0, g: 0, b: 0, a: 0 };

        const min = -90;
        const max = -30;
        let norm = (dbm - min) / (max - min); // 0 (Weak) to 1 (Strong)
        norm = Math.min(1, Math.max(0, norm));

        if (norm < 0.25) return lerpColor(COLORS.blue, COLORS.green, norm / 0.25);
        if (norm < 0.50) return lerpColor(COLORS.green, COLORS.yellow, (norm - 0.25) / 0.25);
        if (norm < 0.75) return lerpColor(COLORS.yellow, COLORS.orange, (norm - 0.50) / 0.25);
        return lerpColor(COLORS.orange, COLORS.red, (norm - 0.75) / 0.25);
    }

    if (!thresholds) return { r: 0, g: 0, b: 0, a: 0 };

    // Standard / Manual Mode
    if (dbm >= thresholds.red) return { ...COLORS.red, a: 150 }; // Stronger than Red threshold
    if (dbm < thresholds.blue) return { r: 0, g: 0, b: 0, a: 0 }; // Weaker than Blue threshold (Cutoff)

    // Red -> Orange
    if (dbm >= thresholds.orange) {
        const t = (dbm - thresholds.orange) / (thresholds.red - thresholds.orange);
        return lerpColor(COLORS.orange, COLORS.red, t);
    }
    // Orange -> Yellow
    if (dbm >= thresholds.yellow) {
        const t = (dbm - thresholds.yellow) / (thresholds.orange - thresholds.yellow);
        return lerpColor(COLORS.yellow, COLORS.orange, t);
    }
    // Yellow -> Green
    if (dbm >= thresholds.green) {
        const t = (dbm - thresholds.green) / (thresholds.yellow - thresholds.green);
        return lerpColor(COLORS.green, COLORS.yellow, t);
    }
    // Green -> Blue
    const t = (dbm - thresholds.blue) / (thresholds.green - thresholds.blue);
    return lerpColor(COLORS.blue, COLORS.green, t);
};

export const HeatmapLayer: React.FC<{ stage: any }> = ({ stage }) => {
    const { walls, anchors, scaleRatio, layers, heatmapResolution, showHeatmap, heatmapColorMode, heatmapThresholds } = useProjectStore(
        useShallow((state: ProjectState) => ({
            walls: state.walls,
            anchors: state.anchors,
            scaleRatio: state.scaleRatio,
            layers: state.layers,
            heatmapResolution: state.heatmapResolution,
            showHeatmap: state.showHeatmap,
            heatmapColorMode: state.heatmapColorMode,
            heatmapThresholds: state.heatmapThresholds
        }))
    );
    const [image, setImage] = useState<HTMLImageElement | null>(null);

    useEffect(() => {
        if (!showHeatmap || !layers.heatmap || anchors.length === 0) {
            setImage(null);
            return;
        }

        // 1. Calculate Project Bounds (World Coordinates)
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        anchors.forEach(a => {
            minX = Math.min(minX, a.x);
            minY = Math.min(minY, a.y);
            maxX = Math.max(maxX, a.x);
            maxY = Math.max(maxY, a.y);
        });

        // Add walls to context
        walls.forEach(w => {
            minX = Math.min(minX, w.points[0], w.points[2]);
            minY = Math.min(minY, w.points[1], w.points[3]);
            maxX = Math.max(maxX, w.points[0], w.points[2]);
            maxY = Math.max(maxY, w.points[1], w.points[3]);
        });

        // If no objects found, fallback to stage
        if (minX === Infinity) {
            minX = 0; minY = 0; maxX = stage.width(); maxY = stage.height();
        }

        // Add Padding relative to Max Range
        // Max range in 'Standard' is 7m. In 'Test' it's effectively 20m+.
        const paddingMeters = heatmapThresholds?.blue ? heatmapThresholds.blue * 1.5 : 20;
        const paddingPx = paddingMeters * scaleRatio;

        minX -= paddingPx;
        minY -= paddingPx;
        maxX += paddingPx;
        maxY += paddingPx;

        const boundsWidth = maxX - minX;
        const boundsHeight = maxY - minY;

        // Safety check
        if (boundsWidth <= 0 || boundsHeight <= 0) return;

        // Calculate thresholds in dBm
        const REF_TX = 20;

        let activeThresholds;
        let rangeLimit = Infinity;

        if (heatmapColorMode === 'standard') {
            activeThresholds = {
                red: calculateFreeSpaceRSSI(REF_TX, 2),
                orange: calculateFreeSpaceRSSI(REF_TX, 3),
                yellow: calculateFreeSpaceRSSI(REF_TX, 4),
                green: calculateFreeSpaceRSSI(REF_TX, 5),
                blue: calculateFreeSpaceRSSI(REF_TX, 7)
            };
            rangeLimit = 7;
        } else if (heatmapColorMode === 'manual') {
            activeThresholds = {
                red: calculateFreeSpaceRSSI(REF_TX, heatmapThresholds.red),
                orange: calculateFreeSpaceRSSI(REF_TX, heatmapThresholds.orange),
                yellow: calculateFreeSpaceRSSI(REF_TX, heatmapThresholds.yellow),
                green: calculateFreeSpaceRSSI(REF_TX, heatmapThresholds.green),
                blue: calculateFreeSpaceRSSI(REF_TX, heatmapThresholds.blue)
            };
            rangeLimit = heatmapThresholds.blue;
        }

        // visual grid step
        const stepMeters = heatmapResolution / 100;
        const calculationStepPixels = Math.max(10, stepMeters * scaleRatio);

        const cols = Math.ceil(boundsWidth / calculationStepPixels);
        const rows = Math.ceil(boundsHeight / calculationStepPixels);

        // Limit Max Size to avoid crash (e.g. max 5000x5000)
        if (cols * rows > 25000000) {
            console.warn("Heatmap too large");
            return;
        }

        const gridCanvas = document.createElement('canvas');
        gridCanvas.width = cols;
        gridCanvas.height = rows;
        const ctx = gridCanvas.getContext('2d');
        if (!ctx) return;

        const imgData = ctx.createImageData(cols, rows);

        // 1. Convert World Objects to Meters
        const worldAnchors = anchors.map(a => ({
            x: a.x / scaleRatio,
            y: a.y / scaleRatio,
            txPower: a.txPower || 20
        }));

        const worldWalls = walls.map(w => ({
            ...w,
            points: [w.points[0] / scaleRatio, w.points[1] / scaleRatio, w.points[2] / scaleRatio, w.points[3] / scaleRatio] as [number, number, number, number]
        }));

        // 2. Pre-Calculate Virtual Anchors
        const virtualAnchors = generateVirtualAnchors(worldAnchors, worldWalls);

        // 3. Pixel Loop
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {

                // Position relative to Bounds Origin (minX, minY)
                const screenX = minX + x * calculationStepPixels;
                const screenY = minY + y * calculationStepPixels;

                const worldPixel = {
                    x: screenX / scaleRatio,
                    y: screenY / scaleRatio
                };

                // Optimization: Range Check
                if (rangeLimit !== Infinity) {
                    let minDist = Infinity;
                    for (const a of worldAnchors) {
                        const d = Math.hypot(worldPixel.x - a.x, worldPixel.y - a.y);
                        if (d < minDist) minDist = d;
                    }
                    if (minDist > rangeLimit * 1.5) continue;
                }

                const dbm = calculateTotalPowerAtPixel(worldPixel, worldAnchors, virtualAnchors, worldWalls);
                const c = getHeatmapColor(dbm, heatmapColorMode, activeThresholds);

                const index = (y * cols + x) * 4;
                imgData.data[index] = c.r;
                imgData.data[index + 1] = c.g;
                imgData.data[index + 2] = c.b;
                imgData.data[index + 3] = c.a;
            }
        }

        ctx.putImageData(imgData, 0, 0);

        // Upscale
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = boundsWidth;
        finalCanvas.height = boundsHeight;
        const fCtx = finalCanvas.getContext('2d');
        if (fCtx) {
            fCtx.imageSmoothingEnabled = true;
            fCtx.imageSmoothingQuality = 'high';
            fCtx.drawImage(gridCanvas, 0, 0, boundsWidth, boundsHeight);

            const finalImage = new window.Image();
            finalImage.onload = () => {
                // Store positioning info
                (finalImage as any)._x = minX;
                (finalImage as any)._y = minY;
                setImage(finalImage);
            };
            finalImage.src = finalCanvas.toDataURL();
        }

    }, [walls, anchors, showHeatmap, layers.heatmap, scaleRatio, stage, heatmapResolution, heatmapColorMode, heatmapThresholds]);

    if (!image) return null;

    return (
        <KonvaImage
            image={image}
            x={(image as any)._x || 0}
            y={(image as any)._y || 0}
            width={image.width}
            height={image.height}
            listening={false}
            opacity={0.5} // Reduced opacity to ensure Visibility of underlying/overlaying layers
        />
    );
};
