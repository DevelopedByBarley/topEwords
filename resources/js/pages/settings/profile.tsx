import { Transition } from '@headlessui/react';
import { Form, Head, usePage } from '@inertiajs/react';
import { useState } from 'react';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import DeleteUser from '@/components/delete-user';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { edit } from '@/routes/profile';

export default function Profile() {
    const { auth } = usePage().props;
    // E-mail-cseréhez a backend jelszó-megerősítést kér (ProfileUpdateRequest);
    // a jelszómezőt csak akkor mutatjuk, ha az e-mail tényleg változik.
    const [email, setEmail] = useState(auth.user.email);
    const emailChanged = email !== auth.user.email;

    return (
        <>
            <Head title="Profil beállítások" />

            <h1 className="sr-only">Profil beállítások</h1>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Profil adatok"
                    description="Frissítse nevét és e-mail címét"
                />

                <Form
                    action={ProfileController.update.url()}
                    method="patch"
                    options={{
                        preserveScroll: true,
                    }}
                    className="space-y-6"
                >
                    {({ processing, recentlySuccessful, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="name">Név</Label>

                                <Input
                                    id="name"
                                    className="mt-1 block w-full"
                                    defaultValue={auth.user.name}
                                    name="name"
                                    required
                                    autoComplete="name"
                                    placeholder="Teljes név"
                                />

                                <InputError
                                    className="mt-2"
                                    message={errors.name}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="email">E-mail cím</Label>

                                <Input
                                    id="email"
                                    type="email"
                                    className="mt-1 block w-full"
                                    defaultValue={auth.user.email}
                                    name="email"
                                    required
                                    autoComplete="username"
                                    placeholder="E-mail cím"
                                    onChange={(e) => setEmail(e.target.value)}
                                />

                                <InputError
                                    className="mt-2"
                                    message={errors.email}
                                />
                            </div>

                            {emailChanged && (
                                <div className="grid gap-2">
                                    <Label htmlFor="current_password">
                                        Jelenlegi jelszó
                                    </Label>

                                    <Input
                                        id="current_password"
                                        type="password"
                                        className="mt-1 block w-full"
                                        name="current_password"
                                        required
                                        autoComplete="current-password"
                                        placeholder="Jelenlegi jelszó"
                                    />

                                    <p className="text-sm text-muted-foreground">
                                        Az e-mail cím módosításához adja meg
                                        jelenlegi jelszavát.
                                    </p>

                                    <InputError
                                        className="mt-2"
                                        message={errors.current_password}
                                    />
                                </div>
                            )}

                            <div className="flex items-center gap-4">
                                <Button
                                    disabled={processing}
                                    data-test="update-profile-button"
                                >
                                    Mentés
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

            <DeleteUser />
        </>
    );
}

Profile.layout = {
    breadcrumbs: [
        {
            title: 'Profil beállítások',
            href: edit(),
        },
    ],
};
