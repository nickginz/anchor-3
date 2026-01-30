# Auto-Optimization Logic (Targeting Manual Efficiency)

## Objective
The goal is to automatically generate an anchor layout that matches the efficiency of a human planner, specifically effectively reducing the anchor count to within **±15%** of a user-optimized layout.

## Core Problem
The current "Baseline" algorithm (Offsets/Skeleton) tends to over-provision, placing redundant anchors in:
1.  **Small Rooms**: Often places 2-3 anchors due to shape irregularities (e.g., "Extended" classification).
2.  **Corridors**: excessive density near junctions.
3.  **Large Zones**: Overlaps > 50% due to conservative spacing.

## Proposed Algorithm: "Adaptive Density Control"

### Phase 1: Intelligent Classification (The "Human" View)
Human planners intuitively treat rooms as "Units".
1.  **Unit Cells (< 110m²)**:
    *   **Logic**: Irrespective of shape (L-shape, Square), if the room is a standard office size, it gets **1 Anchor**.
    *   **Placement**: Centroid ( Geometric Center).
    *   *Reduction Impact*: High. Reduces 2-3 anchors per room to 1.

### Phase 2: Spacing Maximization (Large Zones)
For Open Offices (> 110m²), humans maximize spacing to reduce hardware costs while maintaining "Green" heatmaps.
1.  **Spacing Rule**:
    *   Current: `Spacing = Radius * 1.0` (Conservative).
    *   Optimized: `Spacing = Radius * 1.6` (Approaching Hexagonal efficiency).
2.  **Wall Avoidance**:
    *   Humans avoid placing anchors within 1-2m of walls.
    *   **Logic**: Prune any candidate within `1.5m` of a wall unless it is the *only* anchor in that space.

### Phase 3: Global Density Loop
To hit the "±15%" target without knowing the user's specific count beforehand, we use an **Efficiency Heuristic**:

**Target Count Calculation**:
$$ N_{target} \approx \frac{\text{Total Deployment Area}}{\pi \times R^2} \times 1.3 \text{ (Efficiency Factor)} $$

**Optimization Steps**:
1.  **Classify**: Identify all "Compact" rooms and lock 1 anchor per room.
2.  **Generate**: Fill remaining "Large" areas with a Grid.
3.  **Prune**:
    *   Calculate **Inter-Anchor Distance** ($D_{ij}$).
    *   If $D_{ij} < 1.4 \times R$, mark the pair as "Redundant".
    *   Remove the anchor that contributes least to *unique* coverage area.
4.  **Convergence**: Repeat pruning until `Current_Count <= Target_Count + 15%`.

## Summary of Logic Changes
| Feature | Baseline (Current) | Auto-Optimized |
| :--- | :--- | :--- |
| **Small Rooms** | Shape-based (can place multiple) | **Area-based (Strict 1 Centroid)** |
| **Spacing** | ~1.2R (Dense) | **~1.6R (Efficient)** |
| **Priority** | Coverage Continuity | **Hardware Ministimization** |
| **Junctions** | Skelton Nodes (High count) | **Simplified Grid (Low count)** |
