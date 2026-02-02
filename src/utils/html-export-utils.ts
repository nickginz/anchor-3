import type { ProjectState } from '../store/useProjectStore';


export const generateHtmlContent = (state: ProjectState, projectName: string = "AnchorCAD_Project", customHtmlContent: string = "") => {
    const { minX, minY, width, height } = calculateBounds(state);
    const viewBoxString = `${minX} ${minY} ${width} ${height}`;

    // Calculate Scale Bar Size (Aim for ~4cm on A4 Landscape Width 297mm)
    // A4 Width = 297mm. 4cm = ~13.5% of width.
    const targetPx = width * 0.135;
    const scaleRatio = state.scaleRatio || 50;
    const targetMeters = targetPx / scaleRatio;
    const niceNumbers = [1, 2, 5, 10, 20, 50, 100];
    const barMeters = niceNumbers.reduce((prev, curr) =>
        Math.abs(curr - targetMeters) < Math.abs(prev - targetMeters) ? curr : prev
    );
    const barPx = barMeters * scaleRatio;

    // Calculate Ticks & Blocks for HTML (Professional Style)
    let step = 1;
    if (barMeters <= 2) step = 0.5;
    else if (barMeters <= 5) step = 1;
    else if (barMeters <= 10) step = 2;
    else if (barMeters <= 20) step = 5;
    else if (barMeters <= 50) step = 10;
    else step = 20;

    const barHeight = 12;
    let blocksSvg = '';
    let labelsSvg = '';

    // 1. Blocks
    for (let m = 0; m < barMeters; m += step) {
        const stepIndex = Math.round(m / step);
        if (stepIndex % 2 === 0) {
            const x = (m / barMeters) * barPx;
            const w = (step / barMeters) * barPx;
            blocksSvg += `<rect x="${x}" y="0" width="${w}" height="${barHeight}" fill="black" />`;
        }
    }

    // 2. Labels
    for (let m = 0; m <= barMeters; m += step) {
        const x = (m / barMeters) * barPx;
        labelsSvg += `<text x="${x}" y="${barHeight + 14}" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="black">${m}</text>`;
    }

    const svgContent = generateSvgLayers(state);
    const bomHtml = generateBomHtml(state);
    const script = getViewerScript(minX, minY, width, height, state.scaleRatio || 50);
    const styles = getViewerStyles();
    const defaultRadius = state.anchorRadius || 10;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName} - Interactive View</title>
    <style>
        ${styles}
    </style>
