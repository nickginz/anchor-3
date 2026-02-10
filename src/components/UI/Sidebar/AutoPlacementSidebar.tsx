import React, { useCallback } from 'react';
import { useProjectStore } from '../../../store/useProjectStore';
import { generateAutoAnchors } from '../../../utils/auto-placement';
import { Activity, GitCommit, Sliders, CheckSquare, Wand2, Eye, EyeOff, Settings } from 'lucide-react';
import { detectRooms, calculatePolygonArea } from '../../../utils/room-detection';
import { getPolygonCentroid } from '../../../utils/geometry';
import { calculateObstacleLoss, calculateFreeSpaceRSSI } from '../../../utils/signal-physics';
import type { Wall, Anchor } from '../../../types';

// --- Median Signal Component --- (Now Categorized Stats)
const MedianSignalDisplay: React.FC<{
    walls: Wall[];
    anchors: Anchor[];
    scaleRatio: number;
    scope: 'small' | 'large' | 'all';
}> = React.memo(({ walls, anchors, scaleRatio, scope }) => {

    const stats = React.useMemo(() => {
        if (!walls || walls.length === 0) return null;

        // 1. Get Room Polygons
        const rooms = detectRooms(walls);
        const relevantRooms = rooms.filter(poly => {
            const areaPx = Math.abs(calculatePolygonArea(poly));
            const areaM2 = areaPx / (scaleRatio * scaleRatio);
            if (scope === 'small') return areaM2 <= 80;
            if (scope === 'large') return areaM2 > 80;
            return true;
        });

        if (relevantRooms.length === 0) return null;

        // 2. Calculate Max Signal for each room
        const roomSignals: number[] = [];

        relevantRooms.forEach(room => {
            const center = getPolygonCentroid(room);
            let maxSignalDb = -120;

            anchors.forEach(a => {
                const distPx = Math.hypot(center.x - a.x, center.y - a.y);
                const distM = distPx / scaleRatio;

                // Obstacle Loss
                const loss = calculateObstacleLoss(
                    { x: a.x / scaleRatio, y: a.y / scaleRatio },
                    { x: center.x / scaleRatio, y: center.y / scaleRatio },
                    walls.map(w => ({ ...w, points: w.points.map(p => p / scaleRatio) as any }))
                );

                const tx = a.txPower || 20;
                let rssi = calculateFreeSpaceRSSI(tx, distM) - loss;

                // Clamp physics artifact for extremely close distance (e.g. centroid placement)
                if (rssi > -10) rssi = -10;

                if (rssi > -100) {
                    if (rssi > maxSignalDb) maxSignalDb = rssi;
                }
            });

            if (maxSignalDb > -120) {
                roomSignals.push(maxSignalDb);
            }
        });

        if (roomSignals.length === 0) return null;

        // 3. Categorize
        // Good/Excellent: > -75
        // Fair: -75 to -85
        // Bad: < -85
        const good = roomSignals.filter(s => s > -75);
        const fair = roomSignals.filter(s => s <= -75 && s > -85);
        const bad = roomSignals.filter(s => s <= -85);

        const avg = (arr: number[]) => arr.length > 0 ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : '-';

        return {
            goodCount: good.length,
            goodAvg: avg(good),
            fairCount: fair.length,
            fairAvg: avg(fair),
            badCount: bad.length,
            badAvg: avg(bad)
        };
    }, [walls, anchors, scaleRatio, scope]);

    if (!stats) return <span className="text-gray-500 text-[10px]">-</span>;

    return (
        <div className="flex flex-col space-y-1 w-full px-2">
            <div className="flex justify-between items-center text-[9px] text-green-500">
                <span>Good (&gt;-75):</span>
                <span className="font-bold">{stats.goodCount} Rooms ({stats.goodAvg} dBm)</span>
            </div>
            <div className="flex justify-between items-center text-[9px] text-orange-400">
                <span>Fair (-75..-85):</span>
                <span className="font-bold">{stats.fairCount} Rooms ({stats.fairAvg} dBm)</span>
            </div>
            <div className="flex justify-between items-center text-[9px] text-red-500">
                <span>Bad (&lt;-85):</span>
                <span className="font-bold">{stats.badCount} Rooms ({stats.badAvg} dBm)</span>
            </div>
        </div>
    );
});

interface ToggleButtonProps {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    title: string;
    isDark?: boolean;
}

