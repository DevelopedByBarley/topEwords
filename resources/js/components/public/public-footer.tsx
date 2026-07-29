import { Link, usePage } from '@inertiajs/react';
import { PUBLIC_FOOTER_LINKS } from '@/components/public/public-nav-links';
import { privacy, terms } from '@/routes';

/**
 * A publikus oldalak közös lábléce. Két sávra bomlik: felül a termék-linkek
 * (innen érhető el a kézikönyv és a tananyag, ami korábban zsákutca volt),
 * alul a jogi és üzemeltetői információ.
 */
export function PublicFooter() {
    const { billingEnabled } = usePage<{ billingEnabled: boolean }>().props;
    const links = PUBLIC_FOOTER_LINKS.filter(
        (link) => billingEnabled || link.label !== 'Árazás',
    );

    return (
        <footer className="border-t border-neutral-800 bg-[#171717] px-5 py-10 text-neutral-400">
            <div className="mx-auto max-w-[1100px]">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-white">
                        <img
                            src="/logo.png"
                            alt=""
                            className="size-9 rounded-[10px]"
                        />
                        TopWords
                    </div>

                    <nav
                        aria-label="Lábléc navigáció"
                        className="flex flex-wrap gap-x-6 gap-y-2.5 text-sm"
                    >
                        {links.map((link) =>
                            link.isAnchor ? (
                                <a
                                    key={link.label}
                                    href={link.href}
                                    className="transition-colors hover:text-white"
                                >
                                    {link.label}
                                </a>
                            ) : (
                                <Link
                                    key={link.label}
                                    href={link.href}
                                    className="transition-colors hover:text-white"
                                >
                                    {link.label}
                                </Link>
                            ),
                        )}
                    </nav>
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-t border-neutral-800 pt-6 text-[13px] text-neutral-500">
                    <div className="flex flex-wrap gap-x-5 gap-y-2">
                        <Link
                            href={terms()}
                            className="transition-colors hover:text-white"
                        >
                            ÁSZF
                        </Link>
                        <Link
                            href={privacy()}
                            className="transition-colors hover:text-white"
                        >
                            Adatkezelési tájékoztató
                        </Link>
                    </div>
                    <p>
                        Készítette:{' '}
                        <a
                            href="https://codebarley.hu"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-300 transition-colors hover:text-indigo-200"
                        >
                            codebarley.hu
                        </a>
                    </p>
                </div>
            </div>
        </footer>
    );
}
