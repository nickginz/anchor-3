# Technical Reference Manual

## Architecture Overview
**Wall Pro** is a client-side React application built for performance-critical CAD operations.

### Core Stack
-   **Framework**: React 18 + Vite (Fast HMR).
-   **Canvas Engine**: `react-konva` (Canvas 2D API wrapper).
-   **State Management**: `zustand` (with `temporal` middleware for Undo/Redo).
-   **Styling**: Tailwind CSS.

## State Management (`useProjectStore.ts`)
The application uses a single centralized store for all project data.
-   **Walls/Anchors/Hubs**: Stored as flat arrays of objects with UUIDs.
-   **Layers**: Boolean flags for visibility.
-   **Interaction State**: `activeTool`, `selection`, `isDragging`.

> **Note**: Heavy operations (like re-calculating cables) should be optimized to avoid blocking the main thread, as the store updates trigger React re-renders.

## Key Components

### `InteractionLayer.tsx`
The heart of the canvas interactions. It handles:
-   Global Mouse/Keyboard listeners (`handleMouseDown`, `handleKeyDown`).
-   Tool logic (Wall drawing, Selection box, Handle manipulation).
-   **Refactoring Note**: This file is large (~3000 lines). Future work should split tool logic into hooks (e.g., `useWallTool`, `useSelectionTool`).

### `MainStage.tsx`
The root Canvas component. It composes the layers:
1.  `GridLayer` (Background)
2.  `ImageLayer` (Imports)
3.  `WallsLayer` (Structural)
4.  `HeatmapLayer` (Signal Analysis)
5.  `InteractionLayer` (Overlay UI)

## Algorithms

### Cable Routing (`routing.ts`)
-   Uses a grid-based **A*** (A-Star) or orthogonal step algorithm.
-   **Obstacle Avoidance**: Walls act as high-cost nodes.
-   **Topology**:
    -   *Star*: Direct home-run from Hub to Anchor.
    -   *Daisy-Chain*: Serial connection (Hub -> A1 -> A2...).

### Signal Propagation (`heatmap.ts`)
-   Free-space path loss model adapted for obstacles.
-   **Wall Attenuation**: Material-based dB loss (Concrete > Drywall > Glass).

## Folder Structure
-   `/src`: Source code.
    -   `/components`: UI and Canvas layers.
    -   `/store`: Zustand store definition.
    -   `/utils`: Math, Geometry, and Export logic.
    -   `/hooks`: React hooks.
-   `/DOC`: Additional documentation.
