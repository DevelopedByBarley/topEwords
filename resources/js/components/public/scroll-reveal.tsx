import { useEffect, useRef } from 'react';
import { gsap, ScrollTrigger } from '@/lib/scroll-trigger';

/**
 * Görgetésre felúszó-beúszó burkoló a landing statikus blokkjaihoz.
 *
 * A pinnelt jelenetek (szólista, szövegelemzés, flashcard) saját timeline-t
 * futtatnak — ez a komponens a köztük lévő közönséges szekciókat és
 * kártyarácsokat hozza mozgásba, blokkonként egyszer.
 *
 * Rácsban a `delay`-t az elem indexéből érdemes számolni, így a kártyák
 * egymás után jelennek meg, nem egyszerre.
 */
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
                    /*
                     * Szándékosan NEM `once: true`: a felette lévő pinnelt
                     * szekciók csak a saját `useEffect`-jükben épülnek be a
                     * laphosszba, és egy `once` trigger addigra már kilőne és
                     * megsemmisülne. Így viszont életben marad, a `refresh()`
                     * újraszámolja a helyét — előrefelé pedig csak egyszer
                     * játszik le, visszafelé nem fordul vissza.
                     */
                    toggleActions: 'play none none none',
                },
            });

            return () => tween.kill();
        });

        /* A pinnelt szekciók spacer-e módosítja a laphosszt — újramérés kell. */
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
