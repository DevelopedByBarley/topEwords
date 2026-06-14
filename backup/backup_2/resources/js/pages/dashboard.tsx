import { Head, Link } from '@inertiajs/react';
import { BookMarked, CheckCheck, Clock, ExternalLink, Flame, Mic, NotebookPen, Trophy } from 'lucide-react';
import { ExtensionBanner } from '@/components/extension-banner';
import { dashboard } from '@/routes';
import { index as wordsIndex } from '@/routes/words';

interface LevelStat {
    level: number;
    label: string;
    color: string;
    total: number;
    known: number;
    learning: number;
    saved: number;
    pronunciation: number;
    percent: number;
}

interface CustomStats {
    total: number;
    known: number;
    learning: number;
    saved: number;
    pronunciation: number;
}

interface Props {
    levelStats: LevelStat[];
    totalKnown: number;
    totalWords: number;
    totalPercent: number;
    streak: number;
    customStats: CustomStats;
}

const LEVEL_COLORS: Record<string, { bar: string; bg: string; text: string }> = {
    green:  { bar: 'bg-green-500',  bg: 'bg-green-50 dark:bg-green-950/20',  text: 'text-green-700 dark:text-green-400' },
    blue:   { bar: 'bg-blue-500',   bg: 'bg-blue-50 dark:bg-blue-950/20',    text: 'text-blue-700 dark:text-blue-400' },
    yellow: { bar: 'bg-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-950/20',text: 'text-yellow-700 dark:text-yellow-400' },
    orange: { bar: 'bg-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/20',text: 'text-orange-700 dark:text-orange-400' },
    purple: { bar: 'bg-purple-500', bg: 'bg-purple-50 dark:bg-purple-950/20',text: 'text-purple-700 dark:text-purple-400' },
    red:    { bar: 'bg-red-500',    bg: 'bg-red-50 dark:bg-red-950/20',      text: 'text-red-700 dark:text-red-400' },
};

