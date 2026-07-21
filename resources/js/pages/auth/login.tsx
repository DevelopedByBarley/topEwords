import { Form, Head } from '@inertiajs/react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { register } from '@/routes';
import { store } from '@/routes/login';
import { request } from '@/routes/password';

type Props = {
    status?: string;
    canResetPassword: boolean;
    canRegister: boolean;
};

export default function Login({
    status,
    canResetPassword,
    canRegister,
}: Props) {
    return (
        <>
            <Head title="Bejelentkezés" />

            {status && (
                <div className="mb-2 text-center text-sm font-medium text-green-600">
                    {status}
                </div>
            )}

            <Form
                action={store.url()}
                method="post"
                resetOnSuccess={['password']}
                className="flex flex-col gap-6"
            >
                {({ processing, errors }) => (
                    <>
                        <div className="grid gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="email">E-mail cím</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    name="email"
                                    required
                                    autoFocus
                                    tabIndex={1}
                                    autoComplete="email"
                                    placeholder="email@example.com"
                                    className="rounded-xl focus-visible:border-indigo-400 focus-visible:ring-indigo-400/50"
                                />
                                <InputError message={errors.email} />
                            </div>

                            <div className="grid gap-2">
                                <div className="flex items-center">
                                    <Label htmlFor="password">Jelszó</Label>
                                    {canResetPassword && (
                                        <TextLink
                                            href={request()}
                                            className="ml-auto text-sm text-indigo-600 hover:text-indigo-700"
                                            tabIndex={5}
                                        >
                                            Elfelejtett jelszó?
                                        </TextLink>
                                    )}
                                </div>
                                <PasswordInput
                                    id="password"
                                    name="password"
                                    required
                                    tabIndex={2}
                                    autoComplete="current-password"
                                    placeholder="Jelszó"
                                    className="rounded-xl focus-visible:border-indigo-400 focus-visible:ring-indigo-400/50"
                                />
                                <InputError message={errors.password} />
                            </div>

                            <div className="flex items-center space-x-3">
                                <Checkbox
                                    id="remember"
                                    name="remember"
                                    tabIndex={3}
                                />
                                <Label htmlFor="remember">Emlékezz rám</Label>
                            </div>

                            <Button
                                type="submit"
                                className="w-full rounded-full bg-linear-to-br from-green-400 to-green-500 font-bold text-green-950 shadow-[0_4px_0_0_var(--color-green-600)] hover:brightness-105"
                                tabIndex={4}
                                disabled={processing}
                                data-test="login-button"
                            >
                                {processing && <Spinner />}
                                Bejelentkezés
                            </Button>
                        </div>

                        {canRegister && (
                            <div className="text-center text-sm text-muted-foreground">
                                Még nincs fiókod?{' '}
                                <TextLink
                                    href={register()}
                                    tabIndex={6}
                                    className="text-indigo-600 hover:text-indigo-700"
                                >
                                    Regisztráció
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
