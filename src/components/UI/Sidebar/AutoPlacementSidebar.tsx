import React, { useCallback } from 'react';
import { useProjectStore } from '../../../store/useProjectStore';
import { generateAutoAnchors, densityOptimization } from '../../../utils/auto-placement';
import { Activity, GitCommit, Sliders, CheckSquare, Wand2, Eye, EyeOff } from 'lucide-react';

// --- Helper Components ---

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
            ? 'bg-blue-900/30 border-blue-500/50 text-blue-400'
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

interface ControlSliderProps {
    label: string;
    value: number;
    min: number;
    max: number;
    unit: string;
    onChange: (val: number) => void;
}

const ControlSlider: React.FC<ControlSliderProps> = ({ label, value, min, max, unit, onChange }) => (
    <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-gray-400">
            <span>{label}</span>
            <span className="font-mono text-gray-300">{value}{unit}</span>
        </div>
        <input
            type="range"
            min={min} max={max}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full h-1.5 bg-[#444] rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
    </div>
);

// --- Main Component ---

export const AutoPlacementSidebar: React.FC = () => {
    const {
        isAutoPlacementOpen, setIsAutoPlacementOpen,
        walls, anchors, layers, scaleRatio,
        anchorRadius, setAnchorRadius,
        showAnchorRadius, setShowAnchorRadius,
        showMedialAxis, setShowMedialAxis,
        skeletonMode, setSkeletonMode,
        showOffsets, setShowOffsets, offsetStep, setOffsetStep,
        showSkeleton, setShowSkeleton,
        optimizationSettings, setOptimizationSettings,
        setTool, activeTool, setAnchors,
        showOverlapCounts, setShowOverlapCounts,
        centroids, setCentroids,
        theme,
        placementAreaEnabled, setPlacementAreaEnabled // Added destructuring
    } = useProjectStore();

    // const [placementAreaEnabled, setPlacementAreaEnabled] = React.useState(false); // Removed local state
    // Density Optimization Target State
    const [densityTarget, setDensityTarget] = React.useState<'small' | 'large'>('small');

    // Theme Colors
    const isDark = theme === 'dark';
    const bgClass = isDark ? 'bg-[#1e1e1e]' : 'bg-white border-r border-gray-200';
    const textHeader = isDark ? 'text-gray-400' : 'text-gray-600';
    const textNormal = isDark ? 'text-gray-300' : 'text-gray-800';
    const inputBg = isDark ? 'bg-[#333] border-[#444] text-white' : 'bg-gray-100 border-gray-300 text-gray-800';

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
        <div className={`fixed left-0 top-16 bottom-0 w-64 ${bgClass} shadow-lg z-40 flex flex-col font-sans transition-colors duration-200`}>
            {/* Header */}
            <div className={`px-4 py-3 border-b ${isDark ? 'border-[#333]' : 'border-gray-200'} flex justify-between items-center`}>
                <div className="flex items-center space-x-2">
                    <Wand2 size={16} className="text-blue-500" />
                    <h3 className={`font-bold text-xs uppercase tracking-wider ${textHeader}`}>Anchor Placement</h3>
                </div>
                {/* Close Button if needed, or just X */}
                <button onClick={() => useProjectStore.getState().setIsAutoPlacementOpen(false)} className={`${isDark ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-black'}`}>
                    &times;
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">

                {/* 1. Tools & Debug */}
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

                        {/* Offset Step (Compact inline) */}
                        {showOffsets && (
                            <>
                                <div className={`w-px h-5 ${isDark ? 'bg-[#444]' : 'bg-gray-300'} mx-1`}></div>
                                <div className={`flex items-center gap-1 ${isDark ? 'bg-[#2d2d2d]' : 'bg-gray-100'} px-1.5 py-1 rounded h-full ml-auto`}>
                                    <span className="text-[9px] text-gray-500">Step</span>
                                    <input
                                        type="number"
                                        value={offsetStep}
                                        onChange={(e) => setOffsetStep(Number(e.target.value))}
                                        className={`w-8 ${inputBg} rounded px-1 text-[10px] text-right h-5 focus:border-blue-500 outline-none`}
                                        step={1}
                                        min={1}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* 2. Target Placement Actions */}
                <div className="space-y-3">
                    <h4 className={`text-xs font-bold ${textHeader} uppercase tracking-wider mt-4`}>Auto Place Actions</h4>
                    <div className="flex gap-2">
                        <ActionButton
                            onClick={() => handleOptimize('small', 'append')}
                            label="Small Rooms"
                            desc="< 110m²"
                            color="bg-emerald-600 hover:bg-emerald-500"
                        />
                        <ActionButton
                            onClick={() => handleOptimize('large', 'append')}
                            label="Large Rooms"
                            desc="≥ 110m²"
                            color="bg-blue-600 hover:bg-blue-500"
                        />
                    </div>
                </div>


                {/* --- Density Optimization --- */}
                <div>
                    <h4 className={`text-[10px] font-bold uppercase ${textHeader} mb-2`}>Density Optimization</h4>

                    <div className={`${isDark ? 'bg-[#2d2d2d]' : 'bg-gray-100'} p-1 rounded mb-3 flex`}>
                        <button
                            onClick={() => setDensityTarget('small')}
                            className={`flex-1 text-[10px] py-1 rounded transition-all ${densityTarget === 'small' ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            Small Rooms
                        </button>
                        <button
                            onClick={() => setDensityTarget('large')}
                            className={`flex-1 text-[10px] py-1 rounded transition-all ${densityTarget === 'large' ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            Big Rooms
                        </button>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                        {[4, 3, 2, 1].map(n => (
                            <button
                                key={n}
                                onClick={() => {
                                    const state = useProjectStore.getState();
                                    const isAreaActive = state.placementAreaEnabled && state.placementArea && state.placementArea.points.length > 2;
                                    const area = isAreaActive ? state.placementArea.points : undefined;
                                    const effectiveScope = isAreaActive ? 'all' : densityTarget;

                                    const newAnchors = densityOptimization(
                                        state.anchors,
                                        n, // User Request: Use N directly (Remove if >= N)
                                        state.scaleRatio,
                                        state.anchorRadius,
                                        state.walls,
                                        effectiveScope,
                                        area // Pass area constraint
                                    );
                                    state.setAnchors(newAnchors);
                                }}
                                className={`h-8 rounded border transition-all text-xs font-medium ${isDark
                                    ? 'bg-[#252526] border-[#333] text-gray-300 hover:bg-[#2d2d2d]'
                                    : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'}`}
                                title={`Remove if overlaps >= ${n}${useProjectStore.getState().placementAreaEnabled ? " (Inside Area Only)" : ""}`}
                            >
                                {n}
                            </button>
                        ))}
                    </div>
                </div>

            </div>
        </div>

    );
};
