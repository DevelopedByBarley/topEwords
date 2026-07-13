import { Form, Head } from '@inertiajs/react';
import { MonitorCheck, ShieldAlert } from 'lucide-react';
import PlayerPairingController from '@/actions/App/Http/Controllers/PlayerPairingController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { connect } from '@/routes/player';

/**
 * A topwords Player (desktop lejátszó) fiók-összekötésének jóváhagyó oldala.
 * A lejátszó a rendszer-böngészőt nyitja ide; a felhasználó a lejátszóban
 * megjelenő kódot KÉZZEL írja be — szándékosan nincs előkitöltés, hogy egy
 * kapott linkkel ne lehessen egy kattintással idegen párosítást jóváhagyatni.
 * A jóváhagyás a saját bejelentkezett session-nel történik, az appba így soha
 * nem kerül jelszó.
 */
export default function PlayerConnect() {
    return (
        <>
            <Head title="Lejátszó összekötése" />

            <div className="mx-auto max-w-xl space-y-6 py-8">
                <Heading
                    title="topwords Player összekötése"
                    description="Kösd össze a desktop lejátszót a fiókoddal, hogy a feliratok szavai a te szólistád szerint színeződjenek."
                />

                <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
                    <ShieldAlert className="mt-0.5 size-5 shrink-0" />
                    <p>
                        Csak a <strong>saját lejátszódban megjelenő</strong>{' '}
                        kódot írd be. Ha valaki mástól kaptad ezt a kódot vagy
                        ezt az oldalt, ne hagyd jóvá — zárd be az oldalt.
                    </p>
                </div>

                <Form
                    action={PlayerPairingController.approve.url()}
                    method="post"
                    className="space-y-6"
                >
                    {({ processing, wasSuccessful, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="code">
                                    A lejátszóban látható kód
                                </Label>

                                <Input
                                    id="code"
                                    name="code"
                                    required
                                    autoFocus
                                    autoComplete="off"
                                    spellCheck={false}
                                    maxLength={20}
                                    placeholder="XXXX-XXXX"
                                    className="max-w-xs font-mono text-lg tracking-widest uppercase"
                                />

                                <InputError message={errors.code} />
                            </div>

                            {wasSuccessful ? (
                                <div className="flex items-center gap-3 rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-900 dark:border-green-700 dark:bg-green-950 dark:text-green-200">
                                    <MonitorCheck className="size-5 shrink-0" />
                                    <p>
                                        A lejátszó összekötve. Visszatérhetsz az
                                        alkalmazásba — pár másodpercen belül
                                        magától bejelentkezik.
                                    </p>
                                </div>
                            ) : (
                                <Button disabled={processing}>
                                    {processing
                                        ? 'Jóváhagyás…'
                                        : 'Összekötés jóváhagyása'}
                                </Button>
                            )}
                        </>
                    )}
                </Form>
            </div>
        </>
    );
}

PlayerConnect.layout = {
    breadcrumbs: [
        {
            title: 'Lejátszó összekötése',
            href: connect(),
        },
    ],
};
