import { Head, Link } from '@inertiajs/react';
import {
    BookMarked,
    CheckCheck,
    Clock,
    ExternalLink,
    Flame,
    Languages,
    Layers,
    Mic,
    NotebookPen,
    ScanText,
    Trophy,
} from 'lucide-react';
import { ExtensionBanner } from '@/components/extension-banner';
import { dashboard } from '@/routes';
import { index as flashcardsIndex } from '@/routes/flashcards';
import { show as textAnalysisShow } from '@/routes/text-analysis';
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
    studiedToday: boolean;
    lastActivityDate: string | null;
    customStats: CustomStats;
    /** Deferred prop: az első renderkor még nincs itt. */
    dueFlashcards?: { cards: number; decks: number };
}

const LEVEL_COLORS: Record<string, { bar: string; bg: string; text: string }> =
    {
        green: {
            bar: 'bg-green-500',
            bg: 'bg-green-50 dark:bg-green-950/20',
            text: 'text-green-700 dark:text-green-400',
        },
        blue: {
            bar: 'bg-blue-500',
            bg: 'bg-blue-50 dark:bg-blue-950/20',
            text: 'text-blue-700 dark:text-blue-400',
        },
        yellow: {
            bar: 'bg-yellow-500',
            bg: 'bg-yellow-50 dark:bg-yellow-950/20',
            text: 'text-yellow-700 dark:text-yellow-400',
        },
        orange: {
            bar: 'bg-orange-500',
            bg: 'bg-orange-50 dark:bg-orange-950/20',
            text: 'text-orange-700 dark:text-orange-400',
        },
        purple: {
            bar: 'bg-indigo-500',
            bg: 'bg-indigo-50 dark:bg-indigo-950/20',
            text: 'text-indigo-700 dark:text-indigo-400',
        },
        red: {
            bar: 'bg-red-500',
            bg: 'bg-red-50 dark:bg-red-950/20',
            text: 'text-red-700 dark:text-red-400',
        },
    };

/**
 * Kerekítés helyett „<1%”, amíg van már ismert szó: 10 000-es nevezőnél az
 * első több tucat megjelölés különben 0%-nak látszana.
 */
function formatPercent(percent: number, known: number): string {
    if (percent === 0 && known > 0) {
        return '<1%';
    }

    return `${percent}%`;
}

function ProgressBar({
    percent,
    label,
    className,
    barClassName,
}: {
    percent: number;
    label: string;
    className: string;
    barClassName: string;
}) {
    return (
        <div
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={label}
            className={className}
        >
            <div className={barClassName} style={{ width: `${percent}%` }} />
        </div>
    );
}

function StatTile({
    icon: Icon,
    label,
    value,
    tone,
}: {
    icon: typeof CheckCheck;
    label: string;
    value: number;
    tone: 'green' | 'blue' | 'orange' | 'indigo';
}) {
    const tones = {
        green: 'bg-green-100 ring-green-300 dark:bg-green-950 dark:ring-green-800',
        blue: 'bg-blue-100 ring-blue-300 dark:bg-blue-950 dark:ring-blue-800',
        orange: 'bg-orange-100 ring-orange-300 dark:bg-orange-950 dark:ring-orange-800',
        indigo: 'bg-indigo-100 ring-indigo-300 dark:bg-indigo-950 dark:ring-indigo-800',
    };
    const text = {
        green: 'text-green-600 dark:text-green-400',
        blue: 'text-blue-600 dark:text-blue-400',
        orange: 'text-orange-600 dark:text-orange-400',
        indigo: 'text-indigo-600 dark:text-indigo-400',
    };
    const labelText = {
        green: 'text-green-700 dark:text-green-300',
        blue: 'text-blue-700 dark:text-blue-300',
        orange: 'text-orange-700 dark:text-orange-300',
        indigo: 'text-indigo-700 dark:text-indigo-300',
    };

    return (
        <div
            className={`flex flex-col gap-1 rounded-2xl p-3 ring-1 ring-inset ${tones[tone]}`}
        >
            <div className="flex items-center gap-1.5">
                <Icon className={`size-3.5 ${text[tone]}`} />
                <span className={`text-xs font-medium ${labelText[tone]}`}>
                    {label}
                </span>
            </div>
            <span className={`text-2xl font-bold tabular-nums ${text[tone]}`}>
                {value.toLocaleString()}
            </span>
        </div>
    );
}

