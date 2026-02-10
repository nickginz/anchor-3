import React, { useEffect, useState } from 'react';
import { calculateBOM, type BOMData } from '../../../utils/bom-calculator';
import { X, Calculator, Download } from 'lucide-react';
import { useProjectStore } from '../../../store/useProjectStore';

export const BOMModal: React.FC = () => {
    const isOpen = useProjectStore((state) => state.isBOMOpen);
    const onClose = () => useProjectStore.getState().setIsBOMOpen(false);

    const [data, setData] = useState<BOMData | null>(null);

    useEffect(() => {
        if (isOpen) {
            setData(calculateBOM());
        }
    }, [isOpen]);

    if (!isOpen || !data) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-overlay">
            <div className="bg-[#1e1e1e] border border-[var(--border-color)] rounded-xl shadow-2xl w-[500px] flex flex-col text-sm text-[var(--text-primary)] animate-scale-in">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] bg-[#252525] rounded-t-lg">
                    <div className="flex items-center gap-2">
                        <Calculator size={16} className="text-[var(--accent-color)]" />
                        <span className="font-semibold">Bill of Materials</span>
                    </div>
                    <button onClick={onClose} className="hover:text-white text-secondary transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-[#2a2a2a] p-3 rounded border border-[var(--border-color)]">
                            <span className="text-secondary text-xs block mb-1">Total Anchors</span>
                            <span className="text-xl font-bold text-white">{data.anchors}</span>
                        </div>
                        <div className="bg-[#2a2a2a] p-3 rounded border border-[var(--border-color)]">
                            <span className="text-secondary text-xs block mb-1">Rooms Detected</span>
                            <span className="text-xl font-bold text-white">{data.rooms}</span>
                        </div>
                    </div>

                    {/* Cables */}
                    <div className="bg-[#2a2a2a] p-3 rounded border border-[var(--border-color)]">
                        <h4 className="border-b border-[var(--border-color)] pb-2 mb-2 font-medium">Cabling</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="text-secondary text-xs block">Cable Runs</span>
                                <span className="text-lg font-bold">{data.cables.count}</span>
                            </div>
                            <div>
                                <span className="text-secondary text-xs block">Total Length (+20%)</span>
                                <span className="text-lg font-bold text-[var(--accent-color)]">
                                    {data.cables.totalLengthWithMargin.toFixed(1)} m
                                </span>
                                <span className="text-[10px] text-secondary block">
                                    (Raw: {data.cables.totalLength.toFixed(1)} m)
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Hubs */}
                    <div className="bg-[#2a2a2a] p-3 rounded border border-[var(--border-color)]">
                        <h4 className="border-b border-[var(--border-color)] pb-2 mb-2 font-medium">Connection Hubs</h4>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-secondary">Total Hubs</span>
                            <span className="font-bold">{data.hubs.total}</span>
                        </div>
                        <div className="space-y-1">
                            {Object.entries(data.hubs.byCapacity).map(([capacity, count]) => (
                                <div key={capacity} className="flex justify-between text-xs">
                                    <span className="text-secondary">{capacity}-Port Hub</span>
                                    <span>{count}</span>
                                </div>
                            ))}
                            {data.hubs.total === 0 && <div className="text-xs text-secondary italic">No hubs placed</div>}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-[var(--border-color)] bg-[#252525] rounded-b-lg flex justify-end">
                    <button
                        className="flex items-center gap-2 px-3 py-1.5 bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white rounded text-xs transition-colors"
                        onClick={() => alert("Excel Export Not Implemented Yet")} // TODO
                    >
                        <Download size={14} />
                        Export Excel
                    </button>
                </div>
            </div>
        </div>
    );
};
