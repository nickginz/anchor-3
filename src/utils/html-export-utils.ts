import type { ProjectState } from '../store/useProjectStore';


export const generateHtmlContent = (state: ProjectState, projectName: string = "AnchorCAD_Project", customHtmlContent: string = "") => {
    const { minX, minY, width, height } = calculateBounds(state);
    const viewBoxString = `${minX} ${minY} ${width} ${height}`;

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
        <div class="sidebar-header">
            <h2>Layers</h2>
        </div>
        <div class="layer-list">
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
        </div>
        <!-- Notes Section -->
        <div class="sidebar-notes">
            <div class="notes-header">
                <h3>Notes</h3>
                <div class="notes-tools">
                    <button onclick="document.execCommand('bold',false,null)" title="Bold"><b>B</b></button>
                    <button onclick="document.execCommand('underline',false,null)" title="Underline"><u>U</u></button>
                    <div style="width:1px; height:12px; background:#e2e8f0; margin:0 4px;"></div>
                     <input type="color" onchange="document.execCommand('foreColor',false,this.value)" title="Text Color" style="width:16px; height:16px; padding:0; border:none; background:transparent; cursor:pointer;" value="#334155" />
                </div>
            </div>
            <div id="project-notes" contenteditable="true" placeholder="Type notes..."></div>
            <div class="save-status">Auto-saved</div>
        </div>

        <div class="project-info">
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
            </defs>
            <rect x="${minX - 10000}" y="${minY - 10000}" width="${width + 20000}" height="${height + 20000}" fill="#ffffff" />
            
            <!-- Layers -->
            ${svgContent}
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
        // Initialize Notes from LocalStorage
        const noteKey = 'anchorcad_notes_${projectName}';
        const notesDiv = document.getElementById('project-notes');
        
        if (notesDiv) {
            const saved = localStorage.getItem(noteKey);
            if (saved) notesDiv.innerHTML = saved;
            
            notesDiv.addEventListener('input', () => {
                localStorage.setItem(noteKey, notesDiv.innerHTML);
            });
        }

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
    // Layer: Walls
    const wallsSvg = state.walls.map(w => `
        <line x1="${w.points[0]}" y1="${w.points[1]}" x2="${w.points[2]}" y2="${w.points[3]}" 
              stroke="#000000" stroke-width="${Math.max(w.thickness, 4)}" stroke-linecap="round" />
    `).join('');

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
        <g id="layer-heatmap" style="display:none">${heatmapSvg}</g> 
        <g id="layer-walls">${wallsSvg}</g>
        <g id="layer-cables">${cablesSvg}</g>
        <g id="layer-radius" style="display:none">${radiusSvg}</g>
        <g id="layer-anchors">${anchorsSvg}</g>
        <g id="layer-hubs">${hubsSvg}</g>
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
    
    /* Sidebar */
    #sidebar { width: 250px; background: #ffffff; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; z-index: 10; box-shadow: 2px 0 10px rgba(0,0,0,0.05); }
    .sidebar-header { padding: 20px; border-bottom: 1px solid #e2e8f0; background: #f1f5f9; }
    .sidebar-header h2 { margin: 0; font-size: 18px; color: #0f172a; letter-spacing: 0.5px; }
    .layer-list { flex: 1; padding: 20px; overflow-y: auto; scrollbar-width: none; -ms-overflow-style: none; }
    .layer-list::-webkit-scrollbar { display: none; }
    .layer-item { display: flex; items-center; margin-bottom: 12px; cursor: pointer; user-select: none; padding: 8px; border-radius: 4px; transition: background 0.2s; color: #475569; font-weight: 500; }
    .layer-item:hover { background: #f1f5f9; }
    .layer-item input { margin-right: 12px; accent-color: #3b82f6; cursor: pointer; width: 16px; height: 16px; }
    
    .project-info { padding: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #cbd5e1; text-align: center; background: #fff; }
    
    /* Notes */
    .sidebar-notes { padding: 16px; border-top: 1px solid #e2e8f0; background: #f8fafc; height: 35%; display: flex; flex-direction: column; }
    .notes-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .notes-header h3 { margin: 0; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
    .notes-tools { display: flex; align-items: center; background: #fff; padding: 2px; border: 1px solid #e2e8f0; border-radius: 4px; }
    .notes-tools button { border: none; background: transparent; cursor: pointer; padding: 4px 6px; border-radius: 2px; font-size: 10px; color: #475569; display: flex; align-items: center; justify-content: center; }
    .notes-tools button:hover { background: #f1f5f9; color: #0f172a; }
    
    #project-notes { flex: 1; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px; font-size: 13px; line-height: 1.5; color: #334155; overflow-y: auto; outline: none; background: #fff; box-shadow: inset 0 1px 2px rgba(0,0,0,0.02); resize: none; font-family: inherit; }
    #project-notes:focus { border-color: #3b82f6; ring: 2px solid #3b82f6; }
    #project-notes:empty:before { content: attr(placeholder); color: #94a3b8; }
    
    .save-status { font-size: 9px; color: #94a3b8; margin-top: 6px; text-align: right; font-style: italic; }

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

function updateViewBox() {
    svg.setAttribute('viewBox', \`\${viewBox.x} \${viewBox.y} \${viewBox.w} \${viewBox.h}\`);
    }

    svg.addEventListener('mousedown', (e) => {
        isPanning = true;
        startPoint = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mousemove', (e) => {
        if (isPanning) {
            const dx = (e.clientX - startPoint.x) * (viewBox.w / svg.clientWidth);
            const dy = (e.clientY - startPoint.y) * (viewBox.h / svg.clientHeight);
            viewBox.x -= dx;
            viewBox.y -= dy;
            startPoint = { x: e.clientX, y: e.clientY };
            updateViewBox();
        }
    });

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

    window.addEventListener('mouseup', () => { isPanning = false; });

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
        activePanel = document.getElementById(id);
        const rect = activePanel.getBoundingClientRect();
        dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    window.addEventListener('mousemove', (e) => {
        if (isDragging && activePanel) {
            activePanel.style.left = (e.clientX - dragOffset.x) + 'px';
            activePanel.style.top = (e.clientY - dragOffset.y) + 'px';
            activePanel.style.right = 'auto'; // Clear right if set
        }
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        activePanel = null;
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
