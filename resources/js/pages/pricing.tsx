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
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import PublicLayout from '@/layouts/public-layout';
import { dashboard, register } from '@/routes';
import { checkout, portal } from '@/routes/pricing';

interface Props {
    hasActiveAccess: boolean;
    isOnTrial: boolean;
    trialEndsAt: string | null;
    isSubscribed: boolean;
    stripeConfigured: boolean;
    trialDays: number;
}

/**
 * Egy csomag-funkció sora. A `value` (pl. „50" vagy „Korlátlan") kiemelve
 * jelenik meg a `label` előtt, hogy a limitek gyorsan átfuthatók legyenek.
 * A `heading: true` egy halvány szekció-címkét jelöl (nincs pipa). Az `info`
 * egy (i) buborékban ad rövid magyarázatot a szakszavakhoz.
 */
type PlanFeature = {
    value?: string;
    label: string;
    heading?: boolean;
    info?: string;
};

// Rövid, közérthető magyarázatok a szakszavakhoz. Egy helyen tartjuk, mert több
// csomagkártyán is ugyanaz a szöveg jelenik meg.
const INFO = {
    flashcards:
        'A tanulókártyák (flashcardok) egyik oldalán a szó, a másikon a jelentése áll – ezekkel memorizálhatsz. A csomagok témák szerint rendezik a kártyáidat.',
    srs: 'A kártyák a felejtési görbéd szerint térnek vissza: amit könnyen felidézel, azt ritkábban kérdezzük újra.',
    textAnalysis:
        'Beillesztesz egy szöveget, mi pedig kiemeljük benne, mely szavakat ismered már és melyek újak neked.',
    streak: 'A napi sorozat (streak) azt mutatja, hány napja tanulsz megszakítás nélkül – motivál a mindennapi gyakorlásra.',
    extensionSave:
        'A böngészőbővítményből közvetlenül elmentheted a szavakat, saját szavakat és tanulókártyákat, anélkül hogy átváltanál az appra.',
};

const FREE_FEATURES: PlanFeature[] = [
    { value: 'Korlátlan', label: 'szógyűjtés tanulás közben' },
    { value: '50', label: 'tanulókártya, 5 csomagban', info: INFO.flashcards },
    { label: 'Ütemezett kártyaismétlés (SRS)', info: INFO.srs },
    { value: '2', label: 'szövegelemzés naponta', info: INFO.textAnalysis },
    { value: '1', label: 'mentett könyv, 3 YouTube-felirat' },
    { label: 'Fejlődés- és napi sorozatkövetés', info: INFO.streak },
    { label: 'Chrome-bővítmény: szókeresés és YouTube-feliratok' },
    {
        value: '20',
        label: 'mentés naponta a Chrome-bővítményből',
        info: INFO.extensionSave,
    },
    {
        label: 'AI-próbahozzáférés',
        info: 'Egy kis havi AI-keret, amivel kipróbálhatod az AI-funkciókat – a Pro csomagban jóval nagyobb kerettel használhatod őket.',
    },
];

// A Pro csomag (nem-AI) többlete az Ingyeneshez képest…
const PRO_FEATURES: PlanFeature[] = [
    { heading: true, label: 'Minden az Ingyenesből, plusz:' },
    { value: 'Korlátlan', label: 'tanulókártya és kártyacsomag' },
    { value: '50', label: 'szövegelemzés naponta', info: INFO.textAnalysis },
    { value: '7', label: 'mentett könyv, 40 YouTube-felirat' },
    {
        value: 'Korlátlan',
        label: 'mentés a Chrome-bővítményből',
        info: INFO.extensionSave,
    },
];

// …és az öt AI-funkció (ezeket külön kiemeljük a kártyán, teljes kerettel).
const AI_FEATURES: PlanFeature[] = [
    {
        label: 'Az AI megkeresi és elmagyarázza a szavak jelentését',
        info: 'A mesterséges intelligencia megadja egy szó jelentését, példamondatait és használatát – nem kell külön szótárazni.',
    },
    { label: 'Az AI kitölti helyetted a tanulókártyákat' },
    { label: 'Az AI ellenőrzi a fordításaidat' },
    { label: 'Az AI kiértékeli a gyakorlásaidat' },
    {
        label: 'Mélyebb AI szóelemzés',
        info: 'Részletesebb betekintés egy szóba: jelentésárnyalatok, gyakori kifejezések és példák, amikben előfordul.',
    },
];

