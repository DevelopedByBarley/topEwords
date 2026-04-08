import { Head, Link, router, usePage } from '@inertiajs/react';
import { Crown, ExternalLink, Zap } from 'lucide-react';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { pricing } from '@/routes';
import { cancel, portal } from '@/routes/subscription';

interface Props {
    hasActiveAccess: boolean;
    isSubscribed: boolean;
    hasLifetime: boolean;
    isOnTrial: boolean;
    trialEndsAt: string | null;
    subscription: {
        stripe_status: string;
        ends_at: string | null;
        cancel_at_period_end: boolean;
    } | null;
}

export default function Subscription({ hasActiveAccess, isSubscribed, hasLifetime, isOnTrial, trialEndsAt, subscription }: Props) {
    const { flash } = usePage<{ flash: { success?: string } }>().props;

    const trialDaysLeft = trialEndsAt
        ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
        : 0;

    function handleCancel() {
        if (confirm('Biztosan le szeretnéd mondani az előfizetésed? A hónap végéig még hozzáférsz a prémium funkciókhoz.')) {
            router.post(cancel().url);
        }
    }

    function handlePortal() {
        router.post(portal().url);
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

                {/* Lifetime */}
                {hasLifetime && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-950/30">
                        <div className="flex items-center gap-2 mb-1">
                            <Crown className="size-4 text-amber-600 dark:text-amber-400" />
                            <p className="font-semibold text-amber-700 dark:text-amber-300">Lifetime hozzáférés</p>
                        </div>
                        <p className="text-sm text-amber-600 dark:text-amber-400">Köszönjük a támogatást! Korlátlan hozzáférésed van örökre.</p>
                    </div>
                )}

                {/* Trial */}
                {!hasLifetime && isOnTrial && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-800 dark:bg-blue-950/30">
                        <div className="flex items-center gap-2 mb-1">
                            <Zap className="size-4 text-blue-600 dark:text-blue-400" />
                            <p className="font-semibold text-blue-700 dark:text-blue-300">Próbaidőszak</p>
                        </div>
                        <p className="text-sm text-blue-600 dark:text-blue-400 mb-4">
                            Még <strong>{trialDaysLeft} napod</strong> van a próbaidőszakból. Utána az ingyenes korlátok lépnek életbe.
                        </p>
                        <Link href={pricing()}>
                            <Button size="sm">Előfizetek most</Button>
                        </Link>
                    </div>
                )}

                {/* Active subscription */}
                {!hasLifetime && isSubscribed && (
                    <div className="rounded-xl border p-5 space-y-4">
                        <div>
                            <p className="font-semibold">Havi előfizetés</p>
                            {subscription?.cancel_at_period_end ? (
                                <p className="text-sm text-muted-foreground mt-1">
                                    Lemondva — hozzáférésed <strong>{new Date(subscription.ends_at!).toLocaleDateString('hu-HU')}</strong> lejárig megmarad.
                                </p>
                            ) : (
                                <p className="text-sm text-muted-foreground mt-1">Aktív előfizetés</p>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={handlePortal}>
                                <ExternalLink className="mr-1.5 size-3.5" />
                                Számlák & kártyaadatok
                            </Button>
                            {!subscription?.cancel_at_period_end && (
                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={handleCancel}>
                                    Előfizetés lemondása
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {/* No subscription */}
                {!hasLifetime && !isSubscribed && !isOnTrial && (
                    <div className="rounded-xl border p-5">
                        <p className="font-semibold mb-1">Ingyenes csomag</p>
                        <p className="text-sm text-muted-foreground mb-4">Váltj prémiumra a korlátlan hozzáférésért.</p>
                        <Link href={pricing()}>
                            <Button size="sm">Csomagok megtekintése</Button>
                        </Link>
                    </div>
                )}
            </div>
        </>
    );
}
