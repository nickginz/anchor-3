import React, { useState } from 'react';
import { useProjectStore } from '../../../store/useProjectStore';
import { FileUp, Crop, FileText, Image as ImageIcon, Check, FileCode } from 'lucide-react';
import { generateHtmlContent } from '../../../utils/html-export-utils';


export const ExportSidebar: React.FC = () => {
    const {
        isExportSidebarOpen,
        setIsExportSidebarOpen,
        theme,
        exportRegion,
        setTool,
        activeTool,
        setExportRegion,
        toolbarSize
    } = useProjectStore();

    const [format, setFormat] = useState<'png' | 'pdf' | 'html'>('pdf');
    const [pdfSize, setPdfSize] = useState<'a4' | 'a3' | 'a2' | 'a1' | 'a0'>('a4');
    const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('landscape');
    const quality = 2; // Pixel Ratio

    if (!isExportSidebarOpen) return null;

    const isDark = theme === 'dark';
    const bgClass = isDark ? 'bg-[#1e1e1e] border-[#333]' : 'bg-white border-gray-200';
    const textClass = isDark ? 'text-gray-200' : 'text-gray-800';
    const subTextClass = isDark ? 'text-gray-400' : 'text-gray-500';

    const handleDrawRegion = () => {
        if (activeTool === 'export_area') {
            setTool('select');
            setExportRegion(null);
        } else {
            setTool('export_area');
        }
    };

    const handleExport = async () => {
        let fileHandle = null;

        // Try to get File Handle immediately to satisfy User Gesture requirement
        try {
            // @ts-ignore
            if (window.showSaveFilePicker) {
                const defaultName = `project-${new Date().toISOString().slice(0, 10)}`;

                let ext = '';
                let mime = '';
                let description = '';

                if (format === 'png') {
                    ext = 'png'; mime = 'image/png'; description = 'PNG Image';
                } else if (format === 'pdf') {
                    ext = 'pdf'; mime = 'application/pdf'; description = 'PDF Document';
                } else if (format === 'html') {
                    ext = 'html'; mime = 'text/html'; description = 'Web Page';
                }

                // @ts-ignore
                fileHandle = await window.showSaveFilePicker({
                    suggestedName: `${defaultName}.${ext}`,
                    types: [{
                        description,
                        accept: { [mime]: [`.${ext}`] }
                    }],
                });
            }
        } catch (err: any) {
            if (err.name === 'AbortError') {
                return; // User cancelled
            }
            console.warn('File Picker failed, falling back to legacy download:', err);
        }

        // HTML Export - Handle specific write logic here since we have the content ready
        if (format === 'html') {
            const state = useProjectStore.getState();
            let htmlContent = "";
            try {
                htmlContent = generateHtmlContent(state, "AnchorCAD_Project");
            } catch (e) {
                console.error("HTML Generation Failed:", e);
                alert("Failed to generate HTML content. Please check console for details.");
                return;
            }

            if (!htmlContent) {
                console.error("HTML Generation produced empty string options:", { state });
                alert("Generated HTML is empty. Export aborted.");
                return;
            }
            console.log("Generated HTML length:", htmlContent.length);

            let writeSuccess = false;

            if (fileHandle) {
                try {
                    // @ts-ignore
                    const writable = await fileHandle.createWritable();
                    // @ts-ignore
                    await writable.write(htmlContent);
                    // @ts-ignore
                    await writable.close();
                    writeSuccess = true;
                } catch (err) {
                    console.error("Failed to write to file handle:", err);
                    // Fallback to legacy download below
                }
            }

            if (!writeSuccess) {
                // Legacy Fallback
                const blob = new Blob([htmlContent], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `project-${new Date().toISOString().slice(0, 10)}.html`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }
            return;
        }

        // PDF/PNG - Dispatch event for canvas processing
        const event = new CustomEvent('request-export', {
            detail: {
                format,
                pdfSize,
                orientation,
                quality,
                region: exportRegion,
                fileHandle // Pass the handle
            }
        });
        window.dispatchEvent(event);
    };

    return (
        <div className={`fixed left-0 ${toolbarSize === 'small' ? 'top-[54px]' : 'top-[64px]'} bottom-8 w-64 ${bgClass} border-r z-20 flex flex-col shadow-lg transition-all duration-300`}>
            {/* Header */}
            <div className={`p-3 border-b ${isDark ? 'border-[#333]' : 'border-gray-200'} flex justify-between items-center`}>
                <h3 className={`font-semibold text-sm ${textClass} flex items-center gap-2`}>
                    <FileUp size={14} />
                    Export Project
                </h3>
                <button
                    onClick={() => setIsExportSidebarOpen(false)}
                    className={`text-xs hover:text-red-500 ${subTextClass}`}
                >
                    Close
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* Format Section */}
                <div>
                    <h4 className={`text-[11px] font-bold uppercase ${subTextClass} mb-2`}>Format</h4>
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            onClick={() => setFormat('png')}
                            className={`flex flex-col items-center justify-center p-3 rounded border transition-all ${format === 'png'
                                ? 'bg-blue-900/30 border-blue-500/50 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.15)]'
                                : `${isDark ? 'bg-[#252526] border-[#333] hover:bg-[#2d2d2d]' : 'bg-gray-50 border-gray-200'} ${textClass} hover:opacity-80`
                                }`}
                        >
                            <ImageIcon size={20} className="mb-1" />
                            <span className="text-xs">PNG</span>
                        </button>
                        <button
                            onClick={() => setFormat('pdf')}
                            className={`flex flex-col items-center justify-center p-3 rounded border transition-all ${format === 'pdf'
                                ? 'bg-blue-900/30 border-blue-500/50 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.15)]'
                                : `${isDark ? 'bg-[#252526] border-[#333] hover:bg-[#2d2d2d]' : 'bg-gray-50 border-gray-200'} ${textClass} hover:opacity-80`
                                }`}
                        >
                            <FileText size={20} className="mb-1" />
                            <span className="text-xs">PDF</span>
                        </button>
                        <button
                            onClick={() => setFormat('html')}
                            className={`flex flex-col items-center justify-center p-3 rounded border transition-all ${format === 'html'
                                ? 'bg-blue-900/30 border-blue-500/50 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.15)]'
                                : `${isDark ? 'bg-[#252526] border-[#333] hover:bg-[#2d2d2d]' : 'bg-gray-50 border-gray-200'} ${textClass} hover:opacity-80`
                                }`}
                        >
                            <FileCode size={20} className="mb-1" />
                            <span className="text-xs">HTML</span>
                        </button>
                    </div>
                </div>

                {/* PDF Options */}
                {format === 'pdf' && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                        <h4 className={`text-[11px] font-bold uppercase ${subTextClass} mb-2`}>Page Settings</h4>

                        <div className="space-y-3">
                            <div>
                                <label className={`text-xs ${subTextClass} block mb-1`}>Size</label>
                                <div className="grid grid-cols-5 gap-1">
                                    {['a4', 'a3', 'a2', 'a1', 'a0'].map((s) => (
                                        <button
                                            key={s}
                                            onClick={() => setPdfSize(s as any)}
                                            className={`text-[10px] py-1 rounded border uppercase transition-all ${pdfSize === s
                                                ? 'bg-blue-900/30 border-blue-500/50 text-blue-400 font-bold'
                                                : `${isDark ? 'bg-[#252526] border-[#333] text-gray-400 hover:bg-[#2d2d2d]' : 'bg-gray-50 border-gray-200 text-gray-600'}`
                                                }`}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className={`text-xs ${subTextClass} block mb-1`}>Orientation</label>
                                <div className={`flex rounded p-1 ${isDark ? 'bg-[#252526]' : 'bg-gray-100'}`}>
                                    <button
                                        onClick={() => setOrientation('portrait')}
                                        className={`flex-1 text-[10px] py-1 rounded transition-all ${orientation === 'portrait'
                                            ? `${isDark ? 'bg-[#3e3e42] text-white shadow ring-1 ring-white/10' : 'bg-white shadow text-black'}`
                                            : `${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`
                                            }`}
                                    >
                                        Portrait
                                    </button>
                                    <button
                                        onClick={() => setOrientation('landscape')}
                                        className={`flex-1 text-[10px] py-1 rounded transition-all ${orientation === 'landscape'
                                            ? `${isDark ? 'bg-[#3e3e42] text-white shadow ring-1 ring-white/10' : 'bg-white shadow text-black'}`
                                            : `${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`
                                            }`}
                                    >
                                        Landscape
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Region Selection */}
                <div>
                    <h4 className={`text-[11px] font-bold uppercase ${subTextClass} mb-2`}>Export Area</h4>

                    <button
                        onClick={handleDrawRegion}
                        className={`w-full flex items-center justify-center gap-2 p-2 rounded border transition-all mb-2 ${activeTool === 'export_area'
                            ? 'bg-orange-500 text-white border-orange-600'
                            : `${isDark ? 'bg-[#252526] border-[#333]' : 'bg-gray-50 border-gray-200'} ${textClass} hover:opacity-80`
                            }`}
                    >
                        <Crop size={16} />
                        <span className="text-xs">
                            {activeTool === 'export_area' ? 'Drawing Region...' : 'Draw Region'}
                        </span>
                    </button>

                    {exportRegion ? (
                        <div className="flex items-center justify-between p-2 bg-green-500/10 border border-green-500/20 rounded">
                            <span className="text-xs text-green-600 flex items-center gap-1">
                                <Check size={12} /> Custom Area Set
                            </span>
                            <button
                                onClick={() => setExportRegion(null)}
                                className="text-[10px] text-red-500 hover:underline"
                            >
                                Clear
                            </button>
                        </div>
                    ) : (
                        <div className={`text-[10px] ${subTextClass} text-center italic`}>
                            Default: Full Canvas
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Action */}
            <div className={`p-4 border-t ${isDark ? 'border-[#333]' : 'border-gray-200'} bg-opacity-50`}>
                <button
                    onClick={handleExport}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded shadow-sm text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                    <FileUp size={16} />
                    Export {format.toUpperCase()}
                </button>
            </div>
        </div>
    );
};
