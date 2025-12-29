
# Application Functionality Status

## ✅ Core Drafting & Editing
- [x] **Wall Tools**
    - [x] Draw Linear Walls (Polyline).
    - [x] Draw Rectangular Rooms.
    - [x] Wall Thickness Presets (Standard, Thick, Wide).
    - [x] Wall Styling (Color/Stroke).
    - [x] **Node Editing**: Drag wall endpoints to resize/reconnect.
    - [x] **Snapping**: Snap to corners and grid (respects visibility).
- [x] **Anchor Network**
    - [x] Manual Anchor Placement.
    - [x] Auto-Place Anchors (Grid/Coverage logic).
    - [x] **Grouping**: Group/Ungroup anchors (Ctrl+G).
    - [x] **Customization**: Individual Radius & Shape (Circle/Square).
    - [x] **Context Menu**: Right-click options for anchors.
- [x] **Dimensioning**
    - [x] Smart Wall Dimensions (Auto-snap to walls).
    - [x] Free Dimensions (Measure any distance).
    - [x] **Interactive**: Drag text labels and dimension lines.
- [x] **Editing Operations**
    - [x] Selection (Single Click, Shift+Click, Box Selection).
    - [x] Move/Drag Objects (Walls, Anchors, Dimensions).
    - [x] Delete (Del/Backspace).
    - [x] **Undo/Redo**: Full history support for all actions.
    - [x] **Scale**: Set custom scale ratio (px to meters).

## ✅ Import System
- [x] **Multi-File Support**: Import multiple files into one project.
- [x] **Formats**:
    - [x] Images (PNG, JPG, JPEG).
    - [x] PDF (Converted to high-res image).
    - [x] DXF (Parsed layers and entities).
- [x] **Management**:
    - [x] **Movable Imports**: Drag/Position imported plans (`Alt + Drag`).
    - [x] **DXF Layer Manager**: Toggle specific DXF layers.
    - [x] **Unified Import**: Single button for all formats.
    - [x] **Selection Guard**: Restricted selection of imported drawings to `Alt + Click` only.

## ✅ View & Navigation
- [x] **Canvas Controls**:
    - [x] Zoom (Mouse Wheel).
    - [x] Pan (Right-Mouse Button Drag).
    - [x] Zoom Extents (Fit to Screen).
- [x] **Layer Visibility System**:
    - [x] Toggle Walls, Anchors, Dimensions, Imports.
    - [x] **Interaction Guard**: Hidden layers are strictly non-selectable/non-interactive.
- [x] **UI Elements**:
    - [x] Ribbon Toolbar (Tabbed style).
    - [x] Configuration Modals (Wall Widths, Anchor Settings).

## 🚀 Planned (To Do)

### Export System
- [ ] **Image Export**:
    - [ ] Export Viewport (PNG/JPG).
    - [ ] High-Resolution support.
- [ ] **DXF Export (CAD)**:
    - [ ] Generate `.dxf` file with proper layers (`WALLS`, `ANCHORS`).
    - [ ] Export Walls as LINES, Anchors as CIRCLES.
- [ ] **PDF Export (Report)**:
    - [ ] **Vector Generation**: Draw sharp lines/text (not just screenshot).
    - [ ] **PDF Layers**: Toggleable layers inside the PDF.
    - [ ] **BOM Page**: Appendix with inventory/coordinates.

### Debugging & Fixes (Priority)
- [x] **DXF Interaction**:
    - [x] Investigate why DXF objects cannot be selected/moved.
    - [x] Ensure `InteractionLayer` blindly hits DXF entities or specialized logic exists.
    - [x] Fix Selection/Transform for DXF imports.

### Feature Enhancements
- [x] **Wall Splitting**:
    - [x] Update `geometry.ts` to return Edge Snaps.
    - [x] Implement `splitWall` in Store.
    - [x] Integrate Splitting into `InteractionLayer` wall drawing.
- [x] **Seamless Wall Connections**:
    - [x] Analyze invalid rendering of joints.
    - [x] Implement robust corner/intersection geometry generation.
    - [x] Ensure styling (fill/stroke) looks unified.
    - [x] **Regression Fix**: Resolved wall disappearance bug (zero-length segments/robust fallback).
    - [x] **Visual Fix**: Eliminated "Spike" artifacts by restricting filler wedges to outer convex corners.

### Project Management
- [ ] **Save/Load Project**:
    - [ ] Save full state to `.json`.
    - [ ] Load project from `.json`.

### Analysis Module
- [ ] **Signal Heatmap**:
    - [ ] Simulate signal attenuation based on wall materials.
    - [ ] Render color-coded heatmap overlay.
- [ ] **Coverage Zones**:
    - [ ] Visual indicator of "Good/Bad" coverage areas.

### Automation
- [ ] **Wall Detection**:
    - [x] Auto-detect walls from imported images/drawings.
    - [x] Convert pixels to interactive Wall objects.
    - [x] **Fix White Screen Crash** (Fixed type-only import).
    - [x] **Wall Merging**: Stitch fragmented wall segments.
    - [x] **UI Improvements**: Add Pan/Zoom to detection preview.
    - [x] **Diagonal Support**: Allow non-orthogonal walls (User Request).
    - [x] **Interactive Mask Editing**: Paint/Erase mask before detection. (Disabled in UI)
    
### Room & Validation Refinements
- [x] **Refining Rooms**:
     - [x] Dynamic scaling for room text.
     - [x] Independent toggle for Fill and Label visibility.
- [x] **Open Wall Validation**:
     - [x] **Open Wall Indicators**: Red Ring (fixed px size) at unconnected wall ends.
     - [x] **Unified Toggle**: Walls toggle controls Rooms and Labels.
- [x] **Interaction**:
     - [x] **Endpoint Snapping**: Snap to other geometry when dragging existing wall endpoints.
