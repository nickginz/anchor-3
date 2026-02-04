import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useProjectStore } from '../../../store/useProjectStore';
import { Router, X } from 'lucide-react';

export const HubPropertiesToolbar: React.FC = () => {
    const { hubs, selectedIds, updateHub, setSelection, cables } = useProjectStore(
        useShallow((state) => ({
            hubs: state.hubs,
            selectedIds: state.selectedIds,
            updateHub: state.updateHub,
            setSelection: state.setSelection,
            cables: state.cables
        }))
    );

    const selectedHubs = React.useMemo(() => {
        return hubs.filter(h => selectedIds.includes(h.id));
    }, [hubs, selectedIds]);

    if (selectedHubs.length === 0) return null;

    // Derived States
    const firstHub = selectedHubs[0];
    const isSingle = selectedHubs.length === 1;

    // Color (Common or First)
    const commonColor = selectedHubs.every(h => h.color === firstHub.color)
        ? firstHub.color || '#3b82f6' // Default Blue
        : '#888888';

    // Capacity (Common or First)  // 2 | 6 | 12 | 24
    const commonCapacity = selectedHubs.every(h => h.capacity === firstHub.capacity)
        ? firstHub.capacity
        : 0;

    // Connections Count (Only for Single Selection usually relevant, or Sum?)
    // "conection num" likely means "Capacity" OR "Current Used Ports".
    // I'll show Capacity Selector AND "Used Ports" text.
    const getUsedPorts = (id: string) => cables.filter(c => c.fromId === id || c.toId === id).length;
    const usedPorts = isSingle ? getUsedPorts(firstHub.id) : 0;

    const handleColorChange = (color: string) => {
        selectedHubs.forEach(h => updateHub(h.id, { color }));
    };

    const handleCapacityChange = (cap: number) => {
        selectedHubs.forEach(h => updateHub(h.id, { capacity: cap as any }));
    };

    return (
        <div className="absolute top-20 right-20 bg-white dark:bg-[#222] border border-gray-200 dark:border-[#444] shadow-xl rounded-lg p-3 z-50 flex flex-col space-y-3 animate-in fade-in slide-in-from-right-4 w-48">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#444] pb-2">
                <div className="flex items-center space-x-2">
                    <Router size={14} className="text-blue-500" />
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
                        {isSingle ? (firstHub.name || 'Unhamed Hub') : `${selectedHubs.length} Hubs`}
                    </span>
                </div>
                <button
                    onClick={() => setSelection([])}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                >
                    <X size={14} />
                </button>
            </div>

            {/* Properties Grid */}
            <div className="space-y-3">

                {/* Connection Limit */}
                <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase font-bold">Capacity (Ports)</label>
                    <div className="grid grid-cols-4 gap-1">
                        {[2, 6, 12, 24].map(cap => (
                            <button
                                key={cap}
                                onClick={() => handleCapacityChange(cap)}
                                className={`text-[10px] font-bold py-1 rounded border transition-colors ${commonCapacity === cap
                                    ? 'bg-blue-600 border-blue-600 text-white'
                                    : 'bg-gray-50 dark:bg-[#333] border-gray-200 dark:border-[#555] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#444]'
                                    }`}
                            >
                                {cap}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Color */}
                <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase font-bold">Indicator Color</label>
                    <div className="flex items-center space-x-2">
                        <input
                            type="color"
                            value={commonColor}
                            onChange={(e) => handleColorChange(e.target.value)}
                            className="w-8 h-8 rounded cursor-pointer border-0 p-0 overflow-hidden"
                        />
                        <span className="text-xs text-mono text-gray-500">{commonColor}</span>
                    </div>
                </div>

                {/* Used Ports Info */}
                {isSingle && (
                    <div className="bg-gray-100 dark:bg-[#333] rounded p-2 text-center">
                        <span className="text-xs text-gray-600 dark:text-gray-300">
                            <strong>{usedPorts}</strong> / {firstHub.capacity} Ports Used
                        </span>
                        {/* Visual Bar */}
                        <div className="w-full h-1 bg-gray-300 dark:bg-[#555] mt-1 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-500"
                                style={{ width: `${Math.min((usedPorts / firstHub.capacity) * 100, 100)}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
};
