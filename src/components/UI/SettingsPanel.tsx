import React from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { X, Settings, Wifi } from 'lucide-react';

export const SettingsPanel: React.FC = () => {
    const {
        isSettingsOpen, setIsSettingsOpen,
        heatmapColorMode, setHeatmapColorMode,
        heatmapThresholds, setHeatmapThresholds
    } = useProjectStore();

    if (!isSettingsOpen) return null;

    const handleThresholdChange = (color: keyof typeof heatmapThresholds, value: number) => {
        const newThresholds = { ...heatmapThresholds, [color]: value };

        // Validation: Radius cannot be less than previous color
        // Order: Red < Orange < Yellow < Green < Blue
        // But logic is "Up to X meters". So Red=3 means 0-3m is Red. 
        // Then Orange=6 means 3-6m is Orange.
        // So Orange MUST be > Red.

        let isValid = true;
        if (color === 'orange' && value <= newThresholds.red) isValid = false;
        if (color === 'yellow' && value <= newThresholds.orange) isValid = false;
        if (color === 'green' && value <= newThresholds.yellow) isValid = false;
        if (color === 'blue' && value <= newThresholds.green) isValid = false;

        // Also check backwards
        if (color === 'red' && value >= newThresholds.orange) isValid = false;
        // ... etc (Simplified validation: just ensure it's strictly increasing)

        // Actually, user experience is better if we just update and let them fix it, 
        // OR clamp values? 
        // Let's just update for now but visually warn if invalid?
        // Or simpler: Just set it.

        setHeatmapThresholds(newThresholds);
    };

    return (
        <div className="fixed top-16 right-0 bottom-0 w-80 bg-[#2b2b2b] border-l border-[#444] shadow-2xl z-40 flex flex-col animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="h-12 border-b border-[#444] flex items-center justify-between px-4 bg-[#333]">
                <div className="flex items-center space-x-2 text-white">
                    <Settings size={18} />
                    <span className="font-bold text-sm uppercase tracking-wide">Global Settings</span>
                </div>
                <button onClick={() => setIsSettingsOpen(false)} className="text-gray-400 hover:text-white">
                    <X size={18} />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* Category: Anchor Settings */}
                <div className="space-y-3">
                    <div className="flex items-center space-x-2 text-blue-400 border-b border-[#444] pb-2">
                        <Wifi size={16} />
                        <h3 className="text-sm font-bold uppercase">Anchor Settings</h3>
                    </div>

                    <div className="space-y-4 pl-2">
                        {/* Color Option Mode */}
                        <div className="space-y-1">
                            <label className="text-xs text-gray-400 block">Signal Color Mode</label>
                            <select
                                value={heatmapColorMode}
                                onChange={(e) => setHeatmapColorMode(e.target.value as any)}
                                className="w-full bg-[#222] border border-[#444] text-white text-xs rounded px-2 py-2 focus:outline-none focus:border-blue-500"
                            >
                                <option value="test">Test (Default Gradient)</option>
                                <option value="standard">Standard (Freq / 15m)</option>
                                <option value="manual">User Defined</option>
                            </select>
                            <p className="text-[10px] text-gray-500 mt-1">
                                {heatmapColorMode === 'test' && "Uses standard dBm gradient (Red > -30, Blue < -90)."}
                                {heatmapColorMode === 'standard' && "Colors based on standard 2.4GHz drop-off up to 15m."}
                                {heatmapColorMode === 'manual' && "Define custom radius (meters) for each color zone."}
                            </p>
                        </div>

                        {/* Manual Thresholds Inputs */}
                        {heatmapColorMode === 'manual' && (
                            <div className="space-y-2 bg-[#1a1a1a] p-3 rounded border border-[#333]">
                                <h4 className="text-xs font-bold text-gray-300 mb-2">Color Zones (Radius in Meters)</h4>

                                <ThresholdInput
                                    label="Red (Strong)"
                                    color="text-red-500"
                                    value={heatmapThresholds.red}
                                    onChange={(v) => handleThresholdChange('red', v)}
                                    max={heatmapThresholds.orange}
                                />
                                <ThresholdInput
                                    label="Orange"
                                    color="text-orange-500"
                                    value={heatmapThresholds.orange}
                                    onChange={(v) => handleThresholdChange('orange', v)}
                                    min={heatmapThresholds.red}
                                    max={heatmapThresholds.yellow}
                                />
                                <ThresholdInput
                                    label="Yellow"
                                    color="text-yellow-500"
                                    value={heatmapThresholds.yellow}
                                    onChange={(v) => handleThresholdChange('yellow', v)}
                                    min={heatmapThresholds.orange}
                                    max={heatmapThresholds.green}
                                />
                                <ThresholdInput
                                    label="Green"
                                    color="text-green-500"
                                    value={heatmapThresholds.green}
                                    onChange={(v) => handleThresholdChange('green', v)}
                                    min={heatmapThresholds.yellow}
                                    max={heatmapThresholds.blue}
                                />
                                <ThresholdInput
                                    label="Blue (Weak)"
                                    color="text-blue-500"
                                    value={heatmapThresholds.blue}
                                    onChange={(v) => handleThresholdChange('blue', v)}
                                    min={heatmapThresholds.green}
                                />
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

const ThresholdInput: React.FC<{
    label: string,
    color: string,
    value: number,
    onChange: (v: number) => void,
    min?: number,
    max?: number
}> = ({ label, color, value, onChange, min, max }) => {
    return (
        <div className="flex items-center justify-between">
            <span className={`text-[10px] ${color} font-medium`}>{label}</span>
            <div className="flex items-center space-x-1">
                <span className="text-[10px] text-gray-500">&lt;</span>
                <input
                    type="number"
                    value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                    className="w-12 bg-[#333] border border-[#555] rounded px-1 py-0.5 text-xs text-right text-white focus:border-blue-500 outline-none"
                />
                <span className="text-[10px] text-gray-500">m</span>
            </div>
        </div>
    );
};