/**
 * Kis (i) ikon, amire rámutatva / rákoppintva rövid magyarázat jelenik meg.
 * A szakszavakat (tanulókártya, SRS, streak stb.) tesszük vele érthetővé.
 */
function InfoTip({ text }: { text: string }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    aria-label="Mit jelent ez?"
                    className="ml-1 inline-flex translate-y-px cursor-help text-muted-foreground/50 transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
                >
                    <Info className="size-3.5" />
                </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs leading-relaxed">
                {text}
            </TooltipContent>
        </Tooltip>
    );
}

/**
 * Egyetlen funkció-sor egy csomagkártyán. A `value` félkövéren, a `label`
 * halványabban jelenik meg, így a limitek egy pillantással átfuthatók. Ha van
 * `info`, egy (i) buborék magyarázza a szakszót.
 */
function FeatureRow({
    feature,
    checkClass,
    valueClass,
    muted = false,
    emphasis = false,
}: {
    feature: PlanFeature;
    checkClass: string;
    valueClass: string;
    muted?: boolean;
    emphasis?: boolean;
}) {
    if (feature.heading) {
        return (
            <li className="pt-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {feature.label}
            </li>
        );
    }

    return (
        <li
            className={`flex items-start gap-2.5 text-sm ${muted ? 'text-muted-foreground' : ''} ${emphasis ? 'font-medium' : ''}`}
        >
            <Check className={`mt-0.5 size-4 shrink-0 ${checkClass}`} />
            <span>
                {feature.value && (
                    <span className={`font-semibold ${valueClass}`}>
                        {feature.value}{' '}
                    </span>
                )}
                {feature.label}
                {feature.info && <InfoTip text={feature.info} />}
            </span>
        </li>
    );
}

