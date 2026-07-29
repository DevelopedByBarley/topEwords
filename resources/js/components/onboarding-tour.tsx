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
                            'A főoldalon egy pillantásra látod a teljes haladásodat: hány szót ismersz, hány van folyamatban, mennyi az aktuális streak, és mikor tanultál utoljára. Legfelül a „Folytasd itt” sáv mutatja, mi a következő lépés — például hány flashcard esedékes ma.',
                        side: 'right',
                        align: 'start',
                    },
                },
                {
                    element: '#tour-words',
                    popover: {
                        title: '📚 Angol szavak',
                        description:
                            'A szótárban böngészheted az összes angol szót szint, státusz és mappa szerint szűrve. Minden szóhoz beállíthatod az állapotát (Ismeretlen / Tanulom / Mentett / Kiejtés / Tudom), mappákba rendezheted őket, és AI-segítséggel generálhatsz példamondatokat vagy kiejtést. Tömegesen is módosíthatod a státuszokat, exportálhatsz CSV-be, és törölhetsz szavakat.',
                        side: 'right',
                        align: 'start',
                    },
                },
                {
                    element: '#tour-flashcards',
                    popover: {
                        title: '🃏 Flashcards',
                        description:
                            'Hozz létre saját flashcard paklikat tetszőleges témában. Minden kártyán gazdag szövegszerkesztő áll rendelkezésre: formázás, képek, listák. Az okos ismétlési rendszer (SRS) automatikusan ütemezi, mikor kerüljön ismét elő egy kártya a teljesítményed alapján. A paklikat mappákba rendezheted, és egyenként is szerkesztheted vagy törölheted a kártyákat.',
                        side: 'right',
                        align: 'start',
                    },
                },
                {
                    element: '#tour-text-analysis',
                    popover: {
                        title: '🔍 Szövegelemzés',
                        description:
                            'Illessz be bármilyen angol szöveget vagy tölts fel fájlt, és az alkalmazás azonnal megmutatja, melyik szavakat ismered már és melyeket nem. Az ismeretlen szavakra kattintva egyből hozzáadhatod őket a szótárhoz a megfelelő státusszal. Kiváló módszer könyvek, cikkek vagy dalszövegek feldolgozásához.',
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
                            'A Chrome bővítménnyel bármely weboldalon dupla kattintással vagy az Option+W (Windows: Alt+W) gyorsbillentyűvel kereshetsz szavakat. Azonnal látod a fordítást, a státuszt, és közvetlenül a böngészőből adhatod hozzá a szót a szótárhoz — YouTube- és Netflix-feliratokon is.',
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
