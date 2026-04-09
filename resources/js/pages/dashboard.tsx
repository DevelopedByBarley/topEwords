import { Head, Link } from '@inertiajs/react';
import { BookMarked, CheckCheck, Clock, ExternalLink, Flame, Mic, NotebookPen, RefreshCw, Trophy } from 'lucide-react';
import { dashboard } from '@/routes';
import { index as reviewIndex } from '@/routes/review';
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
    reviewDueCount: number;
}

const LEVEL_COLORS: Record<string, { bar: string; bg: string; text: string; border: string }> = {
    green:  { bar: 'bg-green-500',  bg: 'bg-green-50 dark:bg-green-950/20',  text: 'text-green-700 dark:text-green-400',  border: 'border-green-200 dark:border-green-800' },
    blue:   { bar: 'bg-blue-500',   bg: 'bg-blue-50 dark:bg-blue-950/20',    text: 'text-blue-700 dark:text-blue-400',    border: 'border-blue-200 dark:border-blue-800' },
    yellow: { bar: 'bg-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-950/20',text: 'text-yellow-700 dark:text-yellow-400',border: 'border-yellow-200 dark:border-yellow-800' },
    orange: { bar: 'bg-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/20',text: 'text-orange-700 dark:text-orange-400',border: 'border-orange-200 dark:border-orange-800' },
    purple: { bar: 'bg-purple-500', bg: 'bg-purple-50 dark:bg-purple-950/20',text: 'text-purple-700 dark:text-purple-400',border: 'border-purple-200 dark:border-purple-800' },
    red:    { bar: 'bg-red-500',    bg: 'bg-red-50 dark:bg-red-950/20',      text: 'text-red-700 dark:text-red-400',      border: 'border-red-200 dark:border-red-800' },
};

export default function Dashboard({ levelStats, totalKnown, totalWords, totalPercent, streak, customStats, reviewDueCount }: Props) {
    return (
        <>
            <Head title="Haladás" />

            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold tracking-tight">Haladás</h1>
                    <p className="text-muted-foreground text-sm">Kövesd nyomon, hány szót ismersz szintenként.</p>
                </div>

                {/* Review due */}
                {reviewDueCount > 0 && (
                    <Link
                        href={reviewIndex()}
                        className="flex items-center justify-between gap-4 rounded-xl border border-blue-200 bg-blue-50 p-5 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/20 dark:hover:bg-blue-950/30"
                    >
                        <div className="flex items-center gap-3">
                            <RefreshCw className="size-5 text-blue-500" />
                            <div>
                                <p className="font-semibold text-blue-900 dark:text-blue-200">Napi ismétlés</p>
                                <p className="text-sm text-blue-700 dark:text-blue-400">
                                    {reviewDueCount} szó vár ismétlésre ma
                                </p>
                            </div>
                        </div>
                        <span className="rounded-full bg-blue-500 px-3 py-1 text-sm font-bold text-white tabular-nums">
                            {reviewDueCount}
                        </span>
                    </Link>
                )}

                {/* Streak */}
                <div className={`rounded-xl border p-5 ${streak > 0 ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800' : 'bg-card'}`}>
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
                <div className="rounded-xl border bg-card p-5">
                    <div className="mb-3 flex items-center justify-between">
                        <span className="font-semibold">Összesen</span>
                        <span className="text-muted-foreground text-sm">
                            {totalKnown.toLocaleString()} / {totalWords.toLocaleString()} szó
                        </span>
                    </div>
                    <div className="bg-secondary mb-2 h-3 w-full overflow-hidden rounded-full">
                        <div
                            className="h-3 rounded-full bg-primary transition-all duration-500"
                            style={{ width: `${totalPercent}%` }}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <CheckCheck className="size-3 text-green-500" />
                                Tudom: {totalKnown.toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1">
                                <Clock className="size-3 text-blue-500" />
                                Tanulom: {levelStats.reduce((s, l) => s + l.learning, 0).toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1">
                                <BookMarked className="size-3 text-orange-500" />
                                Később: {levelStats.reduce((s, l) => s + l.saved, 0).toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1">
                                <Mic className="size-3 text-violet-500" />
                                Kiejtés: {levelStats.reduce((s, l) => s + l.pronunciation, 0).toLocaleString()}
                            </span>
                        </div>
                        <span className="text-sm font-semibold">{totalPercent}%</span>
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
                                className={`rounded-xl border p-5 transition-colors ${isComplete ? `${colors.bg} ${colors.border}` : 'bg-card'} ${isEmpty ? 'opacity-50' : ''}`}
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
                                        <div className="mb-3 flex flex-col gap-1 text-xs text-muted-foreground">
                                            <div className="flex justify-between">
                                                <span className="flex items-center gap-1">
                                                    <CheckCheck className="size-3 text-green-500" /> Tudom
                                                </span>
                                                <span>{level.known.toLocaleString()} / {level.total.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="size-3 text-blue-500" /> Tanulom
                                                </span>
                                                <span>{level.learning.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="flex items-center gap-1">
                                                    <BookMarked className="size-3 text-orange-500" /> Később
                                                </span>
                                                <span>{level.saved.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="flex items-center gap-1">
                                                    <Mic className="size-3 text-violet-500" /> Kiejtés
                                                </span>
                                                <span>{level.pronunciation.toLocaleString()}</span>
                                            </div>
                                        </div>

                                        <Link
                                            href={`${wordsIndex()}?level=${level.level}`}
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
                <div className="rounded-xl border bg-card p-5">
                    <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <NotebookPen className="size-4 text-muted-foreground" />
                            <span className="font-semibold">Saját szavak</span>
                        </div>
                        <Link
                            href={`${wordsIndex()}#custom-words`}
                            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                        >
                            Kezelés →
                        </Link>
                    </div>

                    {customStats.total === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            Még nem adtál hozzá saját szót.{' '}
                            <Link href={`${wordsIndex()}#custom-words`} className="text-primary underline underline-offset-2">
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
                    className="group flex items-center justify-between gap-4 rounded-xl border bg-card p-5 transition-colors hover:bg-accent"
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
