import type { Wall, Anchor } from '../types';
import { detectRooms, calculatePolygonArea } from './room-detection';
import { dist, getPolygonCentroid, getPolygonBBox, isPointInPolygon } from './geometry';
import type { Point } from './geometry';
import { generateOffsets, generateMedialAxis } from './geometry-tools';
import * as turf from '@turf/turf';

// Types
export interface PlacementOptions {
    radius: number; // Detection radius in meters
    shape?: 'circle' | 'square' | 'triangle' | 'star' | 'hex'; // Anchor shape
    showRadius?: boolean; // Show coverage radius
    minOverlap: number; // Min required overlap count
    wallThickness: number; // For avoiding walls
    scaleRatio: number; // Pixels per meter
    spacingFactor?: number; // Usage depends on algorithm
    // New Targeting & Optimization
    targetScope?: 'small' | 'large' | 'all';
    coverageTarget?: number; // 50-100%
    minSignalStrength?: number; // -90 to -40 dBm
    placementArea?: Point[]; // Optional polygon for filtering
    placementAreaEnabled?: boolean; // New flag
}

interface ProcessedRoom {
    poly: Point[];
    areaM2: number;
    maxEdgeLengthM: number;
    type: 'compact' | 'extended' | 'large';
    medialAxis: Point[][];
    medialFeats: any[];
    stitchedAxis: Point[][];
    bbox: { minX: number, maxX: number, minY: number, maxY: number, width: number, height: number };
    fillFactor: number;
}

type Priority = 'critical' | 'high' | 'normal';

interface Candidate {
    p: Point;
    priority: Priority;
}

