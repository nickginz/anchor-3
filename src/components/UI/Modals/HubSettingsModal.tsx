import React from 'react';
import { useProjectStore } from '../../../store/useProjectStore';
import { X, Save, Router } from 'lucide-react';

export const HubSettingsModal: React.FC = () => {
    const { isHubSettingsOpen, setIsHubSettingsOpen, activeHubId, hubs, updateHub } = useProjectStore();

    if (!isHubSettingsOpen || !activeHubId) return null;

    const hub = hubs.find(h => h.id === activeHubId);
    if (!hub) return null;

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        setIsHubSettingsOpen(false);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-overlay" onKeyDown={(e) => e.stopPropagation()}>
            <div className="bg-[#1e1e1e] border border-[#333] rounded-xl shadow-2xl w-80 overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between p-3 border-b border-[#333] bg-[#252525]">
                    <div className="flex items-center space-x-2 text-gray-200">
                        <Router size={16} className="text-blue-400" />
                        <span className="font-bold text-sm">Hub Settings</span>
                    </div>
                    <button
                        onClick={() => setIsHubSettingsOpen(false)}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSave} className="p-4 space-y-4">

                    {/* Name */}
                    <div className="space-y-1">
                        <label className="text-xs text-gray-400 font-medium">Hub Name</label>
                        <input
                            type="text"
                            value={hub.name || ''}
                            onChange={(e) => updateHub(hub.id, { name: e.target.value })}
                            placeholder="Main Switch"
                            className="w-full bg-[#111] border border-[#333] rounded px-2 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                            autoFocus
                        />
                    </div>

                    {/* Capacity */}
                    <div className="space-y-1">
                        <label className="text-xs text-gray-400 font-medium">Port Capacity</label>
                        <div className="grid grid-cols-4 gap-2">
                            {[2, 6, 12, 24].map(cap => (
                                <button
                                    key={cap}
                                    type="button"
                                    onClick={() => updateHub(hub.id, { capacity: cap as any })}
                                    className={`px-2 py-1.5 text-xs font-bold rounded border transition-colors ${hub.capacity === cap
                                        ? 'bg-blue-600 border-blue-500 text-white'
                                        : 'bg-[#2a2a2a] border-[#333] text-gray-400 hover:bg-[#333]'
                                        }`}
                                >
                                    {cap}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Info */}
                    <div className="p-2 bg-blue-900/20 border border-blue-900/50 rounded text-[10px] text-blue-200">
                        Changes are applied immediately.
                    </div>

                    {/* Footer */}
                    <div className="pt-2 flex justify-end">
                        <button
                            type="submit"
                            className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded transition-colors"
                        >
                            <Save size={12} />
                            <span>Done</span>
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};
