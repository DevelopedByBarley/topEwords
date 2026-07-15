import { Transition } from '@headlessui/react';
import { Form, Head, router } from '@inertiajs/react';
import { Monitor, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import SecurityController from '@/actions/App/Http/Controllers/Settings/SecurityController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import TwoFactorRecoveryCodes from '@/components/two-factor-recovery-codes';
import TwoFactorSetupModal from '@/components/two-factor-setup-modal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useTwoFactorAuth } from '@/hooks/use-two-factor-auth';
import { edit } from '@/routes/security';
import {
    destroy as revokePlayerDevice,
    destroyAll as revokeAllPlayerDevices,
} from '@/routes/security/player-devices';
import { disable, enable } from '@/routes/two-factor';

type PlayerDevice = {
    id: number;
    name: string;
    last_used_at: string | null;
    created_at: string | null;
    expires_at: string | null;
};

type Props = {
    canManageTwoFactor?: boolean;
    requiresConfirmation?: boolean;
    twoFactorEnabled?: boolean;
    playerDevices?: PlayerDevice[];
};

/** Egy ISO-időpontot rövid magyar dátum-idő alakra formáz (vagy „—", ha nincs). */
function formatDateTime(iso: string | null): string {
    if (!iso) {
        return '—';
    }

    return new Date(iso).toLocaleDateString('hu-HU', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function Security({
    canManageTwoFactor = false,
    requiresConfirmation = false,
    twoFactorEnabled = false,
    playerDevices = [],
}: Props) {
    const passwordInput = useRef<HTMLInputElement>(null);
    const currentPasswordInput = useRef<HTMLInputElement>(null);

    const {
        qrCodeSvg,
        hasSetupData,
        manualSetupKey,
        clearSetupData,
        clearTwoFactorAuthData,
        fetchSetupData,
        recoveryCodesList,
        fetchRecoveryCodes,
        errors,
    } = useTwoFactorAuth();
    const [showSetupModal, setShowSetupModal] = useState<boolean>(false);
    const prevTwoFactorEnabled = useRef(twoFactorEnabled);

    useEffect(() => {
        if (prevTwoFactorEnabled.current && !twoFactorEnabled) {
            clearTwoFactorAuthData();
        }

        prevTwoFactorEnabled.current = twoFactorEnabled;
    }, [twoFactorEnabled, clearTwoFactorAuthData]);

    return (
        <>
            <Head title="Biztonsági beállítások" />

            <h1 className="sr-only">Biztonsági beállítások</h1>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Jelszó módosítása"
                    description="Használj hosszú, véletlenszerű jelszót, hogy a fiókod biztonságban maradjon"
                />

                <Form
                    action={SecurityController.update.url()}
                    method="put"
                    options={{
                        preserveScroll: true,
                    }}
                    resetOnError={[
                        'password',
                        'password_confirmation',
                        'current_password',
                    ]}
                    resetOnSuccess
                    onError={(errors) => {
                        if (errors.password) {
                            passwordInput.current?.focus();
                        }

                        if (errors.current_password) {
                            currentPasswordInput.current?.focus();
                        }
                    }}
                    className="space-y-6"
                >
                    {({ errors, processing, recentlySuccessful }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="current_password">
                                    Jelenlegi jelszó
                                </Label>

                                <PasswordInput
                                    id="current_password"
                                    ref={currentPasswordInput}
                                    name="current_password"
                                    className="mt-1 block w-full"
                                    autoComplete="current-password"
                                    placeholder="Jelenlegi jelszó"
                                />

                                <InputError message={errors.current_password} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="password">Új jelszó</Label>

                                <PasswordInput
                                    id="password"
                                    ref={passwordInput}
                                    name="password"
                                    className="mt-1 block w-full"
                                    autoComplete="new-password"
                                    placeholder="Új jelszó"
                                />

                                <InputError message={errors.password} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="password_confirmation">
                                    Jelszó megerősítése
                                </Label>

                                <PasswordInput
                                    id="password_confirmation"
                                    name="password_confirmation"
                                    className="mt-1 block w-full"
                                    autoComplete="new-password"
                                    placeholder="Jelszó megerősítése"
                                />

                                <InputError
                                    message={errors.password_confirmation}
                                />
                            </div>

                            <div className="flex items-center gap-4">
                                <Button
                                    disabled={processing}
                                    data-test="update-password-button"
                                >
                                    Jelszó mentése
                                </Button>

                                <Transition
                                    show={recentlySuccessful}
                                    enter="transition ease-in-out"
                                    enterFrom="opacity-0"
                                    leave="transition ease-in-out"
                                    leaveTo="opacity-0"
                                >
                                    <p className="text-sm text-neutral-600">
                                        Mentve
                                    </p>
                                </Transition>
                            </div>
                        </>
                    )}
                </Form>
            </div>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Összekötött eszközök"
                    description="A topwords Player alkalmazással összekötött eszközök. Ha egy eszközt elvesztettél vagy már nem használod, vond vissza a hozzáférését."
                />

                {playerDevices.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        Jelenleg nincs összekötött lejátszó-eszköz.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {playerDevices.map((device) => (
                            <div
                                key={device.id}
                                className="flex items-start justify-between gap-4 rounded-lg border border-border p-4"
                            >
                                <div className="flex items-start gap-3">
                                    <Monitor className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                                    <div className="space-y-0.5">
                                        <p className="text-sm font-medium">
                                            {device.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Utolsó használat:{' '}
                                            {formatDateTime(
                                                device.last_used_at,
                                            )}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Lejár:{' '}
                                            {formatDateTime(device.expires_at)}
                                        </p>
                                    </div>
                                </div>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        if (
                                            confirm(
                                                `Biztosan visszavonod a(z) „${device.name}” eszköz hozzáférését? Az eszközön újra össze kell majd kötni a fiókot.`,
                                            )
                                        ) {
                                            router.delete(
                                                revokePlayerDevice(device.id)
                                                    .url,
                                                { preserveScroll: true },
                                            );
                                        }
                                    }}
                                >
                                    Visszavonás
                                </Button>
                            </div>
                        ))}

                        {playerDevices.length > 1 && (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                    if (
                                        confirm(
                                            'Biztosan visszavonod az összes összekötött eszköz hozzáférését? Mindegyik eszközön újra össze kell majd kötni a fiókot.',
                                        )
                                    ) {
                                        router.delete(
                                            revokeAllPlayerDevices().url,
                                            { preserveScroll: true },
                                        );
                                    }
                                }}
                            >
                                Összes visszavonása
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {canManageTwoFactor && (
                <div className="space-y-6">
                    <Heading
                        variant="small"
                        title="Kétlépéses azonosítás"
                        description="Kezeld a kétlépéses azonosítás beállításait"
                    />
                    {twoFactorEnabled ? (
                        <div className="flex flex-col items-start justify-start space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Bejelentkezéskor egy biztonsági kódot kell
                                megadnod, amelyet a telefonodon lévő hitelesítő
                                alkalmazásból olvashatsz le.
                            </p>

                            <div className="relative inline">
                                <Form action={disable.url()} method="delete">
                                    {({ processing }) => (
                                        <Button
                                            variant="destructive"
                                            type="submit"
                                            disabled={processing}
                                        >
                                            2FA kikapcsolása
                                        </Button>
                                    )}
                                </Form>
                            </div>

                            <TwoFactorRecoveryCodes
                                recoveryCodesList={recoveryCodesList}
                                fetchRecoveryCodes={fetchRecoveryCodes}
                                errors={errors}
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col items-start justify-start space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Ha bekapcsolod a kétlépéses azonosítást,
                                bejelentkezéskor egy biztonsági kódot kell
                                megadnod. Ezt a kódot a telefonodon lévő
                                hitelesítő alkalmazásból olvashatod le.
                            </p>

                            <div>
                                {hasSetupData ? (
                                    <Button
                                        onClick={() => setShowSetupModal(true)}
                                    >
                                        <ShieldCheck />
                                        Beállítás folytatása
                                    </Button>
                                ) : (
                                    <Form
                                        action={enable.url()}
                                        method="post"
                                        onSuccess={() =>
                                            setShowSetupModal(true)
                                        }
                                    >
                                        {({ processing }) => (
                                            <Button
                                                type="submit"
                                                disabled={processing}
                                            >
                                                2FA bekapcsolása
                                            </Button>
                                        )}
                                    </Form>
                                )}
                            </div>
                        </div>
                    )}

                    <TwoFactorSetupModal
                        isOpen={showSetupModal}
                        onClose={() => setShowSetupModal(false)}
                        requiresConfirmation={requiresConfirmation}
                        twoFactorEnabled={twoFactorEnabled}
                        qrCodeSvg={qrCodeSvg}
                        manualSetupKey={manualSetupKey}
                        clearSetupData={clearSetupData}
                        fetchSetupData={fetchSetupData}
                        errors={errors}
                    />
                </div>
            )}
        </>
    );
}

Security.layout = {
    breadcrumbs: [
        {
            title: 'Biztonsági beállítások',
            href: edit(),
        },
    ],
};
