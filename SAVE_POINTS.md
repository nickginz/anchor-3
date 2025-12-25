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
| **Current** | `62f0440` | **Wall Joining & Selection Guard**<br>Fixed wall spikes (wedge logic), resolved disappearance bug, refined Alt+Click/Drag selection for imports. |
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
