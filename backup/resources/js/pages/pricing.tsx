import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    AlertCircle,
    Check,
    Clock,
    Crown,
    Info,
    Sparkles,
    Zap,
} from 'lucide-react';
import { useState } from 'react';
import AppLogoIcon from '@/components/app-logo-icon';
import { Button } from '@/components/ui/button';
import { dashboard, home, login, register } from '@/routes';
import { checkout, portal } from '@/routes/pricing';

interface Props {
    hasActiveAccess: boolean;
    isOnTrial: boolean;
    trialEndsAt: string | null;
    isSubscribed: boolean;
    isPremium: boolean;
    hasAiAccess: boolean;
    stripeConfigured: boolean;
}

const FREE_FEATURES = [
    '50 szó mentése',
    '10 saját szó',
    '1 flashcard pakli (max 20 kártya)',
    'Napi 10 quiz kérdés',
    'Napi 5 cloze feladat',
    'Napi 2 szövegelemzés',
    'Teljesítmények & Streak',
    'Chrome extension (szókeresés)',
];

const BASIC_FEATURES = [
    'Korlátlan szómentés',
    'Korlátlan saját szó',
    'Korlátlan flashcard pakli & kártya',
    'Korlátlan quiz & cloze',
    'Korlátlan szövegelemzés',
    'Chrome extension státusz mentés',
    'Teljesítmények & Streak',
    'Minden jövőbeli alap funkció',
];

const PREMIUM_FEATURES = [
    ...BASIC_FEATURES,
    'AI szógenerátor flashcardhoz',
    'AI szókereső szövegelemzésben',
    'AI szójelentés & példamondatok',
    'Minden jövőbeli AI funkció',
];

const PAGE_LOADED_AT = Date.now();

