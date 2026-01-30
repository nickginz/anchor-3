import React from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { X, Settings, Wifi } from 'lucide-react';

export const SettingsPanel: React.FC = () => {
    const {
        isSettingsOpen, setIsSettingsOpen,
        heatmapColorMode, setHeatmapColorMode,
        heatmapThresholds, setHeatmapThresholds,
        theme, setTheme,
        toolbarSize,

    } = useProjectStore();

    if (!isSettingsOpen) return null;

    const topClass = toolbarSize === 'small' ? 'top-[54px]' : 'top-[64px]';

    const handleThresholdChange = (key: keyof typeof heatmapThresholds, value: number) => {
        setHeatmapThresholds({ ...heatmapThresholds, [key]: value });
    };

    return (
        <div className={`fixed ${topClass} right-0 bottom-0 w-80 panel-bg panel-border border-l shadow-2xl z-40 flex flex-col animate-in slide-in-from-right duration-200 transition-all`}>
            {/* Header */}
            <div className="h-12 border-b panel-border flex items-center justify-between px-4 hover-bg">
                <div className="flex items-center space-x-2 text-primary">
                    <Settings size={18} />
                    <span className="font-bold text-sm uppercase tracking-wide">Global Settings</span>
                </div>
                <button onClick={() => setIsSettingsOpen(false)} className="text-secondary hover:text-primary">
                    <X size={18} />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* Category: Appearance */}
                <div className="space-y-3">
                    <h3 className="text-sm font-bold uppercase text-primary border-b panel-border pb-2">Appearance</h3>
                    <div className="flex items-center justify-between pl-2">
                        <span className="text-xs text-secondary">Theme Mode</span>
                        <div className="flex bg-[var(--bg-input)] rounded p-0.5 border panel-border">
                            <button
                                onClick={() => setTheme('dark')}
                                className={`px-3 py-1 text-[10px] rounded ${theme === 'dark' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
                            >
                                Dark
                            </button>
                            <button
                                onClick={() => setTheme('light')}
                                className={`px-3 py-1 text-[10px] rounded ${theme === 'light' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
                            >
                                Light
                            </button>

                        </div>
                    </div>

                    {/* Toolbar Size */}
                    <div className="flex items-center justify-between pl-2">
                        <span className="text-xs text-secondary">Toolbar Size</span>
                        <div className="flex bg-[var(--bg-input)] rounded p-0.5 border panel-border">
                            <button
                                onClick={() => useProjectStore.getState().setToolbarSize('small')}
                                className={`px-3 py-1 text-[10px] rounded ${useProjectStore.getState().toolbarSize === 'small' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
                            >
                                Small
                            </button>
                            <button
                                onClick={() => useProjectStore.getState().setToolbarSize('big')}
                                className={`px-3 py-1 text-[10px] rounded ${useProjectStore.getState().toolbarSize === 'big' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
                            >
                                Big
                            </button>
                        </div>
                    </div>
                </div>

                {/* Categories: Debug / QA */}
                <div className="space-y-3">
                    <h3 className="text-sm font-bold uppercase text-primary border-b panel-border pb-2">Debug</h3>
                    <div className="flex items-center justify-between pl-2">
                        <span className="text-xs text-secondary">QA Monitor</span>
                        <div className="flex bg-[var(--bg-input)] rounded p-0.5 border panel-border">
                            <button
                                onClick={() => useProjectStore.getState().setShowQAMonitor(true)}
                                className={`px-3 py-1 text-[10px] rounded ${useProjectStore.getState().showQAMonitor ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
                            >
                                On
                            </button>
                            <button
                                onClick={() => useProjectStore.getState().setShowQAMonitor(false)}
                                className={`px-3 py-1 text-[10px] rounded ${!useProjectStore.getState().showQAMonitor ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
                            >
                                Off
                            </button>
                        </div>
                    </div>
                </div>

                {/* Category: Documentation */}
                <div className="space-y-3">
                    <h3 className="text-sm font-bold uppercase text-primary border-b panel-border pb-2">Docs</h3>
                    <div className="pl-2">
                        <button
                            onClick={() => window.open('/app_map.html', '_blank')}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 px-4 rounded flex items-center justify-center space-x-2 transition-colors"
                        >
                            <Settings size={14} className="mr-2" />
                            <span>Open App Architecture Map</span>
                        </button>
                        <p className="text-[10px] text-secondary mt-2 text-center">Interactive map of system functions.</p>
                    </div>
                </div>

                {/* Category: Door Settings (Global Defaults) */}


                {/* Category: Anchor Settings */}
                <div className="space-y-3">
                    <div className="flex items-center space-x-2 text-accent border-b panel-border pb-2">
                        <Wifi size={16} />
                        <h3 className="text-sm font-bold uppercase">Anchor Settings</h3>
                    </div>

                    <div className="space-y-4 pl-2">
                        {/* Color Option Mode */}
                        <div className="space-y-1">
                            <label className="text-xs text-secondary block">Signal Color Mode</label>
                            <select
                                value={heatmapColorMode}
                                onChange={(e) => setHeatmapColorMode(e.target.value as any)}
                                className="w-full input-bg panel-border border text-primary text-xs rounded px-2 py-2 focus:outline-none focus:border-blue-500"
                            >
                                <option value="test">Test (Default Gradient)</option>
                                <option value="standard">Standard (Freq / 15m)</option>
                                <option value="manual">User Defined</option>
                            </select>
                            <p className="text-[10px] text-secondary mt-1">
                                {heatmapColorMode === 'test' && "Uses standard dBm gradient (Red > -30, Blue < -90)."}
                                {heatmapColorMode === 'standard' && "Colors based on standard 2.4GHz drop-off up to 15m."}
                                {heatmapColorMode === 'manual' && "Define custom radius (meters) for each color zone."}
                            </p>
                        </div>

                        {/* Manual Thresholds Inputs */}
                        {heatmapColorMode === 'manual' && (
                            <div className="space-y-2 bg-[var(--bg-input)] p-3 rounded border panel-border">
                                <h4 className="text-xs font-bold text-primary mb-2">Color Zones (Radius in Meters)</h4>

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
        </div >
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
                <span className="text-[10px] text-secondary">&lt;</span>
                <input
                    type="number"
                    min={min}
                    max={max}
                    value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                    className="w-12 input-bg border panel-border rounded px-1 py-0.5 text-xs text-right text-primary focus:border-blue-500 outline-none"
                />
                <span className="text-[10px] text-secondary">m</span>
            </div>
        </div>
    );
};
