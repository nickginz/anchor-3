# Comprehensive Functionality Test Plan

## 1. Drawing Tools
- [x] **Linear Wall**: Draw a wall segment. (Success)
- [x] **Rectangular Wall**: Draw a box. (Success)
- [x] **3-Point Wall**: Draw a 3-point rectangle. (Success)
- [x] **Wall Locking**: Lock walls, try to select/move (should fail), unlock. (Success)

## 2. Edit & Manipulation
- [ ] **Selection**: Select a wall.
- [x] **Undo/Redo**: Draw -> Undo (gone) -> Redo (back). (Success)

## 3. Devices (Anchors & Network)
- [x] **Manual Anchor**: Place an anchor. (Success)
- [x] **Auto-Placement Sidebar**: Toggle open/close. (Success)
- [x] **Anchor Settings**: Change radius, toggle "Show Radius". (Success)
- [x] **Hub Placement**: Place a hub. (Success)
- [x] **Hub Settings**: Change capacity in dropdown. (Success)

## 4. Measurement & Scaling
- [x] **Dimension Tool**: Measure a distance. (Success)
- [x] **Scale Tool**: Click tool, verify prompt/instruction appears. (Success)

## 5. View & Layers
- [x] **Layer Toggles**: Toggle 'Walls', 'Anchors' visibility. (Success)
- [x] **Heatmap**: Toggle Heatmap on/off. (Success)

## 6. Project Management
- [x] **BOM**: Open BOM modal, close. (Success)
- [x] **Slots**: Open Slots panel, close. (Success)
- [x] **Save As**: Click button, verify download trigger. (Success)
- [x] **New Project**: Trigger "Save Prompt", checking Cancel/Discard/Save flows. (Success)
