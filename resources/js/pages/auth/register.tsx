import { Form, Head } from '@inertiajs/react';
import { ChevronDown, MailCheck } from 'lucide-react';
import { useState } from 'react';
import AuthField from '@/components/auth/auth-field';
import AuthNotice from '@/components/auth/auth-notice';
import FocusFirstError from '@/components/auth/focus-first-error';
import PasswordRequirements from '@/components/auth/password-requirements';
import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { login, privacy, terms } from '@/routes';
import { store } from '@/routes/register';

type Props = {
    inviteOnly?: boolean;
    invite?: string;
};

export default function Register({ inviteOnly = false, invite = '' }: Props) {
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
                    <RegisterFields
                        processing={processing}
                        errors={errors}
                        inviteOnly={inviteOnly}
                        invite={invite}
                    />
                )}
            </Form>
        </>
    );
}

/**
 * Külön komponens, mert az Inertia `<Form>` render-propjában nem lehet hookot
 * használni — a mezők állapota (élő jelszó-ellenőrzés, számlázási panel) viszont
 * hookokat igényel.
 */
function RegisterFields({
    processing,
    errors,
    inviteOnly,
    invite,
}: Props & { processing: boolean; errors: Record<string, string> }) {
    const [accountName, setAccountName] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [billingRequested, setBillingRequested] = useState(false);
    const [sameAsAccount, setSameAsAccount] = useState(false);
    const [isCompany, setIsCompany] = useState(false);

    /*
     * A számlázási panel becsukva indul, a hozzá tartozó mezők pedig nincsenek a
     * DOM-ban. Ha a szerver mégis számlázási hibát ad vissza, a felhasználó
     * csukott panel mögött keresné, mi a baj — ezért ilyenkor kinyitjuk. A
     * render közben számoljuk (nem effektben), hogy a hibás mező már az első
     * kirajzoláskor létezzen, és a `FocusFirstError` rá tudjon fókuszálni.
     */
    const hasBillingError = Object.keys(errors).some((field) =>
        field.startsWith('billing_'),
    );
    const billingOpen = billingRequested || hasBillingError;

    const passwordsMatch = password !== '' && password === passwordConfirmation;

    return (
        <>
            <FocusFirstError errors={errors} />

            <div className="grid gap-4">
                {inviteOnly && (
                    <AuthField
                        id="invite"
                        name="invite"
                        type="text"
                        label="Meghívókód"
                        required
                        // Ha a kód a linkből már ki van töltve, a névvel kezd a felhasználó.
                        autoFocus={invite === ''}
                        autoComplete="off"
                        placeholder="Meghívókód"
                        defaultValue={invite}
                        hint="A regisztráció jelenleg csak meghívóval érhető el."
                        error={errors.invite}
                    />
                )}

                {/*
                 * Nagyobb kijelzőn két hasábban: az űrlap egy hasábban túl
                 * hosszú lett, a gomb a hajtás alá csúszott. A párok
                 * (név–e-mail, jelszó–megerősítés) olvasási sorrendben követik
                 * egymást, így a tab-sorrend is természetes marad.
                 */}
                <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
                    <AuthField
                        id="name"
                        name="name"
                        type="text"
                        label="Név"
                        required
                        autoFocus={!inviteOnly || invite !== ''}
                        autoComplete="name"
                        placeholder="Kiss János"
                        value={accountName}
                        onChange={(event) => setAccountName(event.target.value)}
                        error={errors.name}
                    />

                    <AuthField
                        id="email"
                        name="email"
                        type="email"
                        label="E-mail cím"
                        required
                        autoComplete="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        inputMode="email"
                        placeholder="email@example.com"
                        error={errors.email}
                    />

                    <AuthField
                        id="password"
                        name="password"
                        label="Jelszó"
                        password
                        required
                        autoComplete="new-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        hint={<PasswordRequirements value={password} />}
                        error={errors.password}
                    />

                    <AuthField
                        id="password_confirmation"
                        name="password_confirmation"
                        label="Jelszó megerősítése"
                        password
                        required
                        autoComplete="new-password"
                        value={passwordConfirmation}
                        onChange={(event) =>
                            setPasswordConfirmation(event.target.value)
                        }
                        error={errors.password_confirmation}
                        hint={
                            passwordConfirmation !== '' && (
                                <span
                                    aria-live="polite"
                                    className={
                                        passwordsMatch
                                            ? 'text-green-600 dark:text-green-400'
                                            : 'text-amber-600 dark:text-amber-400'
                                    }
                                >
                                    {passwordsMatch
                                        ? 'A két jelszó megegyezik.'
                                        : 'A két jelszó még nem egyezik.'}
                                </span>
                            )
                        }
                    />
                </div>

                <div className="rounded-xl border border-border">
                    <button
                        type="button"
                        id="billing-toggle"
                        onClick={() => setBillingRequested((open) => !open)}
                        aria-expanded={billingOpen}
                        aria-controls="billing-fields"
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                    >
                        <span>
                            <span className="text-sm font-medium text-foreground">
                                Számlázási adatok
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                                Csak előfizetéshez kell — később a
                                Beállításokban is megadhatod.
                            </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                            Opcionális
                            <ChevronDown
                                className={`size-4 transition-transform ${billingOpen ? 'rotate-180' : ''}`}
                                aria-hidden="true"
                            />
                        </span>
                    </button>

                    <div
                        id="billing-fields"
                        role="region"
                        aria-labelledby="billing-toggle"
                    >
                        {billingOpen && (
                            <div className="space-y-3 border-t border-border px-4 pt-4 pb-4">
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

                                <div className="flex flex-wrap gap-x-6 gap-y-3">
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id="billing_same_as_account"
                                            checked={sameAsAccount}
                                            onCheckedChange={(checked) =>
                                                setSameAsAccount(
                                                    checked === true,
                                                )
                                            }
                                        />
                                        <Label
                                            htmlFor="billing_same_as_account"
                                            className="cursor-pointer text-xs font-normal text-muted-foreground"
                                        >
                                            Megegyezik a fióknévvel
                                        </Label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id="billing_is_company"
                                            checked={isCompany}
                                            onCheckedChange={(checked) =>
                                                setIsCompany(checked === true)
                                            }
                                        />
                                        <Label
                                            htmlFor="billing_is_company"
                                            className="cursor-pointer text-xs font-normal text-muted-foreground"
                                        >
                                            Cég vagyok
                                        </Label>
                                    </div>
                                </div>

                                {sameAsAccount ? (
                                    <input
                                        type="hidden"
                                        name="billing_name"
                                        value={accountName}
                                    />
                                ) : (
                                    <AuthField
                                        id="billing_name"
                                        name="billing_name"
                                        label={
                                            isCompany
                                                ? 'Cégnév'
                                                : 'Számlázási név'
                                        }
                                        placeholder={
                                            isCompany
                                                ? 'Példa Kft.'
                                                : 'Kiss János'
                                        }
                                        autoComplete={
                                            isCompany ? 'organization' : 'name'
                                        }
                                        error={errors.billing_name}
                                    />
                                )}

                                {isCompany && (
                                    <div className="grid gap-3 sm:grid-cols-2 sm:items-start">
                                        <AuthField
                                            id="billing_tax_number"
                                            name="billing_tax_number"
                                            label="Adószám"
                                            placeholder="12345678-1-01"
                                            error={errors.billing_tax_number}
                                        />

                                        <AuthField
                                            id="billing_company_registration_number"
                                            name="billing_company_registration_number"
                                            label="Cégjegyzékszám"
                                            placeholder="01-09-999999"
                                            error={
                                                errors.billing_company_registration_number
                                            }
                                        />
                                    </div>
                                )}

                                <div className="grid grid-cols-3 gap-3">
                                    <div className="col-span-1">
                                        <AuthField
                                            id="billing_zip"
                                            name="billing_zip"
                                            label="Irányítószám"
                                            placeholder="1234"
                                            autoComplete="postal-code"
                                            inputMode="numeric"
                                            error={errors.billing_zip}
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <AuthField
                                            id="billing_city"
                                            name="billing_city"
                                            label="Város"
                                            placeholder="Budapest"
                                            autoComplete="address-level2"
                                            error={errors.billing_city}
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2 sm:items-start">
                                    <AuthField
                                        id="billing_address"
                                        name="billing_address"
                                        label="Utca, házszám"
                                        placeholder="Kossuth Lajos utca 1."
                                        autoComplete="street-address"
                                        error={errors.billing_address}
                                    />

                                    <AuthField
                                        id="billing_phone"
                                        name="billing_phone"
                                        type="tel"
                                        label="Telefonszám"
                                        placeholder="+36301234567"
                                        autoComplete="tel"
                                        inputMode="tel"
                                        error={errors.billing_phone}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/*
                 * A regisztráció nem léptet be (RegisterResponse): e-mail-
                 * megerősítés után lehet belépni. Ezt a gomb mellett mondjuk el,
                 * hogy a „miért dobott vissza a bejelentkezésre?” kérdés fel se
                 * merüljön.
                 */}
                <AuthNotice icon={MailCheck}>
                    A regisztráció után <strong>megerősítő e-mailt</strong>{' '}
                    küldünk. A belépéshez kattints a benne lévő linkre.
                </AuthNotice>

                {/*
                 * A jogi dokumentumok elfogadása kifejezett, kötelező pipa. A
                 * `terms` mezőt a szerver is megköveteli (CreateNewUser), a
                 * linkek pedig új lapon nyílnak, hogy a kitöltött űrlap ne
                 * vesszen el.
                 */}
                <div className="grid gap-2">
                    <div className="flex items-start gap-3">
                        <Checkbox
                            id="terms"
                            name="terms"
                            className="mt-0.5"
                            aria-invalid={errors.terms ? true : undefined}
                            aria-describedby={
                                errors.terms ? 'terms-error' : undefined
                            }
                        />
                        <Label
                            htmlFor="terms"
                            className="cursor-pointer text-sm leading-relaxed font-normal"
                        >
                            Elolvastam és elfogadom az{' '}
                            <a
                                href={terms.url()}
                                target="_blank"
                                rel="noreferrer"
                                className="text-link underline underline-offset-4 hover:text-link-hover"
                            >
                                ÁSZF-et
                            </a>{' '}
                            és az{' '}
                            <a
                                href={privacy.url()}
                                target="_blank"
                                rel="noreferrer"
                                className="text-link underline underline-offset-4 hover:text-link-hover"
                            >
                                Adatkezelési tájékoztatót
                            </a>
                            .
                        </Label>
                    </div>
                    <InputError id="terms-error" message={errors.terms} />
                </div>

                <Button
                    type="submit"
                    className="w-full rounded-full bg-linear-to-br from-green-400 to-green-500 font-bold text-green-950 shadow-[0_4px_0_0_var(--color-green-600)] hover:brightness-105"
                    disabled={processing}
                    aria-busy={processing}
                    data-test="register-user-button"
                >
                    {processing && <Spinner aria-hidden="true" />}
                    {processing ? 'Fiók létrehozása…' : 'Fiók létrehozása'}
                </Button>
            </div>

            <div className="text-center text-sm text-muted-foreground">
                Már van fiókod?{' '}
                <TextLink
                    href={login()}
                    className="text-link hover:text-link-hover"
                >
                    Bejelentkezés
                </TextLink>
            </div>
        </>
    );
}

Register.layout = {
    title: 'Fiók létrehozása',
    description: 'Add meg az adataidat a regisztrációhoz',
    // Az űrlap kétkijelzős elrendezéséhez szélesebb oszlop kell, mint a többi
    // auth-lap egymezős űrlapjaihoz.
    wide: true,
};
