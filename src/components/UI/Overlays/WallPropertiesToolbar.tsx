import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useProjectStore } from '../../../store/useProjectStore';
import { X, ArrowRight, ArrowDown } from 'lucide-react';

export const WallPropertiesToolbar: React.FC = () => {
    const { walls, selectedIds, updateWall, setSelection } = useProjectStore(
        useShallow((state) => ({
            walls: state.walls,
            selectedIds: state.selectedIds,
            updateWall: state.updateWall,
            setSelection: state.setSelection,
        }))
    );

    const selectedWalls = React.useMemo(() => {
        return walls.filter(w => selectedIds.includes(w.id));
    }, [walls, selectedIds]);

    if (selectedWalls.length === 0) return null;

    // Derived States for Input Values
    // If all selected have same material, show it. Else show "mixed"
    const commonMaterial = selectedWalls.every(w => w.material === selectedWalls[0].material)
        ? selectedWalls[0].material
        : 'mixed';

    // If all selected have same thickness, show it. Else show "mixed" (empty string or placeholder)
    const commonThickness = selectedWalls.every(w => Math.abs(w.thickness - selectedWalls[0].thickness) < 0.001)
        ? selectedWalls[0].thickness
        : '';

    const handleThicknessChange = (val: number) => {
        if (isNaN(val) || val <= 0) return;
        selectedWalls.forEach(w => updateWall(w.id, { thickness: val }));
    };

    const handleMaterialChange = (mat: string) => {
        selectedWalls.forEach(w => updateWall(w.id, { material: mat as any }));
    };

    return (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-white dark:bg-[#222] border border-gray-200 dark:border-[#444] shadow-xl rounded-lg p-2.5 z-50 flex items-center space-x-4 animate-in fade-in slide-in-from-bottom-2">

            {/* Header / Info */}
            <div className="flex flex-col border-r border-gray-200 dark:border-[#444] pr-3 mr-1">
                <span className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Selected</span>
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{selectedWalls.length} Wall{selectedWalls.length > 1 ? 's' : ''}</span>
            </div>

            {/* Thickness Input */}
            <div className="flex flex-col space-y-0.5">
                <span className="text-[10px] text-gray-500 uppercase">Thickness (m)</span>
                <div className="relative">
                    <input
                        type="number"
                        step="0.05"
                        placeholder={commonThickness === '' ? "Mixed" : ""}
                        value={commonThickness}
                        onChange={(e) => handleThicknessChange(parseFloat(e.target.value))}
                        className="w-20 bg-gray-50 dark:bg-[#333] border border-gray-200 dark:border-[#555] rounded px-1.5 py-1 text-xs text-gray-800 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                    {commonThickness === '' && (
                        <span className="absolute left-2 top-1 text-xs text-gray-400 pointer-events-none italic">Mixed</span>
                    )}
                </div>
            </div>

            {/* Material Select */}
            <div className="flex flex-col space-y-0.5">
                <span className="text-[10px] text-gray-500 uppercase">Material</span>
                <select
                    value={commonMaterial}
                    onChange={(e) => handleMaterialChange(e.target.value)}
                    className="w-24 bg-gray-50 dark:bg-[#333] border border-gray-200 dark:border-[#555] rounded px-1.5 py-1 text-xs text-gray-800 dark:text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                    <option value="mixed" disabled hidden>Mixed</option>
                    <option value="drywall">Drywall</option>
                    <option value="concrete">Concrete</option>
                    <option value="brick">Brick</option>
                    <option value="wood">Wood</option>
                    <option value="metal">Metal</option>
                    <option value="glass">Glass</option>
                </select>
            </div>

            {/* Alignment Tools (Single Wall Only) */}
            {selectedWalls.length === 1 && (
                <div className="flex items-center space-x-1 border-l border-gray-200 dark:border-[#444] pl-3 ml-1">
                    <button
                        onClick={() => {
                            const w = selectedWalls[0];
                            const [x1, y1, x2, y2] = w.points;
                            // Make Horizontal: Move Rightest Edge (Max X)
                            // If x1 > x2, modify p1.y to match p2.y
                            // If x2 > x1, modify p2.y to match p1.y
                            if (x1 > x2) updateWall(w.id, { points: [x1, y2, x2, y2] });
                            else updateWall(w.id, { points: [x1, y1, x2, y1] });
                        }}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-[#444] text-gray-500 hover:text-blue-500 transition-colors"
                        title="Make Horizontal (Align Right Edge)"
                    >
                        <ArrowRight size={14} className="transform rotate-0" />
                    </button>
                    <button
                        onClick={() => {
                            const w = selectedWalls[0];
                            const [x1, y1, x2, y2] = w.points;
                            // Make Vertical: Move Bottom Edge (Max Y)
                            // If y1 > y2, modify p1.x to match p2.x
                            // If y2 > y1, modify p2.x to match p1.x
                            if (y1 > y2) updateWall(w.id, { points: [x2, y1, x2, y2] });
                            else updateWall(w.id, { points: [x1, y1, x1, y2] });
                        }}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-[#444] text-gray-500 hover:text-blue-500 transition-colors"
                        title="Make Vertical (Align Bottom Edge)"
                    >
                        <ArrowDown size={14} />
                    </button>
                </div>
            )}

            {/* Close / Deselect */}
            <button
                onClick={() => setSelection([])}
                className="ml-2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#444] text-gray-400 hover:text-red-500 transition-colors"
                title="Deselect All"
            >
                <X size={14} />
            </button>
        </div>
    );
};
