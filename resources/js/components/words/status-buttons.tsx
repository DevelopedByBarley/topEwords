import { STATUS_CONFIG } from '@/components/words/word-config';
import type { WordStatus } from '@/types/words';

interface StatusButtonsProps {
    current: WordStatus;
    onSelect: (status: Exclude<WordStatus, null>) => void;
    /** 'row' = kompakt pill gombsor a listában, 'modal' = nagy gombok a részletező modalban */
    variant: 'row' | 'modal';
}

export default function StatusButtons({
    current,
    onSelect,
    variant,
}: StatusButtonsProps) {
    if (variant === 'modal') {
        return (
            <div className="flex flex-wrap gap-2">
                {STATUS_CONFIG.map(
                    ({ value, label, icon: Icon, pillActive, pillHover }) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => onSelect(value)}
                            className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                                current === value
                                    ? pillActive
                                    : `bg-secondary text-muted-foreground ${pillHover}`
                            }`}
                        >
                            <Icon className="size-4" /> {label}
                        </button>
                    ),
                )}
            </div>
        );
    }

    return (
        <div className="scrollbar-none flex shrink-0 gap-1 overflow-x-auto">
            {STATUS_CONFIG.map(
                ({ value, label, icon: Icon, pillActive, pillHover }) => (
                    <button
                        key={value}
                        type="button"
                        onClick={() => onSelect(value)}
                        title={label}
                        className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-medium transition-all sm:px-3 sm:py-2 ${
                            current === value
                                ? pillActive
                                : `bg-secondary text-muted-foreground ${pillHover}`
                        }`}
                    >
                        <Icon className="size-3.5 sm:size-4" />
                        <span className="hidden sm:inline">{label}</span>
                    </button>
                ),
            )}
        </div>
    );
}
