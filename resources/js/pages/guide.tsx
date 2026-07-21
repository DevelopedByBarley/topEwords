import { Head, Link, usePage } from '@inertiajs/react';
import { BookOpen, Clock, Play } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { dashboard, guide, login, pricing, privacy, register, terms } from '@/routes';

type CategoryKey =
    | 'Összes'
    | 'Kezdő lépések'
    | 'Szólista'
    | 'Flashcard'
    | 'Kvíz'
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
        description: 'Regisztráció, a kezdőképernyő és a haladás-sáv értelmezése.',
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
        description: 'Hogyan lapozz a frekvencialistában és keress rá szavakra.',
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
        description: 'Mit jelent az Újra / Nehéz / Jó / Könnyű, és mikor melyiket.',
    },
    {
        id: 8,
        category: 'Flashcard',
        duration: '5:20',
        title: 'CSV import és kalibráció',
        description: 'Tömeges importálás és szintfelmérő kalibrálás új kártyákhoz.',
    },
    {
        id: 9,
        category: 'Kvíz',
        duration: '3:15',
        title: 'Kvíz és mondatkiegészítés',
        description: 'Szókincsteszt és cloze feladatok hatékony használata.',
    },
    {
        id: 10,
        category: 'Szövegelemzés',
        duration: '6:10',
        title: 'Szöveg, könyv és YouTube elemzése',
        description: 'Ismeretlen szavak kiemelése és azonnali tanulás szövegből.',
    },
    {
        id: 11,
        category: 'Extension',
        duration: '4:30',
        title: 'A Chrome bővítmény telepítése',
        description: 'Fejlesztői módban töltsd fel a bővítményt pár perc alatt.',
    },
    {
        id: 12,
        category: 'Extension',
        duration: '5:45',
        title: 'A bővítmény használata',
        description: 'Dupla kattintás, keresőpaletta és felirat-kiemelés Netflixen.',
    },
];

const CATEGORIES: CategoryKey[] = [
    'Összes',
    'Kezdő lépések',
    'Szólista',
    'Flashcard',
    'Kvíz',
    'Szövegelemzés',
    'Extension',
];

function categoryCount(cat: CategoryKey): number {
    if (cat === 'Összes') {
        return VIDEOS.length;
    }

    return VIDEOS.filter((v) => v.category === cat).length;
}

function VideoCard({ video, index }: { video: Video; index: number }) {
    return (
        <div className="group overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
            <div className="relative aspect-video bg-neutral-900">
                <span className="absolute top-2.5 left-2.5 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                    {video.category}
                </span>
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex size-12 items-center justify-center rounded-full bg-white/90 shadow-lg transition-transform group-hover:scale-105">
                        <Play className="ml-0.5 size-5 fill-neutral-800 text-neutral-800" />
                    </div>
                </div>
                <div className="absolute right-2.5 bottom-2.5 flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
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
                        <h3 className="text-sm font-semibold leading-snug text-neutral-800 dark:text-neutral-100">
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
    const { auth, billingEnabled } = usePage<{
        auth: { user: { id: number } | null };
        billingEnabled: boolean;
    }>().props;

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
                    content="Lépésről lépésre videók a TopWords összes funkciójáról — szólista, flashcard, kvíz, szövegelemzés és Chrome bővítmény."
                />
            </Head>

            <div className="min-h-screen bg-neutral-50 text-foreground dark:bg-neutral-950">
                {/* Header */}
                <header className="sticky top-0 z-50 border-b border-neutral-200 bg-neutral-50/80 backdrop-blur-md dark:border-neutral-700 dark:bg-neutral-900/80">
                    <div className="mx-auto flex max-w-300 items-center gap-5 px-6 py-3">
                        <Link
                            href="/"
                            className="flex items-center gap-2.5 text-[20px] font-extrabold leading-none tracking-tight text-neutral-800 dark:text-neutral-100"
                        >
                            <span className="flex size-9 items-center justify-center rounded-xl bg-linear-to-br from-indigo-600 to-indigo-800 text-white">
                                <BookOpen size={22} />
                            </span>
                            TopWords
                        </Link>

                        <nav className="ml-2 hidden items-center gap-1 lg:flex">
                            {(
                                [
                                    ['Funkciók', '/#features'],
                                    ['Szólista', '/#wordlist'],
                                    ['Flashcard', '/#flashcard'],
                                    ['Kvíz', '/#quiz'],
                                    ['Bővítmény', '/#extension'],
                                ] as const
                            ).map(([label, href]) => (
                                <a
                                    key={label}
                                    href={href}
                                    className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                                >
                                    {label}
                                </a>
                            ))}
                            <Link
                                href={guide()}
                                className="rounded-lg px-3 py-2 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
                            >
                                Tananyag
                            </Link>
                        </nav>

                        <div className="ml-auto flex items-center gap-2">
                            {billingEnabled && (
                                <Button
                                    variant="ghost"
                                    asChild
                                    className="hidden sm:inline-flex"
                                >
                                    <Link href={pricing()}>Árak</Link>
                                </Button>
                            )}
                            {auth.user ? (
                                <Button
                                    asChild
                                    className="bg-linear-to-br from-indigo-600 to-indigo-800 text-white hover:brightness-105"
                                >
                                    <Link href={dashboard()}>
                                        Irány az alkalmazás
                                    </Link>
                                </Button>
                            ) : (
                                <>
                                    <Button
                                        variant="ghost"
                                        asChild
                                        className="hidden sm:inline-flex"
                                    >
                                        <Link href={login()}>
                                            Bejelentkezés
                                        </Link>
                                    </Button>
                                    <Button
                                        asChild
                                        className="bg-linear-to-br from-indigo-600 to-indigo-800 text-white hover:brightness-105"
                                    >
                                        <Link href={register()}>
                                            Regisztrálás
                                        </Link>
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </header>

                {/* Main */}
                <main className="mx-auto max-w-300 px-6 py-10">
                    {/* Title */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-50">
                            Tananyag
                        </h1>
                        <p className="mt-2 max-w-xl text-neutral-500 dark:text-neutral-400">
                            Tanuld meg lépésről lépésre, hogyan használd a
                            TopWordost. Minden funkcióhoz külön videó.
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
                                index={activeCategory === 'Összes' ? i : VIDEOS.indexOf(video)}
                            />
                        ))}
                    </div>
                </main>

                {/* Footer */}
                <footer className="mt-16 border-t border-neutral-200 dark:border-neutral-700">
                    <div className="mx-auto max-w-300 px-6 py-8">
                        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-neutral-400 dark:text-neutral-500">
                            <span>© 2025 TopWords</span>
                            <span>·</span>
                            <Link
                                href={terms()}
                                className="transition-colors hover:text-neutral-700 dark:hover:text-neutral-200"
                            >
                                Általános feltételek
                            </Link>
                            <span>·</span>
                            <Link
                                href={privacy()}
                                className="transition-colors hover:text-neutral-700 dark:hover:text-neutral-200"
                            >
                                Adatkezelés
                            </Link>
                            <span>·</span>
                            <a
                                href="https://codebarley.hu"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="transition-colors hover:text-neutral-700 dark:hover:text-neutral-200"
                            >
                                Készítette: codebarley.hu
                            </a>
                        </div>
                    </div>
                </footer>
            </div>
        </>
    );
}