</head>
<body>
    <!-- Sidebar -->
    <div id="sidebar">
        <div id="layers-container" style="flex: 1; overflow-y: auto;">
            <div class="sidebar-header">
                <h2>Layers</h2>
            </div>
            <div class="layer-list">
                <label class="layer-item">
                    <input type="checkbox" checked onchange="toggleLayer('layer-imported')">
                    <span>Imported Drawings</span>
                </label>
                <label class="layer-item">
                    <input type="checkbox" checked onchange="toggleLayer('layer-walls')">
                    <span>Walls</span>
                </label>
                 <label class="layer-item">
                    <input type="checkbox" checked onchange="toggleLayer('layer-anchors')">
                    <span>Anchors</span>
                </label>
                <label class="layer-item">
                    <input type="checkbox" checked onchange="toggleLayer('layer-cables')">
                    <span>Cables</span>
                </label>
                <label class="layer-item">
                    <input type="checkbox" checked onchange="toggleLayer('layer-hubs')">
                    <span>Hubs</span>
                </label>
                <label class="layer-item">
                    <input type="checkbox" onchange="toggleLayer('layer-radius')">
                    <span>Coverage Radius</span>
                </label>
                 <div class="layer-item" style="flex-direction: column; align-items: flex-start;">
                    <div style="display:flex; justify-content:space-between; width:100%; margin-bottom:4px;">
                        <span style="font-size: 11px;">Radius Size</span>
                        <span id="radius-val" style="font-size: 11px; font-weight:bold;">${defaultRadius}.0 m</span>
                    </div>
                    <input type="range" min="3" max="15" step="0.5" value="${defaultRadius}" oninput="updateRadius(this.value)" style="width: 100%;">
                </div>
                 <label class="layer-item">
                    <input type="checkbox" onchange="toggleLayer('layer-heatmap')">
                    <span>Signal Heatmap</span>
                </label>
                 <label class="layer-item">
                    <input type="checkbox" checked onchange="toggleLayer('layer-bom')">
                    <span>Bill of Materials</span>
                </label>
                 <label class="layer-item">
                    <input type="checkbox" onchange="toggleLayer('layer-dimensions')">
                    <span>Dimensions</span>
                </label>
                <label class="layer-item">
                    <input type="checkbox" checked onchange="toggleLayer('layer-scalebar')">
                    <span>Scale Bar</span>
                </label>
            </div>
        </div>

        <div id="tools-container" style="flex-shrink: 0; border-top: 1px solid #e2e8f0; background: #fff;">
            <div class="sidebar-header">
                <h2>Tools</h2>
            </div>
            <div class="layer-list">
                 <button id="tool-pan" class="tool-btn active" onclick="setTool('pan')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-3 3-3-3"/><path d="M12 3v18"/><path d="m9 6 3-3 3 3"/><path d="M18 15 21 12 18 9"/><path d="M3 12h18"/><path d="m6 9-3 3 3 3"/></svg>
                    Pan View
                 </button>
                 <button id="tool-measure" class="tool-btn" onclick="setTool('measure')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m11 11 2 2"/><path d="m11 13 2-2"/><path d="M14 6 6 14"/><path d="M15 11 11 15"/><path d="M19.1 4.9a2.1 2.1 0 0 0-3 0l-1.5 1.5-1.1-1.1-1.4 1.4 1.1 1.1L4.9 16.1a2.1 2.1 0 0 0 0 3l.7.7 3.5-3.5 1.4 1.4-3.5 3.5.7.7a2.1 2.1 0 0 0 3 0l8.3-8.3 1.1 1.1 1.4-1.4-1.1-1.1 1.5-1.5a2.1 2.1 0 0 0 0-3l-.7-.7Z"/></svg>
                    Measure
                 </button>
            </div>
        </div>

        <div class="project-info" style="flex-shrink: 0;">
             <span>${projectName} &bull; ${new Date().toLocaleDateString()}</span>
        </div>
    </div>

    <!-- Main Viewer -->
    <div id="viewer">
        <button id="sidebar-toggle" onclick="toggleSidebar()" style="position: absolute; top: 20px; left: 20px; z-index: 100; padding: 8px 16px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; font-weight: 600; color: #475569; box-shadow: 0 2px 4px rgba(0,0,0,0.05); transition: all 0.2s; display: flex; align-items: center; gap: 6px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2Z"/><path d="M6 12h12"/><path d="M6 18h12"/><path d="M6 6v12"/></svg>
            Layers
        </button>
        <svg id="main-svg" viewBox="${viewBoxString}" preserveAspectRatio="xMidYMid meet">
            <defs>
                 <radialGradient id="heatGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                    <stop offset="0%" stop-color="rgba(0, 255, 0, 0.6)" />
                    <stop offset="100%" stop-color="rgba(0, 255, 0, 0)" />
                 </radialGradient>
                 <marker id="arrowhead" markerWidth="8" markerHeight="5" refX="7" refY="2.5" orient="auto">
                    <path d="M 0 0 L 8 2.5 L 0 5 Z" fill="#22c55e" />
                 </marker>
                 <marker id="arrowhead-start" markerWidth="8" markerHeight="5" refX="1" refY="2.5" orient="auto-start-reverse">
                    <path d="M 0 0 L 8 2.5 L 0 5 Z" fill="#22c55e" />
                 </marker>
            </defs>
            <rect x="${minX - 10000}" y="${minY - 10000}" width="${width + 20000}" height="${height + 20000}" fill="#ffffff" />
            
            <!-- Layers -->
            <!-- Layers -->
            ${svgContent}

            <!-- Scale Bar (Professional Alternating Blocks) - Draggable -->
            <g id="layer-scalebar" transform="translate(${minX + width - barPx - 80}, ${minY + height - 80})" onmousedown="startSvgDrag(event, 'layer-scalebar')" style="cursor: move;">
                <!-- Hit Area for easy grabbing -->
                <rect x="-20" y="-30" width="${barPx + 50}" height="70" fill="transparent" />
                
                <!-- Background Halo -->
                <rect x="-10" y="-20" width="${barPx + 40}" height="60" fill="rgba(255, 255, 255, 0.85)" rx="2" style="pointer-events: none;" />
                
                <!-- Main Border (White Base) -->
                <rect x="0" y="0" width="${barPx}" height="${barHeight}" fill="white" stroke="black" stroke-width="2" style="pointer-events: none;" />
                
                <!-- Black Blocks -->
                <g style="pointer-events: none;">
                ${blocksSvg}
                </g>
                
                <!-- Labels -->
                <g style="pointer-events: none;">
                ${labelsSvg}
                </g>
                
                <!-- Unit -->
                <text x="${barPx + 15}" y="10" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="black" style="pointer-events: none;">m</text>
            </g>
        </svg>

        <!-- Draggable BOM -->
        <div id="layer-bom" class="draggable-panel" style="top: 20px; right: 20px; width: 180px;">
            <div class="panel-content">
                ${bomHtml}
            </div>
        </div>

        <!-- Custom HTML Content -->
        ${customHtmlContent ? `
        <div id="layer-custom-text" class="draggable-panel" onmousedown="startDrag(event, 'layer-custom-text')">
            <div class="panel-content" style="padding:10px;">
                ${customHtmlContent}
            </div>
        </div>
        ` : ''}
    </div>

    <script>

        ${script}
    </script>
