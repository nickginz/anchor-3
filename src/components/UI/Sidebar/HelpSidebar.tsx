import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../../store/useProjectStore';
import {
    X, ChevronRight, ChevronDown, Info,
    MousePointer2, Undo2, Redo2, Upload,
    PenTool, Lock, Square, BoxSelect,
    Wifi, Wand2, Router, Spline, Cable, Settings,
    FileUp, BookTemplate, Calculator, Ruler, Scaling, FilePlus, MenuSquare
} from 'lucide-react';

const SIDEBAR_MIN_WIDTH = 300;
const SIDEBAR_MAX_WIDTH = 1200;

const QAToggle = () => {
    const { showQAMonitor, setShowQAMonitor } = useProjectStore();
    return (
        <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={showQAMonitor} onChange={(e) => setShowQAMonitor(e.target.checked)} className="sr-only peer" />
            <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
        </label>
    );
};

interface HelpSection {
    id: string;
    title: string;
    content: React.ReactNode;
    searchableText: string;
}

const DOCUMENTATION: HelpSection[] = [
    {
        id: 'intro',
        title: 'Introduction',
        content: (
            <div className="space-y-2">
                <p className="font-semibold text-accent">AnchorCAD Planner 3.0</p>
                <p>A professional web-based CAD tool for planning wireless anchor deployments, designing floor plans, and optimizing signal coverage with automated wall detection and cable routing.</p>
            </div>
        ),
        searchableText: "introduction anchorcad planner 3.0 professional web-based cad tool planning wireless anchor deployments designing floor plans optimizing signal coverage automated wall detection cable routing"
    },
    {
        id: 'interface',
        title: 'Toolbar & Icons',
        content: (
            <div className="space-y-4">
                <div>
                    <h4 className="text-sm font-bold text-gray-300 border-b panel-border pb-1 mb-2">Edit & View</h4>
                    <div className="grid grid-cols-1 gap-3">
                        <div className="flex items-start space-x-3">
                            <div className="p-1.5 bg-gray-700/50 rounded text-gray-200 shrink-0"><MousePointer2 size={14} /></div>
                            <div>
                                <p className="font-bold text-gray-200 text-xs">Select (V)</p>
                                <p className="text-[10px] text-gray-400 text-pretty">Standard cursor to select, move, or edit objects. Click background to deselect.</p>
                            </div>
                        </div>
                        <div className="flex items-start space-x-3">
                            <div className="p-1.5 bg-gray-700/50 rounded text-gray-200 shrink-0 flex space-x-1">
                                <Undo2 size={14} />
                                <Redo2 size={14} />
                            </div>
                            <div>
                                <p className="font-bold text-gray-200 text-xs">Undo / Redo</p>
                                <p className="text-[10px] text-gray-400 text-pretty">Revert or re-apply recent actions (Ctrl+Z / Ctrl+Shift+Z).</p>
                            </div>
                        </div>
                        <div className="flex items-start space-x-3">
                            <div className="p-1.5 bg-gray-700/50 rounded text-gray-200 shrink-0"><Upload size={14} /></div>
                            <div>
                                <p className="font-bold text-gray-200 text-xs">Layer Toggles</p>
                                <p className="text-[10px] text-gray-400 text-pretty">Show/hide Walls, Cables, Floorplan. <strong>Signal Heatmap</strong> visualizes coverage strength.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <h4 className="text-sm font-bold text-gray-300 border-b panel-border pb-1 mb-2">Draw Tools</h4>
                    <div className="grid grid-cols-1 gap-3">
                        <div className="flex items-start space-x-3">
                            <div className="p-1.5 bg-gray-700/50 rounded text-gray-200 shrink-0"><PenTool size={14} /></div>
                            <div>
                                <p className="font-bold text-gray-200 text-xs">Wall (W)</p>
                                <p className="text-[10px] text-gray-400 text-pretty">Draw linear walls. Adjust <strong>Width (m)</strong> and <strong>Material</strong> in settings. Esc to stop.</p>
                            </div>
                        </div>
                        <div className="flex items-start space-x-3">
                            <div className="p-1.5 bg-gray-700/50 rounded text-gray-200 shrink-0"><Lock size={14} /></div>
                            <div>
                                <p className="font-bold text-gray-200 text-xs">Lock Walls (Shift+W)</p>
                                <p className="text-[10px] text-gray-400 text-pretty">Lock all walls to prevent accidental selection or movement while placing devices.</p>
                            </div>
                        </div>
                        <div className="flex items-start space-x-3">
                            <div className="p-1.5 bg-gray-700/50 rounded text-gray-200 shrink-0"><Square size={14} /></div>
                            <div>
                                <p className="font-bold text-gray-200 text-xs">Rect Wall (R)</p>
                                <p className="text-[10px] text-gray-400 text-pretty">Draw a complete rectangular room in one drag action.</p>
                            </div>
                        </div>
                        <div className="flex items-start space-x-3">
                            <div className="p-1.5 bg-gray-700/50 rounded text-gray-200 shrink-0"><BoxSelect size={14} /></div>
                            <div>
                                <p className="font-bold text-gray-200 text-xs">3-Pt Rect</p>
                                <p className="text-[10px] text-gray-400 text-pretty">Draw a rotated rectangle. Click & drag base width, then drag out height.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <h4 className="text-sm font-bold text-gray-300 border-b panel-border pb-1 mb-2">Devices & Network</h4>
                    <div className="grid grid-cols-1 gap-3">
                        <div className="flex items-start space-x-3">
                            <div className="p-1.5 bg-gray-700/50 rounded text-gray-200 shrink-0"><Wifi size={14} /></div>
                            <div>
                                <p className="font-bold text-gray-200 text-xs">Anchor (A)</p>
                                <p className="text-[10px] text-gray-400 text-pretty">Place a wireless anchor or access point. Shows coverage radius.</p>
                            </div>
                        </div>
                        <div className="flex items-start space-x-3">
                            <div className="p-1.5 bg-gray-700/50 rounded text-gray-200 shrink-0"><Wand2 size={14} /></div>
                            <div>
                                <p className="font-bold text-gray-200 text-xs">Auto-Place</p>
                                <p className="text-[10px] text-gray-400 text-pretty">Open the automated placement sidebar to fill rooms with anchors.</p>
                            </div>
                        </div>
                        <div className="flex items-start space-x-3">
                            <div className="p-1.5 bg-gray-700/50 rounded text-gray-200 shrink-0"><Router size={14} /></div>
                            <div>
                                <p className="font-bold text-gray-200 text-xs">Hub (H)</p>
                                <p className="text-[10px] text-gray-400 text-pretty">Place a central hub or switch for cables to connect to.</p>
                            </div>
                        </div>
                        <div className="flex items-start space-x-3">
                            <div className="p-1.5 bg-gray-700/50 rounded text-gray-200 shrink-0"><Spline size={14} /></div>
                            <div>
                                <p className="font-bold text-gray-200 text-xs">Route Cable</p>
                                <p className="text-[10px] text-gray-400 text-pretty">Enter Cable Edit Mode to manually draw or re-route cables between devices.</p>
                            </div>
                        </div>
                        <div className="flex items-start space-x-3">
                            <div className="p-1.5 bg-gray-700/50 rounded text-gray-200 shrink-0"><Cable size={14} /></div>
                            <div>
                                <p className="font-bold text-gray-200 text-xs">Cable Settings</p>
                                <p className="text-[10px] text-gray-400 text-pretty">Configure cable types and routing behaviors.</p>
                            </div>
                        </div>
                        <div className="flex items-start space-x-3">
                            <div className="p-1.5 bg-gray-700/50 rounded text-gray-200 shrink-0"><Settings size={14} /></div>
                            <div>
                                <p className="font-bold text-gray-200 text-xs">Anchor Settings</p>
                                <p className="text-[10px] text-gray-400 text-pretty">Adjust coverage radius and shape.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <h4 className="text-sm font-bold text-gray-300 border-b panel-border pb-1 mb-2">Project & Manage</h4>
                    <div className="grid grid-cols-1 gap-3">
                        <div className="flex items-start space-x-3">
                            <div className="p-1.5 bg-gray-700/50 rounded text-gray-200 shrink-0"><FileUp size={14} /></div>
                            <div>
                                <p className="font-bold text-gray-200 text-xs">Import / Export</p>
                                <p className="text-[10px] text-gray-400 text-pretty">Import background images/DXF. Export finished plan as PDF or Image.</p>
                            </div>
                        </div>
                        <div className="flex items-start space-x-3">
                            <div className="p-1.5 bg-gray-700/50 rounded text-gray-200 shrink-0"><BookTemplate size={14} /></div>
                            <div>
                                <p className="font-bold text-gray-200 text-xs">Save Slots</p>
                                <p className="text-[10px] text-gray-400 text-pretty">Quickly save and load up to 5 different versions of your project.</p>
                            </div>
                        </div>
                        <div className="flex items-start space-x-3">
                            <div className="p-1.5 bg-gray-700/50 rounded text-gray-200 shrink-0"><Calculator size={14} /></div>
                            <div>
                                <p className="font-bold text-gray-200 text-xs">BOM</p>
                                <p className="text-[10px] text-gray-400 text-pretty">View a summary of all used devices, cable lengths, and wall totals.</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-3 mt-2 border-t panel-border pt-2">
                            <div className="p-1.5 bg-gray-700/50 rounded text-gray-200 shrink-0"><BoxSelect size={14} className="text-green-400" /></div>
                            <div className="flex-1">
                                <p className="font-bold text-gray-200 text-xs">QA Monitor</p>
                                <p className="text-[10px] text-gray-400 text-pretty">Show performance metrics (FPS, Mem).</p>
                            </div>
                            <QAToggle />
                        </div>
                        <div className="flex items-start space-x-3">
                            <div className="p-1.5 bg-gray-700/50 rounded text-gray-200 shrink-0"><Ruler size={14} /></div>
                            <div>
                                <p className="font-bold text-gray-200 text-xs">Measure (D)</p>
                                <p className="text-[10px] text-gray-400 text-pretty">Measure distances on the plan.</p>
                            </div>
                        </div>
                        <div className="flex items-start space-x-3">
                            <div className="p-1.5 bg-gray-700/50 rounded text-gray-200 shrink-0"><Scaling size={14} /></div>
                            <div>
                                <p className="font-bold text-gray-200 text-xs">Scale (S)</p>
                                <p className="text-[10px] text-gray-400 text-pretty">Set the pixel-to-meter ratio.</p>
                            </div>
                        </div>
                        <div className="flex items-start space-x-3">
                            <div className="p-1.5 bg-gray-700/50 rounded text-gray-200 shrink-0"><FilePlus size={14} /></div>
                            <div>
                                <p className="font-bold text-gray-200 text-xs">New Project</p>
                                <p className="text-[10px] text-gray-400 text-pretty">Clear canvas and start over.</p>
                            </div>
                        </div>
                        <div className="flex items-start space-x-3">
                            <div className="p-1.5 bg-gray-700/50 rounded text-gray-200 shrink-0"><MenuSquare size={14} /></div>
                            <div>
                                <p className="font-bold text-gray-200 text-xs">Selected Walls Toolbar</p>
                                <p className="text-[10px] text-gray-400 text-pretty">Select multiple walls to batch edit <strong>Thickness</strong> and <strong>Material</strong>.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        ),
        searchableText: "toolbar icons interface edit view select undo redo layers draw wall lock rect 3-pt devices network anchor auto-place hub route cable settings project manage import export slots bom measure scale new project"
    },
    {
        id: 'shortcuts',
        title: 'Keyboard Shortcuts',
        content: (
            <div className="overflow-hidden rounded border panel-border">
                <table className="w-full text-left text-xs">
                    <thead className="bg-gray-100 dark:bg-[#333] text-gray-500 dark:text-gray-300">
                        <tr>
                            <th className="p-2 border-r panel-border">Key</th>
                            <th className="p-2">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y panel-border text-secondary">
                        <tr><td className="p-2 border-r panel-border font-mono text-accent">W</td><td className="p-2">Draw Wall</td></tr>
                        <tr><td className="p-2 border-r panel-border font-mono text-accent">Shift + W</td><td className="p-2">Lock / Unlock Walls</td></tr>
                        <tr><td className="p-2 border-r panel-border font-mono text-accent">R</td><td className="p-2">Cycle Rect / 3-Pt Rect</td></tr>
                        <tr><td className="p-2 border-r panel-border font-mono text-accent">Shift + A</td><td className="p-2">Open Auto-Placement</td></tr>
                        <tr><td className="p-2 border-r panel-border font-mono text-accent">D</td><td className="p-2">Measure</td></tr>
                        <tr><td className="p-2 border-r panel-border font-mono text-accent">S</td><td className="p-2">Set Scale</td></tr>
                        <tr><td className="p-2 border-r panel-border font-mono text-accent">A</td><td className="p-2">Place Anchor</td></tr>
                        <tr><td className="p-2 border-r panel-border font-mono text-accent">H</td><td className="p-2">Place Hub</td></tr>
                        <tr><td className="p-2 border-r panel-border font-mono text-accent">V / Esc</td><td className="p-2">Select Mode</td></tr>
                        <tr><td className="p-2 border-r panel-border font-mono text-accent">Ctrl + Z</td><td className="p-2">Undo</td></tr>
                    </tbody>
                </table>
            </div>
        ),
        searchableText: "keyboard shortcuts key action w draw wall shift+w lock unlock walls r cycle rect 3-pt rect shift+a open auto-placement d measure s set scale a place anchor h place hub v esc select mode ctrl+z undo"
    },
    {
        id: 'logic',
        title: 'Tool Logic',
        content: (
            <div className="space-y-3">
                <div>
                    <h4 className="text-sm font-bold text-gray-300">Auto-Placement</h4>
                    <p className="text-xs text-gray-400 mt-1">
                        The system intelligently analyzes room geometry to place anchors. It distinguishes between small compact rooms (1 anchor) and larger complex spaces (multiple anchors), optimizing fo Line-of-Sight coverage.
                    </p>
                </div>
                <div>
                    <h4 className="text-sm font-bold text-gray-300">Cable Routing</h4>
                    <p className="text-xs text-gray-400 mt-1">
                        Cables automatically follow walls (Manhattan routing) to reach hubs. Select <strong>Route</strong> to draw/edit cables.
                    </p>
                </div>
                <div>
                    <h4 className="text-sm font-bold text-gray-300">Wall Detection</h4>
                    <p className="text-xs text-gray-400 mt-1">
                        When importing an image, you can use the Wand tool to detect walls. Ensure lines in your drawing are high-contrast and fully closed for best results.
                    </p>
                </div>
            </div>
        ),
        searchableText: "tool logic auto-placement room geometry anchors small compact rooms large complex spaces line-of-sight coverage cable routing walls manhattan routing hubs star daisy-chain topology wall detection import image wand tool high-contrast"
    }
];

