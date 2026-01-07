import React, { useMemo } from 'react';
import { Group, Path, Line } from 'react-konva';
import { useProjectStore } from '../../../store/useProjectStore';
import { generateJoinedWalls, generateUnionBoundary } from '../../../utils/wall-joining';
import type { Wall } from '../../../types';
import { getWallPattern } from '../../../utils/wall-patterns';

export const WallsLayer: React.FC = () => {
    const { walls, scaleRatio, layers, selectedIds, theme } = useProjectStore();

    // Group walls by thickness AND material to render them with different styles
    const groupedWalls = useMemo(() => {
        const groups: Record<string, Wall[]> = {};
        walls.forEach(w => {
            // Key: thickness|material
            const key = `${w.thickness.toFixed(2)}|${w.material || 'concrete'}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(w);
        });
        return groups;
    }, [walls]);

    // 1. Generate Filled Polygons (No Stroke) for each group
    const renderFills = useMemo(() => {
        if (!layers.walls) return [];

        return Object.entries(groupedWalls)
            .sort((a, b) => {
                // Sort by thickness ascending (thinner on bottom? or top? actually doesn't matter much for same Z)
                const tA = parseFloat(a[0].split('|')[0]);
                const tB = parseFloat(b[0].split('|')[0]);
                return tA - tB;
            })
            .map(([key, groupWalls]) => {
                const [thicknessStr, material] = key.split('|');
                const polygons = generateJoinedWalls(groupWalls, scaleRatio, walls);

                // Generate Path Data
                const pathData = polygons.map((poly: { x: number, y: number }[]) => {
                    if (poly.length === 0) return '';
                    return `M ${poly[0].x} ${poly[0].y} ` +
                        poly.slice(1).map((p: { x: number, y: number }) => `L ${p.x} ${p.y}`).join(' ') +
                        ' Z';
                }).join(' ');

                // Pattern Handling
                let fillColor = '#9ca3af'; // Default
                let patternImage: HTMLCanvasElement | null = null;
                let opacity = 1;

                const pattern = getWallPattern(material, theme as 'light' | 'dark');
                if (pattern) {
                    patternImage = pattern;
                }

                if (theme === 'light') {
                    // Light Theme Colors
                    switch (material) {
                        case 'brick': fillColor = '#ef4444'; break; // Fallback
                        case 'wood': fillColor = '#d97706'; break; // Amber-600
                        case 'glass': fillColor = '#93c5fd'; opacity = 0.5; break; // Blue-300 + Opacity
                        case 'metal': fillColor = '#cbd5e1'; break; // Slate-300 (Shiny-ish)
                        case 'drywall': fillColor = '#e5e7eb'; break; // Gray-200 (Very Light)
                        case 'concrete': default: fillColor = '#9ca3af'; break; // Gray-400
                    }
                } else {
                    // Dark Theme Colors
                    switch (material) {
                        case 'brick': fillColor = '#b91c1c'; break; // Fallback
                        case 'wood': fillColor = '#92400e'; break; // Amber-800
                        case 'glass': fillColor = '#3b82f6'; opacity = 0.3; break; // Blue-500 + Opacity
                        case 'metal': fillColor = '#64748b'; break; // Slate-500
                        case 'drywall': fillColor = '#374151'; break; // Gray-700
                        case 'concrete': default: fillColor = '#52525b'; break; // Zinc-600
                    }
                }

                return (
                    <Path
                        key={`group-${key}`}
                        data={pathData}
                        fill={patternImage ? undefined : fillColor}
                        fillPatternImage={patternImage || undefined}
                        strokeEnabled={false}
                        hitStrokeWidth={0}
                        fillRule="nonzero"
                        opacity={opacity}
                    />
                );
            });
    }, [groupedWalls, scaleRatio, layers.walls, walls, theme]);

    // 2. Generate Unified Boundary Stroke
    const renderBoundary = useMemo(() => {
        if (!layers.walls || walls.length === 0) return null;

        const boundaryPoly = generateUnionBoundary(walls, scaleRatio);

        const pathData = boundaryPoly.map((poly: { x: number, y: number }[]) => {
            if (poly.length === 0) return '';
            return `M ${poly[0].x} ${poly[0].y} ` +
                poly.slice(1).map((p: { x: number, y: number }) => `L ${p.x} ${p.y}`).join(' ') +
                ' Z';
        }).join(' ');

        return (
            <Path
                key="wall-boundary"
                data={pathData}
                stroke={theme === 'light' ? '#000000' : '#ffffff'}
                strokeWidth={2}
                hitStrokeWidth={10} // Hit detection on the stroke
                fillEnabled={false}
                listening={false} // Let clicks pass to the Fills underneath (if they tracked IDs, but they don't here. Selection is overlay.)
            />
        );

    }, [walls, scaleRatio, layers.walls]);

    if (!layers.walls) return null;

    return (
        <Group>
            {/* Render Merged Geometry Groups */}
            {/* Render Merged Geometry Groups */}
            {renderFills}
            {/* Render Unified Boundary Stroke */}
            {renderBoundary}

            {/* Render Selection Highlights (Overlay) */}
            {selectedIds.length > 0 && selectedIds.map(id => {
                const w = walls.find(wall => wall.id === id);
                if (!w) return null;
                return (
                    <Line
                        key={`sel-${id}`}
                        points={w.points}
                        stroke="#ffaa00" // Orange Highlight
                        strokeWidth={w.thickness * scaleRatio + 4} // Slightly wider than wall
                        opacity={0.4}
                        lineCap="square"
                    />
                );
            })}
        </Group>
    );
};
