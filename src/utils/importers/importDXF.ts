
import DxfParser from 'dxf-parser';

export const importDXF = (file: File): Promise<any> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            if (!content) return reject('Failed to read file');

            try {
                const parser = new DxfParser();
                const dxf = parser.parseSync(content);

                // Calculate Extents
                const extents = calculateExtents(dxf);
                // Augment the DXF object
                (dxf as any).extents = extents;

                resolve(dxf);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsText(file);
    });
};

const calculateExtents = (dxf: any) => {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    let hasEntities = false;

    if (dxf && dxf.entities) {
        dxf.entities.forEach((entity: any) => {
            if (entity.type === 'LINE') {
                entity.vertices.forEach((v: any) => {
                    minX = Math.min(minX, v.x);
                    maxX = Math.max(maxX, v.x);
                    minY = Math.min(minY, v.y);
                    maxY = Math.max(maxY, v.y);
                    hasEntities = true;
                });
            } else if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
                entity.vertices.forEach((v: any) => {
                    minX = Math.min(minX, v.x);
                    maxX = Math.max(maxX, v.x);
                    minY = Math.min(minY, v.y);
                    maxY = Math.max(maxY, v.y);
                    hasEntities = true;
                });
            } else if (entity.type === 'CIRCLE' || entity.type === 'ARC') {
                // Approximate BBox
                const r = entity.radius || 0;
                const x = entity.center.x;
                const y = entity.center.y;
                minX = Math.min(minX, x - r);
                maxX = Math.max(maxX, x + r);
                minY = Math.min(minY, y - r);
                maxY = Math.max(maxY, y + r);
                hasEntities = true;
            }
            // Add other types as needed
        });
    }

    if (!hasEntities) {
        return { min: { x: 0, y: 0 }, max: { x: 100, y: 100 }, width: 100, height: 100 };
    }

    return {
        min: { x: minX, y: minY },
        max: { x: maxX, y: maxY },
        width: maxX - minX,
        height: maxY - minY
    };
};
