import React from 'react';
import { useProjectStore } from '../../store/useProjectStore';

export const SelectionMenu: React.FC = () => {
    const { selectedIds, walls, anchors, updateWall, removeWall, removeAnchor, removeDimension, setSelection, alignAnchors } = useProjectStore();

    if (selectedIds.length === 0) return null;

    // Filter to see what kind of objects are selected
    const selectedWalls = walls.filter(w => selectedIds.includes(w.id));
    const selectedAnchors = anchors.filter(a => selectedIds.includes(a.id));

    // Show menu if EITHER walls OR anchors are selected (prioritize logic if mixed?)
    // If mixed, show generic delete? Or stack sections?
    // Let's stack sections if needed, or just prioritize one. For now, let's just handle them.

    const hasSelection = selectedWalls.length > 0 || selectedAnchors.length > 0;
    if (!hasSelection) return null;

    // TODO: A better UI would handle mixed selection. For now assuming disjoint or handled simply.

    return (
        <div style={{
            position: 'absolute',
            top: 80, // Below ribbon
            right: 20,
            zIndex: 50,
            backgroundColor: '#333',
            border: '1px solid #555',
            borderRadius: '8px',
            padding: '12px',
            color: 'white',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            width: '200px'
        }}>

            {/* --- WALLS SECTION --- */}
            {selectedWalls.length > 0 && (
                <div className="mb-4 last:mb-0">
                    <div className="flex justify-between items-center mb-2 pb-2 border-b border-[#555]">
                        <h3 className="text-xs font-bold uppercase text-gray-400">
                            {selectedWalls.length} Wall{selectedWalls.length > 1 ? 's' : ''} Selected
                        </h3>
                        <button
                            onClick={() => {
                                selectedWalls.forEach(w => removeWall(w.id));
                                // Cleanup selection if only walls were selected, strictly we should update selection
                                setSelection(selectedIds.filter(id => !selectedWalls.some(w => w.id === id)));
                            }}
                            className="text-red-400 hover:text-red-300 text-xs"
                        >
                            Delete
                        </button>
                    </div>

                    <div className="space-y-3">
                        <div className="flex flex-col space-y-1">
                            <label className="text-[10px] text-gray-400 uppercase">Thickness (m)</label>
                            <input
                                type="number"
                                step="0.05"
                                value={selectedWalls.length > 1 ? '' : selectedWalls[0].thickness}
                                placeholder={selectedWalls.length > 1 ? "Multiple..." : ""}
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val) && val > 0) {
                                        selectedWalls.forEach(w => {
                                            updateWall(w.id, { thickness: val });
                                        });
                                    }
                                }}
                                className="bg-[#222] border border-[#444] rounded px-2 py-1 text-xs w-full focus:outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>
                        <div className="flex flex-col space-y-1">
                            <label className="text-[10px] text-gray-400 uppercase">Presets</label>
                            <div className="flex space-x-1">
                                <button
                                    onClick={() => {
                                        const t = useProjectStore.getState().standardWallThickness;
                                        selectedWalls.forEach(w => updateWall(w.id, { thickness: t, material: 'drywall', attenuation: undefined }));
                                    }}
                                    className="flex-1 bg-[#444] hover:bg-[#555] text-[10px] py-1 rounded text-center transition-colors"
                                >Std</button>
                                <button
                                    onClick={() => {
                                        const t = useProjectStore.getState().thickWallThickness;
                                        selectedWalls.forEach(w => updateWall(w.id, { thickness: t, material: 'drywall', attenuation: undefined }));
                                    }}
                                    className="flex-1 bg-[#444] hover:bg-[#555] text-[10px] py-1 rounded text-center transition-colors"
                                >Thick</button>
                                <button
                                    onClick={() => {
                                        const t = useProjectStore.getState().wideWallThickness;
                                        selectedWalls.forEach(w => updateWall(w.id, { thickness: t, material: 'concrete', attenuation: undefined }));
                                    }}
                                    className="flex-1 bg-[#444] hover:bg-[#555] text-[10px] py-1 rounded text-center transition-colors"
                                >Wide</button>
                            </div>
                        </div>

                        <div className="flex flex-col space-y-1">
                            <label className="text-[10px] text-gray-400 uppercase">Material</label>
                            <select
                                value={selectedWalls.length > 1 ? '' : (selectedWalls[0].material || 'concrete')}
                                onChange={(e) => {
                                    const mat = e.target.value as any;
                                    selectedWalls.forEach(w => updateWall(w.id, { material: mat, attenuation: undefined }));
                                }}
                                className="bg-[#222] border border-[#444] rounded px-2 py-1 text-xs w-full focus:outline-none focus:border-blue-500 transition-colors text-white"
                            >
                                <option value="drywall">Drywall</option>
                                <option value="concrete">Concrete</option>
                                <option value="brick">Brick</option>
                                <option value="metal">Metal</option>
                                <option value="wood">Solid Wood</option>
                                <option value="glass">Glass</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {/* --- ANCHORS SECTION --- */}
            {selectedAnchors.length > 0 && (
                <div className="mb-0">
                    {/* Add divider if walls were also present */}
                    {selectedWalls.length > 0 && <div className="border-t border-[#555] my-3"></div>}

                    <div className="flex justify-between items-center mb-2 pb-2 border-b border-[#555]">
                        <h3 className="text-xs font-bold uppercase text-gray-400">
                            {selectedAnchors.length} Anchor{selectedAnchors.length > 1 ? 's' : ''} Selected
                        </h3>
                        <button
                            onClick={() => {
                                selectedAnchors.forEach(a => removeAnchor(a.id));
                                setSelection(selectedIds.filter(id => !selectedAnchors.some(a => a.id === id)));
                            }}
                            className="text-red-400 hover:text-red-300 text-xs"
                        >
                            Delete
                        </button>
                    </div>

                    {selectedAnchors.length > 1 && (
                        <div className="flex flex-col space-y-2">
                            <label className="text-[10px] text-gray-400 uppercase">Alignment</label>
                            <div className="flex space-x-2">
                                <button
                                    onClick={() => alignAnchors('horizontal')}
                                    className="flex-1 bg-[#444] hover:bg-[#555] text-[10px] py-1 rounded text-center"
                                    title="Align Vertically to Left-most (Same Y)"
                                >
                                    Align Horiz
                                </button>
                                <button
                                    onClick={() => alignAnchors('vertical')}
                                    className="flex-1 bg-[#444] hover:bg-[#555] text-[10px] py-1 rounded text-center"
                                    title="Align Horizontally to Top-most (Same X)"
                                >
                                    Align Vert
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