// Main Function: Advanced Auto-Placement (V2)
export const generateAutoAnchors = (walls: Wall[], options: PlacementOptions, existingAnchors: Point[] = []): Omit<Anchor, 'id'>[] => {
    const { radius, scaleRatio, targetScope = 'all' } = options;

    // Optimization Factors
    // 1. Min Signal (dBm): Lower (e.g. -90) = Accept larger spacing. Higher (-40) = Tighter spacing.
    // Map -90...-40 to a spacing multiplier?
    // Let's rely on radius for drop-off calculation mostly, but adjust 'spacingFactor' based on coverageTarget.

    // 2. Coverage Target (%): Higher = Tighter spacing
    // Base overlap 1.9 (approx). 100% coverage might need 1.4-1.5 (closer to sqrt(2) or less). 
    // 50% coverage might allow 2.5.
    let densityMult = 1.0;

    // 1. Coverage Factor (50% -> 1.3x, 100% -> 0.7x)
    let coverageMod = 1.0;
    if (options.coverageTarget) {
        coverageMod = 1.3 - ((options.coverageTarget - 50) / 50) * 0.6;
    }

    // 2. Signal Factor (-90 -> 1.2x, -40 -> 0.6x)
    let signalMod = 1.0;
    if (options.minSignalStrength) {
        // Normalize -90...-40 to 0...1
        const norm = (options.minSignalStrength + 90) / 50;
        signalMod = 1.2 - (norm * 0.6);
    }

    if (options.coverageTarget && options.minSignalStrength) {
        densityMult = (coverageMod + signalMod) / 2;
    } else if (options.coverageTarget) {
        densityMult = coverageMod;
    } else if (options.minSignalStrength) {
        densityMult = signalMod;
    }

    // Target Spacing for Fill Logic
    const baseFactor = options.spacingFactor || 1.9;
    const factor = baseFactor * densityMult;

    const spacingMeters = Math.max(3, factor * radius);
    const spacingPx = spacingMeters * scaleRatio;
    const snapDistPx = 1.5 * scaleRatio;

    // Detect Rooms
    const rawRooms = detectRooms(walls);

    // Global Accumulator for Candidates
    const candidates: Candidate[] = [];

    const finalAnchors: Omit<Anchor, 'id'>[] = [];

    // Helper: Robust Graph Stitching
    const buildRobustGraph = (segments: Point[][], snapRadius: number): Point[][] => {
        const uniquePoints: Point[] = [];

        const getSnapped = (p: Point): Point => {
            for (const up of uniquePoints) {
                if (dist(p, up) < snapRadius) return up;
            }
            uniquePoints.push(p);
            return p;
        };

        // Pre-Process: Flatten and Cluster all points to find true nodes
        const allPoints = segments.flat();
        // Naive clustering O(N^2) - N is small per room
        const finalCoords: Point[] = [];
        const mapOriginalToFinal = new Map<Point, Point>();

        allPoints.forEach(p => {
            let found = false;
            for (const fc of finalCoords) {
                if (dist(p, fc) < snapRadius) {
                    mapOriginalToFinal.set(p, fc);
                    found = true;
                    break;
                }
            }
            if (!found) {
                finalCoords.push(p);
                mapOriginalToFinal.set(p, p);
            }
        });

        const snappedSegments: Point[][] = [];
        segments.forEach(seg => {
            const p1 = mapOriginalToFinal.get(seg[0])!;
            const p2 = mapOriginalToFinal.get(seg[1])!;
            if (p1 !== p2) { // Remove zero length
                snappedSegments.push([p1, p2]);
            }
        });

        const adj = new Map<Point, Point[]>();
        snappedSegments.forEach(seg => {
            const [p1, p2] = seg;
            if (!adj.has(p1)) adj.set(p1, []);
            if (!adj.has(p2)) adj.set(p2, []);
            if (!adj.get(p1)!.includes(p2)) adj.get(p1)!.push(p2);
            if (!adj.get(p2)!.includes(p1)) adj.get(p2)!.push(p1);
        });

        const nodes: Point[] = [];
        adj.forEach((neighbors, p) => {
            if (neighbors.length !== 2) nodes.push(p);
        });

        if (nodes.length === 0 && adj.size > 0) {
            nodes.push(adj.keys().next().value!);
        }

        const edges: Point[][] = [];
        const visitedEdges = new Set<string>();
        const pointKey = (p: Point) => `${Math.round(p.x)},${Math.round(p.y)}`;

        const edgeKey = (p1: Point, p2: Point) => {
            // Order independent
            const k1 = pointKey(p1);
            const k2 = pointKey(p2);
            return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
        };

        nodes.forEach(startNode => {
            const neighbors = adj.get(startNode)!;
            neighbors.forEach(firstStep => {
                const k = edgeKey(startNode, firstStep);
                if (visitedEdges.has(k)) return;

                const currentPath: Point[] = [startNode, firstStep];
                visitedEdges.add(k);

                let prev = startNode;
                let curr = firstStep;

                while (true) {
                    if (nodes.includes(curr)) break;

                    const nexts = adj.get(curr)!;
                    const next = nexts.find(n => n !== prev);

                    if (!next) break;

                    const nextK = edgeKey(curr, next);
                    if (visitedEdges.has(nextK)) break;
                    visitedEdges.add(nextK);

                    currentPath.push(next);
                    prev = curr;
                    curr = next;
                }
                edges.push(currentPath);
            });
        });

        return edges;
    };

    // Global Candidate Adder
    const addCandidate = (p: Point, priority: Priority = 'normal', customThreshold?: number) => {
        if (!p || isNaN(p.x) || isNaN(p.y)) return;
        const dedupTolerance = 1.0 * scaleRatio;

        if (candidates.some(c => dist(c.p, p) < dedupTolerance)) return;

        if (priority !== 'critical') {
            const overlapThreshold = customThreshold || (radius * scaleRatio * 1.2);
            if (candidates.some(c => dist(c.p, p) < overlapThreshold)) return;
        }

        candidates.push({ p, priority });
    };

    const fillGaps = (p1: Point, p2: Point, thresholdPx: number, targetSpacingPx: number) => {
        const d = dist(p1, p2);
        if (d > thresholdPx) {
            const numSegments = Math.ceil(d / targetSpacingPx);
            const stepX = (p2.x - p1.x) / numSegments;
            const stepY = (p2.y - p1.y) / numSegments;
            for (let k = 1; k < numSegments; k++) {
                const p = { x: p1.x + stepX * k, y: p1.y + stepY * k };
                addCandidate(p, 'normal');
            }
        }
    };

    // Pre-process and categorize rooms
    const processedRooms: ProcessedRoom[] = [];
    rawRooms.forEach(roomPoly => {
        if (roomPoly.length < 3) return;

        // BBox and Area (Use shared implementations for consistency with RoomsLayer)
        const bbox = getPolygonBBox(roomPoly);
        const bboxArea = bbox.width * bbox.height;

        const areaPx = Math.abs(calculatePolygonArea(roomPoly));
        const areaM2 = areaPx / (scaleRatio * scaleRatio);
        const fillFactor = areaPx / bboxArea;

        // Medial Axis
        const medialAxis = generateMedialAxis(roomPoly, 2);
        const medialFeats = medialAxis.map(seg => turf.lineString(seg.map(p => [p.x, p.y])));

        // Increased Snap Radius to 20px (approx 0.5m-1m) for robustness
        const stitchedAxis = buildRobustGraph(medialAxis, 20);

        // Metric: Max Topology Distance (Edge Length)
        let maxEdgeLengthM = 0;
        stitchedAxis.forEach(path => {
            let len = 0;
            for (let i = 0; i < path.length - 1; i++) len += dist(path[i], path[i + 1]);
            const m = len / scaleRatio;
            if (m > maxEdgeLengthM) maxEdgeLengthM = m;
        });

        // CLASSIFICATION (Shape Analysis + Topology)
        let type: ProcessedRoom['type'] = 'large';

        if (areaM2 <= 110) {
            // Safety Override: Very small rooms
            if (areaM2 < 40) {
                type = 'compact';
            } else {
                // Shape Analysis
                // const fillFactor = areaPx / bboxArea; // Already calculated
                const aspectRatio = Math.max(bbox.width, bbox.height) / Math.min(bbox.width, bbox.height);

                if (fillFactor > 0.85) {
                    // Convex Room (Square/Rect)
                    if (aspectRatio < 3.0) {
                        // Square or Short Rect -> Center
                        type = 'compact';
                    } else {
                        // Long Corridor -> Joints
                        type = 'extended';
                    }
                } else {
                    // Complex Shape (L, T, U) -> Rely on Medial Axis Topology Check
                    type = maxEdgeLengthM < 13 ? 'compact' : 'extended';
                }
            }
        }


        processedRooms.push({
            poly: roomPoly,
            areaM2,
            maxEdgeLengthM,
            type,
            medialAxis,
            medialFeats,
            stitchedAxis,
            bbox,
            fillFactor
        });
    });

    // Sort order: Small rooms first
    processedRooms.sort((a, b) => {
        const order = { 'compact': 1, 'extended': 2, 'large': 3 };
        return order[a.type] - order[b.type];
    });

    processedRooms.forEach(room => {
        const { poly: roomPoly, type, bbox, areaM2, medialAxis, medialFeats, stitchedAxis } = room;

        // --- SCOPE FILTERING ---
        if (targetScope === 'small') {
            // Include 'compact' and 'extended' (since extended < 110m2 usually, check logic)
            // Logic: areaM2 <= 110 is classified as compact/extended.
            if (areaM2 > 110) return;
        } else if (targetScope === 'large') {
            if (areaM2 <= 110) return;
        }
        // 'all' includes everyone

        // --- AREA FILTERING ---
        // Only if Area exists AND is Enabled
        if (options.placementArea && options.placementArea.length > 2 && options.placementAreaEnabled !== false) {
            // Create Turf Polygon for Area
            const areaCoords = options.placementArea.map(p => [p.x, p.y]);
            // Close loop
            if (areaCoords[0][0] !== areaCoords[areaCoords.length - 1][0] || areaCoords[0][1] !== areaCoords[areaCoords.length - 1][1]) {
                areaCoords.push(areaCoords[0]);
            }
            // Safely try to create polygon
            try {
                const areaPoly = turf.polygon([areaCoords]);

                // Create Polygon for Room
                const roomCoords = roomPoly.map(p => [p.x, p.y]);
                if (roomCoords[0][0] !== roomCoords[roomCoords.length - 1][0] || roomCoords[0][1] !== roomCoords[roomCoords.length - 1][1]) {
                    roomCoords.push(roomCoords[0]);
                }
                const roomTurf = turf.polygon([roomCoords]);

                // Check intersection
                if (!turf.booleanIntersects(areaPoly, roomTurf)) {
                    return; // Skip room if outside area
                }
            } catch (e) {
                console.warn("[AutoPlacement] Error checking area intersection", e);
            }
        }



        // --- SMALL ROOM LOGIC ---
        // 1. COMPACT ROOMS
        if (type === 'compact') {
            const center = getPolygonCentroid(roomPoly);
            addCandidate(center, 'critical');
            console.log(`[AutoPlacement] Room (Center): ${center.x}, ${center.y}`);
            return;
        }

        // 2. EXTENDED & LARGE ROOMS: Topological (Skeleton) Logic
        if (type === 'extended' || type === 'large') {
            const roomCandidates: Point[] = [];

            const addLocal = (p: Point) => {
                if (!p || isNaN(p.x) || isNaN(p.y)) return;
                roomCandidates.push(p);
            };

            let centerForFallback: Point | null = null;
            // Extended Room Logic: Topology Degree Analysis

            // 2. Identification of JOINTS (high priority) and ENDPOINTS (low priority)
            const joints: Point[] = [];
            const endpoints: Point[] = [];

            // 2.a Raw Medial Axis Analysis (Robustness against graph simplification)
            // Use the raw medial axis segments to find convergence points (Degree >= 3)
            // This handles cases where buildRobustGraph might have simplified/snapped the Y-junction away.
            const rawNodeCounts = new Map<string, number>();
            const rawNodeMap = new Map<string, Point>();
            const getRawKey = (p: Point) => `${Math.round(p.x / 5)},${Math.round(p.y / 5)}`; // Grid snap 5px

            medialAxis.forEach(seg => {
                seg.forEach(p => {
                    const k = getRawKey(p);
                    rawNodeCounts.set(k, (rawNodeCounts.get(k) || 0) + 1);
                    // Running average for position? Or just first one.
                    if (!rawNodeMap.has(k)) rawNodeMap.set(k, p);
                });
            });

            // If a raw node appears in 3 different segments (start/end or continuous?), it's a junction.
            // Wait, medialAxis from voronoi is segments. Junctions are shared endpoints.
            // A junction of 3 paths will have 3 segments meeting there.
            // So counts should be >= 3?
            // Actually medialAxis might be continuous polylines?
            // Type is Point[][]. "medialAxis" variable comes from `generateMedialAxis`.
            // Let's assume it returns segments.

            rawNodeCounts.forEach((count, k) => {
                // Note: Simple segments share endpoints, so count=2 is a simple connection.
                // Count >= 3 implies a T or Y junction.
                if (count >= 3) {
                    joints.push(rawNodeMap.get(k)!);
                }
            });

            // 2.a.2 SECONDARY PASS: Spatial Clustering (Robust Fallback)
            // If the grid-based approach above failed (due to alignment), try clustering by distance.
            const rawEndpoints: Point[] = [];
            medialAxis.forEach(seg => {
                if (seg.length > 0) {
                    rawEndpoints.push(seg[0]);
                    rawEndpoints.push(seg[seg.length - 1]);
                }
            });

            const jointTolerancePx = 20; // 20px clustering tolerance
            const potentialJoints: { center: Point, count: number }[] = [];

            rawEndpoints.forEach(p => {
                let found = false;
                for (const cluster of potentialJoints) {
                    if (dist(p, cluster.center) < jointTolerancePx) {
                        cluster.count++;
                        cluster.center.x = (cluster.center.x * (cluster.count - 1) + p.x) / cluster.count;
                        cluster.center.y = (cluster.center.y * (cluster.count - 1) + p.y) / cluster.count;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    potentialJoints.push({ center: { ...p }, count: 1 });
                }
            });

            potentialJoints.forEach(cluster => {
                // If 3 or more segments end here, it's a junction (T/Y/Cross)
                if (cluster.count >= 3) {
                    // Check if we already added something close?
                    if (!joints.some(j => dist(j, cluster.center) < jointTolerancePx)) {
                        joints.push(cluster.center);
                        console.log(`[AutoPlacement] Found Raw Joint (Clustered) at ${cluster.center.x}, ${cluster.center.y}`);
                    }
                }
            });

            // 2.a.3 FINAL PASS: Full-Vertex Graph Analysis (Robust Fallback for Voronoi T-Junctions)
            // Use a spatial graph of ALL vertices to find T/Y-junctions, even mid-segment.
            const vertexGraph = new Map<string, Set<string>>(); // ID -> NeighborIDs
            const vertexCoords = new Map<string, Point>();
            const vertexIdMap = new Map<string, string>(); // RawCoordKey -> ClusterID
            // 20px tolerance for clustering vertices (robust against noisy Voronoi)
            const VERTEX_TOLERANCE = 20;

            const getClusterId = (p: Point): string => {
                const rawKey = `${Math.round(p.x)},${Math.round(p.y)}`;
                if (vertexIdMap.has(rawKey)) return vertexIdMap.get(rawKey)!;

                // Check existing clusters
                for (const [id, center] of vertexCoords) {
                    if (dist(p, center) < VERTEX_TOLERANCE) {
                        vertexIdMap.set(rawKey, id);
                        return id;
                    }
                }

                // New Cluster
                const newId = rawKey;
                vertexCoords.set(newId, p);
                vertexIdMap.set(rawKey, newId);
                return newId;
            };

            medialAxis.forEach(seg => {
                if (seg.length < 2) return;
                for (let i = 0; i < seg.length - 1; i++) {
                    const u = getClusterId(seg[i]);
                    const v = getClusterId(seg[i + 1]);
                    if (u !== v) {
                        if (!vertexGraph.has(u)) vertexGraph.set(u, new Set());
                        if (!vertexGraph.has(v)) vertexGraph.set(v, new Set());
                        vertexGraph.get(u)!.add(v);
                        vertexGraph.get(v)!.add(u);
                    }
                }
            });

            vertexGraph.forEach((neighbors, id) => {
                // Degree >= 3 is a Joint
                if (neighbors.size >= 3) {
                    const center = vertexCoords.get(id)!;
                    // Check dups against existing joints
                    if (!joints.some(j => dist(j, center) < VERTEX_TOLERANCE)) {
                        joints.push(center);
                        console.log(`[AutoPlacement] Found Graph Degree-3 Joint at ${center.x}, ${center.y}`);
                    }
                }
            });

            // 2.b Rebuild Graph Topology from Stitched Axis to find Node Degrees
            const nodeDegrees = new Map<string, number>();
            const nodeMap = new Map<string, Point>();
            const getKey = (p: Point) => `${Math.round(p.x)},${Math.round(p.y)}`;

            stitchedAxis.forEach(path => {
                if (path.length < 2) return;
                const starts = [path[0], path[path.length - 1]];
                starts.forEach(p => {
                    const k = getKey(p);
                    nodeDegrees.set(k, (nodeDegrees.get(k) || 0) + 1);
                    nodeMap.set(k, p);
                });
            });

            // 2. Identify Joints (Deg >= 3) and Endpoints (Deg 1 or 2 ends)
            // (Already declared above)

            nodeDegrees.forEach((deg, k) => {
                const p = nodeMap.get(k)!;
                if (deg >= 3) joints.push(p);
                else if (deg === 1) endpoints.push(p);
            });

            // 2.5 Identify "Geometric Joints" (Sharp Bends in paths)
            // This catches L-shaped rooms where the corner spur was snapped away (Deg 2 but sharp turn)
            stitchedAxis.forEach(path => {
                if (path.length < 3) return;
                for (let i = 1; i < path.length - 1; i++) {
                    const p0 = path[i - 1];
                    const p1 = path[i]; // potential corner
                    const p2 = path[i + 1];

                    // Vector A (p0 -> p1), Vector B (p1 -> p2)
                    const dx1 = p0.x - p1.x; const dy1 = p0.y - p1.y;
                    const dx2 = p2.x - p1.x; const dy2 = p2.y - p1.y;

                    // Angle calculation
                    const angle1 = Math.atan2(dy1, dx1);
                    const angle2 = Math.atan2(dy2, dx2);
                    let diff = Math.abs(angle1 - angle2);
                    // Normalize to 0-PI deviation from straight line
                    if (diff > Math.PI) diff = 2 * Math.PI - diff;
                    // Straight is PI (180deg). Sharp turn is < 135deg (PI * 0.75).
                    // Deviation angle: Math.abs(PI - diff).

                    // If the path bends by more than 45 degrees (PI/4)
                    const deviation = Math.abs(Math.PI - diff);
                    if (deviation > Math.PI / 4) {
                        joints.push(p1);
                    }
                }
            });

            // 2.a.4 FINAL PASS: Geometric T-Junction Detection (Definitive Fix)
            // Check if any endpoint (tips of lines) lies close to the middle of another segment.
            // This catches T-junctions where the "spur" end touches a long backbone segment.
            const allTips: Point[] = [];
            const allSegments: [Point, Point][] = [];

            medialAxis.forEach(seg => {
                if (seg.length < 2) return;
                allTips.push(seg[0]);
                allTips.push(seg[seg.length - 1]);
                for (let i = 0; i < seg.length - 1; i++) {
                    allSegments.push([seg[i], seg[i + 1]]);
                }
            });

            const distToSegmentFinal = (p: Point, v: Point, w: Point) => {
                const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
                if (l2 === 0) return dist(p, v);
                let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
                t = Math.max(0, Math.min(1, t));
                const projection = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
                return dist(p, projection);
            };

            const TJUNCTION_TOLERANCE_FINAL = 25 * scaleRatio;

            allTips.forEach(tip => {
                let isTJunction = false;
                for (const [p1, p2] of allSegments) {
                    if (dist(tip, p1) < 1 || dist(tip, p2) < 1) continue;
                    if (distToSegmentFinal(tip, p1, p2) < TJUNCTION_TOLERANCE_FINAL) {
                        isTJunction = true;
                        break;
                    }
                }
                if (isTJunction) {
                    if (!joints.some(j => dist(j, tip) < TJUNCTION_TOLERANCE_FINAL)) {
                        joints.push(tip);
                        console.log(`[AutoPlacement] Found Geometric T-Junction at ${tip.x}, ${tip.y}`);
                    }
                }
            });

            // 3. Selection Strategy
            if (joints.length > 0) {
                // Complex Shape (L, T, Cross): Prioritize Joints
                joints.forEach(p => addLocal(p));
            } else {
                // Linear Corridor (I-shape): Use Endpoints
                // Determine if we need one center or two ends based on length?
                // For "Small Extended", usually just ends is fine, or mid if very short.
                // Let's stick to endpoints for now, consistent with "Skeleton" view.
                endpoints.forEach(p => addLocal(p));
            }

            // Backup: If for some reason graph failed, fallback to Medial Axis Center
            if (roomCandidates.length === 0 && stitchedAxis.length > 0) {
                centerForFallback = stitchedAxis[0][Math.floor(stitchedAxis[0].length / 2)];
            }


            // Proximity Cleanup: Merge close points instead of failing to Centroid
            const minAllowedDistPx = 5 * scaleRatio;

            // removeLocal Duplicates/Close points
            const uniqueCandidates: Point[] = [];

            // Sort by priority? Joints (already added) are implicitly high val.
            // Just greedy dedup.
            roomCandidates.forEach(p => {
                const existing = uniqueCandidates.find(u => dist(u, p) < minAllowedDistPx);
                if (!existing) {
                    uniqueCandidates.push(p);
                } else {
                    // If we found a Joint (Deg>=3) and existing was Endpoint, we might want to keep Joint?
                    // But in our logic above, we ONLY added Joints if they existed.
                    // So we are only deduping Joints against Joints, or Endpoints against Endpoints.
                    // Safe to just skip.
                }
            });

            if (uniqueCandidates.length === 0 && centerForFallback) {
                addCandidate(centerForFallback, 'high');
            } else {
                uniqueCandidates.forEach(p => addCandidate(p, 'high'));
            }
            if (type === 'extended') return; // Done for extended, continue for Large
        }

        // --- LARGE ROOM LOGIC (> 110m2) ---

        const allOffsetPolys: Point[][] = [];
        let layerIndex = 0;
        const MAX_LAYERS = 20;

        let deepZonePoly: Point[] | null = null;

        while (layerIndex < MAX_LAYERS) {
            const currentOffsetMeters = 5 + (10 * layerIndex);
            const offsetPx = currentOffsetMeters * scaleRatio;
            const offsetPolys = generateOffsets(roomPoly, offsetPx);

            if (!offsetPolys.length) break;

            if (layerIndex === 0 && offsetPolys.length > 0) {
                deepZonePoly = offsetPolys.sort((a, b) => b.length - a.length)[0];
            }

            allOffsetPolys.push(...offsetPolys);

            const offsetLines: any[] = [];
            offsetPolys.forEach(poly => {
                const coords = poly.map(p => [p.x, p.y]);
                if (coords.length < 2) return;
                if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
                    coords.push(coords[0]);
                }
                offsetLines.push(turf.lineString(coords));
            });

            if (layerIndex === 0) {
                offsetLines.forEach(offLine => {
                    medialFeats.forEach(medLine => {
                        const intersects = turf.lineIntersect(offLine, medLine);
                        turf.featureEach(intersects, (pt) => {
                            let [x, y] = pt.geometry.coordinates;
                            let snapped = false;
                            for (const poly of offsetPolys) {
                                for (const v of poly) {
                                    if (dist({ x, y }, v) < snapDistPx) {
                                        x = v.x;
                                        y = v.y;
                                        snapped = true;
                                        break;
                                    }
                                }
                                if (snapped) break;
                            }
                            addCandidate({ x, y }, 'high');
                        });
                    });
                });
            }

            const zone3Threshold = 12.5 * scaleRatio;
            offsetPolys.forEach(poly => {
                for (let i = 0; i < poly.length; i++) {
                    const p1 = poly[i];
                    const p2 = poly[(i + 1) % poly.length];
                    fillGaps(p1, p2, zone3Threshold, spacingPx);
                }
            });

            layerIndex++;
        }

        const calculateOverlapRatio = (candidate: Point, others: Candidate[], r: number) => {
            const rPx = r * scaleRatio;
            const covering = others.filter(o => dist(candidate, o.p) < rPx);
            return covering.length >= 2 ? 0.8 : 0.0;
        };

        // Zone 2
        const nodeCounts = new Map<string, number>();
        const nodeCoords = new Map<string, Point>();
        medialAxis.forEach(seg => {
            seg.forEach(p => {
                const k = `${Math.round(p.x)},${Math.round(p.y)}`;
                nodeCounts.set(k, (nodeCounts.get(k) || 0) + 1);
                nodeCoords.set(k, p);
            });
        });

        const deepGapThresholdPx = 12 * scaleRatio;

        nodeCounts.forEach((count, key) => {
            if (count >= 3) {
                const p = nodeCoords.get(key)!;
                if (deepZonePoly && !isPointInPolygon(p, deepZonePoly)) return;
                if (deepZonePoly && isPointInPolygon(p, deepZonePoly)) {
                    const nearest = candidates.reduce((min, c) => Math.min(min, dist(p, c.p)), Infinity);
                    if (nearest < deepGapThresholdPx) return;
                }
                const ratio = calculateOverlapRatio(p, candidates, radius);
                if (ratio <= 0.40) {
                    addCandidate(p, 'high');
                }
            }
        });

        // Zone 4
        stitchedAxis.forEach(path => {
            if (path.length < 2) return;
            let coveredCount = 0;
            const sampleCount = 5;
            for (let k = 0; k <= sampleCount; k++) {
                const idx = Math.floor((path.length - 1) * (k / sampleCount));
                const p = path[idx];
                if (allOffsetPolys.some(poly => isPointInPolygon(p, poly))) {
                    coveredCount++;
                }
            }
            if (coveredCount < sampleCount / 2) {
                const startP = path[0];
                const checkAndAdd = (pt: Point) => {
                    const inDeep = deepZonePoly ? isPointInPolygon(pt, deepZonePoly) : false;
                    const farFromHP = !candidates.some(c => (c.priority === 'high' || c.priority === 'critical') && dist(pt, c.p) < spacingPx * 0.8);
                    if (inDeep || farFromHP) {
                        addCandidate(pt, 'normal');
                    }
                };
                checkAndAdd(startP);
                for (let i = 0; i < path.length - 1; i++) {
                    const p1 = path[i];
                    const p2 = path[i + 1];
                    const d = dist(p1, p2);
                    const numSteps = Math.floor(d / spacingPx);
                    const ux = (p2.x - p1.x) / d;
                    const uy = (p2.y - p1.y) / d;
                    for (let k = 1; k <= numSteps; k++) {
                        const px = p1.x + ux * (k * spacingPx);
                        const py = p1.y + uy * (k * spacingPx);
                        checkAndAdd({ x: px, y: py });
                    }
                }
                checkAndAdd(path[path.length - 1]);
            }
        });
    });

    // 3. Safety Check
    const gridStepPx = 1.41 * scaleRatio;
    const radiusPx = radius * scaleRatio;

    processedRooms.forEach(room => {
        // Respect Scope in Safety Check
        if (targetScope === 'small' && room.areaM2 > 110) return;
        if (targetScope === 'large' && room.areaM2 <= 110) return;

        // Skip Safety Check for Compact rooms - we explicitly want ONLY the centroid
        if (room.type === 'compact') return;

        const { poly, bbox } = room;
        const weakPoints: Point[] = [];

        for (let x = bbox.minX; x <= bbox.maxX; x += gridStepPx) {
            for (let y = bbox.minY; y <= bbox.maxY; y += gridStepPx) {
                const pt = { x, y };
                if (isPointInPolygon(pt, poly)) {
                    let minDist = Infinity;
                    for (const cand of candidates) {
                        const d = dist(cand.p, pt);
                        if (d < minDist) minDist = d;
                    }
                    if (existingAnchors.length > 0) {
                        for (const cand of existingAnchors) {
                            const d = dist(cand, pt);
                            if (d < minDist) minDist = d;
                        }
                    }

                    const strength = Math.max(0, 1 - (minDist / radiusPx));
                    if (strength < 0.3) {
                        weakPoints.push(pt);
                    }
                }
            }
        }

        if (weakPoints.length > 0) {
            let sumX = 0, sumY = 0;
            weakPoints.forEach(p => { sumX += p.x; sumY += p.y; });
            const center = { x: sumX / weakPoints.length, y: sumY / weakPoints.length };

            if (isPointInPolygon(center, poly)) {
                addCandidate(center, 'critical');
            } else {
                if (weakPoints.length > 0) addCandidate(weakPoints[0], 'critical');
            }
        }
    });

    // 4. Final Clean
    const priorityVal = { 'critical': 3, 'high': 2, 'normal': 1 };
    candidates.sort((a, b) => priorityVal[b.priority] - priorityVal[a.priority]);

    candidates.forEach(c => {
        let threshold = radius * scaleRatio * 1.2;
        if (c.priority === 'high') threshold = radius * scaleRatio * 0.9;
        if (c.priority === 'critical') threshold = radius * scaleRatio * 0.4;

        const internalConflict = finalAnchors.some(d => dist(d, c.p) < threshold);
        if (internalConflict) return;

        const externalConflict = existingAnchors.some(e => dist(e, c.p) < 10);
        if (!externalConflict) {
            // STRICT AREA CHECK (Final Guard)
            let inArea = true;
            if (options.placementArea && options.placementArea.length > 2 && options.placementAreaEnabled !== false) {
                const pt = turf.point([c.p.x, c.p.y]);
                const areaCoords = options.placementArea.map(p => [p.x, p.y]);
                if (areaCoords[0][0] !== areaCoords[areaCoords.length - 1][0]) areaCoords.push(areaCoords[0]);
                const areaPoly = turf.polygon([areaCoords]);
                if (!turf.booleanPointInPolygon(pt, areaPoly)) {
                    inArea = false;
                }
            }

            if (inArea) {
                finalAnchors.push({
                    x: c.p.x, y: c.p.y,
                    radius, range: radius,
                    showRadius: options.showRadius ?? true,
                    shape: options.shape || 'circle',
                    power: -40,
                    txPower: 0
                });
            }
        }
    });

    return finalAnchors.map(a => ({
        ...a,
        isAuto: true
    }));
};