const ToggleButton: React.FC<ToggleButtonProps> = ({ active, onClick, icon, title, isDark = true }) => (
    <button
        onClick={onClick}
        title={title}
        className={`w-8 h-8 flex items-center justify-center rounded border transition-all ${active
            ? 'bg-blue-900/30 border-blue-500/50 text-accent'
            : isDark
                ? 'bg-[#252526] border-[#333] text-gray-400 hover:bg-[#2d2d2d]'
                : 'bg-gray-100 border-gray-300 text-gray-500 hover:bg-gray-200'
            }`}
    >
        {icon}
    </button>
);

interface ActionButtonProps {
    onClick: () => void;
    label: string;
    desc: string;
    color: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({ onClick, label, desc, color }) => (
    <button
        onClick={onClick}
        className={`flex-1 p-2 rounded text-center transition-all ${color} text-white shadow-lg`}
    >
        <div className="font-medium text-xs">{label}</div>
        <div className="text-[9px] opacity-80">{desc}</div>
    </button>
);



// --- Main Component ---

export const AutoPlacementSidebar: React.FC = () => {
    const {
        isAutoPlacementOpen,
        walls, anchors, scaleRatio, toolbarSize,

        skeletonMode, setSkeletonMode,
        showOffsets, setShowOffsets, offsetStep, setOffsetStep,
        showOverlapCounts, setShowOverlapCounts,
        centroids, setCentroids,
        theme,
        placementAreaEnabled, setPlacementAreaEnabled,
        anchorRadius, setAnchorRadius, // Added anchorRadius
    } = useProjectStore();

    // const [placementAreaEnabled, setPlacementAreaEnabled] = React.useState(false); // Removed local state
    // Density Optimization Target State
    const [densityTarget, setDensityTarget] = React.useState<'small' | 'large'>('small');

    // Theme Colors
    const isDark = theme === 'dark';
    const bgClass = isDark ? 'bg-[#1e1e1e] border-[#333]' : 'bg-white border-gray-200';
    const textHeader = isDark ? 'text-gray-400' : 'text-gray-600';

    const inputBg = isDark ? 'input-bg border-[#444] text-white' : 'input-bg border-gray-300 text-gray-800';

    // --- Handlers ---
    const handleOptimize = useCallback((scope: 'small' | 'large' | 'all', mode: 'append' | 'replace' = 'replace') => {
        // Prepare options
        const placementArea = useProjectStore.getState().placementArea; // Get placementArea directly from store
        const currentRadius = useProjectStore.getState().anchorRadius;

        const options = {
            targetScope: scope,
            wallThickness: useProjectStore.getState().standardWallThickness,
            scaleRatio,
            radius: currentRadius, // Correct property name for generateAutoAnchors
            anchorRadius: currentRadius,
            placementArea: (placementAreaEnabled && placementArea) ? placementArea.points : undefined,
            minOverlap: 1,
            offsetStep: useProjectStore.getState().offsetStep
        };

        // Determine which anchors to preserve based on mode
        let preservedAnchors = anchors;
        if (mode === 'replace') {
            // Replace mode: Keep MANUAL anchors, discard AUTO anchors
            preservedAnchors = anchors.filter(a => !a.isAuto);
        } else {
            // Append mode: Keep ALL existing anchors (Manual + Auto)
            preservedAnchors = anchors;
        }

        const newAnchorsOmitId = generateAutoAnchors(walls, options, preservedAnchors);

        // Update Store
        // logical set: 1. Set preserved. 2. Append new.
        useProjectStore.getState().setAnchors(preservedAnchors);
        useProjectStore.getState().addAnchors(newAnchorsOmitId);

    }, [walls, anchors, scaleRatio, placementAreaEnabled]);



    if (!isAutoPlacementOpen) return null;

    return (
        <div className={`fixed left-0 ${toolbarSize === 'small' ? 'top-[54px]' : 'top-[64px]'} bottom-0 w-64 ${bgClass} shadow-lg z-40 flex flex-col font-sans transition-all duration-300`}>
            {/* Header */}
            <div className={`px-4 py-3 border-b border-gray-200 dark:border-[#333] flex justify-between items-center`}>
                <div className="flex items-center space-x-2">
                    <Wand2 size={16} className="text-blue-500" />
                    <h3 className={`font-bold text-xs uppercase tracking-wider ${textHeader}`}>Anchor Placement</h3>
                </div>
                {/* Close Button if needed, or just X */}
                <button onClick={() => useProjectStore.getState().setIsAutoPlacementOpen(false)} className={`${isDark ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-black'}`}>
                    &times;
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">

                {/* 1. Global Parameters (User Request: High Visibility) */}
                <div className={`p-3 rounded border ${isDark ? 'bg-[#252526] border-[#333]' : 'bg-gray-50 border-gray-200'} space-y-3`}>
                    <h4 className={`text-[10px] font-bold uppercase ${textHeader} mb-1 flex items-center gap-1.5`}>
                        <Settings size={12} className="text-blue-500" />
                        <span>Global Parameters</span>
                    </h4>

                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] text-secondary font-medium">Anchor Radius</span>
                            <div className="flex items-center gap-1.5">
                                <input
                                    type="number"
                                    step="0.5"
                                    value={anchorRadius}
                                    onChange={(e) => setAnchorRadius(Number(e.target.value))}
                                    className={`w-14 ${inputBg} rounded px-1.5 py-0.5 text-[11px] focus:border-blue-500 outline-none h-6 text-right`}
                                />
                                <span className="text-[9px] text-gray-500 w-3">m</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] text-secondary font-medium">Offset Step</span>
                            <div className="flex items-center gap-1.5">
                                <input
                                    type="number"
                                    step="1"
                                    min="1"
                                    value={offsetStep}
                                    onChange={(e) => setOffsetStep(Number(e.target.value))}
                                    className={`w-14 ${inputBg} rounded px-1.5 py-0.5 text-[11px] focus:border-blue-500 outline-none h-6 text-right`}
                                />
                                <span className="text-[9px] text-gray-500 w-3">m</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Tools & Debug */}
                <div>
                    <h4 className={`text-[10px] font-bold uppercase ${textHeader} mb-2 flex items-center justify-between`}>
                        <span>Tools & Debug</span>
                    </h4>
                    <div className="flex items-center h-8 gap-1.5">
                        {/* Debug Group */}
                        <div className="flex gap-1 items-center">
                            <ToggleButton
                                active={centroids}
                                onClick={() => setCentroids(!centroids)}
                                icon={<CheckSquare size={14} />}
                                title="Centroids"
                                isDark={isDark}
                            />
                            <ToggleButton
                                active={skeletonMode !== 'none'}
                                onClick={() => {
                                    const next = skeletonMode === 'none' ? 'full' : skeletonMode === 'full' ? 'simplified' : 'none';
                                    setSkeletonMode(next);
                                }}
                                icon={
                                    <Activity
                                        size={14}
                                        className={skeletonMode === 'simplified' ? 'text-orange-400' : 'currentColor'}
                                    />
                                }
                                title={`Skeleton: ${skeletonMode.charAt(0).toUpperCase() + skeletonMode.slice(1)} `}
                                isDark={isDark}
                            />
                            <ToggleButton
                                active={showOffsets}
                                onClick={() => setShowOffsets(!showOffsets)}
                                icon={<Sliders size={14} />}
                                title="Offsets"
                                isDark={isDark}
                            />
                            <ToggleButton
                                active={showOverlapCounts}
                                onClick={() => setShowOverlapCounts(!showOverlapCounts)}
                                icon={
                                    <div className="flex items-center justify-center w-full h-full font-bold text-[10px]">
                                        #
                                    </div>
                                }
                                title="Show Overlap Counts"
                                isDark={isDark}
                            />
                        </div>

                        {/* Divider */}
                        <div className={`w-px h-5 ${isDark ? 'bg-[#444]' : 'bg-gray-300'} mx-1`}></div>

                        {/* Area Group */}
                        <div className="flex gap-1 items-center">
                            {/* Visibility/Enable Toggle */}
                            <ToggleButton
                                active={placementAreaEnabled}
                                onClick={() => {
                                    if (placementAreaEnabled) {
                                        setPlacementAreaEnabled(false);
                                        if (useProjectStore.getState().activeTool === 'placement_area') {
                                            useProjectStore.getState().setTool('select');
                                        }
                                    } else {
                                        setPlacementAreaEnabled(true);
                                    }
                                }}
                                icon={placementAreaEnabled ? <Eye size={14} /> : <EyeOff size={14} />}
                                title={placementAreaEnabled ? "Disable Area" : "Enable Area"}
                                isDark={isDark}
                            />

                            {/* Define Tool Button */}
                            <button
                                onClick={() => {
                                    if (!placementAreaEnabled) return;
                                    if (useProjectStore.getState().activeTool === 'placement_area') {
                                        useProjectStore.getState().setTool('select');
                                    } else {
                                        useProjectStore.getState().setTool('placement_area');
                                    }
                                }}
                                disabled={!placementAreaEnabled}
                                className={`w-8 h-8 flex items-center justify-center rounded border transition-all ${placementAreaEnabled
                                    ? useProjectStore.getState().activeTool === 'placement_area'
                                        ? 'bg-orange-600 border-orange-500 text-white' // Active Tool
                                        : isDark ? 'bg-[#252526] border-[#333] text-gray-400 hover:bg-[#2d2d2d]' : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'
                                    : 'opacity-50 cursor-not-allowed bg-transparent border-transparent text-gray-600' // Disabled State
                                    }`}
                                title="Define Area"
                            >
                                <GitCommit size={14} />
                            </button>
                        </div>

                    </div>
                </div>

                {/* 2. Target Placement Actions */}
                <div className="space-y-3">
                    <h4 className={`text-xs font-bold ${textHeader} uppercase tracking-wider mt-4`}>Auto Place Actions</h4>
                    <div className="flex gap-2">
                        <ActionButton
                            onClick={() => handleOptimize('small', 'append')}
                            label="Small Rooms"
                            desc="< 80m²"
                            color="bg-emerald-600 hover:bg-emerald-500"
                        />
                        <ActionButton
                            onClick={() => handleOptimize('large', 'append')}
                            label="Large Rooms"
                            desc="≥ 80m²"
                            color="bg-blue-600 hover:bg-blue-500"
                        />
                    </div>
                </div>


                {/* --- Smart Reduction & Scope --- */}
                <div className="mt-4 border-t border-gray-700/50 pt-4">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className={`text-[10px] font-bold uppercase ${textHeader}`}>Smart Reduction</h4>

                        {/* Scope Toggle (Moved here) */}
                        <div className={`flex rounded p-0.5 border ${isDark ? 'bg-[#2d2d2d] border-[#444]' : 'bg-gray-100 border-gray-300'}`}>
                            <button
                                onClick={() => setDensityTarget('small')}
                                className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all ${densityTarget === 'small'
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                Small
                            </button>
                            <button
                                onClick={() => setDensityTarget('large')}
                                className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all ${densityTarget === 'large'
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                Big
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 mb-3">
                        {[0.05, 0.10, 0.15, 0.20].map(pct => (
                            <button
                                key={pct}
                                onClick={() => useProjectStore.getState().optimizeAnchorCount(pct, densityTarget)}
                                className={`h-8 rounded border transition-all text-xs font-bold ${isDark
                                    ? 'bg-[#252526] border-[#333] text-rose-400 hover:bg-[#2d2d2d]'
                                    : 'bg-gray-100 border-gray-300 text-rose-600 hover:bg-gray-200'}`}
                                title={`Reduce ${densityTarget} room anchors by ${(pct * 100).toFixed(0)}%`}
                            >
                                -{(pct * 100).toFixed(0)}%
                            </button>
                        ))}
                    </div>

                    {/* Median Signal Strength Data (User Request) */}
                    {(() => {
                        // Inline Calculation for Display
                        // 1. Get Rooms in Scope
                        // const { detectRooms, calculatePolygonArea } = require('../../../utils/room-detection'); // Lazy import if needed or already available?
                        // Actually better to use existing helper if possible or duplicate logic for simplicity in rendering loop
                        // Let's assume detectRooms is available or implemented here.
                        // Since I can't easily import detectRooms inside render without breaking hooks rules or bundling...
                        // I will add the imports to the top of file in next step if missing.
                        // For now I will assume imports are added.

                        // Wait, I can't add imports with this tool call if I'm replacing this block.
                        // I need to add imports FIRST or assume they are there.
                        // I will add imports in this same tool call using a multi-replace if possible? No, 'replace_file_content' is single block.
                        // I will blindly use them and then fix imports in next step if validation fails.
                        // OR better: I'll use a placeholder and then fix it.

                        // Actually, calculating this Every Render might be heavy.
                        // But for < 50 rooms it's instant.

                        return (
                            <div className={`text-[10px] text-center py-1 rounded border ${isDark ? 'bg-[#222] border-[#333] text-gray-400' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                                <span className="opacity-70 mr-1">Current Median Coverage:</span>
                                <MedianSignalDisplay
                                    walls={walls} anchors={anchors} scaleRatio={scaleRatio} scope={densityTarget}
                                />
                            </div>
                        );
                    })()}
                </div>

            </div>
        </div>
    );
};