export default function Dashboard({ levelStats, totalKnown, totalWords, totalPercent, streak, customStats }: Props) {
    return (
        <>
            <Head title="Haladás" />

            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                {/* Hero */}
                <div className="relative overflow-hidden rounded-3xl bg-primary p-6 md:p-8">
                    <div className="pointer-events-none absolute -top-14 -right-14 size-56 rounded-full bg-white/15" />
                    <div className="pointer-events-none absolute -bottom-20 right-32 size-40 rounded-full bg-white/10" />
                    <div className="relative max-w-xl">
                        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Haladás</h1>
                        <p className="mt-1.5 text-sm text-white/85 md:text-base">
                            Kövesd nyomon, hány szót ismersz szintenként — és folytasd ott, ahol abbahagytad.
                        </p>
                        <Link
                            href={wordsIndex()}
                            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-green-700 shadow-[0_4px_0_0_var(--color-primary-shade)] transition-all hover:brightness-95 active:translate-y-0.75 active:shadow-[0_1px_0_0_var(--color-primary-shade)]"
                        >
                            Szavak böngészése
                        </Link>
                    </div>
                </div>

                <ExtensionBanner />

                {/* Streak */}
                <div className={`rounded-3xl p-5 shadow-sm ${streak > 0 ? 'bg-orange-50 dark:bg-orange-950/20' : 'bg-card'}`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Flame className={`size-5 ${streak > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
                            <span className="font-semibold">Napi sorozat</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className={`text-3xl font-bold tabular-nums ${streak > 0 ? 'text-orange-500' : 'text-muted-foreground'}`}>
                                {streak}
                            </span>
                            <span className="text-sm text-muted-foreground">nap</span>
                        </div>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {streak === 0
                            ? 'Jelölj meg egy szót a sorozatod elindításához!'
                            : streak === 1
                              ? 'Szép kezdet! Gyere vissza holnap is.'
                              : `${streak} egymást követő nap – csak így tovább!`}
                    </p>
                </div>

                {/* Összesített */}
                <div className="rounded-3xl bg-card p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <span className="font-semibold">Összesen</span>
                        <span className="text-sm font-bold tabular-nums">{totalPercent}%</span>
                    </div>
                    <div className="bg-secondary mb-5 h-3 w-full overflow-hidden rounded-full">
                        <div
                            className="h-3 rounded-full bg-primary transition-all duration-500"
                            style={{ width: `${totalPercent}%` }}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="flex flex-col gap-1 rounded-2xl bg-green-50 p-3 dark:bg-green-950/20">
                            <div className="flex items-center gap-1.5">
                                <CheckCheck className="size-3.5 text-green-600" />
                                <span className="text-xs text-green-700 dark:text-green-400">Tudom</span>
                            </div>
                            <span className="text-2xl font-bold tabular-nums text-green-700 dark:text-green-400">
                                {totalKnown.toLocaleString()}
                            </span>
                        </div>
                        <div className="flex flex-col gap-1 rounded-2xl bg-blue-50 p-3 dark:bg-blue-950/20">
                            <div className="flex items-center gap-1.5">
                                <Clock className="size-3.5 text-blue-600" />
                                <span className="text-xs text-blue-700 dark:text-blue-400">Tanulom</span>
                            </div>
                            <span className="text-2xl font-bold tabular-nums text-blue-700 dark:text-blue-400">
                                {levelStats.reduce((s, l) => s + l.learning, 0).toLocaleString()}
                            </span>
                        </div>
                        <div className="flex flex-col gap-1 rounded-2xl bg-orange-50 p-3 dark:bg-orange-950/20">
                            <div className="flex items-center gap-1.5">
                                <BookMarked className="size-3.5 text-orange-600" />
                                <span className="text-xs text-orange-700 dark:text-orange-400">Később</span>
                            </div>
                            <span className="text-2xl font-bold tabular-nums text-orange-700 dark:text-orange-400">
                                {levelStats.reduce((s, l) => s + l.saved, 0).toLocaleString()}
                            </span>
                        </div>
                        <div className="flex flex-col gap-1 rounded-2xl bg-violet-50 p-3 dark:bg-violet-950/20">
                            <div className="flex items-center gap-1.5">
                                <Mic className="size-3.5 text-violet-600" />
                                <span className="text-xs text-violet-700 dark:text-violet-400">Kiejtés</span>
                            </div>
                            <span className="text-2xl font-bold tabular-nums text-violet-700 dark:text-violet-400">
                                {levelStats.reduce((s, l) => s + l.pronunciation, 0).toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Szintek */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {levelStats.map((level) => {
                        const colors = LEVEL_COLORS[level.color];
                        const isComplete = level.percent === 100;
                        const isEmpty = level.total === 0;

                        return (
                            <div
                                key={level.level}
                                className={`rounded-3xl p-5 shadow-sm transition-colors ${isComplete ? colors.bg : 'bg-card'} ${isEmpty ? 'opacity-50' : ''}`}
                            >
                                <div className="mb-1 flex items-start justify-between gap-2">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs font-bold uppercase tracking-wider ${colors.text}`}>
                                                {level.level}. szint
                                            </span>
                                            {isComplete && <Trophy className="size-4 text-yellow-500" />}
                                        </div>
                                        <span className="font-semibold">{level.label}</span>
                                    </div>
                                    <span className={`text-2xl font-bold tabular-nums ${isComplete ? colors.text : ''}`}>
                                        {level.percent}%
                                    </span>
                                </div>

                                <div className="bg-secondary my-3 h-2 w-full overflow-hidden rounded-full">
                                    <div
                                        className={`h-2 rounded-full transition-all duration-500 ${colors.bar}`}
                                        style={{ width: `${level.percent}%` }}
                                    />
                                </div>

                                {isEmpty ? (
                                    <p className="text-xs text-muted-foreground">Hamarosan elérhető</p>
                                ) : (
                                    <>
                                        <div className="mb-3 grid grid-cols-2 gap-2">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    <CheckCheck className="size-3 text-green-500" /> Tudom
                                                </span>
                                                <span className="text-base font-bold tabular-nums">
                                                    {level.known.toLocaleString()}
                                                    <span className="text-xs font-normal text-muted-foreground">
                                                        /{level.total.toLocaleString()}
                                                    </span>
                                                </span>
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    <Clock className="size-3 text-blue-500" /> Tanulom
                                                </span>
                                                <span className="text-base font-bold tabular-nums">{level.learning.toLocaleString()}</span>
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    <BookMarked className="size-3 text-orange-500" /> Később
                                                </span>
                                                <span className="text-base font-bold tabular-nums">{level.saved.toLocaleString()}</span>
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    <Mic className="size-3 text-violet-500" /> Kiejtés
                                                </span>
                                                <span className="text-base font-bold tabular-nums">{level.pronunciation.toLocaleString()}</span>
                                            </div>
                                        </div>

                                        <Link
                                            href={wordsIndex({ query: { level: level.level } })}
                                            className={`text-xs font-medium underline underline-offset-2 ${colors.text} hover:opacity-80`}
                                        >
                                            Ugrás erre a szintre →
                                        </Link>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Saját szavak */}
                <div className="rounded-3xl bg-card p-5 shadow-sm">
                    <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <NotebookPen className="size-4 text-muted-foreground" />
                            <span className="font-semibold">Saját szavak</span>
                        </div>
                        <Link
                            href={`${wordsIndex.url()}#custom-words`}
                            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                        >
                            Kezelés →
                        </Link>
                    </div>

                    {customStats.total === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            Még nem adtál hozzá saját szót.{' '}
                            <Link href={`${wordsIndex.url()}#custom-words`} className="text-primary underline underline-offset-2">
                                Hozzáadás →
                            </Link>
                        </p>
                    ) : (
                        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                            <div className="flex justify-between">
                                <span className="flex items-center gap-1">
                                    <CheckCheck className="size-3 text-green-500" /> Tudom
                                </span>
                                <span>{customStats.known.toLocaleString()} / {customStats.total.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="flex items-center gap-1">
                                    <Clock className="size-3 text-blue-500" /> Tanulom
                                </span>
                                <span>{customStats.learning.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="flex items-center gap-1">
                                    <BookMarked className="size-3 text-orange-500" /> Később
                                </span>
                                <span>{customStats.saved.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="flex items-center gap-1">
                                    <Mic className="size-3 text-violet-500" /> Kiejtés
                                </span>
                                <span>{customStats.pronunciation.toLocaleString()}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* codebarley.hu promo */}
                <a
                    href="https://codebarley.hu"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center justify-between gap-4 rounded-3xl bg-card p-5 shadow-sm transition-colors hover:bg-accent"
                >
                    <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Készítette</p>
                        <p className="font-semibold">codebarley.hu</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Webfejlesztés, projektek és cikkek — nézz be!
                        </p>
                    </div>
                    <ExternalLink className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                </a>

                {/* Motiváció */}
                {totalPercent === 0 && (
                    <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
                        <p className="font-medium">Még nincs megtanult szavad.</p>
                        <p className="mt-1 text-sm">
                            Kezdd el a{' '}
                            <Link href={wordsIndex()} className="text-primary underline underline-offset-2">
                                szólista böngészésével
                            </Link>
                            , és jelöld meg amit tudsz!
                        </p>
                    </div>
                )}
            </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [{ title: 'Dashboard', href: dashboard() }],
};
