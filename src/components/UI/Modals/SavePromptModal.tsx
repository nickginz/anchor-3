import React from 'react';
import { AlertCircle, Save, Trash2, X } from 'lucide-react';

interface SavePromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    onDontSave: () => void;
}

export const SavePromptModal: React.FC<SavePromptModalProps> = ({ isOpen, onClose, onSave, onDontSave }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
            <div className="bg-[#1e1e1e] border border-[var(--border-color)] rounded-lg shadow-2xl w-[400px] flex flex-col text-sm text-[var(--text-primary)] animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] bg-[#252525] rounded-t-lg">
                    <div className="flex items-center gap-2 text-orange-400">
                        <AlertCircle size={18} />
                        <span className="font-semibold text-white">Unsaved Changes</span>
                    </div>
                    <button onClick={onClose} className="hover:text-white text-secondary transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <p className="text-gray-300 leading-relaxed">
                        You have unsaved changes in your current project. Do you want to save them before creating a new project?
                    </p>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-[var(--border-color)] bg-[#252525] rounded-b-lg flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-3 py-2 text-secondary hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onDontSave}
                        className="flex items-center gap-2 px-3 py-2 bg-red-900/50 hover:bg-red-900 text-red-200 border border-red-800 rounded transition-colors"
                    >
                        <Trash2 size={14} />
                        Don't Save
                    </button>
                    <button
                        onClick={onSave}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                    >
                        <Save size={14} />
                        Save Project
                    </button>
                </div>
            </div>
        </div>
    );
};
