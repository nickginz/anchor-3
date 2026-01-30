# Anchor Planner Application Wiki

## Introduction
Anchor Planner is a specialized web application designed for designing floor plans, placing wireless anchors, and managing architectural layouts. It supports importing external drawings (PDF, DXF, Images), creating walls, and calculating coverage metrics.

---

## 1. Navigation & View Controls
- **Pan**: Hold **Right Mouse Button** or **Middle Mouse Button** and drag to move the canvas.
- **Zoom**: Use the **Mouse Wheel** to zoom in and out.
- **Fit to Screen**: Double-click the **Middle Mouse Button** to automatically center and zoom the view to fit all objects.

---

## 2. Tools & Creation

### Select Tool (`V`)
The default tool for interacting with objects.
- **Click** to select a single object (Wall, Anchor, Dimension).
- **Shift + Click** to select multiple objects.
- **Drag Box** to select multiple objects:
  - **Left-to-Right (Window Select)**: Selects objects strictly *inside* the box.
  - **Right-to-Left (Crossing Select)**: Selects objects *touching* or inside the box.
- **Alt + Click**: Select an Imported Drawing (Image/DXF).
- **Alt + Drag Box**: Select Imported Drawings using the box method.

### Wall Tools
- **Wall (Polyline) (`W`)**: Draws continuous connected walls.
  - Click to set the start point.
  - Click again to set the next point.
  - Press **Esc** or click 'Stop Drawing' in the context menu to finish a chain.
  - **Snap**: Walls snap to existing endpoints and perpendicular/horizontal axes.
- **Wall Rect (`R`)**: Draws a rectangular room with four walls created instantly.

### Wall Configuration
You can customize the thickness presets for walls:
1. Click the **Settings (Gear Icon)** (or "Config") button in the Ribbon.
2. Adjust the values for:
   - **Standard**: Default thickness in meters.
   - **Thick**: Presets for load-bearing walls.
   - **Wide**: Presets for external or special walls.

### Anchor Tools
- **Anchor (Manual) (`A`)**: Places a single wireless anchor point.
  - Click anywhere to place.
  - **Right-Click** an anchor to open its Validation Menu (Set Radius, Shape).
- **Auto Anchor**: Automatically places anchors in the center of detected rooms (requires closed wall loops).

### Dimension Tool (`D`)
- **Smart Dimension**: Click near a wall to automatically dimension it.
- **Two-Point Dimension**: Click two points to measure the distance between them.

### Scale Tool (`S`)
Calibrates the scale of the canvas (Pixels per Meter).
1. Click two points on the drawing where the real-world distance is known.
2. Enter the distance in meters in the popup.
3. The entire project creates/dimensions will update to match this scale.

### Editing Tools
- **Trim**: Removes the segment of a wall between two intersections.
- **Extend**: Extends a wall to meet the next intersecting line.
- **Mirror**: Mirrors selected objects across a defined axis.

---

## 3. Imported Drawings (Reference Layers)

### Supported Formats
- **Images**: `.png`, `.jpg`, `.jpeg`
- **PDF**: `.pdf` (Rendered high-quality to canvas)
- **DXF**: `.dxf` (CAD drawings)

### Working with Imports
- **Single Import Policy**: The app currently focuses on one active reference drawing (DXF) at a time. Importing a new DXF replaces the previous one.
- **Selection**: Hold **Alt** and Click the drawing (or use Alt + Selection Box) to select it. A green contour will appear.
- **Moving**: Select the import (Alt+Click), then **drag** it to position it under your walls.
- **Auto-Sizing**: DXF drawings automatically calculate their bounding box on import for easier selection.

### DXF Layer Manager
When a DXF is imported, the **Layer Manager** panel appears automatically (or can be toggled via the Ribbon).
- Toggle visibility of individual CAD layers (e.g., hide "hatch", show "walls").
- "Show All" / "Hide All" for quick visibility toggles.

---

## 4. Editing & Manipulation

### Node Editing (Wall Endpoints)
- Select a wall to reveal two **Blue Handles** at its endpoints.
- **Drag** a handle to move that corner.
- **Smart Connection**: If the corner connects multiple walls, *all* connecting walls will move together to maintain the junction.
- *Note: Handles are hidden if the **Walls** layer is turned off.*

### Deleting
- Select object(s) and press **Delete** or **Backspace**.
- Works for Walls, Anchors, Dimensions, and Imports (reference drawings).

### Anchors Advanced
- **Context Menu**: Right-click an anchor (or selection of anchors) to:
  - Set Wireless Radius (in meters).
  - Change Shape (Circle/Square representation).
  - Group/Ungroup.
- **Grouping (`Ctrl+G`)**: Groups selected anchors so they have shared properties.
- **Ungrouping (`Ctrl+Shift+G`)**: Separates them.

### Undo / Redo
- **Undo (`Ctrl+Z`)**: Revert the last action (drawing, moving, deleting).
  - *Smart Undo*: If drawing a wall chain, Undo removes the last segment but keeps the drawing session active.
- **Redo (`Ctrl+Y`)**: Reapply the cancelled action.

---

## 5. Keyboard Shortcuts Reference

| Key | Action |
| :--- | :--- |
| `V` | Select Tool |
| `W` | Wall Tool |
| `R` | Wall Rect Tool |
| `A` | Anchor Tool |
| `Shift + A` | Auto Anchor Tool |
| `D` | Dimension Tool |
| `S` | Scale Tool |
| `Delete` / `Backspace` | Delete Selection |
| `Ctrl + Z` | Undo |
| `Ctrl + Y` | Redo |
| `Ctrl + G` | Group Anchors |
| `Ctrl + Shift + G` | Ungroup Anchors |
| `Alt + Click` | Select Import (Image/DXF) |
| `Alt + Drag` | Move Import / Box Select Import |
| `MMB` / `RMB` | Pan View |
| `Scroll` | Zoom View |
| `Double Click MMB` | Fit to Screen |
