# Wall Pro - User Manual

## Overview
Wall Pro is a specialized CAD-like tool for designing Wi-Fi/signal coverage layouts. It allows you to draw walls, place anchors (access points) and hubs, route cables, and analyze signal coverage.

## Getting Started

### 1. Interface Basics
- **Ribbon (Top)**: Contains all tools (Walls, Anchors, Hubs, Layers).
- **Canvas (Center)**: Your main workspace. Pan with Right-Click drag, Zoom with Scroll Wheel.
- **Properties (Right)**: Shows details for selected objects.
- **Slots (Top Right)**: Quick Save/Load project slots.

### 2. Drawing Walls
1.  Select the **Wall Tool** from the ribbon (or press `W`).
2.  Click to start, clicked again to place corners.
3.  Press `Esc` to stop the chain.
4.  **Edit**: Select a wall (Left-Click) to see handles (Blue dots). Drag handles to move endpoints.
5.  **Types**: Right-click a wall to change its material (Concrete, Drywall, Glass, etc.).

### 3. Placing Components
-   **Anchors (Access Points)**: Press `A`. Click to place.
    -   *Auto-Placement*: Toggle "Auto" in the Anchor dropdown to let the system optimize placement.
-   **Hubs (Switches)**: Press `H`. Click to place.
-   **Cables**: Select "Cable Edit" tool. Click a Hub/Anchor to start, click another valid device to connect.

### 4. Selection & Editing
-   **Select**: Press `V` or click the Select tool. Click objects or box-select.
-   **Shortcuts**:
    -   `Delete` / `Backspace`: Remove selected items.
    -   `Ctrl+Z`: Undo.
    -   `Ctrl+Y`: Redo.
    -   `Esc`: Cancel current tool or deselect.
    -   `W`/`A`/`H`/`V`: Tool shortcuts.

### 5. Exporting
Open the **Export Panel** (Sidebar) to generate reports.
-   **Output**: PDF or PNG.
-   **Region**: Export the "Full Canvas" or draw a specific "Export Area".
-   **Settings**: Tweak DPI (Resolution) and page orientation.

## Advanced Features
-   **Quick Save**: Use the numbered slots (1-5) to save multiple versions.
    -   *Tip*: Green slot = Saved. Gray slot = Empty.
-   **Import**: Use the Import tab to load DXF floorplans or Background Images.
-   **Layers**: Toggle visibility of Walls, Heatmap, or Cables via the "Layers" dropdown.

## Troubleshooting
-   **"Cannot Drag Wall?"**: Ensure the wall is selected (Blue handles visible). Also check if "Lock Walls" is enabled in settings.
-   **"Shortcuts not working?"**: The app uses physical key positions (QCWERTY standard), so shortcuts work regardless of keyboard language.
