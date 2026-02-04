# Smart Reduction Logic

Smart Reduction is a post-processing step that optimizes anchor placement by removing redundant units while maintaining coverage. It targets specific room sizes ("Small" vs "Big") using distinct strategies tailored to those environments.

## 1. Scope & Targeting

*   **Small Rooms**: Area < 80 m²
*   **Big Rooms**: Area ≥ 80 m² (Includes anchors in corridors or open spaces not confined to small rooms)
*   **Auto-Anchors Only**: The reduction logic **only** affects auto-placed anchors. locked/manual anchors are preserved and serve as "static" context for coverage calculations.

## 2. Reduction Targets

The user selects a reduction percentage (5%, 10%, 15%, 20%). The system calculates the target number of anchors to remove based on the total count of *auto-placed* anchors in the selected scope (Small, Big, or All).

*   **Count**: `floor(Total_Scope_Anchors * Percentage)`

## 3. Reduction Strategy: Small Rooms

In small rooms, signal saturation is common. The strategy balances coverage (signal strength) with efficiency (removing crowded units).

Candidates are ranked for removal based on the following priorities (in order):

1.  **High Signal Redundancy (strongest first)**:
    *   We calculate a "Signal Score" for each anchor (proxy: sum of inverse distances to the room centroid).
    *   Anchors providing the highest excessive signal are preferred for removal.
2.  **Crowding (closest neighbors first)**:
    *   We calculate the sum of distances to the 2 closest neighbors in the same room.
    *   Anchors with closer neighbors (smaller sum) are preferred for removal.
3.  **Room Size (smallest first)**:
    *   Anchors in smaller rooms are preferred for removal as coverage is easier to maintain with fewer units.
4.  **Overlaps (most overlaps first)**:
    *   Anchors with high overlap counts are preferred.

## 4. Reduction Strategy: Big Rooms

In large spaces, uniform distribution is key. The strategy focuses purely on relieving density "hotspots".

1.  **Crowding (closest neighbors first)**:
    *   For each anchor, we sum the distance to its 2 closest neighbors in the "Big Room" pool.
    *   Anchors with the **smallest sum** (most crowded) are removed first.
    *   Solitary anchors (no close neighbors) are protected.

## Summary Table

| Feature | Small Rooms (<80m²) | Big Rooms (≥80m²) |
| :--- | :--- | :--- |
| **Primary Goal** | Remove signal saturation | Relieve density hotspots |
| **Metric 1** | **Signal Strength** (Remove strongest) | **Crowding** (Remove most crowded) |
| **Metric 2** | **Crowding** (Remove most crowded) | N/A |
| **Metric 3** | **Room Area** (Remove from smallest room) | N/A |