</body>
</html>
    `;
};

const calculateBounds = (state: ProjectState) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    // Check Export Region (Priority)
    if (state.exportRegion && state.exportRegion.length > 0) {
        state.exportRegion.forEach(p => {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        });
        // Remove padding for export region to exact fit
        return { minX, minY, width: maxX - minX, height: maxY - minY };
    }

    if (state.walls.length === 0 && state.anchors.length === 0) {
        return { minX: 0, minY: 0, width: 800, height: 600 };
    }

    // Check Walls
    state.walls.forEach(wall => {
        minX = Math.min(minX, wall.points[0], wall.points[2]);
        maxX = Math.max(maxX, wall.points[0], wall.points[2]);
        minY = Math.min(minY, wall.points[1], wall.points[3]);
        maxY = Math.max(maxY, wall.points[1], wall.points[3]);
    });

    // Check AnchorsAnd Hubs
    state.anchors.forEach(a => {
        minX = Math.min(minX, a.x - (a.radius || 0));
        maxX = Math.max(maxX, a.x + (a.radius || 0));
        minY = Math.min(minY, a.y - (a.radius || 0));
        maxY = Math.max(maxY, a.y + (a.radius || 0));
    });

    state.hubs.forEach(h => {
        minX = Math.min(minX, h.x - 20);
        maxX = Math.max(maxX, h.x + 20);
        minY = Math.min(minY, h.y - 20);
        maxY = Math.max(maxY, h.y + 20);
    });

    // Padding
    const padding = 100;
    if (minX === Infinity) {
        minX = 0; maxX = 800; minY = 0; maxY = 600;
    } else {
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;
    }

    return { minX, minY, width: maxX - minX, height: maxY - minY };
};

const generateSvgLayers = (state: ProjectState) => {
    // Layer: Imported Drawings (Images and DXF)
    const importedSvg = (state.importedObjects || []).map(obj => {
        if (!obj.visible) return '';

        if (obj.type === 'image') {
            const w = obj.width * obj.scale;
            const h = obj.height * obj.scale;
            return `
                <g transform="translate(${obj.x}, ${obj.y}) rotate(${obj.rotation})">
                    <image href="${obj.src}" width="${w}" height="${h}" opacity="${obj.opacity ?? 1}" />
                </g>
            `;
        }

        if (obj.type === 'dxf') {
            const entities = obj.data?.entities || [];
            const dxfColors = ['#000000', '#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FFFFFF', '#808080', '#C0C0C0'];

            const entitySvg = entities.map((entity: any) => {
                if (obj.layers && obj.layers[entity.layer] === false) return '';
                const color = dxfColors[entity.color % dxfColors.length] || '#666666';

                if (entity.type === 'LINE') {
                    return `<line x1="${entity.vertices[0].x}" y1="${entity.vertices[0].y}" x2="${entity.vertices[1].x}" y2="${entity.vertices[1].y}" stroke="${color}" stroke-width="1" opacity="0.5" />`;
                }

                if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
                    const points = entity.vertices.map((v: any) => `${v.x},${v.y}`).join(' ');
                    const closed = entity.shape || entity.closed;
                    return `<polyline points="${points}${closed ? ` ${entity.vertices[0].x},${entity.vertices[0].y}` : ''}" fill="none" stroke="${color}" stroke-width="1" opacity="0.5" />`;
                }

                return '';
            }).join('');

            return `
                <g transform="translate(${obj.x}, ${obj.y}) rotate(${obj.rotation}) scale(${obj.scale})">
                    ${entitySvg}
                </g>
            `;
        }
        return '';
    }).join('');

    // Layer: Walls
    const wallsSvg = state.walls.map(w => `
        <line x1="${w.points[0]}" y1="${w.points[1]}" x2="${w.points[2]}" y2="${w.points[3]}" 
              stroke="#000000" stroke-width="${Math.max(w.thickness, 4)}" stroke-linecap="round" />
    `).join('');

    // Layer: Dimensions (Manual Green Dimensions)
    const dimensionsSvg = state.dimensions.map(d => {
        const [x1, y1, x2, y2] = d.points;
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;

        const dx = x2 - x1;
        const dy = y2 - y1;
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;

        // Offset perpendicular to the line for the text
        const length = Math.hypot(dx, dy);
        const nx = -dy / length;
        const ny = dx / length;
        const tx = midX + nx * 20;
        const ty = midY + ny * 20;

        return `
            <g>
                <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#22c55e" stroke-width="1.5" marker-end="url(#arrowhead)" marker-start="url(#arrowhead-start)" />
                <text x="${tx}" y="${ty}" transform="rotate(${angle}, ${tx}, ${ty})" text-anchor="middle" fill="#22c55e" font-size="12" font-weight="bold" font-family="Arial, sans-serif" stroke="white" stroke-width="3" paint-order="stroke">${d.label}</text>
                <text x="${tx}" y="${ty}" transform="rotate(${angle}, ${tx}, ${ty})" text-anchor="middle" fill="#22c55e" font-size="12" font-weight="bold" font-family="Arial, sans-serif">${d.label}</text>
            </g>
        `;
    }).join('');

    // Layer: Anchors (Just the dots/text)
    const anchorsSvg = state.anchors.map(a => `
        <g transform="translate(${a.x}, ${a.y})">
            <circle r="6" fill="#f97316" stroke="#ffffff" stroke-width="2" />
            <text y="-10" text-anchor="middle" fill="#2d3748" font-family="sans-serif" font-size="12" font-weight="bold">${a.id.slice(0, 4)}</text>
        </g>
    `).join('');

    // Layer: Radius (The coverage circles)
    // Layer: Radius (The coverage circles)
    const scale = state.scaleRatio || 50;
    const defaultRadiusMeters = state.anchorRadius || 10; // Use global setting or fallback

    const radiusSvg = state.anchors.map(a => `
        <g transform="translate(${a.x}, ${a.y})">
             <circle class="coverage-circle" r="${(a.radius || defaultRadiusMeters) * scale}" fill="rgba(66, 153, 225, 0.2)" stroke="#2b6cb0" stroke-width="2" />
        </g>
    `).join('');

    // Layer: Heatmap (Simulated with density circles)
    const heatmapSvg = state.anchors.map(a => `
        <g transform="translate(${a.x}, ${a.y})">
             <circle class="heatmap-circle" r="${(a.radius || defaultRadiusMeters) * scale}" fill="url(#heatGradient)" style="mix-blend-mode: multiply;" />
        </g>
    `).join('');

    // Layer: Cables
    const cablesSvg = state.cables.map(c => {
        const pointsStr = c.points.map(p => `${p.x},${p.y}`).join(' ');
        const color = c.color || '#3b82f6'; // Use cable color or default blue
        return `<polyline points="${pointsStr}" stroke="${color}" stroke-width="2" fill="none" />`;
    }).join('');

    // Layer: Hubs
    // Layer: Hubs (Matching App Style)
    const hubsSvg = state.hubs.map(h => {
        // Calculate Details
        let c = state.cables.find(cb => cb.fromId === h.id || cb.toId === h.id); // Find any connected cable
        const hubPrimaryColor = c?.color || '#9333ea'; // Default Purple
        const used = state.cables.filter(cb => cb.fromId === h.id).length; // Simple usage count
        const isFull = used >= h.capacity;

        // Generate Ticks
        const ticks = [];
        const tickLen = 3;
        const halfSize = 12; // 24/2
        const baseDist = halfSize + 4;

        for (let i = 0; i < h.capacity; i++) {
            const angleDeg = (i * 360) / h.capacity;
            const angleRad = (angleDeg - 90) * (Math.PI / 180);
            const cos = Math.cos(angleRad);
            const sin = Math.sin(angleRad);
            const maxComp = Math.max(Math.abs(cos), Math.abs(sin));
            const rStart = baseDist / maxComp;
            const x1 = cos * rStart;
            const y1 = sin * rStart;

            let x2, y2;
            if (Math.abs(y1) > Math.abs(x1)) {
                x2 = x1;
                y2 = y1 + (Math.sign(y1) * tickLen);
            } else {
                x2 = x1 + (Math.sign(x1) * tickLen);
                y2 = y1;
            }

            // Check connection for color
            // Ideally we map index to cable color like in App, but simple logic: 
            // If this hub is connected to *any* cable, color it? 
            // App logic maps specific ports. For static export without full topology re-calc, 
            // we can default to grey or use the hub color if it looks better.
            // Let's use neutral grey for ticks unless we do the full distance check.
            // Given complexity, neutral grey is safer than wrong colors.
            ticks.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#94a3b8" stroke-width="2" />`);
        }

        return `
        <g transform="translate(${h.x}, ${h.y})">
            <!-- Top Half -->
            <path d="M -12 -12 L 12 -12 L 12 0 L -12 0 Z" fill="#9333ea" stroke="#ffffff" stroke-width="2" />
            
            <!-- Bottom Half -->
            <path d="M -12 0 L 12 0 L 12 12 L -12 12 Z" fill="${isFull ? '#ef4444' : hubPrimaryColor}" stroke="#ffffff" stroke-width="2" />
            
            <!-- Divider -->
            <line x1="-12" y1="0" x2="12" y2="0" stroke="#ffffff" stroke-width="1" />
            
            <!-- Text Top (Usage) -->
            <text x="0" y="-3" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="10" font-weight="bold">${used}</text>
            
            <!-- Text Bottom (Capacity) -->
            <text x="0" y="9" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="10" font-weight="bold">${h.capacity}</text>
            
            <!-- Ticks -->
            ${ticks.join('')}
        </g>
        `;
    }).join('');

    return `
        <g id="layer-imported">${importedSvg}</g>
        <g id="layer-heatmap" style="display:none">${heatmapSvg}</g> 
        <g id="layer-walls">${wallsSvg}</g>
        <g id="layer-dimensions" style="display:none">${dimensionsSvg}</g>
        <g id="layer-cables">${cablesSvg}</g>
        <g id="layer-radius" style="display:none">${radiusSvg}</g>
        <g id="layer-anchors">${anchorsSvg}</g>
        <g id="layer-hubs">${hubsSvg}</g>
        <g id="layer-measurements"></g>
        <g id="measure-preview" style="pointer-events:none"></g>
    `;
};



