import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../../store/useProjectStore';
import { X, ChevronRight, ChevronDown, Info } from 'lucide-react';

const SIDEBAR_MIN_WIDTH = 300;
const SIDEBAR_MAX_WIDTH = 1200;

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
        title: 'The Interface',
        content: (
            <div className="space-y-3">
                <p>A breakdown of the main UI elements and their functions.</p>

                <h4 className="text-sm font-bold text-gray-300 mt-2">Edit Tools</h4>
                <ul className="list-disc pl-4 space-y-1 text-xs text-gray-400">
                    <li><strong className="text-gray-200">Select (V)</strong>: Standard cursor for selecting and moving objects.</li>
                    <li><strong className="text-gray-200">Undo (Ctrl+Z) / Redo</strong>: Revert or re-apply changes.</li>
                </ul>

                <h4 className="text-sm font-bold text-gray-300 mt-2">Draw Tools</h4>
                <ul className="list-disc pl-4 space-y-1 text-xs text-gray-400">
                    <li><strong className="text-gray-200">Wall (W)</strong>: Draw linear walls. <strong className="text-gray-200">Shift+W</strong> to toggle Wall Lock.</li>
                    <li><strong className="text-gray-200">Rect Wall (R)</strong>: Cycle between Standard Rectangle and 3-Point Rectangle.</li>
                    <li><strong className="text-gray-200">3-Pt Rect</strong>: Draw rotated rectangles by defining base and height.</li>
                    <li><strong className="text-gray-200">Lock</strong>: Prevent accidental edits to walls (Shift+W).</li>
                </ul>

                <h4 className="text-sm font-bold text-gray-300 mt-2">Measure & Scale</h4>
                <ul className="list-disc pl-4 space-y-1 text-xs text-gray-400">
                    <li><strong className="text-gray-200">Ruler (D)</strong>: Measure distance between two points.</li>
                    <li><strong className="text-gray-200">Scale (S)</strong>: Calibrate the floor plan.</li>
                </ul>

                <h4 className="text-sm font-bold text-gray-300 mt-2">Project & Network</h4>
                <ul className="list-disc pl-4 space-y-1 text-xs text-gray-400">
                    <li><strong className="text-gray-200">Import</strong>: Load background images or DXF files.</li>
                    <li><strong className="text-gray-200">Export</strong>: Save view as PDF or Image.</li>
                    <li><strong className="text-gray-200">Auto-Connect</strong>: Route cables to nearest hubs.</li>
                    <li><strong className="text-gray-200">Shift+A</strong>: Open Auto-Placement Sidebar.</li>
                </ul>
            </div>
        ),
        searchableText: "interface ui elements edit tools select v undo ctrl+z redo draw tools wall w shift+w lock rect wall r 3-pt rect cycle measure scale ruler d s calibration project network import export auto-connect shift+a auto-placement"
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
                        Cables automatically follow walls (Manhattan routing) to reach hubs. You can choose between <strong>Star</strong> (direct) or <strong>Daisy-Chain</strong> topologies in the Network toolbar.
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
