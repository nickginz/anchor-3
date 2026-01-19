import React from 'react';
import { useProjectStore } from '../../store/useProjectStore';

export const SelectionMenu: React.FC = () => {
    const { selectedIds, walls, anchors, hubs, cables, updateWall, removeWall, removeAnchor, setSelection, alignAnchors, theme } = useProjectStore();

    const isDark = theme === 'dark';

    // Theme Styles
    const containerStyle = {
        position: 'absolute' as const,
        top: 80,
        right: 20,
        zIndex: 50,
        backgroundColor: isDark ? '#333' : 'white',
        border: isDark ? '1px solid #555' : '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '12px',
        color: isDark ? 'white' : '#1f2937', // gray-800
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        width: '200px'
    };

    const inputClass = isDark
        ? "bg-[#222] border border-[#444] text-white"
        : "bg-gray-50 border-gray-300 text-gray-900";

    const dividerClass = isDark ? "border-[#555]" : "border-gray-200";
    const headerTextClass = isDark ? "text-gray-400" : "text-gray-500";
    const subTextClass = isDark ? "text-gray-400" : "text-gray-500";
    const buttonBgClass = isDark ? "bg-[#444] hover:bg-[#555]" : "bg-gray-100 hover:bg-gray-200 text-gray-700";

    if (selectedIds.length === 0) return null;

    // Filter to see what kind of objects are selected
    const selectedWalls = walls.filter(w => selectedIds.includes(w.id));
    const selectedAnchors = anchors.filter(a => selectedIds.includes(a.id));
    const selectedHubs = hubs.filter(h => selectedIds.includes(h.id));
    const selectedCables = cables.filter(c => selectedIds.includes(c.id));


    const hasSelection = selectedWalls.length > 0 || selectedAnchors.length > 0 || selectedHubs.length > 0 || selectedCables.length > 0;
    if (!hasSelection) return null;

    return (
        <div style={containerStyle}>

            {/* --- WALLS SECTION --- */}
            {selectedWalls.length > 0 && (
                <div className="mb-4 last:mb-0">
                    <div className={`flex justify-between items-center mb-2 pb-2 border-b ${dividerClass}`}>
                        <h3 className={`text-xs font-bold uppercase ${headerTextClass}`}>
                            {selectedWalls.length} Wall{selectedWalls.length > 1 ? 's' : ''} Selected
                        </h3>
                        <button
                            onClick={() => {
                                selectedWalls.forEach(w => removeWall(w.id));
                                setSelection(selectedIds.filter(id => !selectedWalls.some(w => w.id === id)));
                            }}
                            className="text-red-400 hover:text-red-300 text-xs"
                        >
                            Delete
                        </button>
                    </div>

                    <div className="space-y-3">
                        <div className="flex flex-col space-y-1">
                            <label className={`text-[10px] ${subTextClass} uppercase`}>Thickness (m)</label>
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
                                className={`${inputClass} rounded px-2 py-1 text-xs w-full focus:outline-none focus:border-blue-500 transition-colors`}
                            />
                        </div>
                        <div className="flex flex-col space-y-1">
                            <label className={`text-[10px] ${subTextClass} uppercase`}>Presets</label>
                            <div className="flex space-x-1">
                                <button
                                    onClick={() => {
                                        const t = useProjectStore.getState().standardWallThickness;
                                        selectedWalls.forEach(w => updateWall(w.id, { thickness: t, material: 'drywall', attenuation: undefined }));
                                    }}
                                    className={`flex-1 ${buttonBgClass} text-[10px] py-1 rounded text-center transition-colors`}
                                >Std</button>
                                <button
                                    onClick={() => {
                                        const t = useProjectStore.getState().thickWallThickness;
                                        selectedWalls.forEach(w => updateWall(w.id, { thickness: t, material: 'drywall', attenuation: undefined }));
                                    }}
                                    className={`flex-1 ${buttonBgClass} text-[10px] py-1 rounded text-center transition-colors`}
                                >Thick</button>
                                <button
                                    onClick={() => {
                                        const t = useProjectStore.getState().wideWallThickness;
                                        selectedWalls.forEach(w => updateWall(w.id, { thickness: t, material: 'concrete', attenuation: undefined }));
                                    }}
                                    className={`flex-1 ${buttonBgClass} text-[10px] py-1 rounded text-center transition-colors`}
                                >Wide</button>
                            </div>
                        </div>

                        <div className="flex flex-col space-y-1">
                            <label className={`text-[10px] ${subTextClass} uppercase`}>Material</label>
                            <select
                                value={selectedWalls.length > 1 ? '' : (selectedWalls[0].material || 'concrete')}
                                onChange={(e) => {
                                    const mat = e.target.value as any;
                                    selectedWalls.forEach(w => updateWall(w.id, { material: mat, attenuation: undefined }));
                                }}
                                className={`${inputClass} rounded px-2 py-1 text-xs w-full focus:outline-none focus:border-blue-500 transition-colors`}
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

            {/* --- CABLES SECTION --- */}
            {selectedCables.length > 0 && (
                <div className="mb-4 last:mb-0">
                    <div className={`flex justify-between items-center mb-2 pb-2 border-b ${dividerClass}`}>
                        <h3 className={`text-xs font-bold uppercase ${headerTextClass}`}>
                            {selectedCables.length} Cable{selectedCables.length > 1 ? 's' : ''} Selected
                        </h3>
                        <button
                            onClick={() => {
                                // Deleting cables not implemented directly via delete key yet, but here we can
                                // Actually, deleting a cable disconnects it.
                                // We don't have a direct 'removeCable' action exposed in destructuring, use store directly or add it.
                                // let's stick to just property editing for now as delete is tricky with auto-connect.
                                // But user asked for drag/edit generally.
                            }}
                            className="text-red-400 hover:text-red-300 text-xs opacity-50 cursor-not-allowed"
                            title="Delete disabled (manage via endpoints)"
                        >
                            Delete
                        </button>
                    </div>

                    <div className="space-y-3">
                        <div className="flex flex-col space-y-1">
                            <label className={`text-[10px] ${subTextClass} uppercase`}>Color</label>
                            <input
                                type="color"
                                value={selectedCables[0].color || '#00ff00'}
                                onChange={(e) => {
                                    selectedCables.forEach(c => {
                                        useProjectStore.getState().updateCable(c.id, { color: e.target.value });
                                    });
                                }}
                                className="w-full h-8 rounded cursor-pointer"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* --- ANCHORS SECTION --- */}
            {selectedAnchors.length > 0 && (
                <div className="mb-0">
                    {/* Add divider if walls were also present */}
                    {selectedWalls.length > 0 && <div className={`border-t ${dividerClass} my-3`}></div>}

                    <div className={`flex justify-between items-center mb-2 pb-2 border-b ${dividerClass}`}>
                        <h3 className={`text-xs font-bold uppercase ${headerTextClass}`}>
                            {selectedAnchors.length} Anchor{selectedAnchors.length > 1 ? 's' : ''} Selected
                        </h3>
                        <button
                            onClick={() => {
                                if (selectedAnchors.some(a => a.locked)) return;
                                selectedAnchors.forEach(a => removeAnchor(a.id));
                                setSelection(selectedIds.filter(id => !selectedAnchors.some(a => a.id === id)));
                            }}
                            disabled={selectedAnchors.some(a => a.locked)}
                            className={`text-xs ${selectedAnchors.some(a => a.locked) ? 'text-gray-600 cursor-not-allowed' : 'text-red-400 hover:text-red-300'}`}
                        >
                            Delete
                        </button>
                    </div>

                    <div className="space-y-3">
                        {/* Manual Override */}
                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="manual-mode-check"
                                checked={selectedAnchors.every(a => !a.isAuto)}
                                onChange={(e) => {
                                    const newIsManual = e.target.checked;
                                    const newIsAuto = !newIsManual;

                                    const updatedAnchors = anchors.map(a => {
                                        if (selectedIds.includes(a.id)) {
                                            let newId = a.id;
                                            if (newIsManual && a.isAuto && a.id.startsWith('A')) {
                                                newId = 'AM' + a.id.substring(1);
                                            }
                                            return { ...a, isAuto: newIsAuto, id: newId };
                                        }
                                        return a;
                                    });

                                    const newSelectedIds = selectedAnchors.map(a => {
                                        if (newIsManual && a.isAuto && a.id.startsWith('A')) {
                                            return 'AM' + a.id.substring(1);
                                        }
                                        return a.id;
                                    });

                                    useProjectStore.getState().setAnchors(updatedAnchors);
                                    useProjectStore.getState().setSelection(newSelectedIds);
                                }}
                                className="accent-blue-500 rounded sm"
                            />
                            <label htmlFor="manual-mode-check" className={`text-[10px] ${subTextClass} uppercase select-none cursor-pointer`}>
                                Manual Mode
                            </label>
                        </div>

                        {/* Lock Position */}
                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="lock-position-check"
                                checked={selectedAnchors.every(a => a.locked)}
                                onChange={(e) => {
                                    const newLocked = e.target.checked;
                                    const updatedAnchors = anchors.map(a =>
                                        selectedIds.includes(a.id)
                                            ? { ...a, locked: newLocked }
                                            : a
                                    );
                                    useProjectStore.getState().setAnchors(updatedAnchors);
                                }}
                                className="accent-red-500 rounded sm"
                            />
                            <label htmlFor="lock-position-check" className={`text-[10px] ${subTextClass} uppercase select-none cursor-pointer`}>
                                Lock Position <span className="text-gray-500 normal-case">(Prevent Move/Del)</span>
                            </label>
                        </div>

                        {/* Radius Control */}
                        <div className="flex flex-col space-y-1">
                            <label className={`text-[10px] ${subTextClass} uppercase flex justify-between`}>
                                Radius (m)
                                <span className={isDark ? "text-gray-300" : "text-gray-600"}>{selectedAnchors[0]?.radius ?? useProjectStore.getState().anchorRadius}m</span>
                            </label>
                            <input
                                type="range"
                                min="3" max="30" step="1"
                                value={selectedAnchors[0]?.radius ?? useProjectStore.getState().anchorRadius}
                                onChange={(e) => {
                                    const val = Number(e.target.value);
                                    const updatedAnchors = anchors.map(a =>
                                        selectedIds.includes(a.id)
                                            ? { ...a, radius: val }
                                            : a
                                    );
                                    useProjectStore.getState().setAnchors(updatedAnchors);
                                }}
                                className={`w-full h-1.5 ${isDark ? "bg-[#444]" : "bg-gray-200"} rounded-lg appearance-none cursor-pointer accent-blue-500`}
                            />
                        </div>

                        {selectedAnchors.length > 1 && (
                            <div className={`flex flex-col space-y-2 pt-2 border-t ${dividerClass}`}>
                                <label className={`text-[10px] ${subTextClass} uppercase`}>Alignment</label>
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => alignAnchors('horizontal')}
                                        className={`flex-1 ${buttonBgClass} text-[10px] py-1 rounded text-center transition-colors`}
                                        title="Align Vertically to Left-most (Same Y)"
                                    >
                                        Align Horiz
                                    </button>
                                    <button
                                        onClick={() => alignAnchors('vertical')}
                                        className={`flex-1 ${buttonBgClass} text-[10px] py-1 rounded text-center transition-colors`}
                                        title="Align Horizontally to Top-most (Same X)"
                                    >
                                        Align Vert
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {/* --- HUBS SECTION --- */}
            {selectedHubs.length > 0 && (
                <div className="mb-0">
                    {/* Add divider if walls or anchors were also present */}
                    {(selectedWalls.length > 0 || selectedAnchors.length > 0) && <div className={`border-t ${dividerClass} my-3`}></div>}

                    <div className={`flex justify-between items-center mb-2 pb-2 border-b ${dividerClass}`}>
                        <h3 className={`text-xs font-bold uppercase ${headerTextClass}`}>
                            {selectedHubs.length} Hub{selectedHubs.length > 1 ? 's' : ''} Selected
                        </h3>
                        <button
                            onClick={() => {
                                selectedHubs.forEach(h => useProjectStore.getState().removeHub(h.id));
                                setSelection(selectedIds.filter(id => !selectedHubs.some(h => h.id === id)));
                            }}
                            className="text-red-400 hover:text-red-300 text-xs"
                        >
                            Delete
                        </button>
                    </div>

                    <div className="space-y-3">
                        <div className="flex flex-col space-y-1">
                            <label className={`text-[10px] ${subTextClass} uppercase`}>Capacity</label>
                            <div className="flex space-x-1">
                                {[2, 6, 12, 24].map((cap) => (
                                    <button
                                        key={cap}
                                        onClick={() => {
                                            selectedHubs.forEach(h => useProjectStore.getState().updateHub(h.id, { capacity: cap as any }));
                                        }}
                                        className={`flex-1 py-1 rounded text-[10px] transition-colors
                                            ${selectedHubs.every(h => h.capacity === cap)
                                                ? 'bg-blue-500 text-white'
                                                : buttonBgClass
                                            }
                                        `}
                                    >
                                        {cap}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};
