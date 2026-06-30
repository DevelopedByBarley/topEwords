// Components
import { Form, Head } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { logout } from '@/routes';
import { send } from '@/routes/verification';

export default function VerifyEmail({ status }: { status?: string }) {
    return (
        <>
            <Head title="E-mail megerősítése" />

            {status === 'verification-link-sent' && (
                <div className="mb-4 text-center text-sm font-medium text-green-600">
                    Új megerősítő linket küldtünk a megadott e-mail címre.
                </div>
            )}

            <div className="space-y-6 text-center">
                <p className="text-sm text-muted-foreground">
                    Köszönjük a regisztrációt! Mielőtt belépsz, kérjük, erősítsd
                    meg az e-mail címed a kiküldött levélben lévő linkkel. Ha nem
                    kaptad meg, alább kérhetsz egy újat.
                </p>

                <Form action={send.url()} method="post">
                    {({ processing }) => (
                        <Button disabled={processing} variant="secondary">
                            {processing && (
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                            )}
                            Megerősítő e-mail újraküldése
                        </Button>
                    )}
                </Form>

                <TextLink href={logout()} as="button" className="mx-auto block text-sm">
                    Kijelentkezés
                </TextLink>
            </div>
        </>
    );
}

VerifyEmail.layout = {
    title: 'E-mail megerősítése',
    description: 'Erősítsd meg az e-mail címed a folytatáshoz',
};
