import PublicLayout from '@/layouts/public-layout';

export type LegalSection = {
    id: string;
    title: string;
};

/**
 * Az ÁSZF és az Adatkezelési tájékoztató közös kerete.
 *
 * Mindkét dokumentum több száz soros, tíz-egynéhány számozott ponttal. Korábban
 * egyetlen görgethető szövegfalként jelentek meg: aki egy konkrét pontot
 * keresett (pl. elállási jog, adatmegőrzés), annak végig kellett görgetnie.
 * Innentől a pontok horgonyozhatók, és nagyobb kijelzőn ragadó tartalomjegyzék
 * kíséri őket.
 */
export function LegalPage({
    title,
    effectiveFrom,
    sections,
    children,
}: {
    title: string;
    effectiveFrom: string;
    sections: LegalSection[];
    children: React.ReactNode;
}) {
    return (
        <PublicLayout className="mx-auto w-full max-w-6xl px-6 py-12">
            <h1 className="mb-2 text-3xl font-bold tracking-tight">{title}</h1>
            <p className="mb-10 text-sm text-muted-foreground">
                Hatályos: {effectiveFrom}
            </p>

            <div className="flex gap-12">
                <aside className="sticky top-24 hidden w-64 shrink-0 self-start xl:block">
                    <nav aria-label="Tartalomjegyzék">
                        <p className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                            Tartalom
                        </p>
                        <ol className="space-y-0.5">
                            {sections.map((section) => (
                                <li key={section.id}>
                                    <a
                                        href={`#${section.id}`}
                                        className="block rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                    >
                                        {section.title}
                                    </a>
                                </li>
                            ))}
                        </ol>
                    </nav>
                </aside>

                <div className="min-w-0 flex-1">
                    <details className="mb-8 rounded-xl border bg-card p-4 xl:hidden">
                        <summary className="cursor-pointer text-sm font-semibold">
                            Tartalomjegyzék
                        </summary>
                        <ol className="mt-3 space-y-1">
                            {sections.map((section) => (
                                <li key={section.id}>
                                    <a
                                        href={`#${section.id}`}
                                        className="block py-0.5 text-sm text-muted-foreground underline underline-offset-2"
                                    >
                                        {section.title}
                                    </a>
                                </li>
                            ))}
                        </ol>
                    </details>

                    {children}
                </div>
            </div>
        </PublicLayout>
    );
}
