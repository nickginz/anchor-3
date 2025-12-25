export type WallMaterial = 'concrete' | 'glass' | 'wood' | 'metal' | 'drywall';

export interface Wall {
    id: string;
    points: [number, number, number, number]; // x1, y1, x2, y2
    thickness: number; // meters
    material: WallMaterial;
    attenuation: number; // dB
}

export interface Anchor {
    id: string;
    x: number;
    y: number;
    power: number; // dBm
    range: number; // meters
    radius?: number; // Override radius in meters
    shape?: 'circle' | 'square'; // Override shape
    groupId?: string; // For grouping anchors
}

export interface Dimension {
    id: string;
    type: 'free' | 'wall';
    points: number[];
    label: string;
    textOffset?: { x: number; y: number }; // Offset from default position
}

export type ToolType = 'select' | 'wall' | 'wall_rect' | 'anchor' | 'anchor_auto' | 'scale' | 'dimension' | 'trim' | 'extend' | 'mirror';

export interface ProjectLayers {
    walls: boolean;
    heatmap: boolean;
    floorplan: boolean;
    dimensions: boolean;
    anchors: boolean;
}

export interface BaseImportedObject {
    id: string;
    x: number;
    y: number;
    rotation: number;
    scale: number;
    visible: boolean;
    locked: boolean;
    name: string;
}

export interface ImageObject extends BaseImportedObject {
    type: 'image';
    src: string;
    width: number;
    height: number;
}

export interface DXFObject extends BaseImportedObject {
    type: 'dxf';
    data: any; // DXF Parser output
    layers: Record<string, boolean>; // Layer visibility
    width?: number; // Calculated BBox width
    height?: number; // Calculated BBox height
    opacity?: number; // Opacity of the DXF
}

export type ImportedObject = ImageObject | DXFObject;
