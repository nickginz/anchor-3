# Project Save Points

This document tracks manual save points (Git Commits) created during development. You can revert to any of these points if a critical failure occurs.

## How to Revert
To revert the project to a specific save point, open a terminal in the project directory and run:

```powershell
git reset --hard <COMMIT_HASH>
```

**WARNING:** This will discard all changes made *after* that save point.

## Save History

| Date | Commit Hash | Description |
| :--- | :--- | :--- |
| **Current** | `a3d0b14` | **Optimization Fixes & Gap Filling**<br>Fixed small room density optimization (geometry consistency), restored area constraints for optimization (All-Room scope), applied skeleton logic to complex small rooms (>3 joints), and implemented Big Room Gap Filling for coverage holes >8m from offsets. |
| Previous | `04cff5c` | **Placement Area Refinement**<br>Refined Placement Area behavior: Default OFF, Strict Containment for Auto-Placement & Optimization (only affects anchors inside area). Updated UI: split Eye toggle from Tool button, icon-only tool button. Fixed drag event bubbling. |
| Previous | `0a8a874` | **Large Room Logic V2**<br>Completely rewrote Large Room auto-placement logic. Now strictly uses offset layers (1x, 3x, 5x steps) with anchors at corners and symmetrical edge filling (max overlap 1.5m). Removed legacy skeleton logic for large rooms. |
| Previous | `baf901e` | **Skeleton Simplification & Chain Decomposition**<br>Implmented tri-state Skeleton toggle (Off/Full/Simplified). Rewrote simplification logic to use Chain Decomposition: preserves main arteries, prunes short spurs (<3m), and straightens lines. |
| Previous | `c12f9ce` | **Fixed Signal Attenuation**<br>Removed hardcoded attenuation on wall creation/modification, allowing material defaults to function properly. Fixed Selection Panel to clear attenuation override on material change. |
| Previous | `cc68747` | **Auto-Placement V2 (Medial Axis & Topology)**<br>Implemented Voronoi-based medial axis skeletonization, multi-layer Euclidean offsets (ClipperLib), and gap-filling logic. Resolved critical "Invalid Hook" and "Black Screen" (Geodesic/Turf) issues. Unified dimension tool (Click/Drag) and selection safety. |
| Previous | `e51da2a` | **Auto-Placement Refinement & Wall Tools**<br>Fixed Load button interaction, refined Corridor detection, and added valid JSON checks. Added Snapping/Edge support for all wall tools. |
| Previous | `f65b037` | **Room & Validation Refinements**<br>Added Red Ring indicators for open wall ends. Implemented independent room label logic & scaling. Unified toggle for walls/rooms. |
| Previous | `62f0440` | **Wall Joining & Selection Guard**<br>Fixed wall spikes (wedge logic), resolved disappearance bug, refined Alt+Click/Drag selection for imports. |
| Previous | `c3de4c5` | **Layer Visibility Protection**<br>Secured hidden layers (Walls, Anchors, Dimensions) from selection, snapping, and dragging. Updated Wiki. |
| Previous | `9346412` | **Imports & Editing Overhaul**<br>Fixed PDF (Worker) & DXF imports, added Alt+Click/Drag & Box Selection for imports, Single DXF mode, Delete key, and Wall Endpoint Handles (Node Editing). |
| Previous | `38beefc` | **Refined Undo/Redo & Dragging**<br>Optimized drag history (Start/End only), Smart Wall Undo (keeps cursor), and Drag Commit. |
| Previous | `ce8572c` | **Anchor Grouping & Refinements**<br>Added grouping (Ctrl+G), context menu separators, smart RMB click vs pan, and Undo/Redo. |
| Previous | `5bd7ed4` | **Implemented Individual Anchor Settings**<br>Added right-click context menu, custom radius, and shape overrides. |
| Previous | `9c49389` | **Manual Save Point**<br>Previous working state before anchor settings. |

## Creating New Save Points
To create a new save point manually (if not done by the assistant):

```powershell
git add .
git commit -m "Manual Save Point: <Description>"
```