const generateBomHtml = (state: ProjectState) => {
    // Calculate totals
    const scale = state.scaleRatio || 50;

    const totalCablePixels = state.cables.reduce((acc, cable) => {
        // Calculate length of each segment in the cable path
        let len = 0;
        for (let i = 0; i < cable.points.length - 1; i++) {
            const p1 = cable.points[i];
            const p2 = cable.points[i + 1];
            len += Math.hypot(p2.x - p1.x, p2.y - p1.y);
        }
        return acc + len;
    }, 0);

    const cableMeters = (totalCablePixels / scale).toFixed(2);

    const anchorCount = state.anchors.length;
    const cableCount = state.cables.length;
    // const hubCount = state.hubs.length;

    return `
        <div class="bom-project-name" onmousedown="startDrag(event, 'layer-bom')">
            <label>Project:</label>
            <input type="text" id="project-name-input" placeholder="Project Name" />
        </div>
        <table class="bom-table">
            <thead>
                <tr>
                    <th>Item</th>
                    <th>Count</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="display:flex; align-items:center; gap:8px;">
                        <span style="width:10px; height:10px; border-radius:50%; background:#f97316; border:1px solid #fff; box-shadow:0 0 0 1px #cbd5e1; display:inline-block; -webkit-print-color-adjust: exact; print-color-adjust: exact;"></span>
                        Anchors
                    </td>
                    <td>${anchorCount} units</td>
                </tr>
                <tr>
                    <td style="display:flex; align-items:center; gap:8px;">
                        <span style="width:20px; height:2px; background:#3b82f6; display:inline-block; -webkit-print-color-adjust: exact; print-color-adjust: exact;"></span>
                        Cable Runs
                    </td>
                    <td>${cableCount} segments</td>
                </tr>
                <tr>
                    <td>Total Cable Length</td>
                    <td>${cableMeters} m</td>
                </tr>
                ${[24, 12, 6, 2].map(cap => {
        const count = state.hubs.filter(h => h.capacity === cap).length;
        if (count === 0) return '';
        return `
                    <tr>
                        <td style="display:flex; align-items:center; gap:8px;">
                            <span style="width:12px; height:12px; background:#dc2626; border:1px solid #fff; border-radius:2px; display:inline-block; color:white; font-size:8px; text-align:center; line-height:12px; box-shadow:0 0 0 1px #cbd5e1; -webkit-print-color-adjust: exact; print-color-adjust: exact;">H</span>
                            Hub ${cap} ports
                        </td>
                        <td>${count} units</td>
                    </tr>`;
    }).join('')}
            </tbody>
        </table>
    `;
};

