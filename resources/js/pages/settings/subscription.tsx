import { Head, Link, router, usePage } from '@inertiajs/react';
import { CreditCard, Crown, Download, ExternalLink, FileText, Sparkles, Zap } from 'lucide-react';
import { useState } from 'react';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { pricing } from '@/routes';
import { cancel, portal, resume } from '@/routes/subscription';
import { download } from '@/routes/subscription/invoice';

interface Invoice {
    id: number;
    number: string | null;
    date: string;
}

interface Props {
    invoices: Invoice[];
    hasActiveAccess: boolean;
    isSubscribed: boolean;
    isPremium: boolean;
    hasAiAccess: boolean;
    isOnTrial: boolean;
    trialEndsAt: string | null;
    aiUsage: {
        unlimited: boolean;
        percent: number;
        reset_at: string;
    } | null;
    paymentMethod: { brand: string | null; last_four: string } | null;
    subscription: {
        stripe_status: string;
        ends_at: string | null;
        cancel_at_period_end: boolean;
        type: 'default' | 'premium';
    } | null;
}

export default function Subscription({
    invoices,
    hasActiveAccess,
    isSubscribed,
    isPremium,
    isOnTrial,
    trialEndsAt,
    aiUsage,
    paymentMethod,
    subscription,
}: Props) {
    const { flash } = usePage<{ flash: { success?: string } }>().props;

    const [now] = useState(() => Date.now());

    const trialDaysLeft = trialEndsAt
        ? Math.max(
              0,
              Math.ceil((new Date(trialEndsAt).getTime() - now) / 86400000),
          )
        : 0;

    function handleCancel() {
        if (
            confirm(
                'Biztosan le szeretnéd mondani az előfizetésed?\n\nA hónap végéig (a már kifizetett időszak lejártáig) minden funkciót ugyanúgy használhatsz, és a kártyádat nem terheljük meg újra. Utána a fiókod automatikusan az ingyenes csomagra vált. A lemondást a lejárat előtt bármikor visszavonhatod.',
            )
        ) {
            router.post(cancel().url);
        }
    }

    function handlePortal() {
        router.post(portal().url);
    }

    function handleResume() {
        router.post(resume().url);
    }

    return (
        <>
            <Head title="Előfizetés" />

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Előfizetés"
                    description="Kezeld az előfizetésed és számlázási adataidat"
                />

                {flash?.success && (
                    <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
                        {flash.success}
                    </div>
                )}

                {/* Trial */}
                {isOnTrial && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-800 dark:bg-blue-950/30">
                        <div className="mb-1 flex items-center gap-2">
                            <Zap className="size-4 text-blue-600 dark:text-blue-400" />
                            <p className="font-semibold text-blue-700 dark:text-blue-300">
                                Próbaidőszak
                            </p>
                        </div>
                        <p className="mb-4 text-sm text-blue-600 dark:text-blue-400">
                            Még <strong>{trialDaysLeft} napod</strong> van a
                            próbaidőszakból.
                        </p>
                        <Link href={pricing()}>
                            <Button size="sm">Előfizetek most</Button>
                        </Link>
                    </div>
                )}

                {/* Premium subscription */}
                {isPremium && (
                    <div className="rounded-xl border border-violet-200 bg-violet-50 p-5 dark:border-violet-800 dark:bg-violet-950/30">
                        <div className="mb-1 flex items-center gap-2">
                            <Crown className="size-4 text-violet-600 dark:text-violet-400" />
                            <p className="font-semibold text-violet-700 dark:text-violet-300">
                                Prémium előfizetés
                            </p>
                        </div>
                        {subscription?.cancel_at_period_end ? (
                            <p className="mb-4 text-sm text-violet-600 dark:text-violet-400">
                                Lemondva — a prémium hozzáférésed{' '}
                                <strong>
                                    {new Date(
                                        subscription.ends_at!,
                                    ).toLocaleDateString('hu-HU')}
                                </strong>
                                -ig megmarad, addig minden funkciót
                                korlátozás nélkül használhatsz. Utána a fiókod
                                automatikusan az ingyenes csomagra vált, és
                                nem terheljük meg többé a kártyádat.
                            </p>
                        ) : (
                            <p className="mb-4 text-sm text-violet-600 dark:text-violet-400">
                                Aktív prémium előfizetés. Korlátlan szavak,
                                szólisták, flashcardok, kvíz- és cloze-körök,
                                magasabb napi szövegelemzési és AI-keret, plusz
                                a teljes AI-funkcionalitás. Havonta automatikusan
                                megújul; bármikor lemondhatod, és a hónap végéig
                                akkor is megmarad a hozzáférésed.
                            </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handlePortal}
                            >
                                <ExternalLink className="mr-1.5 size-3.5" />
                                Számlák & kártyaadatok
                            </Button>
                            {subscription?.cancel_at_period_end ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleResume}
                                >
                                    Lemondás visszavonása
                                </Button>
                            ) : (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                    onClick={handleCancel}
                                >
                                    Előfizetés lemondása
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {/* Basic subscription */}
                {!isPremium && isSubscribed && (
                    <div className="space-y-4 rounded-xl border p-5">
                        <div>
                            <p className="font-semibold">Alap előfizetés</p>
                            {subscription?.cancel_at_period_end ? (
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Lemondva — a hozzáférésed{' '}
                                    <strong>
                                        {new Date(
                                            subscription.ends_at!,
                                        ).toLocaleDateString('hu-HU')}
                                    </strong>
                                    -ig megmarad. Utána a fiókod automatikusan
                                    az ingyenes csomagra vált, és nem terheljük
                                    meg többé a kártyádat.
                                </p>
                            ) : (
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Aktív alap előfizetés — korlátlan szavak,
                                    szólisták, flashcardok, kvíz- és cloze-körök,
                                    AI-funkciók nélkül. Havonta automatikusan
                                    megújul. Válts prémiumra az AI-funkciókért,
                                    vagy mondd le bármikor — a hónap végéig
                                    akkor is megmarad a hozzáférésed.
                                </p>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handlePortal}
                            >
                                <ExternalLink className="mr-1.5 size-3.5" />
                                Számlák & kártyaadatok
                            </Button>
                            <Link href={pricing()}>
                                <Button size="sm" variant="outline">
                                    <Sparkles className="mr-1.5 size-3.5" />
                                    Váltás Prémiumra
                                </Button>
                            </Link>
                            {subscription?.cancel_at_period_end ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleResume}
                                >
                                    Lemondás visszavonása
                                </Button>
                            ) : (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                    onClick={handleCancel}
                                >
                                    Előfizetés lemondása
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {/* Előfizetés nélküli prémium hozzáférés (lifetime / admin-adta) —
                    fizetnie nem kell és nem is tud, ezért CTA sincs */}
                {!isSubscribed && !isOnTrial && hasActiveAccess && (
                    <div className="rounded-xl border border-violet-200 bg-violet-50 p-5 dark:border-violet-800 dark:bg-violet-950/30">
                        <div className="mb-1 flex items-center gap-2">
                            <Crown className="size-4 text-violet-600 dark:text-violet-400" />
                            <p className="font-semibold text-violet-700 dark:text-violet-300">
                                Prémium hozzáférés
                            </p>
                        </div>
                        <p className="text-sm text-violet-600 dark:text-violet-400">
                            Prémium hozzáférésed van — előfizetés és fizetés
                            nélkül, az összes funkcióval.
                        </p>
                    </div>
                )}

                {/* No subscription */}
                {!isSubscribed && !isOnTrial && !hasActiveAccess && (
                    <div className="rounded-xl border p-5">
                        <div className="mb-1 flex items-center gap-2">
                            <Zap className="size-4 text-muted-foreground" />
                            <p className="font-semibold">Jelenlegi csomag</p>
                        </div>
                        <p className="mb-4 text-sm text-muted-foreground">
                            Az <strong className="text-foreground">
                                ingyenes csomagot
                            </strong>{' '}
                            használod. Minden fő funkciót kipróbálhatsz, de napi
                            és havi limitekkel: korlátozott flashcard- és
                            szólista-szám, kevesebb napi szövegelemzés, és csak
                            egy kis AI-kóstoló.
                        </p>

                        <div className="mb-4 rounded-lg border border-violet-200 bg-violet-50 p-4 dark:border-violet-800 dark:bg-violet-950/30">
                            <div className="mb-2 flex items-center gap-2">
                                <Crown className="size-4 text-violet-600 dark:text-violet-400" />
                                <p className="text-sm font-semibold text-violet-700 dark:text-violet-300">
                                    Prémiummal a tiéd lenne:
                                </p>
                            </div>
                            <ul className="space-y-1.5 text-sm text-violet-600 dark:text-violet-400">
                                <li>
                                    ✓ Korlátlan szó, szólista, flashcard, kvíz-
                                    és cloze-kör
                                </li>
                                <li>
                                    ✓ Lényegesen magasabb napi szövegelemzési
                                    keret
                                </li>
                                <li>
                                    ✓ Teljes AI-funkcionalitás a nagyobb havi
                                    AI-kerettel
                                </li>
                            </ul>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Link href={pricing()}>
                                <Button size="sm">
                                    <Sparkles className="mr-1.5 size-3.5" />
                                    Váltás Prémiumra
                                </Button>
                            </Link>
                            <Link href={pricing()}>
                                <Button size="sm" variant="outline">
                                    Csomagok összehasonlítása
                                </Button>
                            </Link>
                        </div>
                    </div>
                )}

                {/* AI usage */}
                {aiUsage && (
                    <div className="rounded-xl border p-5">
                        <div className="mb-1 flex items-center gap-2">
                            <Sparkles className="size-4 text-violet-600 dark:text-violet-400" />
                            <p className="font-semibold">AI használat</p>
                        </div>
                        {aiUsage.unlimited ? (
                            <p className="text-sm text-muted-foreground">
                                Korlátlan AI-hozzáférés.
                            </p>
                        ) : (
                            <>
                                <p className="mb-3 text-sm text-muted-foreground">
                                    Ebben a hónapban a havi AI-kereted{' '}
                                    <strong className="text-foreground">
                                        {aiUsage.percent}%
                                    </strong>
                                    -át használtad fel.
                                </p>
                                <div className="bg-secondary mb-2 h-2 w-full overflow-hidden rounded-full">
                                    <div
                                        className="h-2 rounded-full bg-violet-500 transition-all"
                                        style={{ width: `${aiUsage.percent}%` }}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {aiUsage.percent >= 100
                                        ? 'Elérted a havi AI-kereted. '
                                        : `Még ${100 - aiUsage.percent}% maradt. `}
                                    Újraindul:{' '}
                                    {new Date(
                                        aiUsage.reset_at,
                                    ).toLocaleDateString('hu-HU')}
                                    .
                                </p>
                            </>
                        )}
                    </div>
                )}

                {/* Fizetési mód */}
                {paymentMethod && (
                    <div className="rounded-xl border p-5">
                        <div className="mb-1 flex items-center gap-2">
                            <CreditCard className="size-4 text-muted-foreground" />
                            <p className="font-semibold">Fizetési mód</p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {paymentMethod.brand
                                ? `${paymentMethod.brand.toUpperCase()} `
                                : 'Kártya '}
                            •••• {paymentMethod.last_four}
                        </p>
                        <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={handlePortal}
                        >
                            <ExternalLink className="mr-1.5 size-3.5" />
                            Kártya módosítása
                        </Button>
                    </div>
                )}

                {/* Számláim */}
                {invoices.length > 0 && (
                    <div className="rounded-xl border p-5">
                        <div className="mb-3 flex items-center gap-2">
                            <FileText className="size-4 text-muted-foreground" />
                            <p className="font-semibold">Számláim</p>
                        </div>
                        <ul className="divide-y">
                            {invoices.map((invoice) => (
                                <li
                                    key={invoice.id}
                                    className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium">
                                            {invoice.number ??
                                                'Számla'}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(
                                                invoice.date,
                                            ).toLocaleDateString('hu-HU')}
                                        </p>
                                    </div>
                                    <a
                                        href={download(invoice.id).url}
                                        download
                                    >
                                        <Button variant="outline" size="sm">
                                            <Download className="mr-1.5 size-3.5" />
                                            PDF
                                        </Button>
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

            </div>
        </>
    );
}
