import { useEffect } from 'react';
import { usePage } from '@inertiajs/react';
import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';

export default function OnboardingTour() {
    const { flash } = usePage().props;
    const showTour = (flash as Record<string, unknown>)?.showTour;

    useEffect(() => {
        if (!showTour) {
            return;
        }

        const allSteps: DriveStep[] = [
                {
                    element: '#tour-dashboard',
                    popover: {
                        title: '🏠 Haladás',
                        description:
                            'A főoldalon egy pillantásra látod a haladásodat: hány szót tudsz, hány van folyamatban, mennyi az aktuális sorozatod (streak), és hogy ma tanultál-e már. Alatta szintenként is látod, hol tartasz. A „Folytasd itt” sáv mutatja a következő lépést — például hány flashcard esedékes ma.',
                        side: 'right',
                        align: 'start',
                    },
                },
                {
                    element: '#tour-words',
                    popover: {
                        title: '📚 Angol szavak',
                        description:
                            'A szótárban a 10 000 szó között böngészhetsz szint, státusz és mappa szerint szűrve. Minden szóhoz beállíthatod az állapotát (Tudom / Tanulom / Később / Kiejtés / Gyakorlásra), mappákba rendezheted őket, és meghallgathatod a kiejtésüket. Saját szavakat is felvehetsz — ezeket az AI kitölti jelentéssel, szinonimákkal és példamondattal, és bármikor törölheted őket.',
                        side: 'right',
                        align: 'start',
                    },
                },
                {
                    element: '#tour-flashcards',
                    popover: {
                        title: '🃏 Flashcards',
                        description:
                            'Hozz létre saját flashcard paklikat tetszőleges témában. A kártyák szövegét formázhatod: félkövér, dőlt, listák, színek, linkek — és azt is beállíthatod, mit olvasson fel a felolvasó. Az okos ismétlési rendszer (SRS) automatikusan ütemezi, mikor kerüljön ismét elő egy kártya az értékeléseid alapján. A paklikat mappákba rendezheted, a kártyákat pedig szerkesztheted, mozgathatod vagy törölheted.',
                        side: 'right',
                        align: 'start',
                    },
                },
                {
                    element: '#tour-text-analysis',
                    popover: {
                        title: '🔍 Szövegelemzés',
                        description:
                            'Illessz be angol szöveget, adj meg egy weboldalt, tölts fel egy EPUB könyvet vagy elemezd egy YouTube-videó feliratát — az alkalmazás megmutatja, mely szavakat ismered már és melyeket nem, és hány százalékát érted az egésznek. Az ismeretlen szavakra kattintva egyből felveheted őket a szótáradba a megfelelő státusszal.',
                        side: 'right',
                        align: 'start',
                    },
                },
                /*
                 * INDULÁSKOR KIVEZETVE (2026-07-29): a Kvíz (#tour-quiz),
                 * Mondatkiegészítés (#tour-cloze), Rendhagyó igék
                 * (#tour-irregular-verbs) és Szabad írás (#tour-practice)
                 * lépései. A route-jaik ki vannak kommentelve, a sidebar-
                 * horgonyaik nem léteznek — a lenti szűrő eddig is kidobta
                 * őket, de a szöveg itt már félrevezető lett volna.
                 * A topwords Player lépése szintén kikerült: a letöltés
                 * `can:admin` mögé került (routes/web.php).
                 */
                {
                    element: '#tour-achievements',
                    popover: {
                        title: '🏅 Teljesítmények',
                        description:
                            'Gyűjts érmeket a tanulásért! Teljesítményeket kaphatsz a szókincsed növeléséért, a streak megőrzéséért, a flashcard-ismétlésekért, a szövegelemzésekért és a szintek teljesítéséért. A teljesítmények motiválnak és megmutatják, mennyit fejlődtél az idő során.',
                        side: 'right',
                        align: 'start',
                    },
                },
                {
                    popover: {
                        title: '🌐 Chrome bővítmény',
                        description:
                            'A Chrome bővítménnyel bármely weboldalon kereshetsz szavakat: dupla kattintás + nyomva tartás, vagy az Option+W (Windows: Alt+W), illetve a Ctrl+Shift+F gyorsbillentyű. Azonnal látod a jelentést, a kiejtést és a státuszt, felveheted a szót vagy kártyát készíthetsz belőle — YouTube- és Netflix-feliratokon is.',
                    },
                },
        ];

        const steps = allSteps.filter(
            (step) => !('element' in step) || !!document.querySelector(step.element as string),
        );

        const driverObj = driver({
            showProgress: true,
            progressText: '{{current}} / {{total}}',
            nextBtnText: 'Következő →',
            prevBtnText: '← Vissza',
            doneBtnText: 'Kész!',
            steps,
        });

        driverObj.drive();
    }, [showTour]);

    return null;
}
