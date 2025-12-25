import React, { useEffect, useRef, useState } from 'react';
import { WallDetector, type DetectedLine } from '../../utils/cv/WallDetector';
import { X, Play, Loader2, Brush, Key, Move, MousePointer, Minus, Plus, Maximize2, RotateCcw, Wand2 } from 'lucide-react';

interface WallDetectionModalProps {
    imageSrc: string;
    onClose: () => void;
    onImport: (lines: DetectedLine[], scale: number) => void;
}

export const WallDetectionModal: React.FC<WallDetectionModalProps> = ({ imageSrc, onClose, onImport }) => {
    // Mode State
    const [mode, setMode] = useState<'PAN' | 'DRAW' | 'SCALE' | 'SELECT'>('PAN');
    const [drawStart, setDrawStart] = useState<{ x: number, y: number } | null>(null);
    const [tempDistLine, setTempDistLine] = useState<{ x1: number, y1: number, x2: number, y2: number } | null>(null);
    const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null);

    // Selection state
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

    // Zoom & Pan State
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isImageLoaded, setIsImageLoaded] = useState(false);

    // Detection State
    const [detector] = useState(() => new WallDetector());
    const [isCvReady, setIsCvReady] = useState(false);
    const [lines, setLines] = useState<DetectedLine[]>([]);
    const [status, setStatus] = useState<'IDLE' | 'OCR' | 'CV' | 'DONE'>('IDLE');
    const [debugImage, setDebugImage] = useState<ImageData | null>(null);

    // Detection Parameters
    const [cannyLow, setCannyLow] = useState(50);
    const [cannyHigh, setCannyHigh] = useState(150);
    const [minLineLen, setMinLineLen] = useState(50);
    const [maxLineGap, setMaxLineGap] = useState(10);
    const [minWallThickness, setMinWallThickness] = useState(2);

    // New Params
    const [minNoiseSize, setMinNoiseSize] = useState(50);
    const [useSkeleton, setUseSkeleton] = useState(true);
    const [snapDist, setSnapDist] = useState(30);

    const [orthoOnly, setOrthoOnly] = useState(false);
    const [removeText, setRemoveText] = useState(false);
    const [showDebug, setShowDebug] = useState(false);

    // Mask Editing State
    const [isMaskMode, setIsMaskMode] = useState(false);
    const [brushType, setBrushType] = useState<'DRAW' | 'ERASE'>('DRAW');
    const [brushSize, setBrushSize] = useState(10);
    const userMaskCanvasRef = useRef<HTMLCanvasElement | null>(null);

    // Scale Input State
    const [showScaleInput, setShowScaleInput] = useState(false);
    const [measuredPx, setMeasuredPx] = useState(0);
    const [realWorldM, setRealWorldM] = useState("1.0");

    // Computed Scale (Meters per Pixel) - Default 0.05 (20px=1m)
    // Actually we export LINES, not scale.
    // The main app expects lines in PIXELS? Or METERS?
    // Usually the importer handles scaling. 
    // We should compute a scale factor to pass back.
    const [scaleFactor, setScaleFactor] = useState(0.05); // Meters per Pixel

    const [baseMask, setBaseMask] = useState<ImageData | null>(null);
    const [isMaskGenerating, setIsMaskGenerating] = useState(false);

    // Refs
    const imgRef = useRef<HTMLImageElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const isDrawingRef = useRef(false);
    const lastPosRef = useRef<{ x: number, y: number } | null>(null);

    // Initialize OpenCV
    useEffect(() => {
        const checkCv = () => {
            if (detector.isReady()) {
                setIsCvReady(true);
            } else {
                setTimeout(checkCv, 500);
            }
        };
        checkCv();
    }, [detector]);

    // Update Base Mask when filters change
    useEffect(() => {
        if (!imgRef.current || !detector.isReady() || !isImageLoaded) return;

        setIsMaskGenerating(true);
        const timer = setTimeout(() => {
            if (imgRef.current) {
                const mask = detector.getBinaryMask(imgRef.current, {
                    minWallThickness,
                    minNoiseSize,
                    removeText
                });
                setBaseMask(mask);
            }
            setIsMaskGenerating(false);
        }, 50);

        return () => clearTimeout(timer);
    }, [minWallThickness, minNoiseSize, removeText, isCvReady, isImageLoaded]);

    // Redraw Preview
    const drawPreview = () => {
        const canvas = canvasRef.current;
        const img = imgRef.current;
        if (!canvas || !img) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = img.width;
        canvas.height = img.height;

        // 1. Draw Background
        if (isMaskMode || showDebug) {
            // Draw Preprocessed Base Mask
            if (baseMask) {
                ctx.putImageData(baseMask, 0, 0);
            } else {
                ctx.fillStyle = 'black';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            // Draw User Mask Edits on top
            if (userMaskCanvasRef.current) {
                ctx.drawImage(userMaskCanvasRef.current, 0, 0);
            }
        } else {
            // Draw Original Image
            ctx.drawImage(img, 0, 0);
        }

        ctx.lineWidth = 3 / scale;

        // 2. Draw Detected Lines
        if (!isMaskMode) { // Hide lines while editing mask to avoid clutter
            lines.forEach((line, i) => {
                const isSelected = selectedIndices.has(i);
                ctx.strokeStyle = isSelected ? '#ff9900' : '#00ff00';
                ctx.beginPath();
                ctx.moveTo(line.x1, line.y1);
                ctx.lineTo(line.x2, line.y2);
                ctx.stroke();

                ctx.fillStyle = isSelected ? '#ff9900' : '#00ff00';
                const s = 4 / scale;
                ctx.fillRect(line.x1 - s / 2, line.y1 - s / 2, s, s);
                ctx.fillRect(line.x2 - s / 2, line.y2 - s / 2, s, s);
            });
        }

        // Draw Temp Lines / Tools
        if (drawStart && tempDistLine && !isMaskMode) {
            ctx.strokeStyle = mode === 'SCALE' ? '#ff00ff' : '#00ffff';
            ctx.lineWidth = 2 / scale;
            ctx.beginPath();
            ctx.moveTo(tempDistLine.x1, tempDistLine.y1);
            ctx.lineTo(tempDistLine.x2, tempDistLine.y2);
            ctx.stroke();
        }
    };

    // Trigger redraw
    useEffect(() => {
        if (!imgRef.current) return;
        drawPreview();
    }, [lines, tempDistLine, drawStart, scale, position, mode, showDebug, debugImage, selectedIndices, isMaskMode, baseMask]);


    const runDetection = async () => {
        if (!imgRef.current || !isCvReady) return;

        try {
            setStatus('CV');
            await new Promise(r => setTimeout(r, 100));

            // Prepare Input
            let input: HTMLImageElement | HTMLCanvasElement = imgRef.current;
            let isBinaryInput = false;

            if (userMaskCanvasRef.current || isMaskMode) {
                // Compose Base + User Mask
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = imgRef.current.width;
                tempCanvas.height = imgRef.current.height;
                const ctx = tempCanvas.getContext('2d');
                if (ctx && baseMask) {
                    ctx.putImageData(baseMask, 0, 0);
                    if (userMaskCanvasRef.current) {
                        ctx.drawImage(userMaskCanvasRef.current, 0, 0);
                    }
                    input = tempCanvas;
                    isBinaryInput = true;
                }
            }

            const result = await detector.detectAsync(input, {
                threshold1: cannyLow,
                threshold2: cannyHigh,
                apertureSize: 3,
                minLineLength: minLineLen,
                maxLineGap: maxLineGap,
                minWallThickness,
                minNoiseSize,
                useSkeleton,
                orthoOnly,
                removeText,
                snapDistance: snapDist,
                isBinary: isBinaryInput
            });

            setLines(result.lines);
            if (result.debugData) setDebugImage(result.debugData);

            // If we ran detection, exit mask mode to see results
            if (isMaskMode) setIsMaskMode(false);

            setStatus('DONE');
        } catch (error) {
            console.error(error);
            alert("Detection Failed: " + (error as any).message);
            setStatus('IDLE');
        }
    };

    // Interaction Handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left - position.x) / scale;
        const y = (e.clientY - rect.top - position.y) / scale;

        if (isMaskMode) {
            isDrawingRef.current = true;
            lastPosRef.current = { x, y };

            // Init canvas if needed
            if (!userMaskCanvasRef.current && imgRef.current) {
                const c = document.createElement('canvas');
                c.width = imgRef.current.width;
                c.height = imgRef.current.height;
                userMaskCanvasRef.current = c;
            }

            // Draw a single dot in case it's a click
            if (userMaskCanvasRef.current) {
                const ctx = userMaskCanvasRef.current.getContext('2d');
                if (ctx) {
                    ctx.beginPath();
                    ctx.fillStyle = brushType === 'ERASE' ? 'black' : 'white';
                    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
                    ctx.fill();
                    drawPreview();
                }
            }
            return;
        }

        if (mode === 'PAN') {
            setDragStart({ x: e.clientX, y: e.clientY });
        } else {
            if (mode === 'SELECT') {
                // Find nearest line
                let closestIdx = -1;
                let minD = 20 / scale; // Tolerance

                lines.forEach((l, i) => {
                    // Dist from point to segment
                    const A = x - l.x1;
                    const B = y - l.y1;
                    const C = l.x2 - l.x1;
                    const D = l.y2 - l.y1;
                    const dot = A * C + B * D;
                    const lenSq = C * C + D * D;
                    let param = -1;
                    if (lenSq !== 0) param = dot / lenSq;

                    let xx, yy;
                    if (param < 0) { xx = l.x1; yy = l.y1; }
                    else if (param > 1) { xx = l.x2; yy = l.y2; }
                    else { xx = l.x1 + param * C; yy = l.y1 + param * D; }

                    const dx = x - xx;
                    const dy = y - yy;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < minD) {
                        minD = dist;
                        closestIdx = i;
                    }
                });

                if (closestIdx !== -1) {
                    const newSet = new Set(selectedIndices);
                    if (newSet.has(closestIdx)) newSet.delete(closestIdx);
                    else newSet.add(closestIdx);
                    setSelectedIndices(newSet);
                }
            } else if (mode === 'SCALE' || mode === 'DRAW') {
                setDrawStart({ x, y });
                setTempDistLine({ x1: x, y1: y, x2: x, y2: y });
            }
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left - position.x) / scale;
        const y = (e.clientY - rect.top - position.y) / scale;

        if (isMaskMode && isDrawingRef.current && lastPosRef.current && userMaskCanvasRef.current) {
            const ctx = userMaskCanvasRef.current.getContext('2d');
            if (ctx) {
                ctx.beginPath();
                ctx.strokeStyle = brushType === 'ERASE' ? 'black' : 'white';
                ctx.lineWidth = brushSize;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
                ctx.lineTo(x, y);
                ctx.stroke();
                lastPosRef.current = { x, y };
                drawPreview();
            }
            return;
        }

        if (mode === 'PAN' && dragStart) {
            const dx = e.clientX - dragStart.x;
            const dy = e.clientY - dragStart.y;
            setPosition(p => ({ x: p.x + dx, y: p.y + dy }));
            setDragStart({ x: e.clientX, y: e.clientY });
            return;
        }

        if ((mode === 'SCALE' || mode === 'DRAW') && drawStart) {
            setTempDistLine({ x1: drawStart.x, y1: drawStart.y, x2: x, y2: y });
        }
    };

    const handleMouseUp = () => {
        if (isMaskMode) {
            isDrawingRef.current = false;
            lastPosRef.current = null;
            return;
        }

        if (mode === 'PAN') {
            setDragStart(null);
        } else if (mode === 'SCALE' && tempDistLine && drawStart) {
            const len = Math.hypot(tempDistLine.x2 - tempDistLine.x1, tempDistLine.y2 - tempDistLine.y1);
            if (len > 5) {
                setShowScaleInput(true);
                setMeasuredPx(len);
            }
            setDrawStart(null);
            setTempDistLine(null);
        } else if (mode === 'DRAW' && tempDistLine && drawStart) {
            const newLine = {
                x1: tempDistLine.x1, y1: tempDistLine.y1,
                x2: tempDistLine.x2, y2: tempDistLine.y2
            };
            setLines(prev => [...prev, newLine]);
            setDrawStart(null);
            setTempDistLine(null);
        }
    };

    const handleWheel = (e: React.WheelEvent) => {
        const s = -Math.sign(e.deltaY) * 0.1;
        const newScale = Math.max(0.1, Math.min(5, scale + s));

        // Zoom towards center? Or mouse?
        // Simple center zoom for now
        // const factor = newScale / scale;
        // setPosition(p => ({ x: p.x * factor, y: p.y * factor })); // Only if we wanna zoom towards 0,0 relative to container

        setScale(newScale);
    };

    const resetView = () => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
    };

    const deleteSelected = () => {
        setLines(lines.filter((_, i) => !selectedIndices.has(i)));
        setSelectedIndices(new Set());
    };

    const handleImport = () => {
        onImport(lines, scaleFactor);
    };

    const applyScale = () => {
        const m = parseFloat(realWorldM);
        if (m > 0 && measuredPx > 0) {
            // measuredPx (px) = m (meters)
            // 1 px = m / measuredPx meters
            const sf = m / measuredPx;
            setScaleFactor(sf);
            setShowScaleInput(false);
        }
    };


    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="bg-gray-900 rounded-lg w-[95vw] h-[90vh] flex flex-col border border-gray-700 shadow-2xl overflow-hidden text-gray-200 font-sans">

                {/* Header */}
                <div className="p-3 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>🧱</span> Wall Detection AI
                    </h2>
                    <div className="flex items-center space-x-2">
                        <div className="bg-gray-900 rounded px-2 py-1 flex items-center space-x-2 mr-4">
                            <span className="text-xs text-gray-400">Scale: {(scaleFactor * 100).toFixed(3)} m/100px</span>
                        </div>
                        <div className="bg-gray-900 rounded px-2 py-1 flex items-center space-x-2 mr-4">
                            <span className="text-xs text-gray-400">Zoom: {(scale * 100).toFixed(0)}%</span>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-white text-xl"><X size={20} /></button>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">

                    {/* Sidebar Controls */}
                    <div className="w-80 bg-gray-800 border-r border-gray-700 p-4 overflow-y-auto flex flex-col space-y-4">

                        {/* Status */}
                        <div className="flex items-center space-x-2 pb-2 border-b border-gray-700">
                            <span className={`text-xs px-2 py-1 rounded ${isCvReady ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'}`}>
                                {isCvReady ? 'CV Ready' : 'Loading CV...'}
                            </span>
                            <span className="text-xs text-gray-400">
                                {status === 'IDLE' ? 'Ready' :
                                    status === 'OCR' ? 'Reading Text...' :
                                        status === 'CV' ? 'Detecting Walls...' :
                                            status === 'DONE' ? `Found ${lines.length} Walls` : ''}
                            </span>
                        </div>

                        {/* Toolbar */}
                        <div className="grid grid-cols-4 gap-1 bg-gray-900 p-1 rounded">
                            <button onClick={() => setMode('PAN')} className={`p-1 rounded text-center ${mode === 'PAN' ? 'bg-blue-600' : 'hover:bg-gray-700'}`} title="Pan">✋</button>
                            <button onClick={() => setMode('SELECT')} className={`p-1 rounded text-center ${mode === 'SELECT' ? 'bg-blue-600' : 'hover:bg-gray-700'}`} title="Select">↖</button>
                            <button onClick={() => setMode('DRAW')} className={`p-1 rounded text-center ${mode === 'DRAW' ? 'bg-blue-600' : 'hover:bg-gray-700'}`} title="Draw">✏</button>
                            <button onClick={() => setMode('SCALE')} className={`p-1 rounded text-center ${mode === 'SCALE' ? 'bg-blue-600' : 'hover:bg-gray-700'}`} title="Scale">📏</button>
                        </div>

                        {selectedIndices.size > 0 && (
                            <button
                                onClick={deleteSelected}
                                className="w-full bg-red-600 hover:bg-red-700 text-white text-xs py-2 rounded font-bold"
                            >
                                Delete {selectedIndices.size} Selected Lines
                            </button>
                        )}

                        <div className="space-y-4">
                            <button
                                onClick={runDetection}
                                disabled={status !== 'IDLE' && status !== 'DONE'}
                                className={`w-full py-2 rounded font-bold flex items-center justify-center space-x-2 ${status === 'CV' || status === 'OCR' ? 'bg-gray-600' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                            >
                                {(status === 'CV' || status === 'OCR') && <Loader2 className="animate-spin w-4 h-4" />}
                                <span>{status === 'CV' ? 'Processing...' : 'Run Auto-Detect'}</span>
                            </button>
                        </div>

                        {/* Detection Settings */}
                        <div className="space-y-4 border-t border-gray-700 pt-4">
                            <h3 className="text-xs font-bold text-gray-300">Preprocessing Filters</h3>

                            <div>
                                <label className="block text-xs text-gray-400 mb-1">
                                    Noise Removal (Area): {minNoiseSize}
                                </label>
                                <input type="range" min="0" max="500" step="10" value={minNoiseSize} onChange={e => setMinNoiseSize(parseInt(e.target.value))} className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer" />
                            </div>

                            <div>
                                <label className="block text-xs text-gray-400 mb-1">
                                    Min Wall Thickness: {minWallThickness}px
                                </label>
                                <input type="range" min="1" max="20" value={minWallThickness} onChange={e => setMinWallThickness(parseInt(e.target.value))} className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer" />
                            </div>

                            <div>
                                <label className="block text-xs text-gray-400 mb-1">
                                    Gap Filling (Snap): {snapDist}px
                                </label>
                                <input type="range" min="0" max="100" value={snapDist} onChange={e => setSnapDist(parseInt(e.target.value))} className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer" />
                            </div>

                            <div className="flex items-center space-x-2">
                                <input type="checkbox" checked={useSkeleton} onChange={e => setUseSkeleton(e.target.checked)} id="useSkel" />
                                <label htmlFor="useSkel" className="text-xs text-gray-300">Use Skeletonization (Best for Walls)</label>
                            </div>

                            {/* Mask Editor */}
                            <div className="border-t border-gray-700 pt-2 mt-2">
                                {!isMaskMode ? (
                                    <button
                                        onClick={() => {
                                            setIsMaskMode(true);
                                            setMode('DRAW');
                                            setBrushType('DRAW');
                                            // Force generation if missing
                                            if (!baseMask && imgRef.current && detector.isReady()) {
                                                setIsMaskGenerating(true);
                                                setTimeout(() => {
                                                    const mask = detector.getBinaryMask(imgRef.current!, {
                                                        minWallThickness,
                                                        minNoiseSize,
                                                        removeText
                                                    });
                                                    setBaseMask(mask);
                                                    setIsMaskGenerating(false);
                                                }, 10);
                                            }
                                        }}
                                        className="w-full py-1 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded flex items-center justify-center space-x-1"
                                    >
                                        <Wand2 className="w-3 h-3" />
                                        <span>Edit Detection Mask (Wand)</span>
                                    </button>
                                ) : (
                                    <div className="space-y-2 bg-gray-900 p-2 rounded border border-purple-500">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-bold text-purple-300">Mask Editor</span>
                                            <button onClick={() => setIsMaskMode(false)} className="text-[10px] text-red-400">Done</button>
                                        </div>
                                        <div className="flex space-x-1">
                                            <button
                                                onClick={() => setBrushType('DRAW')}
                                                className={`flex-1 py-1 text-[10px] rounded ${brushType === 'DRAW' ? 'bg-white text-black' : 'bg-gray-700 text-gray-300'}`}
                                            >
                                                Draw Wall
                                            </button>
                                            <button
                                                onClick={() => setBrushType('ERASE')}
                                                className={`flex-1 py-1 text-[10px] rounded ${brushType === 'ERASE' ? 'bg-white text-black' : 'bg-gray-700 text-gray-300'}`}
                                            >
                                                Erase
                                            </button>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-500">Brush Size: {brushSize}</label>
                                            <input
                                                type="range" min="2" max="50"
                                                value={brushSize}
                                                onChange={e => setBrushSize(parseInt(e.target.value))}
                                                className="w-full h-1"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center space-x-2">
                                <input type="checkbox" checked={orthoOnly} onChange={e => setOrthoOnly(e.target.checked)} id="ortho" />
                                <label htmlFor="ortho" className="text-xs text-gray-300">Orthogonal Only (90°)</label>
                            </div>

                            <div className="flex items-center space-x-2">
                                <input type="checkbox" checked={removeText} onChange={e => setRemoveText(e.target.checked)} id="ocr" />
                                <label htmlFor="ocr" className="text-xs text-gray-300">Remove Text (OCR)</label>
                            </div>
                        </div>

                        <div className="space-y-4 border-t border-gray-700 pt-4">
                            <h3 className="text-xs font-bold text-gray-300">Line Detection Params</h3>
                            <details>
                                <summary className="text-xs text-gray-500 cursor-pointer">Advanced</summary>
                                <div className="pl-2 space-y-2 pt-2">
                                    <div>
                                        <label className="block text-[10px] text-gray-400">Threshold 2 (Strong Edge)</label>
                                        <input type="range" min="50" max="300" value={cannyHigh} onChange={e => setCannyHigh(parseInt(e.target.value))} className="w-full h-1" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-gray-400">Min Line Length</label>
                                        <input type="range" min="10" max="200" value={minLineLen} onChange={e => setMinLineLen(parseInt(e.target.value))} className="w-full h-1" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-gray-400">Max Line Gap</label>
                                        <input type="range" min="1" max="50" value={maxLineGap} onChange={e => setMaxLineGap(parseInt(e.target.value))} className="w-full h-1" />
                                    </div>
                                </div>
                            </details>
                        </div>

                        <div className="border-t border-gray-700 pt-4">
                            <div className="flex items-center space-x-2">
                                <input type="checkbox" checked={showDebug} onChange={e => setShowDebug(e.target.checked)} id="debug" />
                                <label htmlFor="debug" className="text-xs text-pink-300 font-bold">Show Debug View (Masks)</label>
                            </div>
                            <p className="text-[10px] text-gray-500 mt-1">
                                Check this to see what the computer sees (black/white masks). Use this to tune Noise Removal.
                            </p>
                        </div>

                        <div className="flex-1"></div>

                        <div className="flex space-x-2">
                            <button onClick={() => setLines([])} className="flex-1 py-2 text-xs text-red-400 border border-red-900 rounded hover:bg-red-900/50">Clear</button>
                            <button onClick={resetView} className="flex-1 py-2 text-xs text-gray-400 border border-gray-700 rounded hover:bg-gray-800">Reset View</button>
                        </div>

                        <button onClick={handleImport} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded">
                            Import {lines.length} Walls
                        </button>

                    </div>

                    {/* Canvas Area */}
                    <div
                        className="flex-1 bg-gray-950 relative overflow-hidden cursor-crosshair"
                        ref={containerRef}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onWheel={handleWheel}
                    >
                        <div
                            style={{
                                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                                transformOrigin: '0 0',
                                width: '100%', height: '100%' // Ensure transform handles size
                            }}
                            className="pointer-events-none" // Events handled by container
                        >
                            <img ref={imgRef} src={imageSrc} className="hidden" alt="src" onLoad={() => {
                                setIsImageLoaded(true);
                                // Fit to screen initially?
                                if (imgRef.current && containerRef.current) {
                                    const ir = imgRef.current;
                                    const cr = containerRef.current;
                                    const s = Math.min(cr.clientWidth / ir.width, cr.clientHeight / ir.height) * 0.9;
                                    setScale(s);
                                    setPosition({
                                        x: (cr.clientWidth - ir.width * s) / 2,
                                        y: (cr.clientHeight - ir.height * s) / 2
                                    });
                                }
                            }} />
                            <canvas ref={canvasRef} className="absolute top-0 left-0" />
                        </div>

                        {/* Overlay Messages */}
                        {mode === 'SCALE' && (
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 px-4 py-2 rounded text-white text-sm pointer-events-none">
                                Draw a line along a known dimension (e.g. scale bar)
                            </div>
                        )}
                        {mode === 'SELECT' && (
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 px-4 py-2 rounded text-white text-sm pointer-events-none">
                                Click lines to select, then click Delete
                            </div>
                        )}

                    </div>
                </div>

                {/* Scale Input Modal */}
                {showScaleInput && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-[60]">
                        <div className="bg-gray-800 p-4 rounded shadow-xl border border-gray-600 w-64">
                            <h3 className="text-sm font-bold text-white mb-2">Set Scale</h3>
                            <p className="text-xs text-gray-400 mb-2">Measured {measuredPx.toFixed(1)} px. How many meters is this?</p>
                            <input
                                type="number"
                                value={realWorldM}
                                onChange={e => setRealWorldM(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white mb-3"
                                autoFocus
                            />
                            <div className="flex justify-end space-x-2">
                                <button onClick={() => setShowScaleInput(false)} className="px-3 py-1 text-xs text-gray-300 hover:text-white">Cancel</button>
                                <button onClick={applyScale} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500">Apply</button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};
