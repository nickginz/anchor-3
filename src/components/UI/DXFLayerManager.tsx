
import React from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { Eye, EyeOff, X } from 'lucide-react';

interface DXFLayerManagerProps {
    onClose: () => void;
}

export const DXFLayerManager: React.FC<DXFLayerManagerProps> = ({ onClose }) => {
    const { importedObjects, activeImportId, setDxfLayerVisibility, setAllDxfLayersVisibility } = useProjectStore();

    // Find active DXF object
    const activeObj = importedObjects.find(o => o.id === activeImportId && o.type === 'dxf') as any; // Cast using DXFObject locally if needed or rely on check

    if (!activeObj || !activeObj.layers) {
        return (
            <div className="absolute top-16 left-60 w-64 panel-bg border panel-border rounded-lg shadow-2xl z-50 flex flex-col text-primary animate-in slide-in-from-top-2 p-4">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xs font-bold text-secondary">No DXF Selected</h3>
                    <button onClick={onClose}><X size={14} /></button>
                </div>
                <p className="text-[10px] text-secondary">Alt + Click a DXF to view layers.</p>
            </div>
        );
    }

    const layers = activeObj.layers;
    const layerNames = Object.keys(layers).sort();

    return (
        <div className="absolute top-16 left-60 w-64 panel-bg border panel-border rounded-lg shadow-2xl z-50 flex flex-col text-primary animate-in slide-in-from-top-2">
            {/* Header */}
            <div className="flex flex-col p-3 border-b panel-border bg-gray-100 dark:bg-[#333] rounded-t-lg">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold uppercase text-gray-300">DXF Layers: {activeObj.name}</h3>
                    <button onClick={onClose} className="text-secondary hover:text-primary transition-colors">
                        <X size={14} />
                    </button>
                </div>
                <div className="flex space-x-1">
                    <button
                        onClick={() => setAllDxfLayersVisibility(true)}
                        className="flex-1 bg-gray-200 dark:bg-[#444] hover:bg-gray-300 dark:hover:bg-[#555] text-[10px] py-1 rounded text-primary transition-colors"
                    >
                        Show All
                    </button>
                    <button
                        onClick={() => setAllDxfLayersVisibility(false)}
                        className="flex-1 bg-gray-200 dark:bg-[#444] hover:bg-gray-300 dark:hover:bg-[#555] text-[10px] py-1 rounded text-primary transition-colors"
                    >
                        Hide All
                    </button>
                </div>
            </div>

            {/* Layer List */}
            <div className="max-h-64 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
                <div className="space-y-1">
                    {layerNames.map((name) => (
                        <div key={name} className="flex items-center justify-between p-1.5 hover-bg rounded transition-colors group">
                            <span className="text-xs truncate max-w-[160px]" title={name}>{name}</span>
                            <button
                                onClick={() => setDxfLayerVisibility(name, !layers[name])}
                                className={`p-1 rounded transition-colors ${layers[name] ? 'text-accent hover:bg-gray-200 dark:hover:bg-[#444]' : 'text-gray-500 hover:text-gray-700 dark:text-gray-600 dark:hover:text-gray-400'}`}
                                title={layers[name] ? 'Hide Layer' : 'Show Layer'}
                            >
                                {layers[name] ? <Eye size={14} /> : <EyeOff size={14} />}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="p-2 border-t panel-border bg-gray-100 dark:bg-[#333] rounded-b-lg">
                <p className="text-[10px] text-gray-500 text-center">{layerNames.length} Layers Found</p>
            </div>
        </div>
    );
};
