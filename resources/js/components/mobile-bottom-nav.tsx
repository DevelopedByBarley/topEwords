import { Link } from '@inertiajs/react';
import type { InertiaLinkProps } from '@inertiajs/react';
import { Languages, Layers, Menu, ScanText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSidebar } from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { cn } from '@/lib/utils';
import { index as flashcardsIndex } from '@/routes/flashcards';
import { show as textAnalysisShow } from '@/routes/text-analysis';
import { index as wordsIndex } from '@/routes/words';

type BottomNavItem = {
    title: string;
    href: NonNullable<InertiaLinkProps['href']>;
    icon: LucideIcon;
};

const bottomNavItems: BottomNavItem[] = [
    { title: 'Szavak', href: wordsIndex.url(), icon: Languages },
    { title: 'Flashcards', href: flashcardsIndex(), icon: Layers },
    { title: 'Szövegelemzés', href: textAnalysisShow(), icon: ScanText },
];

const itemClassName =
    'flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors';

function isEditableElement(element: EventTarget | null): boolean {
    if (!(element instanceof HTMLElement)) {
        return false;
    }

    if (element.isContentEditable || element instanceof HTMLTextAreaElement) {
        return true;
    }

    return (
        element instanceof HTMLInputElement &&
        !['checkbox', 'radio', 'button', 'submit', 'range', 'file'].includes(
            element.type,
        )
    );
}

export default function MobileBottomNav() {
    const { isCurrentOrParentUrl } = useCurrentUrl();
    const { setOpenMobile } = useSidebar();
    const [isTyping, setIsTyping] = useState(false);

    useEffect(() => {
        const root = document.documentElement;
        root.dataset.bottomNav = '';

        const handleFocusIn = (event: FocusEvent) =>
            setIsTyping(isEditableElement(event.target));
        const handleFocusOut = () => setIsTyping(false);

        document.addEventListener('focusin', handleFocusIn);
        document.addEventListener('focusout', handleFocusOut);

        return () => {
            delete root.dataset.bottomNav;
            document.removeEventListener('focusin', handleFocusIn);
            document.removeEventListener('focusout', handleFocusOut);
        };
    }, []);

    return (
        <nav
            aria-label="Fő funkciók"
            className={cn(
                'fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_-8px_rgb(0_0_0/0.15)] backdrop-blur md:hidden',
                isTyping && 'hidden',
            )}
        >
            <div className="flex h-16 items-stretch">
                {bottomNavItems.map((item) => {
                    const isActive = isCurrentOrParentUrl(item.href);

                    return (
                        <Link
                            key={item.title}
                            href={item.href}
                            prefetch
                            aria-current={isActive ? 'page' : undefined}
                            className={cn(
                                itemClassName,
                                isActive
                                    ? 'text-primary'
                                    : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            <span
                                className={cn(
                                    'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                                    isActive && 'bg-primary/10',
                                )}
                            >
                                <item.icon className="size-5" />
                            </span>
                            <span className="max-w-full truncate px-1">
                                {item.title}
                            </span>
                        </Link>
                    );
                })}
                <button
                    type="button"
                    onClick={() => setOpenMobile(true)}
                    className={cn(
                        itemClassName,
                        'text-muted-foreground hover:text-foreground',
                    )}
                >
                    <span className="flex h-7 w-12 items-center justify-center">
                        <Menu className="size-5" />
                    </span>
                    <span>Menü</span>
                </button>
            </div>
        </nav>
    );
}
