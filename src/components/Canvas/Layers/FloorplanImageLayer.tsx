
import React from 'react';
import { Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import { useProjectStore } from '../../../store/useProjectStore';

export const FloorplanImageLayer: React.FC = () => {
    const { importedObjects, layers } = useProjectStore();

    if (!layers.floorplan) return null;

    return (
        <React.Fragment>
            {importedObjects.map(obj => {
                if (obj.type !== 'image' || !obj.visible) return null;
                return <SingleImage key={obj.id} obj={obj} />;
            })}
        </React.Fragment>
    );
};

const SingleImage: React.FC<{ obj: any }> = ({ obj }) => {
    const [image] = useImage(obj.src || '', 'anonymous');
    const { activeTool, setActiveImportId, activeImportId } = useProjectStore();

    if (!image) return null;

    const isSelected = activeImportId === obj.id;
    const isSelectMode = activeTool === 'select';

    return (
        <KonvaImage
            image={image}
            x={obj.x}
            y={obj.y}
            width={obj.width * obj.scale}
            height={obj.height * obj.scale}
            opacity={obj.opacity}
            rotation={obj.rotation}
            listening={isSelectMode}
            onClick={(e) => {
                if (isSelectMode && e.evt.altKey) setActiveImportId(obj.id);
            }}
            onTap={(e) => {
                if (isSelectMode && e.evt.altKey) setActiveImportId(obj.id);
            }}
            stroke={isSelected ? '#0078d4' : undefined}
            strokeWidth={isSelected ? 5 / (useProjectStore.getState().scaleRatio / 50) : 0} // visual feedback
        />
    );
};
