import { Head } from '@inertiajs/react';
import { Chrome, Download, MonitorPlay } from 'lucide-react';
import ChromeExtensionsLink from '@/components/chrome-extensions-link';
import { show as showDownload } from '@/routes/downloads';

function DownloadCard({
    icon: Icon,
    title,
    description,
    links,
}: {
    icon: React.ElementType;
    title: string;
    description: React.ReactNode;
    links: { label: string; slug: 'extension' | 'player-mac' | 'player-win' }[];
}) {
    return (
        <div className="rounded-2xl border bg-card p-6">
            <div className="mb-3 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                </div>
                <h2 className="text-lg font-bold tracking-tight">{title}</h2>
            </div>
            <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
                {description}
            </p>
            <div className="flex flex-wrap gap-2.5">
                {links.map(({ label, slug }) => (
                    <a
                        key={slug}
                        href={showDownload(slug).url}
                        download
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                        <Download className="size-4" />
                        {label}
                    </a>
                ))}
            </div>
        </div>
    );
}

export default function Downloads() {
    return (
        <>
            <Head title="Letöltések" />

            <div className="mx-auto flex max-w-3xl flex-1 flex-col gap-6 p-4 md:p-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        Letöltések
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        A Chrome bővítmény és a topwords Player asztali app
                        letöltése egy helyen.
                    </p>
                </div>

                <DownloadCard
                    icon={Chrome}
                    title="Chrome bővítmény"
                    description={
                        <>
                            Tanulj bárhol a neten: dupla kattintással vagy az
                            Option+W / Alt+W gyorsbillentyűvel kereshetsz
                            szavakat bármely oldalon, YouTube-on és Netflixen
                            is. A béta időszak alatt a bővítmény fejlesztői
                            módban telepíthető — a lépésekhez lásd a{' '}
                            <a
                                href="/handbook#extension"
                                className="font-medium text-primary underline underline-offset-2"
                            >
                                kézikönyvet
                            </a>
                            . Telepítéshez nyisd meg: <ChromeExtensionsLink />
                        </>
                    }
                    links={[
                        {
                            label: 'Bővítmény letöltése (.zip)',
                            slug: 'extension',
                        },
                    ]}
                />

                <DownloadCard
                    icon={MonitorPlay}
                    title="topwords Player"
                    description="Asztali alkalmazás Mac és Windows rendszerre — nézz helyi videófájlokat úgy, hogy a felirat szavai a szólista-státuszaid szerint színeződnek. A fiókod a lejátszóban megjelenő kóddal párosíthatod a Beállítások → Lejátszó összekötése oldalon."
                    links={[
                        { label: 'Player – macOS (.dmg)', slug: 'player-mac' },
                        {
                            label: 'Player – Windows (.exe)',
                            slug: 'player-win',
                        },
                    ]}
                />
            </div>
        </>
    );
}
