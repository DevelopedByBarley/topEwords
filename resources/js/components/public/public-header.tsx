import { Link, usePage } from '@inertiajs/react';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { PUBLIC_NAV_LINKS } from '@/components/public/public-nav-links';
import type { PublicNavLink } from '@/components/public/public-nav-links';
import { dashboard, home, login, register } from '@/routes';

/**
 * A publikus oldalak közös fejléce.
 *
 * - `solid`: ragadós, háttérrel és alsó kerettel — ezt kapja minden aloldal.
 * - `transparent`: háttér nélküli, fehér szövegű változat, ami a főoldal
 *   gradiens-heroján ül. Ugyanaz a linkkészlet, csak más felületen.
 */
export function PublicHeader({
    variant = 'solid',
}: {
    variant?: 'solid' | 'transparent';
}) {
    const { auth, billingEnabled } = usePage<{
        auth: { user: { id: number } | null };
        billingEnabled: boolean;
    }>().props;
    const [mobileOpen, setMobileOpen] = useState(false);

    const isTransparent = variant === 'transparent';
    const links = PUBLIC_NAV_LINKS.filter(
        (link) => billingEnabled || link.label !== 'Árazás',
    );

    const linkClass = isTransparent
        ? 'rounded-lg px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white'
        : 'rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground';

    const renderLink = (link: PublicNavLink, onNavigate?: () => void) =>
        link.isAnchor ? (
            <a
                key={link.label}
                href={link.href}
                onClick={onNavigate}
                className={linkClass}
            >
                {link.label}
            </a>
        ) : (
            <Link
                key={link.label}
                href={link.href}
                onClick={onNavigate}
                className={linkClass}
            >
                {link.label}
            </Link>
        );

    return (
        <header
            className={
                isTransparent
                    ? 'relative z-20'
                    : 'sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md'
            }
        >
            <div className="mx-auto flex max-w-300 items-center gap-3 px-5 py-4">
                <Link
                    href={home()}
                    className={`flex min-w-0 shrink-0 items-center gap-2.5 text-lg font-bold tracking-tight sm:text-xl ${
                        isTransparent ? 'text-white' : 'text-foreground'
                    }`}
                >
                    <img
                        src="/logo.png"
                        alt=""
                        className={`size-10 shrink-0 rounded-xl sm:size-11 ${
                            isTransparent
                                ? 'shadow-[0_6px_18px_rgba(79,70,229,.5)]'
                                : ''
                        }`}
                    />
                    <span className="truncate">TopWords</span>
                </Link>

                <nav
                    aria-label="Fő navigáció"
                    className="ml-2 hidden items-center gap-1 lg:flex"
                >
                    {links.map((link) => renderLink(link))}
                </nav>

                <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
                    {auth.user ? (
                        <Link
                            href={dashboard()}
                            className={
                                isTransparent
                                    ? 'rounded-full bg-white px-4 py-2 text-xs font-semibold whitespace-nowrap text-indigo-950 shadow-[0_8px_22px_rgba(0,0,0,.22)] transition-transform hover:-translate-y-0.5 sm:px-5 sm:py-2.5 sm:text-sm'
                                    : 'rounded-full bg-linear-to-br from-indigo-600 to-indigo-800 px-4 py-2 text-xs font-semibold whitespace-nowrap text-white transition-all hover:brightness-110 sm:px-5 sm:py-2.5 sm:text-sm'
                            }
                        >
                            Irány az alkalmazás
                        </Link>
                    ) : (
                        <>
                            <Link
                                href={login()}
                                className={`hidden px-3 py-2.5 text-sm font-medium sm:inline ${
                                    isTransparent
                                        ? 'text-white'
                                        : 'text-muted-foreground transition-colors hover:text-foreground'
                                }`}
                            >
                                Bejelentkezés
                            </Link>
                            <Link
                                href={register()}
                                className={
                                    isTransparent
                                        ? 'rounded-full bg-white px-4 py-2 text-xs font-semibold whitespace-nowrap text-indigo-950 shadow-[0_8px_22px_rgba(0,0,0,.22)] transition-transform hover:-translate-y-0.5 sm:px-5 sm:py-2.5 sm:text-sm'
                                        : 'rounded-full bg-linear-to-br from-green-400 to-green-500 px-4 py-2 text-xs font-bold whitespace-nowrap text-green-950 shadow-[0_4px_0_0_var(--color-green-600)] transition-all hover:brightness-105 sm:px-5 sm:py-2.5 sm:text-sm'
                                }
                            >
                                Regisztráció
                            </Link>
                        </>
                    )}

                    <button
                        type="button"
                        onClick={() => setMobileOpen((open) => !open)}
                        aria-expanded={mobileOpen}
                        aria-controls="public-mobile-nav"
                        aria-label={mobileOpen ? 'Menü bezárása' : 'Menü'}
                        className={`flex size-9 shrink-0 items-center justify-center rounded-full lg:hidden ${
                            isTransparent
                                ? 'text-white/80 hover:bg-white/10'
                                : 'text-muted-foreground hover:bg-accent'
                        }`}
                    >
                        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>
            </div>

            {mobileOpen && (
                /*
                 * A főoldalon a fejléc a hero fölött lebeg, ezért a lenyíló
                 * menünek saját háttér kell — nélküle a hero szövegére úszna rá.
                 */
                <nav
                    id="public-mobile-nav"
                    aria-label="Fő navigáció (mobil)"
                    className={`flex flex-col gap-1 px-5 pb-4 lg:hidden ${
                        isTransparent
                            ? 'mx-4 mb-2 rounded-2xl border border-white/15 bg-indigo-950/85 pt-3 backdrop-blur-md'
                            : 'mx-auto max-w-300 border-t border-border pt-3'
                    }`}
                >
                    {links.map((link) =>
                        renderLink(link, () => setMobileOpen(false)),
                    )}
                    {!auth.user && (
                        <Link
                            href={login()}
                            onClick={() => setMobileOpen(false)}
                            className={`${linkClass} sm:hidden`}
                        >
                            Bejelentkezés
                        </Link>
                    )}
                </nav>
            )}
        </header>
    );
}
