import { Form, Head } from '@inertiajs/react';
import { MailCheck } from 'lucide-react';
import AuthField from '@/components/auth/auth-field';
import AuthNotice from '@/components/auth/auth-notice';
import FocusFirstError from '@/components/auth/focus-first-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { register } from '@/routes';
import { store } from '@/routes/login';
import { request } from '@/routes/password';
import type { LoginPageProps } from '@/types/auth';

export default function Login({
    status,
    canResetPassword,
    canRegister,
}: LoginPageProps) {
    return (
        <>
            <Head title="Bejelentkezés" />

            {status && (
                <AuthNotice icon={MailCheck} tone="success" className="mb-2">
                    {status}
                </AuthNotice>
            )}

            <Form
                action={store.url()}
                method="post"
                resetOnSuccess={['password']}
                className="flex flex-col gap-6"
            >
                {({ processing, errors }) => (
                    <>
                        <FocusFirstError errors={errors} />

                        <div className="grid gap-4">
                            <AuthField
                                id="email"
                                name="email"
                                type="email"
                                label="E-mail cím"
                                required
                                autoFocus
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
                                autoComplete="current-password"
                                error={errors.password}
                                labelAction={
                                    canResetPassword && (
                                        <TextLink
                                            href={request()}
                                            className="text-sm text-link hover:text-link-hover"
                                        >
                                            Elfelejtett jelszó?
                                        </TextLink>
                                    )
                                }
                            />

                            <div className="flex items-start gap-3">
                                <Checkbox
                                    id="remember"
                                    name="remember"
                                    className="mt-0.5"
                                />
                                <div className="grid gap-0.5">
                                    <Label
                                        htmlFor="remember"
                                        className="cursor-pointer"
                                    >
                                        Maradjak bejelentkezve
                                    </Label>
                                    <span className="text-xs text-muted-foreground">
                                        Csak saját eszközön ajánlott.
                                    </span>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="w-full rounded-full bg-linear-to-br from-green-400 to-green-500 font-bold text-green-950 shadow-[0_4px_0_0_var(--color-green-600)] hover:brightness-105"
                                disabled={processing}
                                aria-busy={processing}
                                data-test="login-button"
                            >
                                {processing && <Spinner aria-hidden="true" />}
                                {processing ? 'Belépés…' : 'Bejelentkezés'}
                            </Button>
                        </div>

                        {canRegister && (
                            <div className="text-center text-sm text-muted-foreground">
                                Még nincs fiókod?{' '}
                                <TextLink
                                    href={register()}
                                    className="text-link hover:text-link-hover"
                                >
                                    Regisztrálj ingyen
                                </TextLink>
                            </div>
                        )}
                    </>
                )}
            </Form>
        </>
    );
}

Login.layout = {
    title: 'Bejelentkezés',
    description: 'Add meg az e-mail címed és jelszavad',
};
