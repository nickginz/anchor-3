
import React from 'react';
import { Line, Group } from 'react-konva';
import { useProjectStore } from '../../../store/useProjectStore';

export const DXFLayer: React.FC = () => {
    const { importedObjects, activeTool, setActiveImportId } = useProjectStore();

    return (
        <React.Fragment>
            {importedObjects.map(obj => {
                if (obj.type !== 'dxf' || !obj.visible) return null;
                const isSelectMode = activeTool === 'select';
                return (
                    <Group
                        key={obj.id}
                        x={obj.x}
                        y={obj.y}
                        rotation={obj.rotation}
                        scaleX={obj.scale}
                        scaleY={obj.scale}
                        listening={isSelectMode}
                        onClick={(e) => {
                            if (isSelectMode && e.evt.altKey) {
                                setActiveImportId(obj.id);
                                e.cancelBubble = true;
                            }
                        }}
                        onTap={(e) => {
                            if (isSelectMode && e.evt.altKey) {
                                setActiveImportId(obj.id);
                                e.cancelBubble = true;
                            }
                        }}
                    >
                        {obj.data.entities.map((entity: any, i: number) => {
                            // Check Layer Visibility (Specific to this object)
                            if (obj.layers && obj.layers[entity.layer] === false) return null;

                            // Handle LINE
                            if (entity.type === 'LINE') {
                                return (
                                    <Line
                                        key={i}
                                        points={[entity.vertices[0].x, entity.vertices[0].y, entity.vertices[1].x, entity.vertices[1].y]}
                                        stroke={getColor(entity.color)}
                                        strokeWidth={1 / (useProjectStore.getState().scaleRatio || 1)}
                                        opacity={0.5}
                                    />
                                );
                            }

                            // Handle LWPOLYLINE & POLYLINE
                            if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
                                const points: number[] = [];
                                entity.vertices.forEach((v: any) => points.push(v.x, v.y));

                                if (entity.shape || (entity.closed)) {
                                    points.push(entity.vertices[0].x, entity.vertices[0].y);
                                }

                                return (
                                    <Line
                                        key={i}
                                        points={points}
                                        stroke={getColor(entity.color)}
                                        strokeWidth={1}
                                        opacity={0.5}
                                    />
                                );
                            }
                            return null;
                        })}
                    </Group>
                );
            })}
        </React.Fragment>
    );
};

// Helper for AutoCAD Index Colors
const getColor = (index: number) => {
    // Basic mapping, could be expanded
    const colors = [
        '#000000', '#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FFFFFF', '#808080', '#C0C0C0'
    ];
    return colors[index % colors.length] || '#666666';
};
