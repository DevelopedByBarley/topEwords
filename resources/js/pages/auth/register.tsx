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
}: {
    inviteOnly?: boolean;
    invite?: string;
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
                                        className="rounded-xl focus-visible:border-indigo-400 focus-visible:ring-indigo-400/50"
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
                                    onChange={(e) =>
                                        setAccountName(e.target.value)
                                    }
                                    className="rounded-xl focus-visible:border-indigo-400 focus-visible:ring-indigo-400/50"
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
                                    className="rounded-xl focus-visible:border-indigo-400 focus-visible:ring-indigo-400/50"
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
                                    className="rounded-xl focus-visible:border-indigo-400 focus-visible:ring-indigo-400/50"
                                />
                                <InputError message={errors.password} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="password_confirmation">
                                    Megerősítés
                                </Label>
                                <PasswordInput
                                    id="password_confirmation"
                                    required
                                    tabIndex={4}
                                    autoComplete="new-password"
                                    name="password_confirmation"
                                    placeholder="Jelszó újra"
                                    className="rounded-xl focus-visible:border-indigo-400 focus-visible:ring-indigo-400/50"
                                />
                                <InputError
                                    message={errors.password_confirmation}
                                />
                            </div>

                            <p className="text-xs text-muted-foreground">
                                Min. 12 karakter, nagy- és kisbetű, szám és
                                speciális karakter (pl. !@#$%).
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
                                    <div className="space-y-3 border-t border-border px-4 pt-3 pb-4">
                                        <input
                                            type="hidden"
                                            name="billing_type"
                                            value={
                                                isCompany
                                                    ? 'company'
                                                    : 'individual'
                                            }
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
                                                    onChange={(e) =>
                                                        setSameAsAccount(
                                                            e.target.checked,
                                                        )
                                                    }
                                                />
                                                Megegyezik a fióknévvel
                                            </label>
                                            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-border"
                                                    checked={isCompany}
                                                    onChange={(e) =>
                                                        setIsCompany(
                                                            e.target.checked,
                                                        )
                                                    }
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
                                                    {isCompany
                                                        ? 'Cégnév'
                                                        : 'Számlázási név'}
                                                </Label>
                                                <Input
                                                    id="billing_name"
                                                    name="billing_name"
                                                    placeholder={
                                                        isCompany
                                                            ? 'Példa Kft.'
                                                            : 'Kiss János'
                                                    }
                                                    autoComplete={
                                                        isCompany
                                                            ? 'organization'
                                                            : 'name'
                                                    }
                                                    className="rounded-xl focus-visible:border-indigo-400 focus-visible:ring-indigo-400/50"
                                                />
                                                <InputError
                                                    message={
                                                        errors.billing_name
                                                    }
                                                />
                                            </div>
                                        )}

                                        {isCompany && (
                                            <>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="billing_tax_number">
                                                        Adószám
                                                    </Label>
                                                    <Input
                                                        id="billing_tax_number"
                                                        name="billing_tax_number"
                                                        placeholder="12345678-1-01"
                                                        className="rounded-xl focus-visible:border-indigo-400 focus-visible:ring-indigo-400/50"
                                                    />
                                                    <InputError
                                                        message={
                                                            errors.billing_tax_number
                                                        }
                                                    />
                                                </div>

                                                <div className="grid gap-2">
                                                    <Label htmlFor="billing_company_registration_number">
                                                        Cégjegyzékszám
                                                    </Label>
                                                    <Input
                                                        id="billing_company_registration_number"
                                                        name="billing_company_registration_number"
                                                        placeholder="01-09-999999"
                                                        className="rounded-xl focus-visible:border-indigo-400 focus-visible:ring-indigo-400/50"
                                                    />
                                                    <InputError
                                                        message={
                                                            errors.billing_company_registration_number
                                                        }
                                                    />
                                                </div>
                                            </>
                                        )}

                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="col-span-1 grid gap-2">
                                                <Label htmlFor="billing_zip">
                                                    Irányítószám
                                                </Label>
                                                <Input
                                                    id="billing_zip"
                                                    name="billing_zip"
                                                    placeholder="1234"
                                                    autoComplete="postal-code"
                                                    className="rounded-xl focus-visible:border-indigo-400 focus-visible:ring-indigo-400/50"
                                                />
                                                <InputError
                                                    message={errors.billing_zip}
                                                />
                                            </div>
                                            <div className="col-span-2 grid gap-2">
                                                <Label htmlFor="billing_city">
                                                    Város
                                                </Label>
                                                <Input
                                                    id="billing_city"
                                                    name="billing_city"
                                                    placeholder="Budapest"
                                                    autoComplete="address-level2"
                                                    className="rounded-xl focus-visible:border-indigo-400 focus-visible:ring-indigo-400/50"
                                                />
                                                <InputError
                                                    message={
                                                        errors.billing_city
                                                    }
                                                />
                                            </div>
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="billing_address">
                                                Utca, házszám
                                            </Label>
                                            <Input
                                                id="billing_address"
                                                name="billing_address"
                                                placeholder="Kossuth Lajos utca 1."
                                                autoComplete="street-address"
                                                className="rounded-xl focus-visible:border-indigo-400 focus-visible:ring-indigo-400/50"
                                            />
                                            <InputError
                                                message={errors.billing_address}
                                            />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="billing_phone">
                                                Telefonszám
                                            </Label>
                                            <Input
                                                id="billing_phone"
                                                name="billing_phone"
                                                placeholder="+36301234567"
                                                autoComplete="tel"
                                                className="rounded-xl focus-visible:border-indigo-400 focus-visible:ring-indigo-400/50"
                                            />
                                            <InputError
                                                message={errors.billing_phone}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <Button
                                type="submit"
                                className="w-full rounded-full bg-linear-to-br from-green-400 to-green-500 font-bold text-green-950 shadow-[0_4px_0_0_var(--color-green-600)] hover:brightness-105"
                                tabIndex={5}
                                data-test="register-user-button"
                            >
                                {processing && <Spinner />}
                                Fiók létrehozása
                            </Button>
                        </div>

                        <div className="text-center text-sm text-muted-foreground">
                            Már van fiókod?{' '}
                            <TextLink
                                href={login()}
                                tabIndex={7}
                                className="text-indigo-600 hover:text-indigo-700"
                            >
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
