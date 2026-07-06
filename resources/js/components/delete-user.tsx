import { Form } from '@inertiajs/react';
import { useRef } from 'react';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export default function DeleteUser() {
    const passwordInput = useRef<HTMLInputElement>(null);

    return (
        <div className="space-y-6">
            <Heading
                variant="small"
                title="Fiók törlése"
                description="A fiókod és minden hozzá tartozó adat végleges törlése"
            />
            <div className="space-y-4 rounded-lg border border-red-100 bg-red-50 p-4 dark:border-red-200/10 dark:bg-red-700/10">
                <div className="relative space-y-2 text-red-600 dark:text-red-100">
                    <p className="font-medium">Figyelem — ez nem vonható vissza</p>
                    <p className="text-sm">
                        A fiókod törlésével véglegesen és
                        visszaállíthatatlanul elveszíted az összes hozzá
                        kapcsolódó adatot, többek között:
                    </p>
                    <ul className="ml-4 list-disc space-y-1 text-sm">
                        <li>a szavaidat, szólistáidat és a hozzájuk mentett haladást,</li>
                        <li>a flashcard-tanulási előzményeidet és statisztikáidat,</li>
                        <li>a kvíz-, kihagyásos (cloze) és szövegelemzési eredményeidet,</li>
                        <li>a profil- és fiókbeállításaidat.</li>
                    </ul>
                    <p className="text-sm">
                        Ha van aktív előfizetésed, azt a törléskor
                        automatikusan lemondjuk, így a kártyádat többé nem
                        terheljük meg. A törlés után nem tudjuk az adataidat
                        visszaállítani — ha később újra használni szeretnéd a
                        szolgáltatást, új fiókot kell létrehoznod.
                    </p>
                </div>

                <Dialog>
                    <DialogTrigger asChild>
                        <Button
                            variant="destructive"
                            data-test="delete-user-button"
                        >
                            Fiók törlése
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogTitle>
                            Biztosan törölni szeretnéd a fiókodat?
                        </DialogTitle>
                        <DialogDescription>
                            A fiók törlésével minden hozzá tartozó adat és
                            haladás véglegesen elvész, és ez a művelet nem
                            vonható vissza. Esetleges aktív előfizetésedet a
                            törléskor automatikusan lemondjuk. A megerősítéshez
                            add meg a jelszavadat.
                        </DialogDescription>

                        <Form
                            action={ProfileController.destroy.url()}
                            method="delete"
                            options={{
                                preserveScroll: true,
                            }}
                            onError={() => passwordInput.current?.focus()}
                            resetOnSuccess
                            className="space-y-6"
                        >
                            {({ resetAndClearErrors, processing, errors }) => (
                                <>
                                    <div className="grid gap-2">
                                        <Label
                                            htmlFor="password"
                                            className="sr-only"
                                        >
                                            Jelszó
                                        </Label>

                                        <PasswordInput
                                            id="password"
                                            name="password"
                                            ref={passwordInput}
                                            placeholder="Jelszó"
                                            autoComplete="current-password"
                                        />

                                        <InputError message={errors.password} />
                                    </div>

                                    <DialogFooter className="gap-2">
                                        <DialogClose asChild>
                                            <Button
                                                variant="secondary"
                                                onClick={() =>
                                                    resetAndClearErrors()
                                                }
                                            >
                                                Mégse
                                            </Button>
                                        </DialogClose>

                                        <Button
                                            variant="destructive"
                                            disabled={processing}
                                            asChild
                                        >
                                            <button
                                                type="submit"
                                                data-test="confirm-delete-user-button"
                                            >
                                                Fiók végleges törlése
                                            </button>
                                        </Button>
                                    </DialogFooter>
                                </>
                            )}
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
