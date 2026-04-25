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

        const driverObj = driver({
            showProgress: true,
            progressText: '{{current}} / {{total}}',
            nextBtnText: 'Következő →',
            prevBtnText: '← Vissza',
            doneBtnText: 'Kész!',
            steps: [
                {
                    element: '#tour-dashboard',
                    popover: {
                        title: '🏠 Dashboard',
                        description:
                            'A főoldalon látod a napi haladásodat: szóstatisztikák, streak, és gyors hozzáférés a főbb funkciókhoz.',
                        side: 'right',
                        align: 'start',
                    },
                },
                {
                    element: '#tour-words',
                    popover: {
                        title: '📚 Angol szavak',
                        description:
                            'Itt találod az összes szót a szótárban. Szűrhetsz szintekre, státuszra, mappákra. Minden szóhoz be tudod állítani, hogy ismered-e, tanulod, vagy ismeretlen.',
                        side: 'right',
                        align: 'start',
                    },
                },
                {
                    element: '#tour-quiz',
                    popover: {
                        title: '⚔️ Kvíz',
                        description:
                            'Teszteld le a szókincsed! A kvíz véletlenszerűen választ szavakat, és magyar-angol fordítást kér. Mentsd el az eredményt a statisztikákhoz.',
                        side: 'right',
                        align: 'start',
                    },
                },
                {
                    element: '#tour-cloze',
                    popover: {
                        title: '✏️ Mondatkiegészítés',
                        description:
                            'Valós példamondatokban kell kitalálni a hiányzó szót. Ez az egyik legjobb módja az összefüggésben való tanulásnak.',
                        side: 'right',
                        align: 'start',
                    },
                },
                {
                    element: '#tour-flashcards',
                    popover: {
                        title: '🃏 Flashcards',
                        description:
                            'Hozz létre saját flashcard paklikat! Gazdag formázással, képekkel, hanganyaggal. Az okos ismétlési rendszer (SRS) automatikusan ütemezi a kártyák ismétlését.',
                        side: 'right',
                        align: 'start',
                    },
                },
                {
                    element: '#tour-text-analysis',
                    popover: {
                        title: '🔍 Szövegelemzés',
                        description:
                            'Tölts fel könyvet vagy illessz be szöveget, és az alkalmazás megmutatja, melyik szavakat ismered már és melyeket nem. Közvetlenül innen adhatsz hozzá szavakat a szótárhoz.',
                        side: 'right',
                        align: 'start',
                    },
                },
                {
                    element: '#tour-irregular-verbs',
                    popover: {
                        title: '🔀 Rendhagyó igék',
                        description:
                            'Gyakorold a leggyakoribb rendhagyó igék három alakját (infinitive → past simple → past participle) interaktív kvízzel.',
                        side: 'right',
                        align: 'start',
                    },
                },
                {
                    element: '#tour-achievements',
                    popover: {
                        title: '🏅 Teljesítmények',
                        description:
                            'Gyűjts érmeket és kövesd a haladásodat! A teljesítmények motiválnak és jelzik, hogy mennyit fejlődtél.',
                        side: 'right',
                        align: 'start',
                    },
                },
                {
                    popover: {
                        title: '🌐 Chrome bővítmény',
                        description:
                            'Telepítsd a Chrome bővítményt, és bármely weboldalon rámutatva egy szóra azonnal megjelenik a fordítása és a státusza. Egyenesen a böngészőből adhatsz hozzá szavakat a szótárhoz!',
                    },
                },
            ],
        });

        driverObj.drive();
    }, [showTour]);

    return null;
}
