import { Link, usePage } from '@inertiajs/react';
import { CheckCircle2, Flame } from 'lucide-react';
import AppLogoIcon from '@/components/app-logo-icon';
import { cn } from '@/lib/utils';
import { home } from '@/routes';
import type { AuthLayoutProps } from '@/types';

export default function AuthSplitLayout({
    children,
    title,
    description,
    wide = false,
}: AuthLayoutProps) {
    const { name } = usePage().props;

    return (
        <div className="grid min-h-dvh lg:grid-cols-[2fr_3fr]">
            {/* Left panel — starry indigo branded */}
            <div
                className="relative hidden h-full flex-col overflow-hidden p-10 text-white lg:flex"
                style={{
                    background:
                        'linear-gradient(180deg,#20276B 0%,#3a3688 14%,#6548AC 30%,#5566c4 44%,#4F8EEC 66%,#4F8EEC 100%)',
                }}
            >
                <div className="absolute -top-16 -right-16 size-48 rounded-full bg-white opacity-10" />
                <div className="absolute -bottom-20 -left-10 size-56 rounded-full bg-white opacity-10" />

                <Link
                    href={home()}
                    className="relative z-10 flex items-center gap-2 text-lg font-semibold"
                >
                    <AppLogoIcon className="size-11 rounded-lg" />
                    {name}
                </Link>

                <div className="relative z-10 flex flex-1 flex-col items-start justify-center gap-8 py-8">
                    <div className="space-y-3">
                        {/*
                         * Szándékosan nem <h2>: az oldal egyetlen címsora a jobb
                         * oldali <h1> (az űrlap címe). Egy előtte álló h2 fordított
                         * címsor-sorrendet adna a képernyőolvasónak.
                         */}
                        <p className="text-4xl leading-tight font-bold">
                            Tanulj okosan,
                            <br />
                            minden nap.
                        </p>
                        <p className="text-base leading-relaxed text-white/70">
                            A 10 000 leggyakoribb angol szó — szólista,
                            flashcard SRS, szövegelemzés, Chrome-bővítmény és
                            AI-segítség egy helyen.
                        </p>
                    </div>

                    {/* Demo progress card — díszítő minta kitalált adatokkal, ezért a
                        képernyőolvasó számára rejtett. */}
                    <div
                        aria-hidden="true"
                        className="w-full rounded-2xl bg-white p-5 shadow-xl dark:bg-neutral-800"
                    >
                        <div className="mb-3 flex items-center justify-between">
                            <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">
                                Napi haladás
                            </span>
                            <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                <Flame size={14} />7 nap
                            </span>
                        </div>
                        <div className="mb-2 flex items-end justify-between">
                            <span className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                                4 187{' '}
                                <span className="text-sm font-normal text-neutral-400 dark:text-neutral-500">
                                    / 10 000
                                </span>
                            </span>
                            <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                                41%
                            </span>
                        </div>
                        <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-700">
                            <div
                                className="h-2 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-800"
                                style={{ width: '41%' }}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-neutral-500 dark:text-neutral-400">
                                #42{' '}
                                <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                                    between
                                </span>
                            </span>
                            <span className="flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                <CheckCircle2 size={14} />
                                Tudom
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/60">
                        {[
                            'Ingyenes regisztráció',
                            'Flashcard SRS',
                            'AI-segítség',
                            'Nincs hirdetés',
                        ].map((item) => (
                            <span
                                key={item}
                                className="flex items-center gap-1.5"
                            >
                                <CheckCircle2
                                    size={15}
                                    className="text-green-300"
                                />
                                {item}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right panel — form */}
            <div className="flex items-center justify-center p-8 lg:p-12">
                <div
                    className={cn(
                        'w-full space-y-6',
                        wide ? 'max-w-2xl' : 'max-w-lg',
                    )}
                >
                    <Link
                        href={home()}
                        className="flex items-center justify-center gap-2 lg:hidden"
                    >
                        <AppLogoIcon className="size-12 rounded-lg" />
                        <span className="text-lg font-semibold">{name}</span>
                    </Link>

                    <div className="space-y-1">
                        <h1 className="text-2xl font-bold">{title}</h1>
                        <p className="text-sm text-muted-foreground">
                            {description}
                        </p>
                    </div>

                    {children}
                </div>
            </div>
        </div>
    );
}
