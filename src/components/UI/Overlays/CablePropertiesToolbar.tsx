import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useProjectStore } from '../../../store/useProjectStore';
import { Cable, Lock, Unlock, X } from 'lucide-react';

export const CablePropertiesToolbar: React.FC = () => {
    const { cables, selectedIds, updateCable, setSelection } = useProjectStore(
        useShallow((state) => ({
            cables: state.cables,
            selectedIds: state.selectedIds,
            updateCable: state.updateCable,
            setSelection: state.setSelection
        }))
    );

    const selectedCables = React.useMemo(() => {
        return (cables || []).filter(c => selectedIds.includes(c.id));
    }, [cables, selectedIds]);

    if (selectedCables.length === 0) return null;

    const isSingle = selectedCables.length === 1;

    // Cable Length (Sum or First)
    const totalLength = selectedCables.reduce((sum, c) => sum + (c.length || 0), 0);

    // Check if all selected are locked
    const allLocked = selectedCables.every(c => c.locked);

    const toggleLock = () => {
        const nextLocked = !allLocked;
        selectedCables.forEach(c => updateCable(c.id, { locked: nextLocked }));
    };

    return (
        <div className="absolute top-20 right-20 bg-white dark:bg-[#222] border border-gray-200 dark:border-[#444] shadow-xl rounded-lg p-3 z-50 flex flex-col space-y-3 animate-in fade-in slide-in-from-right-4 w-48">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#444] pb-2">
                <div className="flex items-center space-x-2">
                    <Cable size={14} className="text-orange-500" />
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
                        {isSingle ? 'Cable Properties' : `${selectedCables.length} Cables`}
                    </span>
                </div>
                <button
                    onClick={() => setSelection([])}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                >
                    <X size={14} />
                </button>
            </div>

            {/* Actions / Info */}
            <div className="space-y-3">

                {/* Lock Toggle */}
                <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500 uppercase font-bold">Routing Lock</span>
                    <button
                        onClick={toggleLock}
                        className={`p-1.5 rounded border transition-all flex items-center gap-2 ${allLocked
                            ? 'bg-red-600/10 border-red-500 text-red-500'
                            : 'bg-green-600/10 border-green-500 text-green-500 hover:bg-green-600/20'
                            }`}
                        title={allLocked ? "Unlock to allow auto-regeneration" : "Lock to preserve manual route"}
                    >
                        {allLocked ? <Lock size={14} /> : <Unlock size={14} />}
                        <span className="text-[10px] font-bold">{allLocked ? 'LOCKED' : 'UNLOCKED'}</span>
                    </button>
                </div>

                {/* Length Info */}
                <div className="bg-gray-100 dark:bg-[#333] rounded p-2 flex flex-col items-center">
                    <span className="text-[10px] text-gray-400 uppercase">Total Length</span>
                    <span className="text-sm font-bold text-blue-500 mono">
                        {totalLength.toFixed(2)}m
                    </span>
                </div>

                {isSingle && (
                    <div className="text-[9px] text-gray-500 italic px-1">
                        {allLocked
                            ? "This cable is protected from 'Regenerate Routes'."
                            : "Auto-routing will overwrite this cable."
                        }
                    </div>
                )}
            </div>
        </div>
    );
};
