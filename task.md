
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

- [ ] **Cable Management**
    - [x] Auto-Routing (A* Orthogonal).
    - [x] Manual Routing (Drag Segments/Vertices).
    - [ ] **Smart Extension**: Auto-extend cables when segments are dragged away from devices.
    - [ ] **Length Tracking**: Real-time length calculation (with vertical drops/slack).
    - [ ] **BOM Integration**: Cable totals in export.
    - [ ] Generate `.dxf` file with proper layers (`WALLS`, `ANCHORS`).
    - [ ] Export Walls as LINES, Anchors as CIRCLES.
- [x] **PDF Export**:
    - [x] **High-Res Generation**: Embeds high-quality canvas capture.
    - [x] **Paper Sizes**: standard sizes (A4-A0) and Orientation.
- [ ] **Advanced PDF Features**:
    - [ ] Vector paths (instead of raster).
    - [ ] PDF Layers.
    - [ ] BOM / Inventory Page.
- [x] **UI Refinement**
  - [x] Remove "ELECTRICAL VIEW" from Cable Routing sidebar.
- [x] **Documentation Updates**
  - [x] Add Anchor Placement explanation to Help & Guide.
  - [x] Add Cable Routing explanation to Help & Guide.
- [x] **Cable Locking**
  - [x] Select a cable and verify `CablePropertiesToolbar` appears
- [x] Lock/Unlock a cable and verify dragging behavior
- [x] Verify "Regenerate Routes" preserves locked cables
- [x] **Debug: Fix Smart Cable Extension and Connectivity**
  - [x] Restore 'dogleg' logic preserved during drag
  - [x] Fix Hub/Anchor disconnection bug
  - [x] Allow cable dragging in 'Select' mode (unlocked only)

### Implement Wall Settings Popup (Width and Material)

Add a dedicated modal for editing wall properties (thickness and material) and integrate it into the wall context menu.

## Proposed Changes

### [Store] [useProjectStore.ts](file:///c:/Users/NikolayGunzburg/Desktop/wall_pro/ANCHOR2/src/store/useProjectStore.ts)
- Add `isWallSettingsOpen: boolean` and `wallSettingsIds: string[]` to the state.
- Add `setIsWallSettingsOpen: (open: boolean, ids?: string[]) => void` action.

### [UI Components] [NEW] [WallSettingsModal.tsx](file:///c:/Users/NikolayGunzburg/Desktop/wall_pro/ANCHOR2/src/components/UI/Modals/WallSettingsModal.tsx)
- Create a premium-looking modal using the project's design system.
- Include a numeric input for wall thickness (meters).
- Include a dropdown/select for wall material (Concrete, Drywall, Brick, Metal, Wood, Glass).
- Use `updateWall` from the store to apply changes.

### [UI Components] [App.tsx](file:///c:/Users/NikolayGunzburg/Desktop/wall_pro/ANCHOR2/src/App.tsx)
- Render `WallSettingsModal` alongside other global modals.

### [Canvas] [InteractionLayer.tsx](file:///c:/Users/NikolayGunzburg/Desktop/wall_pro/ANCHOR2/src/components/Canvas/InteractionLayer.tsx)
- Add a "Properties..." menu item to the wall context menu.
- The "Properties..." action will call `setIsWallSettingsOpen(true, targetIds)`.

## Verification Plan

### Automated Tests
- N/A (UI-centric change)

### Manual Verification
1.  Draw a few walls.
2.  Right-click on a wall to open the context menu.
3.  Select "Properties...".
4.  Verify that the `WallSettingsModal` appears.
5.  Change the material and thickness and click "Apply/Done".
6.  Verify that the wall's appearance changes (if material changed) and its thickness is updated on the canvas.
7.  Check the Bill of Materials (BOM) to verify updated properties are reflected.

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
- [x] **Save/Load Project**:
    - [x] Save full state to `.json`.
    - [x] Load project from `.json`.
- [x] **Example Projects Integration**:
    - [x] Copy project files to public directory.
    - [x] Add "Samples" section to `SlotManager`.
    - [x] Implement fetch-and-load logic.

### Analysis Module
- [ ] **Signal Heatmap**:
    - [ ] Simulate signal attenuation based on wall materials.
    - [ ] Render color-coded heatmap overlay.
- [ ] **Coverage Zones**:
    - [ ] Visual indicator of "Good/Bad" coverage areas.
- [x] **Smart Cable Extension**
  - [x] Enable individual segment dragging (orthogonal constraint).
  - [x] Auto-insert corners when dragging breaks orthogonality.
  - [x] Snap/Bridge connections to devices when dragging ends.
  - [x] Fix "Freezing" issue during drag (implemented `useRef` for stability).

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
