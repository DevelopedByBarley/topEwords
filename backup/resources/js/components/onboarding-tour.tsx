import { useEffect } from 'react';
import { usePage } from '@inertiajs/react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

export default function OnboardingTour() {
    const { flash } = usePage().props;
    const showTour = (flash as Record<string, unknown>)?.showTour;

    useEffect(() => {
        if (!showTour) {
            return;
        }

        const allSteps = [
                {
                    element: '#tour-dashboard',
                    popover: {
                        title: '🏠 Dashboard',
                        description:
                            'A főoldalon egy pillantásra látod a teljes haladásodat: hány szót ismersz, hány van folyamatban, mennyi az aktuális streak, és mikor volt az utolsó tanulás. Innen gyorsan eléred a legfontosabb funkciókat.',
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
{
                    element: '#tour-quiz',
                    popover: {
                        title: '⚔️ Kvíz',
                        description:
                            'Teszteld le a szókincsed szabadon! A kvíz véletlenszerűen választ szavakat az általad megadott szintekről és státuszokból, majd feleletválasztós kérdéseket tesz fel magyar–angol és angol–magyar irányban egyaránt. A végén elmentheted az eredményt a statisztikáidhoz.',
                        side: 'right',
                        align: 'start',
                    },
                },
                {
                    element: '#tour-cloze',
                    popover: {
                        title: '✏️ Mondatkiegészítés',
                        description:
                            'Valós példamondatokban kell beírni a hiányzó szót. A kontextusból kell kitalálni a helyes választ – ez az egyik leghatékonyabb módszer arra, hogy a szavak valóban bevésődjenek. A feladatok az általad tanuló szavakból generálódnak.',
                        side: 'right',
                        align: 'start',
                    },
                },
                {
                    element: '#tour-irregular-verbs',
                    popover: {
                        title: '🔀 Rendhagyó igék',
                        description:
                            'Gyakorold a leggyakoribb angol rendhagyó igék mindhárom alakját: infinitive → past simple → past participle. Az interaktív kvíz véletlenszerű sorrendben kérdez, és azonnal visszajelzést ad. Szűrhetsz nehézségi szint szerint is.',
                        side: 'right',
                        align: 'start',
                    },
                },
                {
                    element: '#tour-practice',
                    popover: {
                        title: '✍️ Szabad írás',
                        description:
                            'Adj meg célszavakat, írj szabadon angolul, majd az AI ellenőrzi, hogy helyesen és természetesen használtad-e őket. Visszajelzést kapsz szavanként és a teljes szöveg grammatikájáról is, sőt javított változatot is mutat.',
                        side: 'right',
                        align: 'start',
                    },
                },
                {
                    element: '#tour-achievements',
                    popover: {
                        title: '🏅 Teljesítmények',
                        description:
                            'Gyűjts érmeket a tanulásért! Teljesítményeket kaphatsz szókincsed növeléséért, streak megőrzéséért, kvíz eredményekért és sok minden másért. A teljesítmények motiválnak és megmutatják, mennyit fejlődtél az idő során.',
                        side: 'right',
                        align: 'start',
                    },
                },
                {
                    popover: {
                        title: '🌐 Chrome bővítmény',
                        description:
                            'Telepítsd a Chrome bővítményt, és bármely weboldalon egyetlen kattintással vagy a Ctrl+Shift+F (Mac: ⌘⇧F) gyorsbillentyűvel kereshetsz szavakat. Azonnal látod a fordítást, a státuszt, és közvetlenül a böngészőből adhatod hozzá a szót a szótárhoz. Tökéletes olvasáshoz és böngészés közbeni tanuláshoz!',
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