const getViewerStyles = () => `
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #334155; overflow: hidden; display: flex; height: 100vh; }
    
    /* Sidebar Compact */
    #sidebar { width: 220px; background: #ffffff; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; z-index: 10; box-shadow: 2px 0 10px rgba(0,0,0,0.05); }
    .sidebar-header { padding: 12px 16px; border-bottom: 1px solid #e2e8f0; background: #f1f5f9; flex-shrink: 0; }
    .sidebar-header h2 { margin: 0; font-size: 14px; color: #0f172a; letter-spacing: 0.5px; text-transform: uppercase; font-weight: 700; }
    .layer-list { padding: 8px 12px; }
    .layer-item { display: flex; align-items: center; margin-bottom: 4px; cursor: pointer; user-select: none; padding: 6px; border-radius: 4px; transition: background 0.2s; color: #475569; font-weight: 600; font-size: 12px; }
    .layer-item:hover { background: #f1f5f9; }
    .layer-item input { margin-right: 8px; accent-color: #3b82f6; cursor: pointer; width: 14px; height: 14px; flex-shrink: 0; }
    
    .project-info { padding: 8px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #cbd5e1; text-align: center; background: #fff; }
    
    .tool-btn { 
        display: flex; align-items: center; gap: 8px; width: 100%; border: none; background: transparent; 
        padding: 8px 12px; margin-bottom: 4px; border-radius: 6px; cursor: pointer; color: #475569; 
        font-weight: 600; font-size: 12px; transition: all 0.2s;
    }
    .tool-btn:hover { background: #f1f5f9; color: #1e293b; }
    .tool-btn.active { background: #3b82f6; color: white; }
    .tool-btn svg { flex-shrink: 0; pointer-events: none; width: 14px; height: 14px; }
    

    /* Viewer */
    #viewer { flex: 1; position: relative; background: #f8fafc; cursor: grab; }
    #viewer:active { cursor: grabbing; }
    svg { width: 100%; height: 100%; display: block; }

    /* Draggable Panel (BOM) */
    .draggable-panel { position: absolute; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); min-width: 170px; z-index: 100; resize: both; overflow: hidden; max-height: 80vh; display: flex; flex-direction: column; }
    .panel-header { padding: 12px 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; cursor: move; font-weight: 600; font-size: 14px; color: #1e293b; user-select: none; }
    .panel-content { padding: 0; }
    
    /* Draggable BOM */
    .bom-project-name { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; gap: 8px; background: #f8fafc; cursor: move; border-top-left-radius: 8px; border-top-right-radius: 8px; }
    .bom-project-name label { font-size: 0.85em; font-weight: 600; color: #64748b; }
    .bom-project-name input { border: 1px dashed transparent; padding: 4px; font-size: 1em; font-weight: 600; color: #1e293b; flex: 1; outline: none; background: transparent; transition: all 0.2s; }
    .bom-project-name input:hover { border-color: #cbd5e1; }
    .bom-project-name input:focus { background: #f8fafc; border-color: #3b82f6; border-radius: 4px; }
    
    /* Custom Text Panel */
    #layer-custom-text { top: 20px; left: 20px; width: 300px; padding: 10px; font-size: 14px; line-height: 1.5; color: #333; }

    /* Table */
    .bom-table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
    .bom-table th { text-align: left; padding: 8px 10px; background: #f8fafc; color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
    .bom-table td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: middle; white-space: nowrap; }
    .bom-table tr:last-child td { border-bottom: none; }

    @media print {
        #sidebar, #sidebar-toggle { display: none !important; }
        #viewer { width: 100% !important; height: 100% !important; }
        body { background: white; }
        .draggable-panel { box-shadow: none; border: 1px solid #ccc; }
    }
`;