/** Egy lépés a „Folytasd itt” sávban. */
function NextStepCard({
    icon: Icon,
    title,
    description,
    href,
    highlight = false,
}: {
    icon: typeof Layers;
    title: string;
    description: React.ReactNode;
    href: string;
    highlight?: boolean;
}) {
    return (
        <Link
            href={href}
            className={`group flex flex-col gap-2 rounded-3xl border p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg ${
                highlight
                    ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/30'
                    : 'border-neutral-200 bg-white dark:border-neutral-700 dark:bg-card'
            }`}
        >
            <span
                className={`flex size-10 items-center justify-center rounded-xl ${
                    highlight
                        ? 'bg-indigo-600 text-white'
                        : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400'
                }`}
            >
                <Icon className="size-5" />
            </span>
            <span className="font-semibold">{title}</span>
            <span className="text-sm text-muted-foreground">{description}</span>
        </Link>
    );
}

export default function Dashboard({
    levelStats,
    totalKnown,
    totalWords,
    totalPercent,
    streak,
    studiedToday,
    lastActivityDate,
    customStats,
    dueFlashcards,
}: Props) {
    const totalLearning = levelStats.reduce((s, l) => s + l.learning, 0);
    const totalSaved = levelStats.reduce((s, l) => s + l.saved, 0);
    const totalPronunciation = levelStats.reduce(
        (s, l) => s + l.pronunciation,
        0,
    );
    const isNewUser =
        totalKnown === 0 && totalLearning === 0 && customStats.total === 0;
    const customPercent =
        customStats.total > 0
            ? Math.round((customStats.known / customStats.total) * 100)
            : 0;
    // A sorozat akkor is „élő”, ha az utolsó aktivitás tegnap volt — ilyenkor
    // ma még meg kell tartani, ezért ez a nap a legfontosabb üzenet az oldalon.
    const streakAtRisk = streak > 0 && !studiedToday;

    return (
        <>
            <Head title="Haladás" />

            <div className="mx-auto flex h-full w-full max-w-[2000px] flex-1 flex-col gap-6 p-4 md:p-6 xl:px-10 2xl:px-16">
                {/* Hero */}
                <div
                    className="relative overflow-hidden rounded-3xl p-6 md:p-8"
                    style={{
                        background: 'linear-gradient(135deg,#4338CA,#4F8EEC)',
                    }}
                >
                    <div className="pointer-events-none absolute -top-16 -right-16 size-64 rounded-full bg-white/15 blur-2xl" />
                    <div className="pointer-events-none absolute right-28 -bottom-24 size-48 rounded-full bg-white/10 blur-2xl" />
                    <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                        <div className="max-w-xl">
                            <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                                Haladás
                            </h1>
                            <p className="mt-1.5 text-sm text-white/85 md:text-base">
                                {isNewUser
                                    ? 'Kezdd a szólistával: jelöld meg, mely szavakat ismered már — innentől mindent itt követhetsz nyomon.'
                                    : 'Kövesd nyomon, hány szót ismersz szintenként — és folytasd ott, ahol abbahagytad.'}
                            </p>
                            <Link
                                href={wordsIndex()}
                                className="mt-5 inline-flex items-center gap-2 rounded-full bg-linear-to-br from-green-400 to-green-500 px-6 py-3 text-sm font-bold text-green-950 shadow-[0_4px_0_0_var(--color-green-600)] transition-all hover:brightness-105 active:translate-y-0.75"
                            >
                                Szavak böngészése
                            </Link>
                        </div>
                        <div className="flex shrink-0 flex-col items-center gap-0.5 rounded-2xl bg-white/15 px-5 py-4 ring-1 ring-white/20">
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-bold text-white tabular-nums">
                                    {formatPercent(totalPercent, totalKnown)}
                                </span>
                                <span className="text-sm font-medium text-white/80">
                                    kész
                                </span>
                            </div>
                            <span className="text-xs text-white/70">
                                a Top 10 000 szóból
                            </span>
                        </div>
                    </div>
                </div>

                {/* Folytasd itt */}
                <div>
                    <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                        {isNewUser ? 'Kezdd itt' : 'Folytasd itt'}
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <NextStepCard
                            icon={Layers}
                            title="Flashcards"
                            highlight={(dueFlashcards?.cards ?? 0) > 0}
                            description={
                                dueFlashcards === undefined ? (
                                    <span className="inline-block h-4 w-32 animate-pulse rounded bg-muted align-middle" />
                                ) : dueFlashcards.cards > 0 ? (
                                    <>
                                        <span className="font-semibold text-foreground">
                                            {dueFlashcards.cards.toLocaleString()}{' '}
                                            kártya
                                        </span>{' '}
                                        esedékes ma{' '}
                                        {dueFlashcards.decks > 1
                                            ? `${dueFlashcards.decks} pakliban`
                                            : 'egy pakliban'}
                                        .
                                    </>
                                ) : (
                                    'Nincs mára esedékes kártya — hozz létre újat vagy tanulj előre.'
                                )
                            }
                            href={flashcardsIndex().url}
                        />
                        <NextStepCard
                            icon={ScanText}
                            title="Szövegelemzés"
                            description="Illessz be egy cikket vagy dalszöveget, és nézd meg, hány szót ismersz belőle."
                            href={textAnalysisShow().url}
                        />
                        <NextStepCard
                            icon={Languages}
                            title="Angol szavak"
                            highlight={isNewUser}
                            description={
                                totalLearning > 0
                                    ? `${totalLearning.toLocaleString()} szó van folyamatban — vedd elő őket.`
                                    : 'Jelöld meg a szavakat, amelyeket már ismersz.'
                            }
                            href={
                                totalLearning > 0
                                    ? wordsIndex({
                                          query: { status: 'learning' },
                                      }).url
                                    : wordsIndex().url
                            }
                        />
                    </div>
                </div>

                {/* Streak */}
                <div
                    className={`rounded-3xl border p-5 shadow-sm ${
                        streakAtRisk
                            ? 'border-amber-300 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/20'
                            : streak > 0
                              ? 'border-orange-200/60 bg-orange-50 dark:border-orange-900/40 dark:bg-orange-950/20'
                              : 'border-neutral-200 bg-white dark:border-neutral-700 dark:bg-card'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span
                                className={`flex size-9 items-center justify-center rounded-xl ${streak > 0 ? 'bg-orange-500/15' : 'bg-muted'}`}
                            >
                                <Flame
                                    className={`size-5 ${streak > 0 ? 'text-orange-500' : 'text-muted-foreground'}`}
                                />
                            </span>
                            <span className="font-semibold">Napi sorozat</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span
                                className={`text-3xl font-bold tabular-nums ${streak > 0 ? 'text-orange-500' : 'text-muted-foreground'}`}
                            >
                                {streak}
                            </span>
                            <span className="text-sm text-muted-foreground">
                                nap
                            </span>
                        </div>
                    </div>
                    <p
                        className={`mt-1 text-sm ${streakAtRisk ? 'font-medium text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}`}
                    >
                        {streak === 0
                            ? 'Jelölj meg egy szót a sorozatod elindításához!'
                            : streakAtRisk
                              ? `Ma még nem tanultál — jelölj meg egy szót, különben elveszik a ${streak} napos sorozatod.`
                              : streak === 1
                                ? 'Szép kezdet! Gyere vissza holnap is.'
                                : `${streak} egymást követő nap – csak így tovább!`}
                    </p>
                    {lastActivityDate && (
                        <p className="mt-1 text-xs text-muted-foreground">
                            {studiedToday
                                ? 'Utolsó tanulás: ma ✓'
                                : `Utolsó tanulás: ${new Date(lastActivityDate).toLocaleDateString('hu-HU')}`}
                        </p>
                    )}
                </div>

                {/* Összesített */}
                <div className="rounded-3xl border border-indigo-100 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-card">
                    <div className="mb-4 flex items-center justify-between gap-2">
                        <div>
                            <span className="font-semibold">Összesen</span>
                            <p className="text-xs text-muted-foreground">
                                A Top 10 000 listás szó — a saját szavaid külön
                                szerepelnek lent.
                            </p>
                        </div>
                        <span className="shrink-0 text-sm font-bold text-muted-foreground tabular-nums">
                            {totalKnown.toLocaleString()} /{' '}
                            {totalWords.toLocaleString()}
                        </span>
                    </div>
                    <ProgressBar
                        percent={totalPercent}
                        label={`Összesített haladás: ${totalPercent}%`}
                        className="mb-5 h-3 w-full overflow-hidden rounded-full bg-indigo-50 dark:bg-neutral-800"
                        barClassName="h-3 rounded-full bg-linear-to-r from-indigo-600 to-indigo-800 transition-all duration-500"
                    />
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <StatTile
                            icon={CheckCheck}
                            label="Tudom"
                            value={totalKnown}
                            tone="green"
                        />
                        <StatTile
                            icon={Clock}
                            label="Tanulom"
                            value={totalLearning}
                            tone="blue"
                        />
                        <StatTile
                            icon={BookMarked}
                            label="Később"
                            value={totalSaved}
                            tone="orange"
                        />
                        <StatTile
                            icon={Mic}
                            label="Kiejtés"
                            value={totalPronunciation}
                            tone="indigo"
                        />
                    </div>
                </div>

                {/* Szintek */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {levelStats.map((level) => {
                        const colors = LEVEL_COLORS[level.color];
                        const isComplete = level.percent === 100;
                        const isEmpty = level.total === 0;

                        if (isEmpty) {
                            return (
                                <div
                                    key={level.level}
                                    className="rounded-3xl border border-dashed border-neutral-300 p-5 dark:border-neutral-700"
                                >
                                    <span
                                        className={`text-xs font-bold tracking-wider uppercase ${colors.text}`}
                                    >
                                        {level.level}. szint
                                    </span>
                                    <p className="font-semibold">
                                        {level.label}
                                    </p>
                                    <p className="mt-3 text-xs text-muted-foreground">
                                        Hamarosan elérhető
                                    </p>
                                </div>
                            );
                        }

                        return (
                            <Link
                                key={level.level}
                                href={wordsIndex({
                                    query: { level: level.level },
                                })}
                                className={`group flex flex-col rounded-3xl border border-neutral-200 p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg dark:border-neutral-700 ${isComplete ? colors.bg : 'bg-white dark:bg-card'}`}
                            >
                                <div className="mb-1 flex items-start justify-between gap-2">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span
                                                className={`text-xs font-bold tracking-wider uppercase ${colors.text}`}
                                            >
                                                {level.level}. szint
                                            </span>
                                            {isComplete && (
                                                <Trophy className="size-4 text-yellow-500" />
                                            )}
                                        </div>
                                        <span className="font-semibold">
                                            {level.label}
                                        </span>
                                    </div>
                                    <span
                                        className={`text-2xl font-bold tabular-nums ${isComplete ? colors.text : ''}`}
                                    >
                                        {formatPercent(
                                            level.percent,
                                            level.known,
                                        )}
                                    </span>
                                </div>

                                <ProgressBar
                                    percent={level.percent}
                                    label={`${level.label}: ${level.percent}% kész`}
                                    className="my-3 h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800"
                                    barClassName={`h-2 rounded-full transition-all duration-500 ${colors.bar}`}
                                />

                                <div className="mb-3 grid grid-cols-2 gap-2">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <CheckCheck className="size-3 text-green-500" />{' '}
                                            Tudom
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
                                            <Clock className="size-3 text-blue-500" />{' '}
                                            Tanulom
                                        </span>
                                        <span className="text-base font-bold tabular-nums">
                                            {level.learning.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <BookMarked className="size-3 text-orange-500" />{' '}
                                            Később
                                        </span>
                                        <span className="text-base font-bold tabular-nums">
                                            {level.saved.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <Mic className="size-3 text-indigo-500" />{' '}
                                            Kiejtés
                                        </span>
                                        <span className="text-base font-bold tabular-nums">
                                            {level.pronunciation.toLocaleString()}
                                        </span>
                                    </div>
                                </div>

                                <span
                                    className={`mt-auto text-xs font-medium ${colors.text} group-hover:underline group-hover:underline-offset-2`}
                                >
                                    Ugrás erre a szintre →
                                </span>
                            </Link>
                        );
                    })}
                </div>

                {/* Saját szavak */}
                <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-card">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <span className="flex size-9 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950/40">
                                <NotebookPen className="size-4 text-indigo-700 dark:text-indigo-400" />
                            </span>
                            <div>
                                <span className="font-semibold">
                                    Saját szavak
                                </span>
                                {customStats.total > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                        {customStats.total.toLocaleString()} szó
                                        · {customStats.known.toLocaleString()}{' '}
                                        ismert
                                    </p>
                                )}
                            </div>
                        </div>
                        {customStats.total > 0 && (
                            <Link
                                href={wordsIndex({
                                    query: { source: 'custom' },
                                })}
                                className="shrink-0 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                            >
                                Kezelés →
                            </Link>
                        )}
                    </div>

                    {customStats.total === 0 ? (
                        <div className="rounded-2xl border border-dashed p-6 text-center">
                            <NotebookPen className="mx-auto mb-2 size-8 text-muted-foreground/50" />
                            <p className="text-sm font-medium text-muted-foreground">
                                Még nincs saját szavad
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Adj hozzá szavakat, amiket külön szeretnél
                                nyomon követni.
                            </p>
                            <Link
                                href={wordsIndex({ query: { add: '' } })}
                                className="mt-3 inline-flex items-center gap-1 rounded-full bg-linear-to-br from-green-400 to-green-500 px-4 py-2 text-xs font-bold text-green-950 hover:brightness-105"
                            >
                                Hozzáadás →
                            </Link>
                        </div>
                    ) : (
                        <>
                            <ProgressBar
                                percent={customPercent}
                                label={`Saját szavak haladása: ${customPercent}%`}
                                className="mb-4 h-2 w-full overflow-hidden rounded-full bg-indigo-50 dark:bg-neutral-800"
                                barClassName="h-2 rounded-full bg-linear-to-r from-indigo-600 to-indigo-800 transition-all duration-500"
                            />
                            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                                <div className="flex items-center justify-between gap-2 sm:justify-start">
                                    <dt className="flex items-center gap-1 text-muted-foreground">
                                        <CheckCheck className="size-3.5 text-green-500" />{' '}
                                        Tudom
                                    </dt>
                                    <dd className="font-bold tabular-nums">
                                        {customStats.known.toLocaleString()}
                                    </dd>
                                </div>
                                <div className="flex items-center justify-between gap-2 sm:justify-start">
                                    <dt className="flex items-center gap-1 text-muted-foreground">
                                        <Clock className="size-3.5 text-blue-500" />{' '}
                                        Tanulom
                                    </dt>
                                    <dd className="font-bold tabular-nums">
                                        {customStats.learning.toLocaleString()}
                                    </dd>
                                </div>
                                <div className="flex items-center justify-between gap-2 sm:justify-start">
                                    <dt className="flex items-center gap-1 text-muted-foreground">
                                        <BookMarked className="size-3.5 text-orange-500" />{' '}
                                        Később
                                    </dt>
                                    <dd className="font-bold tabular-nums">
                                        {customStats.saved.toLocaleString()}
                                    </dd>
                                </div>
                                <div className="flex items-center justify-between gap-2 sm:justify-start">
                                    <dt className="flex items-center gap-1 text-muted-foreground">
                                        <Mic className="size-3.5 text-indigo-500" />{' '}
                                        Kiejtés
                                    </dt>
                                    <dd className="font-bold tabular-nums">
                                        {customStats.pronunciation.toLocaleString()}
                                    </dd>
                                </div>
                            </dl>
                        </>
                    )}
                </div>

                <ExtensionBanner />

                {/* codebarley.hu promo */}
                <a
                    href="https://codebarley.hu"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center justify-between gap-4 rounded-2xl border border-dashed border-neutral-200 p-4 transition-colors hover:bg-indigo-50/50 dark:border-neutral-700 dark:hover:bg-accent"
                >
                    <div>
                        <p className="text-xs text-muted-foreground">
                            Készítette:{' '}
                            <span className="font-semibold text-foreground">
                                codebarley.hu
                            </span>
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            Webfejlesztés, projektek és cikkek — nézz be!
                        </p>
                    </div>
                    <ExternalLink className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                </a>
            </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [{ title: 'Haladás', href: dashboard() }],
};
