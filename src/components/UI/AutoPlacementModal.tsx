import React, { useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { generateAutoAnchors } from '../../utils/auto-placement';
import { Wand2, X, Play } from 'lucide-react';

interface AutoPlacementModalProps {
    onClose: () => void;
}

export const AutoPlacementModal: React.FC<AutoPlacementModalProps> = ({ onClose }) => {
    const { walls, anchors, addAnchors, setAnchorMode, anchorRadius, setAnchorRadius, anchorShape, showAnchorRadius, scaleRatio } = useProjectStore();

    // Local state for preview or settings
    const [radius, setRadius] = useState(anchorRadius || 15);
    const [spacingFactor, setSpacingFactor] = useState(1.9);
    const [status, setStatus] = useState<string>('');

    const handleRun = () => {
        if (walls.length === 0) {
            setStatus('No walls detected. Draw walls first.');
            return;
        }

        try {
            const newAnchors = generateAutoAnchors(walls, {
                radius: radius,
                shape: anchorShape,
                showRadius: showAnchorRadius,
                minOverlap: 3,
                wallThickness: 0.1,
                scaleRatio: scaleRatio,
                spacingFactor: spacingFactor
            }, anchors);

            if (newAnchors.length === 0) {
                setStatus('Could not find suitable spots. Try adjusting radius.');
                return;
            }

            setAnchorMode('auto');
            addAnchors(newAnchors);
            setStatus(`Placed ${newAnchors.length} anchors successfully!`);

            // Auto close after brief success msg? Or let user close.
            setTimeout(() => {
                onClose();
            }, 1000);

        } catch (e) {
            console.error(e);
            setStatus('Error occurred during placement.');
        }
    };

    return (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 panel-bg border panel-border p-4 shadow-2xl rounded-lg z-50 w-80 animate-in slide-in-from-top-4 fade-in">
            <div className="flex justify-between items-center mb-4 border-b panel-border pb-2">
                <div className="flex items-center space-x-2">
                    <Wand2 size={18} className="text-blue-400" />
                    <h3 className="font-bold text-sm uppercase tracking-wide text-primary">Auto Placement</h3>
                </div>
                <button onClick={onClose} className="text-secondary hover:text-primary transition-colors">
                    <X size={18} />
                </button>
            </div>

            <div className="space-y-4">
                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-secondary">
                        <span>Detection Radius (m)</span>
                        <span className="font-mono text-blue-400">{radius}m</span>
                    </div>
                    <input
                        type="range"
                        min="5"
                        max="50"
                        step="1"
                        value={radius}
                        onChange={(e) => {
                            setRadius(parseFloat(e.target.value));
                            setAnchorRadius(parseFloat(e.target.value)); // Sync with global
                        }}
                        className="w-full h-1.5 input-bg rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <p className="text-[10px] text-secondary leading-tight">
                        Smaller radius = more anchors. Larger radius = fewer anchors.
                    </p>
                </div>

                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-secondary">
                        <span>Spacing Factor</span>
                        <span className="font-mono text-blue-400">{spacingFactor}x</span>
                    </div>
                    <input
                        type="range"
                        min="1.0"
                        max="2.5"
                        step="0.1"
                        value={spacingFactor}
                        onChange={(e) => setSpacingFactor(parseFloat(e.target.value))}
                        className="w-full h-1.5 input-bg rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <p className="text-[10px] text-secondary leading-tight">
                        1.0 = Tight (High Overlap). 2.0 = Sparse (Less Overlap).
                    </p>
                </div>

                {status && (
                    <div className={`text-xs p-2 rounded ${status.includes('Error') || status.includes('No') ? 'bg-red-900/50 text-red-200' : 'bg-green-900/50 text-green-200'}`}>
                        {status}
                    </div>
                )}

                <div className="flex space-x-2 pt-2">
                    <button
                        onClick={onClose}
                        className="flex-1 px-3 py-2 hover-bg rounded text-xs font-medium transition-colors text-primary"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleRun}
                        className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded text-xs font-bold text-white shadow-lg flex items-center justify-center space-x-2 transition-transform active:scale-95"
                    >
                        <Play size={14} fill="currentColor" />
                        <span>Generate</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
