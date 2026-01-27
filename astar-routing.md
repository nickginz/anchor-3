# A* Routing Logic (`src/utils/astar-routing.ts`)

## Overview
The routing engine has been upgraded to a **Track-Based (Channel) Routing** system. This approach mimics professional PCB or CAD routing where cables are bundled onto "highways" (Grid Lines) and organized into parallel "Tracks" to prevent overlap, producing a clean schematic look.

## Core Logic

### 1. Topology Generation (A*)
First, the optimal path for *every* cable is calculated using A* on a coarse 20px grid. 
-   **Obstacles**: Walls and Anchors.
-   **Cable Awareness**: This stage **IGNORES** other cables. All cables wanting to take the same hallway are *encouraged* to do so. This creates logical bundles.
-   **Heuristic**: Manhattan Distance.

### 2. Path Segmentation
Once all logical paths are found, they are broken down into linear segments (Horizontal or Vertical).
e.g., A path `(0,0) -> (100,0) -> (100,50)` becomes:
-   Segment 1: Horizontal, y=0, x=[0, 100]
-   Segment 2: Vertical, x=100, y=[0, 50]

### 3. Track Assignment (The "Bus" Logic)
The system iterates through all segments to assign them physical space.
-   **Grid Line Map**: A map is created for every grid line (e.g., `Vertical:100`).
-   **Tracks**: Each grid line maintains a list of "Tracks" (offset slots).
-   **Allocation Loop**:
    For each segment:
    1.  Start at Track 0.
    2.  Check if this track is "occupied" for the segment's span (e.g., y=[0,50]).
    3.  If occupied, increment to Track 1, Track 2, etc.
    4.  Once an empty track is found, record the segment in that track.

### 4. Rendering
The final coordinates are calculated by offsetting the base grid line.
-   **Offset Calculation**: `FinalCoord = BaseCoord + (TrackIndex * TRACK_SPACING)`
-   **Centering**: Optionally, the bundle is centered around the grid line (e.g., if there are 3 tracks, offsets might be `-4, 0, +4`).

## Benefits
-   **Zero Overlap**: Cables are mathematically guaranteed not to overlap parallel segments.
-   **Clean Visuals**: Produces organized "Ribbon Cables" or "Buses".
-   **Predictability**: Removes the chaotic "detour" behavior of avoidance routing.