export const HelpSidebar: React.FC = () => {
    const { isHelpOpen, setIsHelpOpen, toolbarSize } = useProjectStore();
    const [sidebarWidth, setSidebarWidth] = useState(window.innerWidth * 0.4); // Start at 40% width
    const [isResizing, setIsResizing] = useState(false);

    // Default expanded state
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        intro: true,
        interface: true,
        shortcuts: true,
        logic: true
    });

    const toggleSection = (id: string) => {
        setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // Resizing Handlers
    const startResizing = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            const newWidth = window.innerWidth - e.clientX;
            if (newWidth >= SIDEBAR_MIN_WIDTH && newWidth <= SIDEBAR_MAX_WIDTH) {
                setSidebarWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);


    if (!isHelpOpen) return null;

    // Dynamic Top based on Toolbar Size
    const topClass = toolbarSize === 'small' ? 'top-[54px]' : 'top-[64px]';

    return (
        <div
            style={{ width: `${sidebarWidth}px` }}
            className={`absolute ${topClass} right-0 bottom-0 panel-bg border-l panel-border shadow-2xl z-40 flex flex-col animate-in slide-in-from-right-4 transition-all duration-300`}
        >
            {/* Resizer Handle */}
            <div
                onMouseDown={startResizing}
                className={`absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 transition-colors z-50 ${isResizing ? 'bg-blue-500' : 'bg-transparent'}`}
            />

            {/* Header */}
            <div className="p-4 border-b panel-border flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-2">
                    <Info size={18} className="text-accent" />
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">Help & Guide</h2>
                </div>
                <button onClick={() => setIsHelpOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                    <X size={18} />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {DOCUMENTATION.map(section => (
                    <div key={section.id} id={`doc-section-${section.id}`} className="border panel-border rounded-lg overflow-hidden bg-white dark:bg-[#252525]">
                        <button
                            onClick={() => toggleSection(section.id)}
                            className="w-full flex items-center justify-between p-3 bg-gray-100 dark:bg-[#333] hover:bg-gray-200 dark:hover:bg-[#3a3a3a] transition-colors text-left"
                        >
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-200 uppercase">
                                {section.title}
                            </span>
                            {expandedSections[section.id] ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                        </button>

                        {/* Animated Expand/Collapse */}
                        {expandedSections[section.id] && (
                            <div className="p-3 text-xs text-gray-400 leading-relaxed border-t border-[#444]">
                                {section.content}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="p-3 border-t panel-border text-[10px] text-center text-gray-500 dark:text-gray-600 bg-gray-100 dark:bg-[#222] shrink-0">
                AnchorCAD Planner v3.0 Documentation
            </div>
        </div>
    );
};
