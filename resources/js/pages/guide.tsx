import { Head, Link } from '@inertiajs/react';
import { Clock, Info, Video } from 'lucide-react';
import { useState } from 'react';
import PublicLayout from '@/layouts/public-layout';
import { handbook } from '@/routes';

// A 'Kvíz' kategória kivezetve (2026-07-29): a kvíz és a mondatkiegészítés
// nem része az induló feature-körnek — lásd routes/words.php.
type CategoryKey =
    | 'Összes'
    | 'Kezdő lépések'
    | 'Szólista'
    | 'Flashcard'
    | 'Szövegelemzés'
    | 'Extension';

interface Video {
    id: number;
    category: Exclude<CategoryKey, 'Összes'>;
    duration: string;
    title: string;
    description: string;
}

const VIDEOS: Video[] = [
    {
        id: 1,
        category: 'Kezdő lépések',
        duration: '3:20',
        title: 'Első lépések a TopWordsban',
        description:
            'Regisztráció, a kezdőképernyő és a haladás-sáv értelmezése.',
    },
    {
        id: 2,
        category: 'Kezdő lépések',
        duration: '2:45',
        title: 'A dashboard értelmezése',
        description: 'A haladás-sávok, streak és napi statisztikák olvasása.',
    },
    {
        id: 3,
        category: 'Szólista',
        duration: '4:05',
        title: 'A 10 000 szó böngészése',
        description:
            'Hogyan lapozz a frekvencialistában és keress rá szavakra.',
    },
    {
        id: 4,
        category: 'Szólista',
        duration: '5:12',
        title: 'Szavak státuszozása',
        description: 'Tudom / Tanulom / Később jelölése egy kattintással.',
    },
    {
        id: 5,
        category: 'Szólista',
        duration: '3:48',
        title: 'Mappák és szűrők',
        description: 'Témák szerinti rendezés és szűrés nehézség szerint.',
    },
    {
        id: 6,
        category: 'Flashcard',
        duration: '6:30',
        title: 'Első flashcard deck létrehozása',
        description: 'Kártyacsomag indítása és kártyák hozzáadása a listából.',
    },
    {
        id: 7,
        category: 'Flashcard',
        duration: '4:55',
        title: 'Az SRS-értékelés használata',
        description:
            'Mit jelent az Újra / Nehéz / Jó / Könnyű, és mikor melyiket.',
    },
    {
        id: 8,
        category: 'Flashcard',
        duration: '5:20',
        title: 'CSV import és kalibráció',
        description:
            'Tömeges importálás és szintfelmérő kalibrálás új kártyákhoz.',
    },
    {
        id: 10,
        category: 'Szövegelemzés',
        duration: '6:10',
        title: 'Szöveg, könyv és YouTube elemzése',
        description:
            'Ismeretlen szavak kiemelése és azonnali tanulás szövegből.',
    },
    {
        id: 11,
        category: 'Extension',
        duration: '4:30',
        title: 'A Chrome bővítmény telepítése',
        description: 'Telepítés a Chrome Web Store-ból, egyetlen kattintással.',
    },
    {
        id: 12,
        category: 'Extension',
        duration: '5:45',
        title: 'A bővítmény használata',
        description:
            'Dupla kattintás, keresőpaletta és felirat-kiemelés Netflixen.',
    },
];

const CATEGORIES: CategoryKey[] = [
    'Összes',
    'Kezdő lépések',
    'Szólista',
    'Flashcard',
    'Szövegelemzés',
    'Extension',
];

function categoryCount(cat: CategoryKey): number {
    if (cat === 'Összes') {
        return VIDEOS.length;
    }

    return VIDEOS.filter((v) => v.category === cat).length;
}

/**
 * Egy tervezett videó kártyája.
 *
 * A borítón szándékosan NINCS lejátszás-gomb: a videók még nem készültek el,
 * és a korábbi play-ikon kattintható tartalmat ígért, ami nem létezett. A
 * „Hamarosan" felirat őszintén jelzi, hogy ez egy terv, nem egy elérhető lecke.
 */
function VideoCard({ video, index }: { video: Video; index: number }) {
    return (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
            <div className="relative aspect-video bg-neutral-900">
                <span className="absolute top-2.5 left-2.5 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">
                    {video.category}
                </span>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-neutral-400">
                    <Video className="size-7" />
                    <span className="text-[11px] font-semibold tracking-wide uppercase">
                        Hamarosan
                    </span>
                </div>
                <div className="absolute right-2.5 bottom-2.5 flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">
                    <Clock className="size-3" />
                    {video.duration}
                </div>
            </div>
            <div className="p-4">
                <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                        {index + 1}
                    </span>
                    <div>
                        <h3 className="text-sm leading-snug font-semibold text-neutral-800 dark:text-neutral-100">
                            {video.title}
                        </h3>
                        <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                            {video.description}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function Guide() {
    const [activeCategory, setActiveCategory] = useState<CategoryKey>('Összes');

    const visibleVideos =
        activeCategory === 'Összes'
            ? VIDEOS
            : VIDEOS.filter((v) => v.category === activeCategory);

    return (
        <>
            <Head title="Tananyag – TopWords">
                <meta
                    head-key="description"
                    name="description"
                    content="Lépésről lépésre videók a TopWords összes funkciójáról — szólista, flashcard, szövegelemzés és Chrome bővítmény."
                />
            </Head>

            <PublicLayout className="mx-auto w-full max-w-300 px-6 py-10">
                {/* Title */}
                <div className="mb-8">
                    <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-50">
                        Tananyag
                    </h1>
                    <p className="mt-2 max-w-xl text-neutral-500 dark:text-neutral-400">
                        Tanuld meg lépésről lépésre, hogyan használd a
                        TopWordsot. Minden funkcióhoz külön videó.
                    </p>
                    <p className="mt-4 inline-flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                        <Info className="mt-0.5 size-4 shrink-0" />
                        <span>
                            A videók még készülnek — addig a{' '}
                            <Link
                                href={handbook()}
                                className="font-medium underline underline-offset-2"
                            >
                                kézikönyv
                            </Link>{' '}
                            írásban végigvezet minden funkción.
                        </span>
                    </p>
                </div>

                {/* Category filter */}
                <div className="mb-8 flex flex-wrap gap-2">
                    {CATEGORIES.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                                activeCategory === cat
                                    ? 'bg-linear-to-br from-indigo-600 to-indigo-800 text-white'
                                    : 'bg-white text-neutral-600 hover:bg-neutral-100 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
                            }`}
                        >
                            {cat}
                            <span
                                className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                                    activeCategory === cat
                                        ? 'bg-white/20 text-white'
                                        : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400'
                                }`}
                            >
                                {categoryCount(cat)}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Video grid */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {visibleVideos.map((video, i) => (
                        <VideoCard
                            key={video.id}
                            video={video}
                            index={
                                activeCategory === 'Összes'
                                    ? i
                                    : VIDEOS.indexOf(video)
                            }
                        />
                    ))}
                </div>
            </PublicLayout>
        </>
    );
}
