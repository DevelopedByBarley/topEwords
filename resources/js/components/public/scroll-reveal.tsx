import { useEffect, useRef } from 'react';
import { gsap, ScrollTrigger } from '@/lib/scroll-trigger';

export function ScrollReveal({
    as: Tag = 'div',
    className,
    style,
    delay = 0,
    onMouseEnter,
    children,
}: {
    as?: React.ElementType;
    className?: string;
    style?: React.CSSProperties;
    delay?: number;
    onMouseEnter?: () => void;
    children: React.ReactNode;
}) {
    const ref = useRef<HTMLElement>(null);

    useEffect(() => {
        const el = ref.current;

        if (!el) {
            return;
        }

        const mm = gsap.matchMedia();

        mm.add('(prefers-reduced-motion: no-preference)', () => {
            const tween = gsap.from(el, {
                y: 40,
                opacity: 0,
                duration: 0.75,
                delay,
                ease: 'power2.out',
                scrollTrigger: {
                    trigger: el,
                    start: 'top 88%',
                    toggleActions: 'play none none none',
                },
            });

            return () => tween.kill();
        });

        const refresh = requestAnimationFrame(() => ScrollTrigger.refresh());

        return () => {
            cancelAnimationFrame(refresh);
            mm.revert();
        };
    }, [delay]);

    return (
        <Tag
            ref={ref}
            className={className}
            style={style}
            onMouseEnter={onMouseEnter}
        >
            {children}
        </Tag>
    );
}
