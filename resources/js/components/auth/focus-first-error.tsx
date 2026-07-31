import { useEffect } from 'react';

/**
 * Validációs hiba után az első hibás mezőre fókuszál.
 *
 * Hosszú űrlapon (regisztráció) a hibaüzenet könnyen a képernyőn kívülre esik,
 * a képernyőolvasó pedig nem tudja, hova lépjen vissza. A fókusz átvitele
 * mindkettőt megoldja: odagörget és felolvassa a mezőt a hibájával együtt.
 *
 * Nem renderel semmit — csak azért komponens, mert a hívó helye az Inertia
 * `<Form>` render-propja, ahol hookot nem lehetne használni.
 */
export default function FocusFirstError({
    errors,
}: {
    errors: Record<string, string>;
}) {
    const firstField = Object.keys(errors)[0];

    useEffect(() => {
        if (!firstField) {
            return;
        }

        /*
         * A Radix-checkbox a `name`-et egy rejtett, nem fókuszálható input-ra
         * teszi (a látható vezérlő egy gomb), ezért az `aria-hidden` elemeket
         * kihagyjuk, és az azonos nevű id-re esünk vissza.
         */
        const field =
            document.querySelector<HTMLElement>(
                `[name="${CSS.escape(firstField)}"]:not([aria-hidden="true"])`,
            ) ?? document.getElementById(firstField);

        field?.focus();
    }, [firstField]);

    return null;
}
