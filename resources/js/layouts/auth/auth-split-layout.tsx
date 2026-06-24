import { Link, usePage } from '@inertiajs/react';
import AppLogoIcon from '@/components/app-logo-icon';
import { home } from '@/routes';
import type { AuthLayoutProps } from '@/types';

export default function AuthSplitLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    const { name } = usePage().props;

    return (
        <div className="grid min-h-dvh lg:grid-cols-[2fr_3fr]">
            {/* Left panel — purple branded */}
            <div className="relative hidden lg:flex flex-col h-full overflow-hidden p-10 text-white" style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)' }}>
                <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-10" style={{ background: 'white' }} />
                <div className="absolute -bottom-20 -left-10 w-56 h-56 rounded-full opacity-10" style={{ background: 'white' }} />

                <Link href={home()} className="relative z-10 flex items-center gap-2 text-lg font-semibold">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
                        <AppLogoIcon className="size-6" />
                    </div>
                    {name}
                </Link>

                <div className="relative z-10 flex flex-1 flex-col items-start justify-center gap-8 py-8">
                    <div className="space-y-3">
                        <h2 className="text-4xl font-bold leading-tight">
                            Tanulj okosan,<br />minden nap.
                        </h2>
                        <p className="text-white/70 text-base leading-relaxed">
                            A 10 000 leggyakoribb angol szó — szólista, flashcard SRS, kvíz és szövegelemzés egy helyen.
                        </p>
                    </div>

                    {/* Demo progress card */}
                    <div className="w-full rounded-2xl bg-white p-5 shadow-xl text-gray-800">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-semibold text-gray-700">Napi haladás</span>
                            <span className="flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-600">
                                🔥 7 nap
                            </span>
                        </div>
                        <div className="flex items-end justify-between mb-2">
                            <span className="text-2xl font-bold text-gray-900">
                                4 187{' '}
                                <span className="text-sm font-normal text-gray-400">/ 10 000</span>
                            </span>
                            <span className="text-lg font-bold" style={{ color: '#7c3aed' }}>41%</span>
                        </div>
                        <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                            <div className="h-2 rounded-full" style={{ width: '41%', background: '#7c3aed' }} />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">
                                #42{' '}
                                <span className="font-semibold text-gray-800">between</span>
                            </span>
                            <span className="flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-600">
                                ✓ Tudom
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-6 text-sm text-white/60">
                        <span>✓ Gyors tanulás</span>
                    </div>
                </div>
            </div>

            {/* Right panel — form */}
            <div className="flex items-center justify-center p-8 lg:p-12">
                <div className="w-full max-w-lg space-y-6">
                    <Link href={home()} className="flex items-center justify-center gap-2 lg:hidden">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                            <AppLogoIcon className="size-6" />
                        </div>
                        <span className="text-lg font-semibold">{name}</span>
                    </Link>

                    <div className="space-y-1">
                        <h1 className="text-2xl font-bold">{title}</h1>
                        <p className="text-sm text-muted-foreground">{description}</p>
                    </div>

                    {children}
                </div>
            </div>
        </div>
    );
}
