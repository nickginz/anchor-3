import React, { useEffect, useRef } from 'react';

interface ContextMenuProps {
    x: number;
    y: number;
    options: { label?: string; action?: () => void; type?: 'separator' }[];
    onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, options, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        window.addEventListener('mousedown', handleClickOutside);
        return () => window.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    return (
        <div
            ref={menuRef}
            className="absolute panel-bg border panel-border shadow-lg rounded py-1 z-50 flex flex-col w-max text-primary"
            style={{ top: y, left: x }}
        >
            {options.map((opt, i) => {
                if (opt.type === 'separator') {
                    return <div key={i} className="h-px bg-gray-200 dark:bg-[#555] my-1 mx-0" />;
                }
                return (
                    <button
                        key={i}
                        onClick={() => {
                            if (opt.action) opt.action();
                            onClose();
                        }}
                        className="text-left px-[5px] py-1.5 text-sm hover-bg transition-colors whitespace-nowrap block w-full"
                    >
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
};
