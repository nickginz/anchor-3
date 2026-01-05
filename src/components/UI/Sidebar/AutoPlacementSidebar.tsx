import React, { useCallback } from 'react';
import { useProjectStore } from '../../../store/useProjectStore';
import { generateAutoAnchors } from '../../../utils/auto-placement';
import { Activity, GitCommit, Sliders, CheckSquare } from 'lucide-react';

// --- Helper Components ---

interface ToggleButtonProps {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    title: string;
}

const ToggleButton: React.FC<ToggleButtonProps> = ({ active, onClick, icon, title }) => (
    <button
        onClick={onClick}
        title={title}
        className={`w-8 h-8 flex items-center justify-center rounded border transition-all ${active
            ? 'bg-blue-900/30 border-blue-500/50 text-blue-400'
            : 'bg-[#252526] border-[#333] text-gray-400 hover:bg-[#2d2d2d]'
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
        optimizationSettings, setOptimizationSettings,
        showMedialAxis, setShowMedialAxis,
        showOffsets, setShowOffsets, offsetStep, setOffsetStep,
        centroids, toggleLayer,
        walls, anchors, scaleRatio,
        anchorRadius,
        placementAreaEnabled, setPlacementAreaEnabled
    } = useProjectStore();

    const handleOptimize = useCallback((scope: 'small' | 'large' | 'all') => {
        console.log(`[Auto] Optimizing for scope: ${scope}`);

        const options = {
            radius: optimizationSettings.radius || anchorRadius,
            scaleRatio: scaleRatio,
            minOverlap: 1,
            wallThickness: 20,
            targetScope: scope,
            coverageTarget: optimizationSettings.coverageTarget,
            minSignalStrength: optimizationSettings.minSignalStrength,
            placementArea: useProjectStore.getState().placementArea?.points,
            placementAreaEnabled: useProjectStore.getState().placementAreaEnabled
        };

        // 1. Filter out previous AUTO anchors (Keep Manual ones)
        // If scope is 'all', we might want to clear ALL auto anchors?
        // Or if scope is 'small', only clear anchors in small rooms?
        // For simplicity and robustness: "Apply Optimization" clears ALL previous *auto* anchors
        // and re-runs the current generation. This ensures the result matches the settings.
        const preservedAnchors = anchors.filter(a => !a.isAuto);

        const newAnchorsOmitId = generateAutoAnchors(walls, options, preservedAnchors);

        // 2. Add preserved Manual anchors + New Auto anchors
        // Note: generateAutoAnchors returns new points. We need to merge.
        // But `addAnchors` in store usually *appends*.
        // We probably need `setAnchors` to replace the list.

        // However, `newAnchorsOmitId` are valid Anchor objects without IDs.
        // We'll trust the store to assign IDs if we pass them, or we can just reconstruct here if needed.
        // Let's use `setAnchors` with the merged list to be safe.
        // Wait, `addAnchors` generates IDs. `setAnchors` expects full objects.
        // We need to keep preserved anchors (with IDs) and add new ones (which need IDs).

        // Actually, `addAnchors` appends. So we should first SET the preserved ones, then ADD the new ones.
        useProjectStore.getState().setAnchors(preservedAnchors);
        useProjectStore.getState().addAnchors(newAnchorsOmitId);

    }, [walls, anchors, scaleRatio, optimizationSettings, anchorRadius]);

    const handleClearAndOptimize = useCallback(() => {
        if (optimizationSettings.targetScope === 'all') {
            if (confirm("This will clear ALL anchors and regenerate. Continue?")) {
                useProjectStore.getState().setAnchors([]);
                setTimeout(() => handleOptimize('all'), 50);
            }
        } else {
            handleOptimize(optimizationSettings.targetScope);
        }
    }, [handleOptimize, optimizationSettings.targetScope]);

    if (!isAutoPlacementOpen) return null;

    return (
        <div className="fixed left-0 top-14 bottom-0 w-80 bg-[#1e1e1e] border-r border-[#333] shadow-xl z-50 flex flex-col font-sans text-gray-200">
            {/* Header */}
            <div className="p-4 border-b border-[#333] flex justify-between items-center bg-[#252526]">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Activity size={18} className="text-blue-400" />
                    Anchor Placement
                </h3>
                <button
                    onClick={() => setIsAutoPlacementOpen(false)}
                    className="hover:bg-[#333] p-1 rounded transition-colors"
                >
                    &times;
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* 1. Debug Layers & Area Tools */}
                <div className="space-y-2 pb-4 border-b border-[#333]">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex justify-between">
                        <span>Tools & Debug</span>
                    </h4>
                    <div className="flex items-center h-8 gap-1.5">
                        {/* Debug Group */}
                        <div className="flex gap-1 items-center">
                            <ToggleButton
                                active={centroids}
                                onClick={() => toggleLayer('centroids')}
                                icon={<CheckSquare size={14} />}
                                title="Centroids"
                            />
                            <ToggleButton
                                active={showMedialAxis}
                                onClick={() => setShowMedialAxis(!showMedialAxis)}
                                icon={<Activity size={14} />}
                                title="Skeleton"
                            />
                            <ToggleButton
                                active={showOffsets}
                                onClick={() => setShowOffsets(!showOffsets)}
                                icon={<Sliders size={14} />}
                                title="Offsets"
                            />
                        </div>

                        {/* Divider */}
                        <div className="w-px h-5 bg-[#444] mx-1"></div>

                        {/* Area Group */}
                        <div className="flex gap-1 items-center">
                            <button
                                onClick={() => useProjectStore.getState().setTool('placement_area')}
                                className={`w-8 h-8 flex items-center justify-center rounded border transition-all ${useProjectStore.getState().activeTool === 'placement_area'
                                    ? 'bg-orange-900/40 border-orange-500 text-orange-400'
                                    : 'bg-[#252526] border-[#333] text-gray-400 hover:bg-[#2d2d2d]'
                                    }`}
                                title="Define Area"
                            >
                                <GitCommit size={14} />
                            </button>
                            <button
                                onClick={() => setPlacementAreaEnabled(!placementAreaEnabled)}
                                className={`w-8 h-8 flex items-center justify-center rounded border transition-all ${placementAreaEnabled
                                    ? 'bg-orange-600 border-orange-500 text-white'
                                    : 'bg-[#252526] border-[#333] text-gray-400 hover:bg-[#2d2d2d]'
                                    }`}
                                title={placementAreaEnabled ? "Area Enabled" : "Area Disabled"}
                            >
                                <CheckSquare size={14} />
                            </button>
                        </div>

                        {/* Offset Step (Compact inline) */}
                        {showOffsets && (
                            <>
                                <div className="w-px h-5 bg-[#444] mx-1"></div>
                                <div className="flex items-center gap-1 bg-[#2d2d2d] px-1.5 py-1 rounded h-full ml-auto">
                                    <span className="text-[9px] text-gray-500">Step</span>
                                    <input
                                        type="number"
                                        value={offsetStep}
                                        onChange={(e) => setOffsetStep(Number(e.target.value))}
                                        className="w-8 bg-[#333] border border-[#444] rounded px-1 text-[10px] text-white text-right h-5 focus:border-blue-500 outline-none"
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

                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-4">Auto Place Actions</h4>
                    <div className="flex gap-2">
                        <ActionButton
                            onClick={() => handleOptimize('small')}
                            label="Small Rooms"
                            desc="< 110m²"
                            color="bg-emerald-600 hover:bg-emerald-500"
                        />
                        <ActionButton
                            onClick={() => handleOptimize('large')}
                            label="Large Rooms"
                            desc="≥ 110m²"
                            color="bg-blue-600 hover:bg-blue-500"
                        />
                    </div>
                </div>

                {/* 3. Optimization Controls */}
                <div className="space-y-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                        <Sliders size={14} /> Optimization Settings
                    </h4>

                    {/* Scope Selector */}
                    <div className="bg-[#2d2d2d] p-1 rounded-md flex text-xs">
                        {(['small', 'large', 'all'] as const).map((s) => (
                            <button
                                key={s}
                                onClick={() => setOptimizationSettings({ targetScope: s })}
                                className={`flex-1 py-1.5 rounded capitalize transition-all ${optimizationSettings.targetScope === s
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-gray-400 hover:text-gray-200'
                                    }`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>

                    {/* Radius Slider */}
                    <ControlSlider
                        label="Anchor Radius"
                        value={optimizationSettings.radius}
                        min={3} max={30} unit="m"
                        onChange={(v: number) => setOptimizationSettings({ radius: v })}
                    />

                    {/* Coverage Target (Placeholder logic for now) */}
                    <ControlSlider
                        label="Target Coverage"
                        value={optimizationSettings.coverageTarget}
                        min={50} max={100} unit="%"
                        onChange={(v: number) => setOptimizationSettings({ coverageTarget: v })}
                    />

                    {/* Min Signal (Placeholder logic) */}
                    <ControlSlider
                        label="Min Signal"
                        value={optimizationSettings.minSignalStrength}
                        min={-90} max={-40} unit="dBm"
                        onChange={(v: number) => setOptimizationSettings({ minSignalStrength: v })}
                    />

                    <button
                        className="w-full py-2 bg-[#333] hover:bg-[#444] border border-[#555] rounded text-sm font-medium transition-colors"
                        onClick={handleClearAndOptimize}
                    >
                        Apply Optimization
                    </button>
                    <p className="text-[10px] text-gray-500 text-center">
                        (Filters by selected scope)
                    </p>

                </div>
            </div>
        </div>
    );
};
