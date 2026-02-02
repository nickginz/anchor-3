import React, { useState, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useProjectStore } from '../../../store/useProjectStore';
import Konva from 'konva';

interface QAMonitorProps {
    stage: Konva.Stage | null;
}

export const QAMonitor: React.FC<QAMonitorProps> = ({ stage }) => {
    const {
        activeTool, walls, anchors, hubs, cables, wallsLocked, theme,
        selectedIds, updateWall, removeWall, removeAnchor, setSelection, alignAnchors, showQAMonitor
    } = useProjectStore(
        useShallow(state => ({
            activeTool: state.activeTool,
            walls: state.walls,
            anchors: state.anchors,
            hubs: state.hubs,
            cables: state.cables,
            wallsLocked: state.wallsLocked,
            theme: state.theme,
            selectedIds: state.selectedIds,
            showQAMonitor: state.showQAMonitor,
            updateWall: state.updateWall,
            removeWall: state.removeWall,
            removeAnchor: state.removeAnchor,
            setSelection: state.setSelection,
            alignAnchors: state.alignAnchors
        }))
    );

    // --- Performance Monitor State ---
    const [fps, setFps] = useState(0);
    const [lag, setLag] = useState<boolean>(false);
    const [memory, setMemory] = useState<any>(null);
    const [eventLog, setEventLog] = useState<string[]>([]);

    // Position State (Initial: Top Right)
    const [position, setPosition] = useState({ x: window.innerWidth - 240, y: 80 });
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    const lastTime = useRef(performance.now());
    const frameCount = useRef(0);
    const lastFpsTime = useRef(performance.now());
    const recentEvents = useRef<{ type: string, time: number }[]>([]);

    const [isCollapsed, setIsCollapsed] = useState(false);

    // --- Effects ---

    // 1. Performance Loop
    useEffect(() => {
        if (!showQAMonitor) return;

        const trackEvent = (type: string) => {
            const now = performance.now();
            recentEvents.current.push({ type, time: now });
            if (recentEvents.current.length > 10) recentEvents.current.shift();
        };

        const onWheel = () => trackEvent('Wheel');
        const onMouseDown = () => trackEvent('MouseDown');
        const onKeyDown = (e: KeyboardEvent) => trackEvent(`Key:${e.code}`);

        window.addEventListener('wheel', onWheel, { passive: true });
        window.addEventListener('mousedown', onMouseDown, { passive: true });
        window.addEventListener('keydown', onKeyDown, { passive: true });

        let animationFrameId: number;

        const loop = () => {
            const now = performance.now();
            const delta = now - lastTime.current;

            // Lag Detection (> 60ms)
            if (delta > 60) {
                setLag(true);
                const culprits = recentEvents.current.filter(e => now - e.time < 500).map(e => e.type);
                if (culprits.length > 0) {
                    const logEntry = `[${new Date().toLocaleTimeString()}] Lag (${delta.toFixed(0)}ms): ${culprits.join(', ')}`;
                    setEventLog(prev => {
                        if (prev.length > 0 && prev[0] === logEntry) return prev;
                        return [logEntry, ...prev].slice(0, 5);
                    });
                }
                setTimeout(() => setLag(false), 500);
            }

            frameCount.current++;
            if (now - lastFpsTime.current >= 1000) {
                setFps(frameCount.current);
                frameCount.current = 0;
                lastFpsTime.current = now;
                if ((performance as any).memory) {
                    setMemory((performance as any).memory);
                }
            }

            lastTime.current = now;
            animationFrameId = requestAnimationFrame(loop);
        };

        loop();

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('wheel', onWheel);
            window.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [showQAMonitor]);

    // 2. Drag Logic
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                setPosition({
                    x: e.clientX - dragOffset.current.x,
                    y: e.clientY - dragOffset.current.y
                });
            }
        };
        const handleMouseUp = () => setIsDragging(false);

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    if (!showQAMonitor) return null;

    const isDark = theme === 'dark';

    // Selection Logic
    const selectedWalls = walls.filter(w => selectedIds.includes(w.id));
    const selectedAnchors = anchors.filter(a => selectedIds.includes(a.id));
    const selectedHubs = hubs.filter(h => selectedIds.includes(h.id));
    const selectedCables = cables.filter(c => selectedIds.includes(c.id));
    const hasSelection = selectedWalls.length > 0 || selectedAnchors.length > 0 || selectedHubs.length > 0 || selectedCables.length > 0;

    const containerStyle: React.CSSProperties = {
        position: 'fixed',
        top: position.y,
        left: position.x,
        zIndex: 9999,
        width: '240px',
        userSelect: 'none',
        borderRadius: '8px',
        padding: '12px',
        fontFamily: 'monospace',
        fontSize: '10px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        backdropFilter: 'blur(4px)',
        border: lag ? '1px solid red' : (isDark ? '1px solid #374151' : '1px solid #e5e7eb'),
        backgroundColor: isDark ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.9)',
        color: isDark ? 'white' : '#1f2937'
    };

    // Helper Styles
    const inputClass = isDark ? "bg-gray-800 border-gray-600 text-white" : "bg-gray-50 border-gray-300 text-gray-900";
    const buttonBgClass = isDark ? "bg-[#444] hover:bg-[#555]" : "bg-gray-100 hover:bg-gray-200 text-gray-700";
    const dividerClass = isDark ? "border-gray-700" : "border-gray-200";

    const handleMouseDown = (e: React.MouseEvent) => {
        // Only allow dragging from header
        if ((e.target as HTMLElement).closest('.draggable-header')) {
            setIsDragging(true);
            dragOffset.current = {
                x: e.clientX - position.x,
                y: e.clientY - position.y
            };
        }
    };

    return (
        <div style={containerStyle} onMouseDown={handleMouseDown}>
            {/* Header / Toggle */}
            <div className={`draggable-header flex justify-between items-center pb-2 border-b ${dividerClass} cursor-grab active:cursor-grabbing`}>
                <div className="flex items-center gap-2">
                    <span className="font-bold text-blue-400">MISSION CONTROL</span>
                    {lag && <span className="text-red-500 font-bold text-[9px] animate-pulse">LAG</span>}
                </div>
                <div className="flex items-center gap-2">
                    <span className={fps < 30 ? "text-red-500" : "text-green-500"}>{fps} FPS</span>
                    <span className="cursor-pointer opacity-50 hover:opacity-100 p-1" onClick={(e) => { e.stopPropagation(); setIsCollapsed(!isCollapsed); }}>
                        {isCollapsed ? '▼' : '▲'}
                    </span>
                </div>
            </div>

            {!isCollapsed && (
                <div className="mt-2 space-y-3">
                    {/* Performance Stats */}
                    <div className="space-y-1 pb-2 border-b border-dashed border-gray-700 opacity-80">
                        {memory && (
                            <div className="flex justify-between">
                                <span className="opacity-60">Memory</span>
                                <span>{(memory.usedJSHeapSize / 1048576).toFixed(1)} / {(memory.jsHeapSizeLimit / 1048576).toFixed(0)} MB</span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span className="opacity-60">Events (Last 5)</span>
                            <span className="text-right text-[9px] max-w-[120px] truncate">{eventLog[0] || "None"}</span>
                        </div>
                    </div>

                    {/* App Stats */}
                    <div className="space-y-1">
                        <div className="flex justify-between">
                            <span className="opacity-60">Tool</span>
                            <span className="font-bold uppercase text-blue-400">{activeTool}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="opacity-60">Locked</span>
                            <span className={wallsLocked ? 'text-red-400' : 'text-green-400'}>{wallsLocked ? 'YES' : 'NO'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="opacity-60">Entities</span>
                            <span>{walls.length}W / {anchors.length}A / {hubs.length}H</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="opacity-60">Scale</span>
                            <span>{(stage?.scaleX() || 1).toFixed(2)}x</span>
                        </div>
                    </div>

                    {/* Dynamic Selection Area */}
                    {hasSelection && (
                        <div className={`pt-2 border-t ${dividerClass} space-y-3`}>
                            {/* Walls Selection */}
                            {selectedWalls.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-yellow-500">{selectedWalls.length} WALLS</span>
                                        <button onClick={() => {
                                            selectedWalls.forEach(w => removeWall(w.id));
                                            setSelection(selectedIds.filter(id => !selectedWalls.some(w => w.id === id)));
                                        }} className="text-red-400 hover:text-red-300">DEL</button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            type="number"
                                            step="0.05"
                                            className={`w-full rounded px-1 py-0.5 border ${inputClass}`}
                                            placeholder="Thick..."
                                            value={selectedWalls.length === 1 ? selectedWalls[0].thickness : ''}
                                            onChange={(e) => selectedWalls.forEach(w => updateWall(w.id, { thickness: parseFloat(e.target.value) || 0.1 }))}
                                        />
                                        <select
                                            className={`w-full rounded px-1 py-0.5 border ${inputClass}`}
                                            onChange={(e) => selectedWalls.forEach(w => updateWall(w.id, { material: e.target.value as any }))}
                                            value={selectedWalls[0].material || 'concrete'}
                                        >
                                            <option value="concrete">Concrete</option>
                                            <option value="drywall">Drywall</option>
                                            <option value="glass">Glass</option>
                                            <option value="brick">Brick</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* Anchors Selection */}
                            {selectedAnchors.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-green-500">{selectedAnchors.length} ANCHORS</span>
                                        <button onClick={() => {
                                            selectedAnchors.forEach(a => removeAnchor(a.id));
                                            setSelection(selectedIds.filter(id => !selectedAnchors.some(a => a.id === id)));
                                        }} className="text-red-400 hover:text-red-300">DEL</button>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center">
                                            <span>Radius (m)</span>
                                            <input
                                                type="number"
                                                className={`w-12 rounded px-1 py-0.5 text-right border ${inputClass}`}
                                                value={selectedAnchors[0].radius}
                                                onChange={(e) => {
                                                    const val = parseFloat(e.target.value);
                                                    const updated = anchors.map(a => selectedIds.includes(a.id) ? { ...a, radius: val } : a);
                                                    useProjectStore.getState().setAnchors(updated);
                                                }}
                                            />
                                        </div>
                                        {selectedAnchors.length > 1 && (
                                            <div className="flex gap-1">
                                                <button onClick={() => alignAnchors('horizontal')} className={`flex-1 py-1 rounded ${buttonBgClass}`}>Align Hor</button>
                                                <button onClick={() => alignAnchors('vertical')} className={`flex-1 py-1 rounded ${buttonBgClass}`}>Align Ver</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Hubs Selection */}
                            {selectedHubs.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-purple-500">{selectedHubs.length} HUBS</span>
                                        <button onClick={() => {
                                            selectedHubs.forEach(h => useProjectStore.getState().removeHub(h.id));
                                            setSelection(selectedIds.filter(id => !selectedHubs.some(h => h.id === id)));
                                        }} className="text-red-400 hover:text-red-300">DEL</button>
                                    </div>
                                    <div className="flex gap-1">
                                        {[2, 6, 12, 24].map(cap => (
                                            <button
                                                key={cap}
                                                onClick={() => selectedHubs.forEach(h => useProjectStore.getState().updateHub(h.id, { capacity: cap as any }))}
                                                className={`flex-1 py-0.5 rounded border border-gray-600 ${selectedHubs.every(h => h.capacity === cap) ? 'bg-purple-600 text-white' : 'bg-transparent text-gray-400'}`}
                                            >
                                                {cap}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
