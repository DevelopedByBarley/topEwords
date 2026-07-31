import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const tones = {
    info: 'border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-100',
    success:
        'border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950/40 dark:text-green-100',
};

/**
 * Az auth-oldalak tájékoztató sávja (pl. „elküldtük a megerősítő e-mailt”).
 *
 * `role="status"`: a szerverről érkező visszajelzést a képernyőolvasó is
 * bemondja — a korábbi sima zöld szöveg némán jelent meg.
 */
export default function AuthNotice({
    icon: Icon,
    tone = 'info',
    children,
    className,
}: {
    icon: LucideIcon;
    tone?: keyof typeof tones;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            role="status"
            className={cn(
                'flex items-start gap-3 rounded-xl border p-4 text-sm leading-relaxed',
                tones[tone],
                className,
            )}
        >
            <Icon className="mt-0.5 size-4.5 shrink-0" aria-hidden="true" />
            <div>{children}</div>
        </div>
    );
}
