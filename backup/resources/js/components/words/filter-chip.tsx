import type { ReactNode } from 'react';

interface FilterChipProps {
    active: boolean;
    onClick: () => void;
    /** Aktív állapot színeinek felülírása (pl. státusz-specifikus szín) */
    activeClass?: string;
    title?: string;
    children: ReactNode;
}

export function FilterChip({ active, onClick, activeClass, title, children }: FilterChipProps) {
    return (
        <button
            onClick={onClick}
            title={title}
            className={`relative inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                active
                    ? (activeClass ?? 'bg-primary text-primary-foreground shadow-sm')
                    : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
        >
            {children}
        </button>
    );
}

interface FilterGroupProps {
    label: string;
    children: ReactNode;
}

export function FilterGroup({ label, children }: FilterGroupProps) {
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-full text-[11px] font-semibold tracking-wider text-muted-foreground uppercase sm:w-20 sm:shrink-0">
                {label}
            </span>
            {children}
        </div>
    );
}