const getViewerScript = (x: number, y: number, w: number, h: number, scale: number) => `
// Pan and Zoom Logic
const svg = document.getElementById('main-svg');
let viewBox = { x: ${x}, y: ${y}, w: ${w}, h: ${h} };
let isPanning = false;
let startPoint = { x: 0, y: 0 };
let activeTool = 'pan';

function setTool(tool) {
    activeTool = tool;
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('tool-' + tool).classList.add('active');
    
    if (tool === 'measure') {
        document.getElementById('viewer').style.cursor = 'crosshair';
    } else {
        document.getElementById('viewer').style.cursor = 'grab';
    }
}

function updateViewBox() {
    svg.setAttribute('viewBox', \`\${viewBox.x} \${viewBox.y} \${viewBox.w} \${viewBox.h}\`);
    }

    svg.addEventListener('mousedown', (e) => {
        if (activeTool === 'pan' && e.button === 0) {
            isPanning = true;
            startPoint = { x: e.clientX, y: e.clientY };
        } else if (activeTool === 'measure') {
            startMeasure(e);
        }
    });

    // Measurement Drawing Logic
    let isDrawingDim = false;
    let dimStart = null;
    const measurementLayer = document.getElementById('layer-measurements');
    const previewLayer = document.getElementById('measure-preview');

    function getSvgCoords(e) {
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        return pt.matrixTransform(svg.getScreenCTM().inverse());
    }

    function startMeasure(e) {
        isDrawingDim = true;
        dimStart = getSvgCoords(e);
    }

    function createDimSvg(p1, p2, isPreview = false) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        const meters = (len / ${scale}).toFixed(2);
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        
        // Offset
        const nx = -dy / len || 0;
        const ny = dx / len || 0;
        const tx = midX + nx * 15;
        const ty = midY + ny * 15;

        let txtAngle = angle;
        if (txtAngle > 90 || txtAngle < -90) txtAngle += 180;

        const removeOnClick = !isPreview ? 'onclick="this.remove()"' : '';
        
        return '<g class="temp-dim" ' + removeOnClick + ' style="cursor: pointer">' +
               '  <line x1="' + p1.x + '" y1="' + p1.y + '" x2="' + p2.x + '" y2="' + p2.y + '" stroke="#22c55e" stroke-width="1.5" marker-end="url(#arrowhead)" marker-start="url(#arrowhead-start)" />' +
               '  <text x="' + tx + '" y="' + ty + '" transform="rotate(' + txtAngle + ', ' + tx + ', ' + ty + ')" text-anchor="middle" fill="#22c55e" font-size="12" font-weight="bold" font-family="Arial, sans-serif" stroke="white" stroke-width="3" paint-order="stroke">' + meters + 'm</text>' +
               '  <text x="' + tx + '" y="' + ty + '" transform="rotate(' + txtAngle + ', ' + tx + ', ' + ty + ')" text-anchor="middle" fill="#22c55e" font-size="12" font-weight="bold" font-family="Arial, sans-serif">' + meters + 'm</text>' +
               '</g>';
    }


    window.updateRadius = (val) => {
        document.getElementById('radius-val').innerText = val + ' m';
        const px = val * ${scale};
        
        // Update Coverage
        const circles = document.getElementsByClassName('coverage-circle');
        for(let c of circles) {
            c.setAttribute('r', px);
        }
        // Update Heatmap
        const hCircles = document.getElementsByClassName('heatmap-circle');
        for(let c of hCircles) {
            c.setAttribute('r', px);
        }
    };


    svg.addEventListener('wheel', (e) => {
        e.preventDefault();
        const scale = e.deltaY > 0 ? 1.1 : 0.9;
        const wNew = viewBox.w * scale;
        const hNew = viewBox.h * scale;
        const dx = (viewBox.w - wNew) / 2;
        const dy = (viewBox.h - hNew) / 2;
        
        // Zoom towards pointer (refined)
        // Simple zoom center for now to avoid complexity of pointer calculation in Vanilla
        const cx = viewBox.x + viewBox.w / 2;
        const cy = viewBox.y + viewBox.h / 2;
        
        viewBox.w = wNew;
        viewBox.h = hNew;
        viewBox.x = cx - wNew / 2;
        viewBox.y = cy - hNew / 2;
        
        updateViewBox();
    });

    // Layer Toggling
    window.toggleLayer = (id) => {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = el.style.display === 'none' ? 'block' : 'none';
        }
    };

    window.toggleSidebar = () => {
        const s = document.getElementById('sidebar');
        const b = document.getElementById('sidebar-toggle');
        if (s.style.display === 'none') {
            s.style.display = 'flex';
            b.style.background = '#ffffff';
            b.style.color = '#475569';
        } else {
            s.style.display = 'none';
            b.style.background = '#e2e8f0';
            b.style.color = '#1e293b';
        }
    };

    // Drag Logic for Panels
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };
    let activePanel = null;

    window.startDrag = (e, id) => {
        isDragging = true;
        isPanning = false; 
        e.stopPropagation();
        e.preventDefault();
        activePanel = document.getElementById(id);
        dragOffset = { 
            x: e.clientX - activePanel.offsetLeft, 
            y: e.clientY - activePanel.offsetTop 
        };
    };

    // SVG Drag State
    let isSvgDragging = false;
    let activeSvgGroup = null;
    let svgDragOffset = { x: 0, y: 0 };

    window.addEventListener('mousemove', (e) => {
        if (isDragging && activePanel) {
            activePanel.style.left = (e.clientX - dragOffset.x) + 'px';
            activePanel.style.top = (e.clientY - dragOffset.y) + 'px';
            activePanel.style.right = 'auto'; 
        }
        if (isSvgDragging && activeSvgGroup) {
            const pt = svg.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
            activeSvgGroup.setAttribute('transform', 'translate(' + (svgP.x - svgDragOffset.x) + ', ' + (svgP.y - svgDragOffset.y) + ')');
        }
        if (isDrawingDim) {
            const current = getSvgCoords(e);
            previewLayer.innerHTML = createDimSvg(dimStart, current, true);
        }

        if (isPanning && !isSvgDragging && !isDragging) {
            const dx = (e.clientX - startPoint.x) * (viewBox.w / svg.clientWidth);
            const dy = (e.clientY - startPoint.y) * (viewBox.h / svg.clientHeight);
            viewBox.x -= dx;
            viewBox.y -= dy;
            startPoint = { x: e.clientX, y: e.clientY };
            updateViewBox();
        }
    });

    window.startSvgDrag = (e, id) => {
        e.preventDefault();
        e.stopPropagation(); 
        isPanning = false; 
        isSvgDragging = true;
        activeSvgGroup = document.getElementById(id);
        
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const mouseSvg = pt.matrixTransform(svg.getScreenCTM().inverse());
        
        // Parse current translation to avoid jump
        const transform = activeSvgGroup.getAttribute('transform') || '';
        const match = /translate\(([^,]+),?\s*([^)]+)\)/.exec(transform);
        let currX = 0, currY = 0;
        if (match) {
            currX = parseFloat(match[1]);
            currY = parseFloat(match[2]);
        }
        
        svgDragOffset = {
            x: mouseSvg.x - currX,
            y: mouseSvg.y - currY
        };
    };

    window.addEventListener('mouseup', (e) => {
        if (isDrawingDim) {
            const current = getSvgCoords(e);
            if (dimStart && current && Math.hypot(current.x - dimStart.x, current.y - dimStart.y) > 5) {
                measurementLayer.innerHTML += createDimSvg(dimStart, current);
            }
            isDrawingDim = false;
            previewLayer.innerHTML = '';
        }
        isPanning = false;
        isDragging = false;
        activePanel = null;
        isSvgDragging = false;
        activeSvgGroup = null;
    });

    // BOM Scaling Observer
    const bomPanel = document.getElementById('layer-bom');
    if (bomPanel) {
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const width = entry.contentRect.width;
                // Base width ~250px = 14px font. Allow scaling up to 48px. Allow down to 10px.
                const newSize = Math.max(10, Math.min(48, 14 * (width / 250)));
                bomPanel.style.fontSize = newSize + 'px';
            }
        });
        resizeObserver.observe(bomPanel);
    }

    // Initialize Project Name from Filename
    try {
        const path = window.location.pathname;
        // Handle local file paths across OSs
        const fileName = decodeURIComponent(path.split('/').pop().split('\\\\').pop()).replace(/\\.html?$/i, '');
        const nameInput = document.getElementById('project-name-input');
        if (nameInput && fileName) {
            nameInput.value = fileName;
        }
    } catch (e) {
        console.warn('Could not set project name from filename', e);
    }
`;
