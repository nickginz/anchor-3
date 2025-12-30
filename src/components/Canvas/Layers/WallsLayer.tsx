import React, { useMemo } from 'react';
import { Group, Path, Line } from 'react-konva';
import { useProjectStore } from '../../../store/useProjectStore';
import { generateJoinedWalls, generateUnionBoundary } from '../../../utils/wall-joining';
import type { Wall } from '../../../types';

export const WallsLayer: React.FC = () => {
    const { walls, scaleRatio, layers, selectedIds, theme } = useProjectStore();

    // Group walls by thickness to render them with different styles
    const groupedWalls = useMemo(() => {
        const groups: Record<string, Wall[]> = {};
        walls.forEach(w => {
            const key = w.thickness.toFixed(2); // Group by thickness '0.10', '0.20'
            if (!groups[key]) groups[key] = [];
            groups[key].push(w);
        });
        return groups;
    }, [walls]);

    // 1. Generate Filled Polygons (No Stroke) for each group
    const renderFills = useMemo(() => {
        if (!layers.walls) return [];

        return Object.entries(groupedWalls)
            .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0])) // Sort by thickness ascending
            .map(([thickness, groupWalls]) => {
                const polygons = generateJoinedWalls(groupWalls, scaleRatio, walls);

                // Generate Path Data
                const pathData = polygons.map((poly: { x: number, y: number }[]) => {
                    if (poly.length === 0) return '';
                    return `M ${poly[0].x} ${poly[0].y} ` +
                        poly.slice(1).map((p: { x: number, y: number }) => `L ${p.x} ${p.y}`).join(' ') +
                        ' Z';
                }).join(' ');

                // Color Logic
                const numThickness = parseFloat(thickness);
                // Theme-based colors
                let fillColor = theme === 'light' ? '#9ca3af' : '#71717a'; // Gray-400 (Light) vs Gray-600 (Dark)
                if (numThickness >= 0.2) {
                    fillColor = theme === 'light' ? '#60a5fa' : '#5b7c99'; // Blue-400 (Light) vs Blueish (Dark)
                }

                return (
                    <Path
                        key={`group-${thickness}`}
                        data={pathData}
                        fill={fillColor}
                        strokeEnabled={false} // No stroke on individual parts
                        hitStrokeWidth={0}
                        fillRule="nonzero"
                    />
                );
            });
    }, [groupedWalls, scaleRatio, layers.walls, walls]);

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