export default function Pricing({
    hasActiveAccess,
    isOnTrial,
    trialEndsAt,
    isSubscribed,
    stripeConfigured,
    trialDays,
}: Props) {
    const { auth, flash } = usePage<{
        auth: { user: { name: string } | null };
        flash: { success?: string; error?: string; info?: string };
    }>().props;
    const isLoggedIn = !!auth?.user;

    // A "most" időpontot state-inicializálóban rögzítjük, mert a render tiszta
    // függvény kell legyen (react-hooks/purity) — betöltésenként úgyis frissül.
    const [now] = useState(() => Date.now());
    const trialDaysLeft = trialEndsAt
        ? Math.max(
              0,
              Math.ceil((new Date(trialEndsAt).getTime() - now) / 86400000),
          )
        : 0;

    const [consent, setConsent] = useState(false);
    const [consentError, setConsentError] = useState(false);

    function handleCheckout() {
        if (!isLoggedIn) {
            router.visit(register());

            return;
        }

        if (!consent) {
            setConsentError(true);

            return;
        }

        router.post(checkout({ plan: 'premium' }).url, { accept_terms: true });
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
                    content="TopWords árazás – Ingyenes és Pro (AI) csomag."
                />
            </Head>

            <TooltipProvider delayDuration={100}>
                <PublicLayout className="mx-auto w-full max-w-7xl px-6 py-16">
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
                                    {trialDays > 0
                                        ? `Az első ${trialDays} nap ingyenes, az előfizetés bármikor lemondható.`
                                        : 'Az előfizetés bármikor lemondható.'}
                                </p>
                            ) : (
                                <p className="text-muted-foreground">
                                    Válaszd ki a hozzád illő csomagot.
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
                                    Az előfizetési csomagok hamarosan elérhetők
                                    lesznek.
                                </p>
                                <Link
                                    href={isLoggedIn ? dashboard() : register()}
                                    className="mt-6 inline-block"
                                >
                                    <Button>
                                        {isLoggedIn
                                            ? 'Irány az alkalmazás'
                                            : 'Regisztrálás'}
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
                                            tart – élvezd a Pro funkciókat!
                                        </p>
                                        {!isSubscribed && stripeConfigured && (
                                            <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                                                Ha most előfizetsz, a megmaradt
                                                idő nem vész el – a terhelés
                                                csak a próbaidőszak vége után
                                                indul.
                                            </p>
                                        )}
                                    </div>
                                )}

                                {isSubscribed && (
                                    <div className="mb-8 rounded-xl border border-indigo-200 bg-indigo-50 px-6 py-4 text-center dark:border-indigo-800 dark:bg-indigo-950">
                                        <p className="mb-2 text-sm font-medium text-indigo-700 dark:text-indigo-300">
                                            <Crown className="mr-1.5 inline size-4" />
                                            Aktív Pro előfizetésed van – minden
                                            funkció elérhető.
                                        </p>
                                        <button
                                            onClick={handlePortal}
                                            className="text-xs text-indigo-600 underline hover:text-indigo-800 dark:text-indigo-400"
                                        >
                                            Előfizetés kezelése →
                                        </button>
                                    </div>
                                )}

                                {/* Pricing cards */}
                                <div className="mx-auto grid max-w-3xl gap-6 md:grid-cols-2">
                                    {/* Free */}
                                    <div className="flex flex-col rounded-2xl border bg-card p-6">
                                        <div className="mb-4">
                                            <p className="text-sm font-medium text-muted-foreground">
                                                Ingyenes
                                            </p>
                                            <p className="mt-1 text-3xl font-bold">
                                                0 Ft
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                &nbsp;
                                            </p>
                                        </div>
                                        <ul className="mb-6 flex-1 space-y-2.5">
                                            {FREE_FEATURES.map((f) => (
                                                <FeatureRow
                                                    key={f.label}
                                                    feature={f}
                                                    checkClass="text-muted-foreground/60"
                                                    valueClass="text-foreground"
                                                    muted
                                                />
                                            ))}
                                        </ul>
                                        {!isLoggedIn ? (
                                            <Link href={register()}>
                                                <Button
                                                    variant="outline"
                                                    className="w-full"
                                                >
                                                    Regisztrálás
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

                                    {/* Pro */}
                                    <div className="relative flex flex-col rounded-2xl border-2 border-indigo-400 bg-card p-6 dark:border-indigo-600">
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                            <span className="rounded-full bg-linear-to-br from-indigo-500 to-indigo-400 px-3 py-1 text-xs font-semibold whitespace-nowrap text-white">
                                                Legnépszerűbb
                                            </span>
                                        </div>
                                        <div className="mb-4">
                                            <div className="flex items-center gap-1.5">
                                                <p className="text-sm font-medium text-muted-foreground">
                                                    Pro
                                                </p>
                                                <Sparkles className="size-3.5 text-indigo-500" />
                                            </div>
                                            <p className="mt-1 text-3xl font-bold">
                                                1 990 Ft
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                / hónap · ~5 €
                                            </p>
                                        </div>
                                        <ul className="mb-6 flex-1 space-y-2.5">
                                            {PRO_FEATURES.map((f) => (
                                                <FeatureRow
                                                    key={f.label}
                                                    feature={f}
                                                    checkClass="text-indigo-400"
                                                    valueClass="text-indigo-600 dark:text-indigo-400"
                                                />
                                            ))}

                                            <li className="flex items-center gap-1.5 pt-2 text-xs font-semibold tracking-wide text-indigo-600 uppercase dark:text-indigo-400">
                                                <Sparkles className="size-3.5" />
                                                Teljes AI-eszköztár
                                            </li>
                                            {AI_FEATURES.map((f) => (
                                                <FeatureRow
                                                    key={f.label}
                                                    feature={f}
                                                    checkClass="text-indigo-500"
                                                    valueClass="text-indigo-600 dark:text-indigo-400"
                                                    emphasis
                                                />
                                            ))}
                                        </ul>
                                        {isSubscribed ? (
                                            <Button
                                                variant="outline"
                                                className="w-full border-indigo-300 dark:border-indigo-700"
                                                onClick={handlePortal}
                                            >
                                                Előfizetés kezelése
                                            </Button>
                                        ) : hasActiveAccess && !isOnTrial ? (
                                            <Button className="w-full" disabled>
                                                Már aktív hozzáférésed van
                                            </Button>
                                        ) : (
                                            <Button
                                                className="w-full rounded-full bg-linear-to-br from-green-400 to-green-500 font-bold text-green-950 shadow-[0_4px_0_0_var(--color-green-600)] hover:brightness-105"
                                                onClick={handleCheckout}
                                                disabled={!stripeConfigured}
                                            >
                                                {!stripeConfigured
                                                    ? 'Hamarosan elérhető'
                                                    : isLoggedIn
                                                      ? 'Előfizetek'
                                                      : 'Regisztrálok'}
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* ÁFA + elállási tájékoztató */}
                                {stripeConfigured && (
                                    <div className="mx-auto mt-6 max-w-2xl space-y-3">
                                        <p className="text-center text-xs text-muted-foreground">
                                            A feltüntetett árak bruttó árak (az
                                            ÁFÁ-t tartalmazzák). A terhelés
                                            forintban történik.
                                        </p>
                                        <label
                                            className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-left text-xs transition-colors ${
                                                consentError
                                                    ? 'border-red-400 bg-red-50 ring-2 ring-red-400 dark:border-red-600 dark:bg-red-950/40 dark:ring-red-600'
                                                    : 'border bg-card text-muted-foreground'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                className={`mt-0.5 size-4 shrink-0 accent-primary ${consentError ? 'outline-2 outline-red-400' : ''}`}
                                                checked={consent}
                                                onChange={(e) => {
                                                    setConsent(
                                                        e.target.checked,
                                                    );
                                                    setConsentError(false);
                                                }}
                                            />
                                            <span
                                                className={
                                                    consentError
                                                        ? 'text-red-700 dark:text-red-300'
                                                        : ''
                                                }
                                            >
                                                Tudomásul veszem, hogy a
                                                szolgáltatás a fizetés után
                                                azonnal elérhetővé válik;
                                                kifejezetten hozzájárulok a
                                                teljesítés azonnali
                                                megkezdéséhez, és tudomásul
                                                veszem, hogy ezzel elveszítem a
                                                14 napos elállási jogomat.
                                                Elfogadom az{' '}
                                                <Link
                                                    href="/terms"
                                                    className="underline underline-offset-2"
                                                >
                                                    ÁSZF
                                                </Link>
                                                -et és az{' '}
                                                <Link
                                                    href="/privacy"
                                                    className="underline underline-offset-2"
                                                >
                                                    Adatkezelési tájékoztatót
                                                </Link>
                                                .
                                            </span>
                                        </label>
                                        {consentError && (
                                            <div className="flex items-center justify-center gap-1.5 rounded-lg bg-red-50 px-4 py-2.5 dark:bg-red-950/40">
                                                <AlertCircle className="size-4 shrink-0 text-red-500" />
                                                <p className="text-sm font-medium text-red-600 dark:text-red-400">
                                                    A folytatáshoz pipáld ki a
                                                    fenti nyilatkozatot.
                                                </p>
                                            </div>
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
                                                a:
                                                    trialDays > 0
                                                        ? `A ${trialDays} napos próbaidőszak után, ha úgy döntesz hogy fizetsz.`
                                                        : 'Az előfizetés indításakor, utána pedig havonta.',
                                            },
                                            {
                                                q: 'Bármikor lemondhatom?',
                                                a: 'Igen, bármikor lemondhatod, a hónap végéig hozzáférésed megmarad.',
                                            },
                                            {
                                                q: 'Mi történik a szavaimmal lemondás után?',
                                                a: 'Minden adatod megmarad, csak a Pro funkciókhoz való hozzáférés szűnik meg.',
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
                </PublicLayout>
            </TooltipProvider>
        </>
    );
}
