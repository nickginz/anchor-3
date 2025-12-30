import React, { useState, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';

interface ToolbarButtonProps {
    icon: LucideIcon;
    label: string;
    active?: boolean;
    onClick: () => void;
    tooltip?: string;
    className?: string;
    iconSize?: number;
}

export const ToolbarButton: React.FC<ToolbarButtonProps> = ({
    icon: Icon,
    label,
    active,
    onClick,
    tooltip,
    className,
    iconSize = 18
}) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleMouseEnter = () => {
        timerRef.current = setTimeout(() => setShowTooltip(true), 500);
    };

    const handleMouseLeave = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        setShowTooltip(false);
    };

    return (
        <div className="relative group flex flex-col items-center">
            <button
                onClick={onClick}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className={`
                    p-2 rounded-md transition-all duration-100 flex items-center justify-center
                    border border-transparent
                    ${active
                        ? 'bg-accent text-white border-blue-700 shadow-sm'
                        : 'text-secondary hover-bg border-transparent'
                    }
                    ${className}
                `}
            >
                <Icon size={iconSize} strokeWidth={1.5} />
            </button>

            {showTooltip && (
                <div className="absolute top-full mt-2 px-2 py-1 bg-black text-white text-xs rounded shadow-lg z-50 whitespace-nowrap border border-gray-700 pointer-events-none">
                    {tooltip || label}
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black rotate-45 border-l border-t border-gray-700"></div>
                </div>
            )}
        </div>
    );
};
