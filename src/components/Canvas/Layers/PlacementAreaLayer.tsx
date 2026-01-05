import React from 'react';
import { Line, Circle, Group } from 'react-konva';
import { useProjectStore } from '../../../store/useProjectStore';

export const PlacementAreaLayer: React.FC = () => {
    const { placementArea, setPlacementArea, activeTool, placementAreaEnabled } = useProjectStore();

    if (!placementAreaEnabled) return null; // Hide if disabled
    if (!placementArea || !placementArea.points || placementArea.points.length === 0) return null;

    const PLACEMENT_AREA_ID = 'placement_area_poly';
    const isSelected = useProjectStore((state) => state.selectedIds.includes(PLACEMENT_AREA_ID));

    const points = placementArea.points.flatMap(p => [p.x, p.y]);

    // Handle drag for editing
    const handleDragMove = (index: number) => (e: any) => {
        if (activeTool !== 'placement_area' && activeTool !== 'select') return;

        const newPoints = [...placementArea.points];
        newPoints[index] = { x: e.target.x(), y: e.target.y() };
        setPlacementArea({ ...placementArea, points: newPoints });
    };

    // Handle Selection click
    const handleSelect = (e: any) => {
        if (activeTool !== 'select' && activeTool !== 'placement_area') return;
        const state = useProjectStore.getState();

        if (e.evt.shiftKey) {
            if (isSelected) {
                state.setSelection(state.selectedIds.filter(id => id !== PLACEMENT_AREA_ID));
            } else {
                state.setSelection([...state.selectedIds, PLACEMENT_AREA_ID]);
            }
        } else {
            state.setSelection([PLACEMENT_AREA_ID]);
        }
        e.cancelBubble = true; // Prevent stage click
    };

    return (
        <Group>
            {/* The Polygon Outline */}
            <Line
                points={points}
                closed={true}
                stroke={isSelected ? "#ea580c" : "#f97316"} // Darker Orange if Selected
                strokeWidth={isSelected ? 4 : 2}
                dash={isSelected ? [] : [10, 5]} // Solid if selected
                fill={isSelected ? "rgba(234, 88, 12, 0.1)" : "rgba(249, 115, 22, 0.05)"}
                listening={activeTool === 'select' || activeTool === 'placement_area'}
                onClick={handleSelect}
                onMouseEnter={() => document.body.style.cursor = 'pointer'}
                onMouseLeave={() => document.body.style.cursor = 'default'}
            />

            {/* Control Points (only if active tool is placement_area or select) */}
            {(activeTool === 'placement_area' || isSelected) && placementArea.points.map((p, i) => (
                <Circle
                    key={i}
                    x={p.x}
                    y={p.y}
                    radius={6}
                    fill="#3b82f6" // Blue-500
                    stroke="white"
                    strokeWidth={2}
                    draggable
                    onDragMove={handleDragMove(i)}
                    onMouseEnter={(e) => {
                        const container = e.target.getStage()?.container();
                        if (container) container.style.cursor = 'move';
                    }}
                    onMouseLeave={(e) => {
                        const container = e.target.getStage()?.container();
                        if (container) container.style.cursor = 'default';
                    }}
                />
            ))}
        </Group>
    );
};