export default function Pricing({
    isOnTrial,
    trialEndsAt,
    isSubscribed,
    isPremium,
    stripeConfigured,
}: Props) {
    const { auth, flash } = usePage<{
        auth: { user: { name: string } | null };
        flash: { success?: string; error?: string; info?: string };
    }>().props;
    const isLoggedIn = !!auth?.user;

    const trialDaysLeft = trialEndsAt
        ? Math.max(
              0,
              Math.ceil(
                  (new Date(trialEndsAt).getTime() - PAGE_LOADED_AT) / 86400000,
              ),
          )
        : 0;

    const [consent, setConsent] = useState(false);
    const [consentError, setConsentError] = useState(false);

    function handleCheckout(plan: 'basic' | 'premium') {
        if (!isLoggedIn) {
            router.visit(register());

            return;
        }

        if (!consent) {
            setConsentError(true);

            return;
        }

        router.post(checkout({ plan }).url);
    }

    function handlePortal() {
        router.post(portal().url);
    }

    return (
        <>
            <Head title="Árazás – TopWords">
                <meta
                    head-key="description"
                    name="description"
                    content="TopWords árazási csomagok – ingyenes, alap és prémium (AI) csomag."
                />
            </Head>

            <div className="min-h-screen bg-background text-foreground">
                {/* Nav */}
                <header className="border-b">
                    <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
                        <Link
                            href={home()}
                            className="flex items-center gap-2.5"
                        >
                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
                                <AppLogoIcon className="size-4.5 text-primary-foreground" />
                            </div>
                            <span className="text-sm font-semibold tracking-tight">
                                TopWords
                            </span>
                        </Link>
                        <div className="flex items-center gap-3">
                            {isLoggedIn ? (
                                <Link
                                    href={dashboard()}
                                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                                >
                                    Irányítópult →
                                </Link>
                            ) : (
                                <>
                                    <Link
                                        href={login()}
                                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                                    >
                                        Bejelentkezés
                                    </Link>
                                    <Link href={register()}>
                                        <Button size="sm">Regisztráció</Button>
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                </header>

                <main className="mx-auto max-w-5xl px-6 py-16">
                    {/* Flash messages (fizetés eredménye) */}
                    {flash?.success && (
                        <div className="mb-8 flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
                            <Check className="mt-0.5 size-4 shrink-0" />
                            <span>{flash.success}</span>
                        </div>
                    )}
                    {flash?.error && (
                        <div className="mb-8 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            <AlertCircle className="mt-0.5 size-4 shrink-0" />
                            <span>{flash.error}</span>
                        </div>
                    )}
                    {flash?.info && (
                        <div className="mb-8 flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
                            <Info className="mt-0.5 size-4 shrink-0" />
                            <span>{flash.info}</span>
                        </div>
                    )}

                    {/* Header */}
                    <div className="mb-12 text-center">
                        <h1 className="mb-3 text-4xl font-bold tracking-tight">
                            Egyszerű árazás
                        </h1>
                        {stripeConfigured ? (
                            <p className="text-muted-foreground">
                                5 nap ingyenes próbaidőszak, utána döntsd el
                                melyik csomag illik hozzád.
                            </p>
                        ) : (
                            <p className="text-muted-foreground">
                                Jelenleg minden funkció ingyenesen használható.
                            </p>
                        )}
                    </div>

                    {!stripeConfigured ? (
                        <div className="mx-auto max-w-md rounded-2xl border bg-card p-8 text-center">
                            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
                                <Clock className="size-6 text-muted-foreground" />
                            </div>
                            <p className="mb-1.5 text-lg font-semibold">
                                Az előfizetés hamarosan elérhető
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Most minden funkciót szabadon kipróbálhatsz.
                                Amint elindulnak a csomagok, itt találod őket.
                            </p>
                            <Link
                                href={isLoggedIn ? dashboard() : register()}
                                className="mt-6 inline-block"
                            >
                                <Button>
                                    {isLoggedIn
                                        ? 'Irány az alkalmazás'
                                        : 'Regisztrálok ingyen'}
                                </Button>
                            </Link>
                        </div>
                    ) : (
                        <>
                            {/* Status banners */}
                            {isOnTrial && trialDaysLeft > 0 && (
                                <div className="mb-8 rounded-xl border border-blue-200 bg-blue-50 px-6 py-4 text-center dark:border-blue-800 dark:bg-blue-950">
                                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                                        <Zap className="mr-1.5 inline size-4" />
                                        Próbaidőszakod még{' '}
                                        <strong>
                                            {trialDaysLeft} napig
                                        </strong>{' '}
                                        tart – élvezd a prémium funkciókat!
                                    </p>
                                </div>
                            )}

                            {isPremium && (
                                <div className="mb-8 rounded-xl border border-violet-200 bg-violet-50 px-6 py-4 text-center dark:border-violet-800 dark:bg-violet-950">
                                    <p className="mb-2 text-sm font-medium text-violet-700 dark:text-violet-300">
                                        <Crown className="mr-1.5 inline size-4" />
                                        Aktív prémium előfizetésed van – AI
                                        funkciók elérhetők.
                                    </p>
                                    <button
                                        onClick={handlePortal}
                                        className="text-xs text-violet-600 underline hover:text-violet-800 dark:text-violet-400"
                                    >
                                        Előfizetés kezelése →
                                    </button>
                                </div>
                            )}

                            {isSubscribed && !isPremium && (
                                <div className="mb-8 rounded-xl border border-green-200 bg-green-50 px-6 py-4 text-center dark:border-green-800 dark:bg-green-950">
                                    <p className="mb-2 text-sm font-medium text-green-700 dark:text-green-300">
                                        <Check className="mr-1.5 inline size-4" />
                                        Aktív alap előfizetésed van.
                                    </p>
                                    <button
                                        onClick={handlePortal}
                                        className="text-xs text-green-600 underline hover:text-green-800 dark:text-green-400"
                                    >
                                        Előfizetés kezelése →
                                    </button>
                                </div>
                            )}

                            {/* Pricing cards */}
                            <div className="grid gap-6 md:grid-cols-3">
                                {/* Free */}
                                <div className="rounded-2xl border bg-card p-6">
                                    <div className="mb-4">
                                        <p className="text-sm font-medium text-muted-foreground">
                                            Ingyenes
                                        </p>
                                        <p className="mt-1 text-3xl font-bold">
                                            0 Ft
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            örökké
                                        </p>
                                    </div>
                                    <ul className="mb-6 space-y-2.5">
                                        {FREE_FEATURES.map((f) => (
                                            <li
                                                key={f}
                                                className="flex items-start gap-2 text-sm text-muted-foreground"
                                            >
                                                <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
                                                {f}
                                            </li>
                                        ))}
                                    </ul>
                                    {!isLoggedIn ? (
                                        <Link href={register()}>
                                            <Button
                                                variant="outline"
                                                className="w-full"
                                            >
                                                Regisztrálok ingyen
                                            </Button>
                                        </Link>
                                    ) : (
                                        <Button
                                            variant="outline"
                                            className="w-full"
                                            disabled
                                        >
                                            Jelenlegi csomag
                                        </Button>
                                    )}
                                </div>

                                {/* Basic */}
                                <div className="relative rounded-2xl border-2 border-primary bg-card p-6">
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                        <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                                            Legnépszerűbb
                                        </span>
                                    </div>
                                    <div className="mb-4">
                                        <p className="text-sm font-medium text-muted-foreground">
                                            Alap
                                        </p>
                                        <p className="mt-1 text-3xl font-bold">
                                            1 500 Ft
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            / hónap · ~4 €
                                        </p>
                                    </div>
                                    <ul className="mb-6 space-y-2.5">
                                        {BASIC_FEATURES.map((f) => (
                                            <li
                                                key={f}
                                                className="flex items-start gap-2 text-sm"
                                            >
                                                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                                                {f}
                                            </li>
                                        ))}
                                    </ul>
                                    {isSubscribed && !isPremium ? (
                                        <Button
                                            className="w-full"
                                            onClick={handlePortal}
                                        >
                                            Előfizetés kezelése
                                        </Button>
                                    ) : (
                                        <Button
                                            className="w-full"
                                            onClick={() =>
                                                handleCheckout('basic')
                                            }
                                            disabled={
                                                !stripeConfigured || isPremium
                                            }
                                        >
                                            {!stripeConfigured
                                                ? 'Hamarosan elérhető'
                                                : isPremium
                                                  ? 'Prémium előfizető'
                                                  : isLoggedIn
                                                    ? 'Előfizetek'
                                                    : 'Regisztrálok'}
                                        </Button>
                                    )}
                                </div>

                                {/* Premium */}
                                <div className="rounded-2xl border-2 border-violet-400 bg-card p-6 dark:border-violet-600">
                                    <div className="mb-4">
                                        <div className="flex items-center gap-1.5">
                                            <p className="text-sm font-medium text-muted-foreground">
                                                Prémium
                                            </p>
                                            <Sparkles className="size-3.5 text-violet-500" />
                                        </div>
                                        <p className="mt-1 text-3xl font-bold">
                                            2 500 Ft
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            / hónap · ~7 €
                                        </p>
                                    </div>
                                    <ul className="mb-6 space-y-2.5">
                                        {PREMIUM_FEATURES.map((f, i) => (
                                            <li
                                                key={f}
                                                className="flex items-start gap-2 text-sm"
                                            >
                                                <Check
                                                    className={`mt-0.5 size-4 shrink-0 ${i >= BASIC_FEATURES.length ? 'text-violet-500' : 'text-violet-400'}`}
                                                />
                                                <span
                                                    className={
                                                        i >=
                                                        BASIC_FEATURES.length
                                                            ? 'font-medium'
                                                            : ''
                                                    }
                                                >
                                                    {f}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                    {isPremium ? (
                                        <Button
                                            variant="outline"
                                            className="w-full border-violet-300 dark:border-violet-700"
                                            onClick={handlePortal}
                                        >
                                            Előfizetés kezelése
                                        </Button>
                                    ) : (
                                        <Button
                                            className="w-full bg-violet-600 text-white hover:bg-violet-700"
                                            onClick={() =>
                                                handleCheckout('premium')
                                            }
                                            disabled={!stripeConfigured}
                                        >
                                            {!stripeConfigured
                                                ? 'Hamarosan elérhető'
                                                : isLoggedIn
                                                  ? 'Prémiumra váltok'
                                                  : 'Regisztrálok'}
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* ÁFA + elállási tájékoztató */}
                            {stripeConfigured && (
                                <div className="mx-auto mt-6 max-w-2xl space-y-3">
                                    <p className="text-center text-xs text-muted-foreground">
                                        A feltüntetett árak bruttó árak (az ÁFÁ-t
                                        tartalmazzák). A terhelés euróban
                                        történik.
                                    </p>
                                    <label className="flex cursor-pointer items-start gap-2 rounded-xl border bg-card px-4 py-3 text-left text-xs text-muted-foreground">
                                        <input
                                            type="checkbox"
                                            className="mt-0.5 size-4 shrink-0"
                                            checked={consent}
                                            onChange={(e) => {
                                                setConsent(e.target.checked);
                                                setConsentError(false);
                                            }}
                                        />
                                        <span>
                                            Tudomásul veszem, hogy a szolgáltatás
                                            a fizetés után azonnal elérhetővé
                                            válik; kifejezetten hozzájárulok a
                                            teljesítés azonnali megkezdéséhez, és
                                            tudomásul veszem, hogy ezzel
                                            elveszítem a 14 napos elállási
                                            jogomat. Elfogadom az{' '}
                                            <Link
                                                href="/terms"
                                                className="text-primary underline underline-offset-2"
                                            >
                                                ÁSZF
                                            </Link>
                                            -et és az{' '}
                                            <Link
                                                href="/privacy"
                                                className="text-primary underline underline-offset-2"
                                            >
                                                Adatkezelési tájékoztatót
                                            </Link>
                                            .
                                        </span>
                                    </label>
                                    {consentError && (
                                        <p className="text-center text-xs text-red-500">
                                            A folytatáshoz fogadd el a
                                            feltételeket.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* FAQ */}
                            <div className="mt-16">
                                <h2 className="mb-6 text-center text-xl font-semibold">
                                    Gyakori kérdések
                                </h2>
                                <div className="grid gap-4 md:grid-cols-2">
                                    {[
                                        {
                                            q: 'Mikor kezdődik a számlázás?',
                                            a: 'A 5 napos próbaidőszak után, ha úgy döntesz hogy fizetsz.',
                                        },
                                        {
                                            q: 'Bármikor lemondhatom?',
                                            a: 'Igen, bármikor lemondhatod, a hónap végéig hozzáférésed megmarad.',
                                        },
                                        {
                                            q: 'Mi történik a szavaimmal lemondás után?',
                                            a: 'Minden adatod megmarad, csak a prémium funkciókhoz való hozzáférés szűnik meg.',
                                        },
                                        {
                                            q: 'Biztonságos a fizetés?',
                                            a: 'A fizetést a Stripe kezeli — mi soha nem látjuk a kártyaadataidat.',
                                        },
                                    ].map(({ q, a }) => (
                                        <div
                                            key={q}
                                            className="rounded-xl border bg-card p-5"
                                        >
                                            <p className="mb-1.5 text-sm font-medium">
                                                {q}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {a}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </main>
            </div>
        </>
    );
}
