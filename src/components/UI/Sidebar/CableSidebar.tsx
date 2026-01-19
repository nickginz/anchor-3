import React from 'react';
import { useProjectStore } from '../../../store/useProjectStore';
import { Cable, Network, GitCommit, AlignJustify, RefreshCw, X } from 'lucide-react';

export const CableSidebar: React.FC = () => {
    const {
        isCableSidebarOpen,
        setIsCableSidebarOpen,
        cableSettings,
        setCableSettings,
        regenerateCables,
        theme,
        toolbarSize
    } = useProjectStore();

    if (!isCableSidebarOpen) return null;

    const isDark = theme === 'dark';
    const bgClass = isDark ? 'bg-[#1e1e1e]' : 'bg-white border-r border-gray-200';
    const textHeader = isDark ? 'text-gray-400' : 'text-gray-600';
    const inputBg = isDark ? 'bg-[#333] border-[#444] text-white' : 'bg-gray-100 border-gray-300 text-gray-800';

    return (
        <div className={`fixed left-0 ${toolbarSize === 'small' ? 'top-[46px]' : 'top-16'} bottom-0 w-64 ${bgClass} shadow-lg z-40 flex flex-col font-sans transition-all duration-300`}>
            {/* Header */}
            <div className={`px-4 py-3 border-b ${isDark ? 'border-[#333]' : 'border-gray-200'} flex justify-between items-center`}>
                <div className="flex items-center space-x-2">
                    <Cable size={16} className="text-orange-500" />
                    <h3 className={`font-bold text-xs uppercase tracking-wider ${textHeader}`}>Cable Routing</h3>
                </div>
                <button
                    onClick={() => setIsCableSidebarOpen(false)}
                    className={`${isDark ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-black'}`}
                >
                    <X size={16} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">

                {/* 1. Topology Selection */}
                <div>
                    <h4 className={`text-[10px] font-bold uppercase ${textHeader} mb-2 flex items-center gap-2`}>
                        <Network size={12} />
                        <span>Topology</span>
                    </h4>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setCableSettings({ topology: 'star' })}
                            className={`flex-1 p-2 rounded border text-xs font-medium transition-all ${cableSettings.topology === 'star'
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : `${isDark ? 'bg-[#252526] border-[#333] hover:bg-[#2d2d2d]' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'} ${isDark ? 'text-gray-300' : 'text-gray-700'}`
                                }`}
                        >
                            Star (Direct)
                        </button>
                        <button
                            onClick={() => setCableSettings({ topology: 'daisy' })}
                            className={`flex-1 p-2 rounded border text-xs font-medium transition-all ${cableSettings.topology === 'daisy'
                                ? 'bg-orange-600 border-orange-600 text-white'
                                : `${isDark ? 'bg-[#252526] border-[#333] hover:bg-[#2d2d2d]' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'} ${isDark ? 'text-gray-300' : 'text-gray-700'}`
                                }`}
                        >
                            Daisy Chain
                        </button>
                    </div>
                </div>

                {/* 2. Physical Properties */}
                <div>
                    <h4 className={`text-[10px] font-bold uppercase ${textHeader} mb-2 flex items-center gap-2`}>
                        <GitCommit size={12} />
                        <span>Physical Properties</span>
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                        {/* Ceiling Height */}
                        <div>
                            <label className="text-[10px] text-gray-500 mb-1 block">Ceiling Height (m)</label>
                            <input
                                type="number"
                                value={cableSettings.ceilingHeight}
                                onChange={(e) => setCableSettings({ ceilingHeight: Number(e.target.value) })}
                                className={`w-full ${inputBg} rounded px-2 py-1.5 text-xs focus:border-blue-500 outline-none`}
                                step={0.1}
                                min={0}
                            />
                        </div>
                        {/* Service Loop */}
                        <div>
                            <label className="text-[10px] text-gray-500 mb-1 block">Service Loop (m)</label>
                            <input
                                type="number"
                                value={cableSettings.serviceLoop}
                                onChange={(e) => setCableSettings({ serviceLoop: Number(e.target.value) })}
                                className={`w-full ${inputBg} rounded px-2 py-1.5 text-xs focus:border-blue-500 outline-none`}
                                step={0.5}
                                min={0}
                            />
                        </div>
                    </div>
                </div>

                {/* 3. Visualization */}
                <div>
                    <h4 className={`text-[10px] font-bold uppercase ${textHeader} mb-2 flex items-center gap-2`}>
                        <AlignJustify size={12} />
                        <span>Visualization</span>
                    </h4>
                    <button
                        onClick={() => setCableSettings({ showParallel: !cableSettings.showParallel })}
                        className={`w-full flex items-center justify-between p-2 rounded border transition-all ${cableSettings.showParallel
                            ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400'
                            : `${isDark ? 'bg-[#252526] border-[#333]' : 'bg-gray-50 border-gray-200'} text-gray-500`
                            }`}
                    >
                        <span className="text-xs font-medium">Electrical View (Parallel)</span>
                        <div className={`w-8 h-4 rounded-full relative transition-colors ${cableSettings.showParallel ? 'bg-indigo-500' : 'bg-gray-600'}`}>
                            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${cableSettings.showParallel ? 'left-4.5' : 'left-0.5'}`} style={{ left: cableSettings.showParallel ? '18px' : '2px' }}></div>
                        </div>
                    </button>
                    <p className="text-[9px] text-gray-500 mt-1 px-1">
                        Display cables as parallel bus lines instead of overlapping paths.
                    </p>
                </div>

                {/* 4. Actions */}
                <div className="pt-4 border-t border-gray-700/50">
                    <button
                        onClick={regenerateCables}
                        className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                        <RefreshCw size={14} />
                        <span className="text-xs font-bold uppercase tracking-wide">Regenerate Routes</span>
                    </button>
                    <p className="text-[9px] text-gray-500 mt-2 text-center">
                        This will delete existing cables and generate new optimal paths based on current settings.
                    </p>
                </div>

            </div>
        </div>
    );
};
