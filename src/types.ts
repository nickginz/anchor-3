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
    attenuation?: number; // dB (Optional override)
    door?: Door;
}

export interface Door {
    id: string;
    wallId: string;
    distance: number; // Distance from Wall Start Point (P1) in meters
    offset: number;   // Distance as percentage (0-1)
    width: number; // Meters
    height?: number; // Meters (2.1 default)
    type: 'single' | 'double' | 'slide';
    opentype: 'left' | 'right'; // Hinge position relative to looking from P1 to P2?
    isOpenOut: boolean; // Swing direction
    angle?: number; // Opening angle (visual)
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
    isAuto?: boolean; // Flag for auto-placed anchors
    locked?: boolean; // Prevent move/delete
    isCorner?: boolean; // Protected from density optimization
}

export interface Dimension {
    id: string;
    type: 'free' | 'wall';
    points: number[];
    label: string;
    textOffset?: { x: number; y: number }; // Offset from default position
}

export type ToolType = 'select' | 'wall' | 'wall_rect' | 'wall_rect_edge' | 'door' | 'anchor' | 'anchor_auto' | 'hub' | 'scale' | 'dimension' | 'trim' | 'extend' | 'mirror' | 'placement_area' | 'export_area' | 'cable_edit';

export interface Hub {
    id: string;
    x: number;
    y: number;
    capacity: 2 | 6 | 12 | 24;
    name: string;
    color?: string; // Hub specific color for cables
}

export interface Cable {
    id: string;
    fromId: string; // Hub or Anchor ID
    toId: string;   // Anchor ID
    points: Point[]; // Orthogonal path
    length: number; // Meters
    color?: string; // Hex color override
    // Advanced Routing Props
    type?: 'cat6' | 'fiber' | 'power';
    verticalDrop?: number; // meters
    serviceLoop?: number; // meters
    topology?: 'star' | 'daisy';
    locked?: boolean;
}

export interface ProjectLayers {
    walls: boolean;
    heatmap: boolean;
    floorplan: boolean;
    dimensions: boolean;
    anchors: boolean;
    rooms: boolean;
    roomLabels: boolean;
    centroids: boolean;
    hubs: boolean;
    cables: boolean;
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
    opacity?: number;
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
}

export type ImportedObject = ImageObject | DXFObject;
