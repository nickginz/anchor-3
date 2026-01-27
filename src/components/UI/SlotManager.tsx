import React, { useState, useEffect } from 'react';
import { Save, FolderOpen, Trash2, X } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';

interface SlotManagerProps {
    onClose: () => void;
}

interface SlotMetadata {
    timestamp: number;
    preview?: string; // Optional: could store thumbnail or logic later
}

export const SlotManager: React.FC<SlotManagerProps> = ({ onClose }) => {
    const [slots, setSlots] = useState<(SlotMetadata | null)[]>([null, null, null]);

    // Load metadata on mount
    useEffect(() => {
        const loadedSlots = [1, 2, 3].map(i => {
            const key = `anchor_project_slot_${i}`;
            const stored = localStorage.getItem(key);
            if (stored) {
                try {
                    const data = JSON.parse(stored);
                    return { timestamp: data.timestamp || Date.now() };
                } catch (e) {
                    return null;
                }
            }
            return null;
        });
        setSlots(loadedSlots);
    }, []);

    const handleSave = (index: number) => {
        const isOverwrite = !!slots[index];
        const message = isOverwrite
            ? `Overwrite Slot ${index + 1}? Previous data will be lost.`
            : `Save current project to Slot ${index + 1}?`;

        if (!confirm(message)) return;

        const state = useProjectStore.getState();
        const data = {
            version: 1,
            timestamp: Date.now(),
            scaleRatio: state.scaleRatio,
            walls: state.walls,
            anchors: state.anchors,
            dimensions: state.dimensions,
            layers: state.layers,
            wallPreset: state.wallPreset,
            anchorMode: state.anchorMode,
            theme: state.theme,
            hubs: state.hubs,
            cables: state.cables,
            allowOutsideConnections: state.allowOutsideConnections,
            anchorsSettings: {
                radius: state.anchorRadius,
                shape: state.anchorShape,
                showRadius: state.showAnchorRadius
            },
            heatmapSettings: {
                show: state.showHeatmap,
                resolution: state.heatmapResolution,
                thresholds: state.heatmapThresholds
            },
            importedObjects: state.importedObjects,
            // Additional state if needed
            activeHubCapacity: state.activeHubCapacity,
            activeTopology: state.activeTopology
        };

        const key = `anchor_project_slot_${index + 1}`;
        try {
            localStorage.setItem(key, JSON.stringify(data));
            const newSlots = [...slots];
            newSlots[index] = { timestamp: data.timestamp };
            setSlots(newSlots);
        } catch (err) {
            console.error(err);
            alert("Failed to save slot. Storage might be full.");
        }
    };

    const handleLoad = (index: number) => {
        if (!confirm(`Load Slot ${index + 1}? Any unsaved changes on the canvas will be lost.`)) return;

        const key = `anchor_project_slot_${index + 1}`;
        const stored = localStorage.getItem(key);
        if (!stored) return;
        try {
            const data = JSON.parse(stored);
            if (!data || (!data.walls && !data.anchors)) throw new Error("Invalid data");
            useProjectStore.getState().loadProject(data);
            onClose();
        } catch (err) {
            console.error(err);
            alert("Failed to load slot. File might be corrupted.");
        }
    };

    const handleClear = (index: number) => {
        if (!confirm(`Are you sure you want to DELETE Slot ${index + 1}? This action cannot be undone.`)) return;
        const key = `anchor_project_slot_${index + 1}`;
        localStorage.removeItem(key);
        const newSlots = [...slots];
        newSlots[index] = null;
        setSlots(newSlots);
    };

    return (
        <div className="absolute top-16 left-0 w-72 bg-[#333] border border-[#555] p-3 shadow-2xl rounded-b-lg z-50 text-white animate-in slide-in-from-top-2">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-[#444]">
                <h3 className="text-xs font-bold uppercase text-gray-400">Quick Save Slots</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={14} /></button>
            </div>

            <div className="flex flex-col space-y-2">
                {slots.map((slot, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded bg-[#222] border border-[#444]">
                        <div className="flex flex-col">
                            <span className="text-xs font-semibold text-gray-300">Slot {i + 1}</span>
                            <span className="text-[10px] text-gray-500">
                                {slot ? new Date(slot.timestamp).toLocaleString() : 'Empty'}
                            </span>
                        </div>
                        <div className="flex space-x-1">
                            <button
                                onClick={() => handleSave(i)}
                                className="p-1.5 rounded hover:bg-[#333] text-blue-400"
                                title="Overwirte / Save"
                            >
                                <Save size={14} />
                            </button>
                            <button
                                onClick={() => handleLoad(i)}
                                disabled={!slot}
                                className={`p-1.5 rounded hover:bg-[#333] ${!slot ? 'text-gray-600 cursor-not-allowed' : 'text-green-400'}`}
                                title="Load"
                            >
                                <FolderOpen size={14} />
                            </button>
                            {slot && (
                                <button
                                    onClick={() => handleClear(i)}
                                    className="p-1.5 rounded hover:bg-[#333] text-red-400"
                                    title="Clear Slot"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-3 text-[10px] text-gray-500 text-center">
                Stored locally in browser
            </div>
        </div>
    );
};
