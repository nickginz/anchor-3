import React, { useEffect, useState, useRef } from 'react';

export const PerformanceMonitor: React.FC = () => {
    const [fps, setFps] = useState(0);
    const [lag, setLag] = useState<boolean>(false);
    const [memory, setMemory] = useState<any>(null);
    const [eventLog, setEventLog] = useState<string[]>([]);

    // Position State (Initial: Under Toolbar approx 60px, Right aligned or Left)
    // User requested "under tollbar". Let's put it Top-Left for visibility, or Top-Right.
    // Assuming Toolbar is ~60px height.
    const [position, setPosition] = useState({ x: 10, y: 70 });
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    const lastTime = useRef(performance.now());
    const frameCount = useRef(0);
    const lastFpsTime = useRef(performance.now());

    // meaningful events buffer
    const recentEvents = useRef<{ type: string, time: number }[]>([]);

    useEffect(() => {
        // Event Listeners to track user actions
        const trackEvent = (type: string) => {
            const now = performance.now();
            recentEvents.current.push({ type, time: now });
            // Keep last 10 events
            if (recentEvents.current.length > 10) recentEvents.current.shift();
        };

        const onWheel = () => trackEvent('Wheel');
        const onMouseDown = () => trackEvent('MouseDown');
        const onKeyDown = (e: KeyboardEvent) => trackEvent(`Key:${e.code}`);

        window.addEventListener('wheel', onWheel, { passive: true });
        window.addEventListener('mousedown', onMouseDown, { passive: true });
        window.addEventListener('keydown', onKeyDown, { passive: true });

        let animationFrameId: number;

        const loop = () => {
            const now = performance.now();
            const delta = now - lastTime.current;

            // Lag Detection (if frame takes > 60ms - approx 3 dropped frames)
            if (delta > 60) {
                setLag(true);
                // Find events in the last 500ms
                const culprits = recentEvents.current
                    .filter(e => now - e.time < 500)
                    .map(e => e.type);

                if (culprits.length > 0) {
                    const logEntry = `[${new Date().toLocaleTimeString()}] Lag (${delta.toFixed(0)}ms) after: ${culprits.join(', ')}`;
                    setEventLog(prev => {
                        // Avoid duplicate logs if lag persists across frames
                        if (prev.length > 0 && prev[0] === logEntry) return prev;
                        return [logEntry, ...prev].slice(0, 5);
                    });
                }

                setTimeout(() => setLag(false), 500);
            }

            frameCount.current++;
            if (now - lastFpsTime.current >= 1000) {
                setFps(frameCount.current);
                frameCount.current = 0;
                lastFpsTime.current = now;

                // Memory (Chrome only)
                if ((performance as any).memory) {
                    setMemory((performance as any).memory);
                }
            }

            lastTime.current = now;
            animationFrameId = requestAnimationFrame(loop);
        };

        loop();

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('wheel', onWheel);
            window.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('keydown', onKeyDown);
        };
    }, []);

    // Drag Logic
    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        dragOffset.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y
        };
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                setPosition({
                    x: e.clientX - dragOffset.current.x,
                    y: e.clientY - dragOffset.current.y
                });
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    return (
        <div
            onMouseDown={handleMouseDown}
            style={{
                position: 'fixed',
                top: position.y,
                left: position.x,
                zIndex: 9999,
                backgroundColor: 'rgba(0, 0, 0, 0.85)',
                color: 'lime',
                padding: '10px',
                fontFamily: 'monospace',
                fontSize: '11px',
                pointerEvents: 'auto', // Allow interaction for drag
                maxWidth: '250px',
                minWidth: '150px', // Min width for stability
                textAlign: 'right',
                cursor: isDragging ? 'grabbing' : 'grab',
                userSelect: 'none',
                borderRadius: '4px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                border: lag ? '1px solid red' : '1px solid #333'
            }}
        >
            <div style={{ fontSize: '14px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                <span>QA Monitor</span>
                <span>FPS: {fps}</span>
            </div>

            {lag && <div style={{ color: 'red', fontWeight: 'bold' }}>LAG DETECTED!</div>}

            {memory && (
                <div style={{ marginTop: '5px' }}>
                    MEM: {(memory.usedJSHeapSize / 1048576).toFixed(1)} MB / {(memory.jsHeapSizeLimit / 1048576).toFixed(0)} MB
                </div>
            )}

            <div style={{ marginTop: '5px', borderTop: '1px solid #444', paddingTop: '5px' }}>
                <div style={{ color: '#aaa', marginBottom: '4px', fontStyle: 'italic', textAlign: 'left' }}>Event History:</div>
                {eventLog.map((log, i) => (
                    <div key={i} style={{
                        color: i === 0 ? 'yellow' : '#888',
                        marginBottom: '2px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        textAlign: 'left'
                    }}>
                        {log}
                    </div>
                ))}
            </div>
        </div>
    );
};
