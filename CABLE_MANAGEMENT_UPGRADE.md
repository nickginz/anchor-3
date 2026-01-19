# Cable Management & Routing Upgrade

## Overview
This document outlines the technical specification for the advanced Cable Management System, designed to automate the connection of anchors to network hubs using smart, orthogonal routing algorithms.

## 1. Network Topologies
The system supports two primary network topologies, selectable via the UI:

### A. Star Topology
- **Logic**: Each Anchor connects directly to the nearest available Hub.
- **Use Case**: Performance-critical deployments requiring dedicated bandwidth per anchor.
- **Constraints**: Higher cable usage; requires sufficient hub ports.

### B. Daisy-Chain Topology (Linear/Loop)
- **Logic**: Anchors are chained together in series (A1 -> A2 -> A3 -> Hub).
- **Use Case**: Evaluating cable efficiency; minimizing total cable length.
- **Constraints**: Latency accumulation; single point of failure (if linear).

## 2. Hub Management
- **Capacity**: Configurable hub models (2, 6, 12, or 24 ports).
- **Placement**: Manually placed "Hub" objects (separate from Anchors).
- **Validation**:
  - The system tracks used/available ports.
  - Basic visual feedback (Red/Green status) for capacity.

## 3. Smart Orthogonal Routing
The core routing engine (`src/utils/routing.ts`) implements intelligent pathfinding to create clean, professional-looking cable runs.

### Algorithm: "Cost-Based Orthogonal Path"
The router evaluates multiple potential paths between two points (Start -> End) and selects the best one based on:
1.  **Intersection Cost**: Minimizing the number of wall crossings.
2.  **Bend Cost**: Preferring simpler shapes (L-Shape) over complex ones (Z-Shape) if they are equally valid.

### Supported Path Shapes
1.  **L-Shapes (1 Bend)**:
    - *Horizontal first*: `Start -> (End.x, Start.y) -> End`
    - *Vertical first*: `Start -> (Start.x, End.y) -> End`
2.  **Z-Shapes (2 Bends)**:
    - Scans for "gaps" (e.g., doors) in walls to thread cables through without drilling.
    - Iterates split ratios (middle X or middle Y) to find the obstruction-free path.

## 4. Cable Representation
- **State**: Cables are stored in `useProjectStore` as `Cable` objects.
- **Properties**:
  - `points`: Array of polyline vertices.
  - `lengthM`: Calculated length in meters (including vertical drops/service loops).
  - `type`: 'cat6', 'fiber', 'power'.
- **Persistence**: Cables are saved/loaded with the project JSON.

## 5. Technical Stack
- **Routing Engine**: Custom geometric solver (`src/utils/routing.ts`).
- **Store**: Zustand (`useProjectStore`).
- **Rendering**: Canvas/Konva (`CablesLayer`).
