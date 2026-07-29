import { PublicFooter } from '@/components/public/public-footer';
import { PublicHeader } from '@/components/public/public-header';

/**
 * A bejelentkezés nélkül elérhető oldalak (árazás, tananyag, kézikönyv, jogi
 * oldalak) közös kerete: ugrólink, egységes fejléc, `main` landmark és lábléc.
 *
 * A főoldal nem ezt használja, mert ott a fejléc a gradiens-heroba ül —
 * viszont ugyanazokat a `PublicHeader` / `PublicFooter` darabokat rendereli.
 */
export default function PublicLayout({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className="flex min-h-screen flex-col bg-background text-foreground">
            <a
                href="#main"
                className="sr-only rounded-b-lg bg-background px-4 py-2 text-sm font-medium underline focus:not-sr-only focus:absolute focus:top-0 focus:left-4 focus:z-100"
            >
                Ugrás a tartalomra
            </a>

            <PublicHeader />

            <main id="main" className={`flex-1 ${className ?? ''}`}>
                {children}
            </main>

            <PublicFooter />
        </div>
    );
}
