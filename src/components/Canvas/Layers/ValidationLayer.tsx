
import React, { useMemo } from 'react';
import { Circle, Group } from 'react-konva';
import { useProjectStore } from '../../../store/useProjectStore';
import { findOpenEndpoints } from '../../../utils/validation';

import type { Stage } from 'konva/lib/Stage';

interface ValidationLayerProps {
    stage: Stage | null;
}

export const ValidationLayer: React.FC<ValidationLayerProps> = ({ stage }) => {
    const { walls, activeTool, layers } = useProjectStore();

    // Show only if Walls layer is visible AND we are not currently drawing
    const visible = layers.walls && activeTool !== 'wall' && activeTool !== 'wall_rect';

    const openPoints = useMemo(() => {
        if (!visible) return [];
        return findOpenEndpoints(walls);
    }, [walls, visible]);

    if (!visible || openPoints.length === 0) return null;

    // Fixed Screen Size Calculation
    const scale = stage?.scaleX() || 1;
    // User requested "a little bit large then seen wall".
    // Increasing Diameter to 40px (Radius 20px) to ensure it encompasses thick walls.
    const radiusPx = 20;
    const radiusWorld = radiusPx / scale;
    const strokeWidthWorld = 3 / scale;

    return (
        <Group listening={false}>
            {openPoints.map((p, i) => (
                <Group key={i} x={p.x} y={p.y}>
                    {/* Outer Ring - Fixed Screen Size */}
                    <Circle
                        radius={radiusWorld}
                        stroke="red"
                        strokeWidth={strokeWidthWorld}
                        fillEnabled={false}
                    />
                </Group>
            ))}
        </Group>
    );
};
