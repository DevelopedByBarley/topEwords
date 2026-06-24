import { Form, Head } from '@inertiajs/react';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { login } from '@/routes';
import { store } from '@/routes/register';

export default function Register({
    inviteOnly = false,
    invite = '',
    canGoogle = false,
}: {
    inviteOnly?: boolean;
    invite?: string;
    canGoogle?: boolean;
}) {
    const [billingOpen, setBillingOpen] = useState(false);
    const [accountName, setAccountName] = useState('');
    const [sameAsAccount, setSameAsAccount] = useState(false);
    const [isCompany, setIsCompany] = useState(false);

    return (
        <>
            <Head title="Regisztráció" />
            <Form
                action={store.url()}
                method="post"
                resetOnSuccess={['password', 'password_confirmation']}
                disableWhileProcessing
                className="flex flex-col gap-6"
            >
                {({ processing, errors }) => (
                    <>
                        <div className="grid gap-4">
                            {inviteOnly && (
                                <div className="grid gap-2">
                                    <Label htmlFor="invite">Meghívókód</Label>
                                    <Input
                                        id="invite"
                                        type="text"
                                        required
                                        name="invite"
                                        defaultValue={invite}
                                        autoComplete="off"
                                        placeholder="Meghívókód"
                                    />
                                    <InputError message={errors.invite} />
                                </div>
                            )}

                            <div className="grid gap-2">
                                <Label htmlFor="name">Név</Label>
                                <Input
                                    id="name"
                                    type="text"
                                    required
                                    autoFocus
                                    tabIndex={1}
                                    autoComplete="name"
                                    name="name"
                                    placeholder="Kiss János"
                                    value={accountName}
                                    onChange={(e) => setAccountName(e.target.value)}
                                />
                                <InputError message={errors.name} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="email">E-mail</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    required
                                    tabIndex={2}
                                    autoComplete="email"
                                    name="email"
                                    placeholder="email@example.com"
                                />
                                <InputError message={errors.email} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="password">Jelszó</Label>
                                <PasswordInput
                                    id="password"
                                    required
                                    tabIndex={3}
                                    autoComplete="new-password"
                                    name="password"
                                    placeholder="Jelszó"
                                />
                                <InputError message={errors.password} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="password_confirmation">Megerősítés</Label>
                                <PasswordInput
                                    id="password_confirmation"
                                    required
                                    tabIndex={4}
                                    autoComplete="new-password"
                                    name="password_confirmation"
                                    placeholder="Jelszó újra"
                                />
                                <InputError message={errors.password_confirmation} />
                            </div>

                            <p className="text-xs text-muted-foreground">
                                Min. 12 karakter, nagy- és kisbetű, szám és speciális karakter (pl. !@#$%).
                            </p>

                            <div className="rounded-lg border border-border">
                                <button
                                    type="button"
                                    onClick={() => setBillingOpen((o) => !o)}
                                    className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-foreground"
                                >
                                    <span>Számlázási adatok</span>
                                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        Opcionális
                                        <ChevronDown
                                            className={`size-4 transition-transform ${billingOpen ? 'rotate-180' : ''}`}
                                        />
                                    </span>
                                </button>

                                {billingOpen && (
                                    <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
                                        <input
                                            type="hidden"
                                            name="billing_type"
                                            value={isCompany ? 'company' : 'individual'}
                                        />
                                        <input
                                            type="hidden"
                                            name="billing_country"
                                            value="HU"
                                        />

                                        <div className="flex flex-wrap gap-4">
                                            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-border"
                                                    checked={sameAsAccount}
                                                    onChange={(e) => setSameAsAccount(e.target.checked)}
                                                />
                                                Megegyezik a fióknévvel
                                            </label>
                                            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-border"
                                                    checked={isCompany}
                                                    onChange={(e) => setIsCompany(e.target.checked)}
                                                />
                                                Cég vagyok
                                            </label>
                                        </div>

                                        {sameAsAccount ? (
                                            <input
                                                type="hidden"
                                                name="billing_name"
                                                value={accountName}
                                            />
                                        ) : (
                                            <div className="grid gap-2">
                                                <Label htmlFor="billing_name">
                                                    {isCompany ? 'Cégnév' : 'Számlázási név'}
                                                </Label>
                                                <Input
                                                    id="billing_name"
                                                    name="billing_name"
                                                    placeholder={isCompany ? 'Példa Kft.' : 'Kiss János'}
                                                    autoComplete={isCompany ? 'organization' : 'name'}
                                                />
                                                <InputError message={errors.billing_name} />
                                            </div>
                                        )}

                                        {isCompany && (
                                            <div className="grid gap-2">
                                                <Label htmlFor="billing_tax_number">Adószám</Label>
                                                <Input
                                                    id="billing_tax_number"
                                                    name="billing_tax_number"
                                                    placeholder="12345678-1-01"
                                                />
                                                <InputError message={errors.billing_tax_number} />
                                            </div>
                                        )}

                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="col-span-1 grid gap-2">
                                                <Label htmlFor="billing_zip">Irányítószám</Label>
                                                <Input
                                                    id="billing_zip"
                                                    name="billing_zip"
                                                    placeholder="1234"
                                                    autoComplete="postal-code"
                                                />
                                                <InputError message={errors.billing_zip} />
                                            </div>
                                            <div className="col-span-2 grid gap-2">
                                                <Label htmlFor="billing_city">Város</Label>
                                                <Input
                                                    id="billing_city"
                                                    name="billing_city"
                                                    placeholder="Budapest"
                                                    autoComplete="address-level2"
                                                />
                                                <InputError message={errors.billing_city} />
                                            </div>
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="billing_address">Utca, házszám</Label>
                                            <Input
                                                id="billing_address"
                                                name="billing_address"
                                                placeholder="Kossuth Lajos utca 1."
                                                autoComplete="street-address"
                                            />
                                            <InputError message={errors.billing_address} />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <Button
                                type="submit"
                                className="w-full"
                                tabIndex={5}
                                data-test="register-user-button"
                            >
                                {processing && <Spinner />}
                                Fiók létrehozása
                            </Button>
                        </div>

                        {canGoogle && (
                            <>
                                <div className="relative flex items-center gap-3">
                                    <div className="flex-1 border-t border-border" />
                                    <span className="text-xs text-muted-foreground">vagy</span>
                                    <div className="flex-1 border-t border-border" />
                                </div>
                                <a
                                    href="/auth/google"
                                    className="flex w-full items-center justify-center gap-3 rounded-md border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
                                    tabIndex={6}
                                >
                                    <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                    </svg>
                                    Folytatás Google-fiókkal
                                </a>
                            </>
                        )}

                        <div className="text-center text-sm text-muted-foreground">
                            Már van fiókod?{' '}
                            <TextLink href={login()} tabIndex={7}>
                                Bejelentkezés
                            </TextLink>
                        </div>
                    </>
                )}
            </Form>
        </>
    );
}

Register.layout = {
    title: 'Fiók létrehozása',
    description: 'Add meg adataidat a regisztrációhoz',
};
