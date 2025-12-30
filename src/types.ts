export type WallMaterial = 'concrete' | 'glass' | 'wood' | 'metal' | 'drywall' | 'brick';

export interface WallPhysics {
    attenuationDb: number;
    reflectionLoss?: number;
}

export interface Point {
    x: number;
    y: number;
}



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
    power: number; // dBm. Tx Power.
    range: number; // meters
    radius?: number; // Override radius in meters
    shape?: 'circle' | 'square' | 'triangle' | 'star' | 'hex'; // Override shape
    showRadius?: boolean; // Show coverage radius
    groupId?: string; // For grouping anchors
    txPower?: number; // Transmit Power in dBm (Default 0)
}

export interface Dimension {
    id: string;
    type: 'free' | 'wall';
    points: number[];
    label: string;
    textOffset?: { x: number; y: number }; // Offset from default position
}

export type ToolType = 'select' | 'wall' | 'wall_rect' | 'wall_rect_edge' | 'anchor' | 'anchor_auto' | 'scale' | 'dimension' | 'trim' | 'extend' | 'mirror';

export interface ProjectLayers {
    walls: boolean;
    heatmap: boolean;
    floorplan: boolean;
    dimensions: boolean;
    anchors: boolean;
    rooms: boolean;
    roomLabels: boolean;
}

export const MATERIAL_PROPERTIES: Record<WallMaterial, WallPhysics> = {
    concrete: { attenuationDb: 12.5, reflectionLoss: 3.0 }, // Good reflector
    brick: { attenuationDb: 17.5, reflectionLoss: 4.0 }, // Fixed type error in copy-paste
    glass: { attenuationDb: 2.5, reflectionLoss: 10.0 },
    wood: { attenuationDb: 9, reflectionLoss: 8.0 },
    metal: { attenuationDb: 40, reflectionLoss: 1.0 }, // Perfect reflector
    drywall: { attenuationDb: 4, reflectionLoss: 12.0 }, // Absorbs/Passes
};

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
