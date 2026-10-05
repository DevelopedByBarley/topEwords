import { Cookie } from 'lucide-react';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'tw-cookie-consent';

export default function CookieConsent() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        try {
            if (localStorage.getItem(STORAGE_KEY) !== '1') {
                setVisible(true);
            }
        } catch {
            setVisible(true);
        }
    }, []);

    if (!visible) {
        return null;
    }

    function accept() {
        try {
            localStorage.setItem(STORAGE_KEY, '1');
        } catch {
            // localStorage nem elérhető — csak a jelen munkamenetre rejtjük el.
        }
        setVisible(false);
    }

    return (
        <div className="fixed inset-x-0 bottom-(--bottom-nav-offset) z-[60] flex justify-center p-3 sm:p-4">
            <div className="flex w-full max-w-2xl flex-col gap-3 rounded-2xl border bg-card p-4 shadow-lg sm:flex-row sm:items-center sm:gap-4">
                <Cookie className="size-5 shrink-0 text-muted-foreground" />
                <p className="flex-1 text-xs leading-relaxed text-muted-foreground">
                    A TopWords kizárólag a működéshez szükséges sütiket használ
                    (pl. bejelentkezés, beállítások). Részletek az{' '}
                    <a
                        href="/privacy"
                        className="text-primary underline underline-offset-2"
                    >
                        Adatkezelési tájékoztatóban
                    </a>
                    .
                </p>
                <button
                    onClick={accept}
                    className="shrink-0 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:brightness-95"
                >
                    Rendben
                </button>
            </div>
        </div>
    );
}
