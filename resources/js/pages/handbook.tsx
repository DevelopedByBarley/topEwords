import { Head, usePage } from '@inertiajs/react';
// A kivezetett szekciókhoz tartozó ikonok kikommentelve (2026-07-29):
// Zap (Mondatkiegészítés), HelpCircle (Kvíz), RefreshCw (Szóismétlés),
// NotebookPen (Szabad írás), MonitorPlay + Download (Desktop lejátszó).
import {
    BookOpen,
    LayoutGrid,
    Chrome,
    Brain,
    Settings2,
    FileText,
    GitBranch,
    Award,
    ChevronRight,
    Lightbulb,
    AlertCircle,
    Sparkles,
    Star,
    ListChecks,
    Tv2,
    Youtube,
    CreditCard,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import PublicLayout from '@/layouts/public-layout';
import { handbook } from '@/routes';
// import ChromeExtensionsLink from '@/components/chrome-extensions-link';
// import { show as showDownload } from '@/routes/downloads';

// Az induló feature-körhöz igazítva (2026-07-29): a kivezetett funkciók
// szekciói kikommentelve — a hozzájuk tartozó tartalom lentebb, a render-fában
// szintén kommentben él. Visszahozáskor a kettőt együtt kell élesíteni.
const sections = [
    { id: 'attekintes', label: 'Áttekintés', icon: LayoutGrid },
    { id: 'szavak', label: 'Szavak', icon: BookOpen },
    // { id: 'szoismetles', label: 'Szóismétlés', icon: RefreshCw },
    { id: 'flashcards', label: 'Flashcards', icon: Brain },
    { id: 'srs', label: 'SRS algoritmus', icon: GitBranch },
    { id: 'deck-settings', label: 'Pakli beállítások', icon: Settings2 },
    { id: 'szovegelemzes', label: 'Szövegelemzés', icon: FileText },
    // { id: 'kviz', label: 'Kvíz', icon: HelpCircle },
    // { id: 'cloze', label: 'Mondatkiegészítés', icon: Zap },
    // { id: 'szabad-iras', label: 'Szabad írás', icon: NotebookPen },
    // { id: 'irregular', label: 'Rendhagyó igék', icon: GitBranch },
    { id: 'teljesitmenyek', label: 'Teljesítmények', icon: Award },
    { id: 'extension', label: 'Chrome bővítmény', icon: Chrome },
    // { id: 'player', label: 'Desktop lejátszó', icon: MonitorPlay },
    { id: 'elofizetes', label: 'Előfizetés & számlázás', icon: CreditCard },
];

function Section({
    id,
    title,
    icon: Icon,
    children,
}: {
    id: string;
    title: string;
    icon?: React.ElementType;
    children: React.ReactNode;
}) {
    return (
        <section id={id} className="scroll-mt-24 space-y-5">
            <div className="flex items-center gap-3 border-b pb-3">
                {Icon && (
                    <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="size-4" />
                    </div>
                )}
                <h2 className="text-xl font-bold tracking-tight">{title}</h2>
            </div>
            {children}
        </section>
    );
}

function Sub({
    title,
    children,
}: {
    title: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-2.5">
            <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                {title}
            </h3>
            {children}
        </div>
    );
}

function P({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-sm leading-relaxed text-muted-foreground">
            {children}
        </p>
    );
}

function Steps({ items }: { items: React.ReactNode[] }) {
    return (
        <ol className="space-y-2">
            {items.map((item, i) => (
                <li
                    key={i}
                    className="flex gap-3 text-sm text-muted-foreground"
                >
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                        {i + 1}
                    </span>
                    <span className="leading-relaxed">{item}</span>
                </li>
            ))}
        </ol>
    );
}

function Ul({ items }: { items: React.ReactNode[] }) {
    return (
        <ul className="space-y-1.5">
            {items.map((item, i) => (
                <li
                    key={i}
                    className="flex gap-2 text-sm text-muted-foreground"
                >
                    <ChevronRight className="mt-1 size-3.5 shrink-0 text-primary/50" />
                    <span className="leading-relaxed">{item}</span>
                </li>
            ))}
        </ul>
    );
}

function Table({
    headers,
    rows,
}: {
    headers: string[];
    rows: (string | React.ReactNode)[][];
}) {
    return (
        <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b bg-muted/50">
                        {headers.map((h, i) => (
                            <th
                                key={i}
                                className="px-4 py-2.5 text-left font-semibold text-foreground"
                            >
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr
                            key={i}
                            className={i % 2 === 0 ? '' : 'bg-muted/20'}
                        >
                            {row.map((cell, j) => (
                                <td
                                    key={j}
                                    className="px-4 py-2.5 align-top text-muted-foreground"
                                >
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function Badge({
    children,
    color = 'default',
}: {
    children: React.ReactNode;
    color?: 'blue' | 'green' | 'orange' | 'purple' | 'rose' | 'default';
}) {
    const colors = {
        blue: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
        green: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300',
        orange: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
        purple: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
        rose: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
        default: 'bg-muted text-foreground',
    };

    return (
        <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${colors[color]}`}
        >
            {children}
        </span>
    );
}

function InfoBox({
    children,
    type = 'info',
}: {
    children: React.ReactNode;
    type?: 'info' | 'tip' | 'warning';
}) {
    const styles = {
        info: {
            wrap: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300',
            icon: <AlertCircle className="mt-0.5 size-4 shrink-0" />,
        },
        tip: {
            wrap: 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300',
            icon: <Lightbulb className="mt-0.5 size-4 shrink-0" />,
        },
        warning: {
            wrap: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300',
            icon: <AlertCircle className="mt-0.5 size-4 shrink-0" />,
        },
    };
    const s = styles[type];

    return (
        <div
            className={`flex gap-2.5 rounded-xl border px-4 py-3 text-sm ${s.wrap}`}
        >
            {s.icon}
            <div className="leading-relaxed">{children}</div>
        </div>
    );
}

/**
 * AI-funkciót jelöl. Szándékosan NEM „Prémium": az AI minden csomagban elérhető
 * (User::hasAiAccess() mindig igaz), a valódi korlát a havi AI-keret —
 * Ingyenesen kóstoló, Prón nagyobb keret (config/plans.php: ai_budget_micros).
 */
function AiBadge() {
    return (
        <span className="inline-flex items-center gap-1 rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
            <Sparkles className="size-3" />
            AI-keret
        </span>
    );
}

function CardGrid({
    cards,
}: {
    cards: { icon: React.ElementType; title: string; desc: string }[];
}) {
    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {cards.map(({ icon: Icon, title, desc }) => (
                <div
                    key={title}
                    className="flex flex-col gap-1.5 rounded-xl border bg-card p-3.5"
                >
                    <div className="flex items-center gap-2">
                        <Icon className="size-4 text-primary" />
                        <span className="text-sm font-semibold">{title}</span>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                        {desc}
                    </p>
                </div>
            ))}
        </div>
    );
}

/**
 * A kézikönyv az egyetlen olyan oldal, amit bejelentkezés nélkül is meg lehet
 * nyitni, de bejelentkezve is van értelme. Vendégként a publikus keretet kapja
 * (korábban az app-sidebart kapta, amiben minden link bejelentkezésre dobott),
 * belépve viszont marad az alkalmazás megszokott kerete.
 */
function HandbookShell({
    isGuest,
    children,
}: {
    isGuest: boolean;
    children: React.ReactNode;
}) {
    if (isGuest) {
        return <PublicLayout>{children}</PublicLayout>;
    }

    return (
        <AppLayout breadcrumbs={[{ title: 'Kézikönyv', href: handbook.url() }]}>
            {children}
        </AppLayout>
    );
}

export default function Handbook() {
    const { auth, extensionStoreUrl } = usePage<{
        auth: { user: { id: number } | null };
        extensionStoreUrl: string | null;
    }>().props;

    const [activeId, setActiveId] = useState('attekintes');
    const observerRef = useRef<IntersectionObserver | null>(null);
    const visibleIdsRef = useRef<Set<string>>(new Set());
    const mobileTocRef = useRef<HTMLDetailsElement>(null);

    useEffect(() => {
        // A megfigyelés a viewporthoz igazodik: az oldal a saját görgetősávján
        // fut, nem egy fix magasságú belső dobozban — így ugyanúgy működik a
        // bejelentkezett app-keretben és a vendégeknek szánt publikus keretben.
        const visibleIds = visibleIdsRef.current;

        observerRef.current = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        visibleIds.add(entry.target.id);
                    } else {
                        visibleIds.delete(entry.target.id);
                    }
                }

                // A sávban egyszerre több szekció is bent lehet; ilyenkor mindig
                // a legfelső számít aktívnak. Enélkül a callback sorrendje dönt,
                // és a tartalomjegyzék jelölése görgetés közben ugrál.
                const topmost = sections.find(({ id }) => visibleIds.has(id));

                if (topmost) {
                    setActiveId(topmost.id);
                }
            },
            { rootMargin: '-20% 0px -70% 0px' },
        );
        sections.forEach(({ id }) => {
            const el = document.getElementById(id);

            if (el) {
                observerRef.current?.observe(el);
            }
        });

        return () => {
            observerRef.current?.disconnect();
            visibleIds.clear();
        };
    }, []);

    /**
     * Görgetés a szekcióhoz úgy, hogy a hash is a címsorba kerüljön — így egy
     * szekció linkelhető és megosztható marad. (A natív ugrást azért váltjuk ki,
     * hogy a görgetés lágy legyen és a mobil tartalomjegyzék becsukódjon.)
     */
    function scrollToSection(
        event: React.MouseEvent<HTMLAnchorElement>,
        id: string,
    ) {
        event.preventDefault();
        document
            .getElementById(id)
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.history.replaceState(null, '', `#${id}`);

        if (mobileTocRef.current) {
            mobileTocRef.current.open = false;
        }
    }

    return (
        <HandbookShell isGuest={!auth.user}>
            <Head title="Kézikönyv">
                <meta
                    head-key="description"
                    name="description"
                    content="A TopWords kézikönyve: szavak, flashcardok, SRS, szövegelemzés és a Chrome bővítmény használata lépésről lépésre."
                />
            </Head>

            <div className="mx-auto w-full max-w-[2000px] p-4 md:p-6 xl:px-10 2xl:px-16">
                {/* Hero */}
                <div
                    className="relative overflow-hidden rounded-3xl p-6 md:p-8"
                    style={{
                        background: 'linear-gradient(135deg,#4338CA,#4F8EEC)',
                    }}
                >
                    <div className="pointer-events-none absolute -top-16 -right-16 size-64 rounded-full bg-white/15 blur-2xl" />
                    <div className="relative max-w-xl">
                        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                            Kézikönyv
                        </h1>
                        <p className="mt-1.5 text-sm text-white/85 md:text-base">
                            Minden, amit a TopWords alkalmazásról tudni kell —
                            lépésről lépésre.
                        </p>
                    </div>
                </div>

                {/* Mobil tartalomjegyzék — a sticky oldalsáv csak lg-től látszik,
                    enélkül kis kijelzőn végig kellene görgetni a teljes anyagot. */}
                <details
                    ref={mobileTocRef}
                    className="group mt-6 overflow-hidden rounded-2xl border bg-card lg:hidden"
                >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold">
                        <span className="flex items-center gap-2">
                            <ListChecks className="size-4 text-primary" />
                            Tartalomjegyzék
                        </span>
                        <ChevronRight
                            className="size-4 text-muted-foreground transition-transform group-open:rotate-90 motion-reduce:transition-none"
                            aria-hidden="true"
                        />
                    </summary>
                    <nav
                        aria-label="Kézikönyv tartalomjegyzék"
                        className="grid gap-0.5 border-t p-2 sm:grid-cols-2"
                    >
                        {sections.map(({ id, label, icon: Icon }) => (
                            <a
                                key={id}
                                href={`#${id}`}
                                onClick={(e) => scrollToSection(e, id)}
                                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            >
                                <Icon className="size-3.5 shrink-0" />
                                {label}
                            </a>
                        ))}
                    </nav>
                </details>

                <div className="mt-6 flex gap-0">
                    {/* Sticky TOC sidebar */}
                    <aside className="sticky top-20 mr-10 hidden w-56 shrink-0 self-start lg:block">
                        <nav
                            aria-label="Kézikönyv tartalomjegyzék"
                            className="max-h-[calc(100dvh-7rem)] space-y-0.5 overflow-y-auto"
                        >
                            <p className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                                Tartalom
                            </p>
                            {sections.map(({ id, label, icon: Icon }) => (
                                <a
                                    key={id}
                                    href={`#${id}`}
                                    aria-current={
                                        activeId === id ? 'true' : undefined
                                    }
                                    onClick={(e) => scrollToSection(e, id)}
                                    className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                                        activeId === id
                                            ? 'bg-primary/10 font-medium text-primary'
                                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                                    }`}
                                >
                                    <Icon className="size-3.5 shrink-0" />
                                    {label}
                                </a>
                            ))}
                        </nav>
                    </aside>

                    {/* Main content */}
                    <div className="max-w-3xl min-w-0 flex-1 space-y-14">
                        {/* ── Áttekintés ── */}
                        <Section
                            id="attekintes"
                            title="Áttekintés"
                            icon={LayoutGrid}
                        >
                            <P>
                                A TopWords egy angol szókincsfejlesztő
                                alkalmazás, amely a tudományosan bevált spaced
                                repetition módszert kombinálja AI-alapú
                                eszközökkel. A cél egyszerű: minél több szót
                                tarts meg minél kevesebb idő alatt.
                            </P>

                            <CardGrid
                                cards={[
                                    {
                                        icon: BookOpen,
                                        title: 'Szavak',
                                        desc: '10 000 szó hat gyakorisági szinten, saját mappákkal',
                                    },
                                    {
                                        icon: Brain,
                                        title: 'Flashcards',
                                        desc: 'Okos kártyás ismétlés SRS algoritmussal',
                                    },
                                    {
                                        icon: FileText,
                                        title: 'Szövegelemzés',
                                        desc: 'Könyv, web, YouTube — melyik szót nem ismered?',
                                    },
                                    {
                                        icon: Award,
                                        title: 'Teljesítmények',
                                        desc: 'Streak és érmek a haladásodért',
                                    },
                                    {
                                        icon: Chrome,
                                        title: 'Chrome bővítmény',
                                        desc: 'Azonnali fordítás bármely weboldalon',
                                    },
                                ]}
                            />

                            <Sub title="Első lépések — hol kezdjem?">
                                <Steps
                                    items={[
                                        'Nyisd meg az Angol szavak oldalt és nézd meg, melyik szintből ismered a legtöbbet.',
                                        'Jelöld meg a szavakat státusszal (Tudom / Tanulom) — ettől frissül a haladásod.',
                                        'Hozz létre egy flashcard paklit és adj hozzá szavakat.',
                                        'Minden nap kattints a Tanulás gombra — az SRS algoritmus elvégzi a többit.',
                                        'Elemezd a szövegeidet — cikkeket, könyvet, YouTube-videót —, hogy lásd, mennyit értesz belőlük.',
                                    ]}
                                />
                            </Sub>

                            <Sub title="Csomagok és az AI-keret">
                                <P>
                                    Két csomag van: <strong>Ingyenes</strong> és{' '}
                                    <strong>Pro</strong>. A kettő ugyanazokat a
                                    funkciókat tartalmazza — a Pro a kereteket
                                    oldja fel (korlátlan tanulókártya és pakli,
                                    napi 50 szövegelemzés, több mentett könyv és
                                    YouTube-felirat, korlátlan mentés a
                                    bővítményből).
                                </P>
                                <InfoBox type="info">
                                    Az <strong>AI-funkciók</strong> (szótár,
                                    kártya-kitöltés, kontextus-magyarázat)
                                    mindkét csomagban működnek — nincsenek
                                    lezárva. A korlát a{' '}
                                    <strong>havi AI-keret</strong>: Ingyenesen
                                    egy kóstoló, Pro csomaggal jóval nagyobb
                                    keret. A felhasználásodat a{' '}
                                    <strong>Beállítások → Előfizetés</strong>{' '}
                                    oldalon látod. Ezt a kézikönyvben az{' '}
                                    <AiBadge /> jelölés mutatja.
                                </InfoBox>
                            </Sub>

                            <Sub title="Haladás (főoldal)">
                                <P>
                                    A főoldalon látod az összesített haladásodat
                                    szintenként (Top 1 000 → 8 001–10 000), a
                                    napi sorozatodat (streak) és az aktuális
                                    statisztikáidat. Minden szinthez tartozik
                                    egy sáv: hány szót jelöltél meg abból a
                                    szintből — a szint kártyájára kattintva
                                    egyből a szűrt szólistára jutsz. A lap
                                    tetején a „Folytasd itt” sáv mutatja a
                                    következő lépést, például a ma esedékes
                                    flashcardok számát.
                                </P>
                            </Sub>
                        </Section>

                        {/* ── Szavak ── */}
                        <Section
                            id="szavak"
                            title="Angol szavak"
                            icon={BookOpen}
                        >
                            <P>
                                A beépített szótár a 10 000 leggyakoribb angol
                                szót tartalmazza, szógyakoriság szerint hat
                                szintbe rendezve. Minden szóhoz látható a magyar
                                jelentés, szófaj, ragozási alakok és egy
                                példamondat.
                            </P>

                            <Sub title="Szintek">
                                <Table
                                    headers={[
                                        'Szint',
                                        'Gyakorisági rang',
                                        'Mikor érdemes?',
                                    ]}
                                    rows={[
                                        [
                                            '1',
                                            'Top 1 000',
                                            'Alapvető szavak — ezeket mindenképp érdemes elsőre megtanulni',
                                        ],
                                        [
                                            '2',
                                            '1 001 – 2 000',
                                            'Hétköznapi kommunikációhoz elegendő',
                                        ],
                                        [
                                            '3',
                                            '2 001 – 4 000',
                                            'Folyékony olvasáshoz és halláshoz szükséges',
                                        ],
                                        [
                                            '4',
                                            '4 001 – 6 000',
                                            'Szakmai szövegek és irodalom megértéséhez',
                                        ],
                                        [
                                            '5',
                                            '6 001 – 8 000',
                                            'Ritka szavak, közel anyanyelvi szint',
                                        ],
                                        [
                                            '6',
                                            '8 001 – 10 000',
                                            'Nagyon ritka, speciális szókincs',
                                        ],
                                    ]}
                                />
                            </Sub>

                            <Sub title="Szóstátuszok">
                                <P>
                                    Minden szóhoz öt státusz közül választhatsz.
                                    Egyszerre csak egy aktív — ha újra
                                    megnyomod, törlődik. Ugyanezek a státuszok
                                    és színek jelennek meg a szövegelemzőben és
                                    a Chrome bővítményben is.
                                </P>
                                <Table
                                    headers={['Státusz', 'Mire jó?']}
                                    rows={[
                                        [
                                            <Badge color="green">Tudom</Badge>,
                                            'Beleszámít a haladásba és a Haladás oldal %-ába — ha egy szót valóban ismersz, ezt jelöld',
                                        ],
                                        [
                                            <Badge color="blue">Tanulom</Badge>,
                                            'Aktívan tanulod — emlékeztetőként jelölöd meg, pl. flashcard mellé',
                                        ],
                                        [
                                            <Badge color="orange">
                                                Később
                                            </Badge>,
                                            'Elmentetted, de még nem foglalkozol vele — "majd egyszer" lista',
                                        ],
                                        [
                                            <Badge color="purple">
                                                Kiejtés
                                            </Badge>,
                                            'A jelentést tudod, de a kiejtést kell még begyakorolni',
                                        ],
                                        [
                                            <Badge color="rose">
                                                Gyakorlásra
                                            </Badge>,
                                            'Külön jelölés azoknak a szavaknak, amelyeket még használni is gyakorolnál',
                                        ],
                                    ]}
                                />
                            </Sub>

                            <Sub title="Mappák">
                                <P>
                                    Saját tematikus mappákat hozhatsz létre (pl.
                                    "Üzleti szavak", "Utazás") és szavakat
                                    rendelhetsz hozzájuk. Egy szó több mappában
                                    is szerepelhet. A szólistát mappára
                                    szűrheted.
                                </P>
                            </Sub>

                            <Sub title="Saját szavak hozzáadása">
                                <P>
                                    Ha egy szó nincs az adatbázisban, felveheted
                                    saját szóként. Megadhatod a jelentést,
                                    példamondatot, ragozási alakokat — ugyanúgy
                                    működik, mint a beépített szavak.
                                </P>
                                <InfoBox type="tip">
                                    A Chrome bővítménnyel a Ctrl+Shift+F
                                    keresőből közvetlenül hozzáadhatod az
                                    ismeretlen szavakat, az AI-os automatikus
                                    kitöltéssel.
                                </InfoBox>
                            </Sub>

                            <Sub
                                title={
                                    <span className="flex items-center gap-2">
                                        AI szótár (Gemini) <AiBadge />
                                    </span>
                                }
                            >
                                <P>
                                    Saját szó felvételekor (és szerkesztésekor)
                                    az AI-kitöltés gombbal az AI automatikusan
                                    kitölti a magyar jelentést, szinonimákat,
                                    ragozási alakokat és egy példamondatot. A
                                    funkció minden csomagban elérhető, a havi
                                    AI-keretedből fogyaszt.
                                </P>
                            </Sub>
                        </Section>

                        {/*
                         * INDULÁSKOR KIVEZETVE (2026-07-29): a Szóismétlés (napi ismétlő)
                         * felületnek nincs route-ja az appban. A leírás visszahozáskor
                         * élesíthető, a `sections` tömb `szoismetles` elemével együtt.
                         *
                         *    ── Szóismétlés ──
                         * <Section
                         *     id="szoismetles"
                         *     title="Szóismétlés"
                         *     icon={RefreshCw}
                         * >
                         *     <P>
                         *         A Szóismétlés egy egyszerűsített kvízrendszer,
                         *         amely automatikusan ismételteti veled az
                         *         esedékes szavakat státuszuk alapján. Ez a
                         *         flashcard SRS-szel párhuzamosan működik — a
                         *         szótárban megjelölt szavakat tartja frissen,
                         *         visszahívással erősítve a memóriát.
                         *     </P>
                         *
                         *     <Sub title="Ismétlési intervallumok">
                         *         <P>
                         *             Minden státuszhoz más ismétlési időköz
                         *             tartozik. Ha egy szót sikeresen felismersz a
                         *             munkamenetben, az ismétlési ideje újraindul.
                         *         </P>
                         *         <Table
                         *             headers={['Státusz', 'Ismétlési időköz']}
                         *             rows={[
                         *                 [
                         *                     <Badge color="blue">Tanulom</Badge>,
                         *                     '1 nap',
                         *                 ],
                         *                 [
                         *                     <Badge color="orange">
                         *                         Mentett
                         *                     </Badge>,
                         *                     '3 nap',
                         *                 ],
                         *                 [
                         *                     <Badge color="purple">
                         *                         Kiejtés
                         *                     </Badge>,
                         *                     '7 nap',
                         *                 ],
                         *                 [
                         *                     <Badge color="green">Tudom</Badge>,
                         *                     '14 nap',
                         *                 ],
                         *             ]}
                         *         />
                         *     </Sub>
                         *
                         *     <Sub title="Hogyan működik?">
                         *         <Steps
                         *             items={[
                         *                 'Nyisd meg a Szóismétlés oldalt — látod, mennyi szó esedékes státuszok szerint.',
                         *                 'Kattints a "Kezdés" gombra — legfeljebb 50 szó kerül be egy munkamenetbe.',
                         *                 'Megjelenik a szó angolul, és négy magyar fordítás közül kell a helyeset választani.',
                         *                 'Helyes válasz esetén a szó megkapja a mai dátumot, és az intervallum újraindul.',
                         *                 'A munkamenet végén látod az eredményedet és az elrontott szavakat.',
                         *             ]}
                         *         />
                         *         <InfoBox type="tip">
                         *             A szóismétlés nem befolyásolja a flashcard
                         *             SRS állapotát — a két rendszer egymástól
                         *             függetlenül működik, de egymást kiegészítve
                         *             erőteljesebb bevésést adnak.
                         *         </InfoBox>
                         *     </Sub>
                         * </Section>
                         */}

                        {/* ── Flashcards ── */}
                        <Section
                            id="flashcards"
                            title="Flashcards"
                            icon={Brain}
                        >
                            <P>
                                A flashcard rendszer a TopWords magja. Saját
                                kártyacsomagokat — <strong>paklikat</strong> —
                                hozhatsz létre, minden kártya két oldalból áll,
                                és az SRS algoritmus automatikusan ütemezi az
                                ismétléseket.
                            </P>

                            <Sub title="Pakli létrehozása és mappák">
                                <Steps
                                    items={[
                                        'A Flashcards főoldalán kattints az "Új pakli" gombra.',
                                        'Adj meg nevet (kötelező) és opcionálisan leírást.',
                                        'Hozzárendelheted egy mappához is — ez segít az átláthatóságban, ha sok paklid van.',
                                    ]}
                                />
                                <P>
                                    A mappákat a hero sávban lévő{' '}
                                    <strong>"Mappák"</strong> gombbal kezelheted
                                    (átnevezés, törlés, új mappa). Egy pakli
                                    több mappához is rendelhető — a kártyákon a
                                    mappa ikon jelzi ezt.
                                </P>
                            </Sub>

                            <Sub title="Kártyák hozzáadása">
                                <Table
                                    headers={['Módszer', 'Mikor használd?']}
                                    rows={[
                                        [
                                            'Kézi szerkesztő',
                                            'Saját mondatoknál, képeknél, speciális formázásnál — teljes Rich Text szerkesztő',
                                        ],
                                        [
                                            'Szó importálás',
                                            'Ha már megvan a szó az adatbázisban: keresd meg és egy kattintással importálod',
                                        ],
                                        [
                                            'CSV import',
                                            'Ha sok kártyát szeretnél egyszerre feltölteni — Anki exportok is működnek',
                                        ],
                                    ]}
                                />
                                <InfoBox type="tip">
                                    CSV importhoz az első oszlop az előlap, a
                                    második a hátlap — vesszővel elválasztva,
                                    fejléc nélkül, egyszerre legfeljebb 5 000
                                    sor. Anki .apkg exportból a "Notes as CSV"
                                    opcióval tudod kinyerni.
                                </InfoBox>
                            </Sub>

                            <Sub title="CSV import — irányválasztás">
                                <P>
                                    Fájl kiválasztása után megjelenik egy
                                    dialóg, ahol megadhatod az tanulás irányát:
                                </P>
                                <Table
                                    headers={['Irány', 'Magyarázat']}
                                    rows={[
                                        [
                                            'Elölap → Hátlap',
                                            'Pl. angol szó látszik, a magyar fordítást kell felidézni (alapértelmezett)',
                                        ],
                                        [
                                            'Hátlap → Elölap',
                                            'Fordított irány — pl. magyar szóból kell az angolt',
                                        ],
                                        [
                                            'Mindkét irány',
                                            'Az algoritmus mindkét irányból kérdez — kétszer annyi munka, kétszer annyira hatékony',
                                        ],
                                    ]}
                                />
                            </Sub>

                            <Sub title="Kártya szerkesztő">
                                <Ul
                                    items={[
                                        <>
                                            Előlap és hátlap Rich Text
                                            szerkesztőben — formázás, kép, hang
                                            beágyazható.
                                        </>,
                                        <>
                                            Hang (TTS): minden oldalhoz
                                            megadható egy szöveg, amelyet
                                            tanulás közben felolvas.
                                        </>,
                                        <>
                                            Irány: beállítható kártyánként —
                                            lehet front_to_back, back_to_front
                                            vagy mindkettő.
                                        </>,
                                        <>
                                            Szín: a kártya bal szegélyének
                                            kiemelő színe — hasznos ha témák
                                            szerint csoportosítasz.
                                        </>,
                                    ]}
                                />
                            </Sub>

                            <Sub
                                title={
                                    <span className="flex items-center gap-2">
                                        Gemini AI kitöltés <AiBadge />
                                    </span>
                                }
                            >
                                <P>
                                    Írd be az angol szót az előlapra, majd
                                    kattints a lila "Generálás" gombra. A Gemini
                                    AI kitölti a hátlapot (magyar fordítás,
                                    példamondat) — az előlap változatlan marad,
                                    így a saját szövegedet nem írja felül.
                                    Minden csomagban elérhető, a havi
                                    AI-keretedből fogyaszt.
                                </P>
                            </Sub>

                            <Sub title="Egyedi kártya-műveletek">
                                <P>
                                    Minden kártya sorában (pakli nézetben) a
                                    három pontos menüből elérhető néhány
                                    gyorsművelet:
                                </P>
                                <Table
                                    headers={['Művelet', 'Mit csinál?']}
                                    rows={[
                                        [
                                            'Statisztika',
                                            'Megmutatja a kártya SRS-adatait: állapot, intervallum, tévesztések',
                                        ],
                                        [
                                            'Másolat létrehozása',
                                            'Készít egy azonos tartalmú kártyát ugyanabban a pakliban',
                                        ],
                                        [
                                            'Áthelyezés',
                                            'Átmozgatja a kártyát egy másik pakliba',
                                        ],
                                        [
                                            'Haladás visszaállítása',
                                            'Az SRS állapotot nullázza — a kártya újként kerül a sorba',
                                        ],
                                        [
                                            'Törlés',
                                            'Véglegesen törli a kártyát',
                                        ],
                                    ]}
                                />
                            </Sub>

                            <Sub
                                title={
                                    <span className="flex items-center gap-2">
                                        Tömeges műveletek{' '}
                                        <ListChecks className="size-4 text-muted-foreground" />
                                    </span>
                                }
                            >
                                <P>
                                    A pakli kártyalistájában a bal oldali
                                    jelölőnégyzetekkel több kártyát is
                                    kijelölhetsz egyszerre (vagy az{' '}
                                    <strong>"Összes kijelölése"</strong> gombbal
                                    mindegyiket). Ekkor az ablak alján
                                    megjelenik a műveletsáv:
                                </P>
                                <Table
                                    headers={['Művelet', 'Magyarázat']}
                                    rows={[
                                        [
                                            'Haladás törlése',
                                            'Minden kijelölt kártya SRS állapota nullázódik',
                                        ],
                                        [
                                            'Kétirányú kártya',
                                            'A kijelölt kártyák mindkét irányból kérdeznek. Ha már mind kétirányú, a gomb "Visszaállítás (1 irányú)"-ra vált',
                                        ],
                                        [
                                            'Áthelyezés',
                                            'A kijelölt kártyák egy másik pakliba kerülnek',
                                        ],
                                        [
                                            'Törlés',
                                            'A kijelölt kártyák végleg törlődnek',
                                        ],
                                    ]}
                                />
                            </Sub>

                            <Sub title="CSV export">
                                <P>
                                    A pakli oldalán a{' '}
                                    <strong>"CSV export"</strong> gombbal
                                    letöltheted az összes kártyát CSV
                                    formátumban. Az első oszlop az előlap, a
                                    második a hátlap — kompatibilis az Anki
                                    importálási formátumával.
                                </P>
                            </Sub>

                            <Sub title="Kalibráció (CSV import után)">
                                <P>
                                    Tömeges importnál az alkalmazás felajánlja a
                                    kalibrálást: egyenként megmutatja a
                                    kártyákat, te értékeled mennyre ismered. Ez
                                    megakadályozza, hogy 1 000 kártyán nulláról
                                    kelljen kezdeni — a már ismert kártyák
                                    azonnal hosszabb intervallumon indulnak.
                                </P>
                                <Table
                                    headers={['Értékelés', 'Hatás']}
                                    rows={[
                                        [
                                            'Nem tudom (1)',
                                            'Normál új kártyaként kerül a tanulási sorba',
                                        ],
                                        [
                                            'Valamennyire (2)',
                                            'Kb. 3–7 napon belül fog megjelenni',
                                        ],
                                        [
                                            'Tudom (3)',
                                            'Kb. 1–3 héten belül jelenik meg',
                                        ],
                                        [
                                            'Jól tudom (4)',
                                            'Kb. 3–7 héten belül jelenik meg',
                                        ],
                                    ]}
                                />
                                <InfoBox type="tip">
                                    A kalibrálást bármikor megszakíthatod és
                                    később folytathatod — a már értékelt kártyák
                                    nem jelennek meg újra. A "Végleg kihagyás"
                                    gomb az összes maradék kártyát azonnal a
                                    normál tanulási sorba teszi.
                                </InfoBox>
                            </Sub>

                            <Sub title="Tanulási munkamenet">
                                <Steps
                                    items={[
                                        'A pakli oldalán kattints a "Tanulás" gombra — csak akkor aktív, ha van esedékes kártya.',
                                        'Megjelenik az előlap — próbáld felidézni a választ.',
                                        'Kattints a kártyára (vagy nyomj Space-t / Entert), és a hátlap is láthatóvá válik.',
                                        'Értékeld a felidézést: Újra / Nehéz / Jó / Könnyű.',
                                        'Az algoritmus a választásod alapján ütemezi a következő megjelenést.',
                                    ]}
                                />
                                <Sub title="Gyorsbillentyűk">
                                    <Table
                                        headers={['Billentyű', 'Mit csinál?']}
                                        rows={[
                                            [
                                                'Space / Enter',
                                                'Megfordítja a kártyát (megmutatja a hátlapot)',
                                            ],
                                            [
                                                '1 – 4',
                                                'Értékelés: Újra (1), Nehéz (2), Jó (3), Könnyű (4)',
                                            ],
                                            [
                                                'Backspace',
                                                'Visszavonja az utolsó értékelést',
                                            ],
                                        ]}
                                    />
                                </Sub>
                                <InfoBox type="tip">
                                    A <strong>Visszavonás</strong> gombbal (vagy
                                    Backspace-szel) visszavonhatod az utolsó
                                    értékelést, ha elütötted.
                                </InfoBox>
                            </Sub>

                            <Sub title="Értékelési gombok">
                                <Table
                                    headers={['Gomb', 'Mikor nyomd?', 'Hatás']}
                                    rows={[
                                        [
                                            'Újra',
                                            'Egyáltalán nem tudtad',
                                            'Visszakerül a sorba, pár percen belül ismét megjelenik',
                                        ],
                                        [
                                            'Nehéz',
                                            'Tudtad, de sokat gondolkodtál',
                                            'Kicsit hosszabb mint "Újra", az ease csökken',
                                        ],
                                        [
                                            'Jó',
                                            'Felidézted rendesen',
                                            'Normál SRS ugrás — általában ezt nyomkod leggyakrabban',
                                        ],
                                        [
                                            'Könnyű',
                                            'Teljesen automatikusan jött',
                                            'Nagyobb intervallum + ease növekszik',
                                        ],
                                    ]}
                                />
                            </Sub>
                        </Section>

                        {/* ── SRS ── */}
                        <Section
                            id="srs"
                            title="SRS algoritmus"
                            icon={GitBranch}
                        >
                            <P>
                                Az SRS (Spaced Repetition System) mögött az az
                                alapelv áll, hogy egy szót pontosan akkor
                                érdemes ismételni, amikor épp el akarnád
                                felejteni. Ez a módszer – tudományos kísérletek
                                alapján – akár 5–10× hatékonyabb, mint a
                                hagyományos "minden nap ugyanazokat olvasom"
                                megközelítés.
                            </P>

                            <Sub title="Kártya állapotok">
                                <Table
                                    headers={['Állapot', 'Mit jelent?']}
                                    rows={[
                                        [
                                            <Badge color="blue">Új</Badge>,
                                            'Még soha nem tanult kártya — a napi "új kártyák" limit szerint kerül sorra',
                                        ],
                                        [
                                            <Badge color="orange">
                                                Tanulás
                                            </Badge>,
                                            'Épp most tanulja az algoritmus — rövid időközökkel ismétlődik (percek, akár órák)',
                                        ],
                                        [
                                            <Badge color="green">
                                                Ismétlés
                                            </Badge>,
                                            'Elvégezte a tanulási lépéseket — napokban, hetekben mért intervallumok',
                                        ],
                                        [
                                            <Badge>Újratanulás</Badge>,
                                            'Korábban tudta, de "Újra"-t kapott — visszakerül a tanulási lépésekbe',
                                        ],
                                    ]}
                                />
                            </Sub>

                            <Sub title="Hogyan számítja az intervallumot?">
                                <P>
                                    Minden kártyának van egy{' '}
                                    <strong>nehézségi szorzója</strong> (ease,
                                    alapból 250%). Ismétlés állapotban:
                                </P>
                                <Table
                                    headers={[
                                        'Értékelés',
                                        'Következő intervallum (közelítő)',
                                        'Szorzó',
                                    ]}
                                    rows={[
                                        [
                                            'Újra',
                                            'Visszaesik tanulásba, majd a tévesztés utáni visszaesés %-a szerint indul újra',
                                            '−20',
                                        ],
                                        [
                                            'Nehéz',
                                            'régi × nehéz szorzó (alap 120%)',
                                            '−15',
                                        ],
                                        [
                                            'Jó',
                                            'régi × szorzó × intervallum módosító (alap 100%)',
                                            'változatlan',
                                        ],
                                        [
                                            'Könnyű',
                                            'jó intervallum × könnyű bónusz (alap 130%)',
                                            '+15',
                                        ],
                                    ]}
                                />
                                <InfoBox>
                                    A nehézségi szorzó nem eshet{' '}
                                    <strong>130% alá</strong> és nem nőhet{' '}
                                    <strong>999% fölé</strong> — így egy sokat
                                    tévesztett kártya sem ragad be végtelen
                                    rövid ismétlésbe.
                                </InfoBox>
                            </Sub>

                            <Sub title="Tanulási lépések">
                                <P>
                                    Mielőtt egy kártya "végez" (graduating) és
                                    bekerül az ismétlési fázisba, végig kell
                                    mennie a tanulási lépéseken. Alapértelmezés:
                                    1 perc → 10 perc.
                                </P>
                                <Ul
                                    items={[
                                        'Újra: visszaesik az első lépésre',
                                        'Jó: továbblép a következő lépésre; az utolsó lépésnél "végez" és elkerül az ismétlési fázisba',
                                        'Könnyű: azonnal végez, az easy_interval-on (alap 4 nap) kerül ismétlésre',
                                    ]}
                                />
                            </Sub>

                            <Sub title="Problémás kártyák">
                                <P>
                                    Ha egy kártya eléri a{' '}
                                    <strong>problémás kártya küszöböt</strong>{' '}
                                    (alap 8 tévesztés), megkapja a problémás
                                    jelzést. Ez azt jelzi, hogy az adott kártya
                                    különlegesen nehéz neked — érdemes
                                    átgondolni az emlékezési stratégiát: kép,
                                    mnemonika, kontextus hozzáadása.
                                </P>
                            </Sub>
                        </Section>

                        {/* ── Deck beállítások ── */}
                        <Section
                            id="deck-settings"
                            title="Pakli beállítások"
                            icon={Settings2}
                        >
                            <P>
                                Minden paklinak lehet saját beállítása, amely
                                felülírja a globális SRS paramétereket. A
                                beállítások dialóg a pakli oldalán a
                                "Beállítások" gombbal érhető el.
                            </P>
                            <InfoBox>
                                Ha nincs egyéni pakli-beállítás, az algoritmus a
                                globális (Beállítások → Flashcard beállítások)
                                értékeket használja. Ha az sincs, a rendszer
                                alapértékei érvényesek.
                            </InfoBox>

                            <Sub title="Gyors előbeállítások">
                                <P>
                                    A beállítások tetején három előbeállítást
                                    találsz: <strong>Lassú</strong> (kevés
                                    kártya naponta, lazább haladás),
                                    <strong>
                                        Normál
                                    </strong> (alapértelmezett),{' '}
                                    <strong>Gyors</strong> (sok kártya, rövidebb
                                    intervallumok). Ezek csak kiindulópontok —
                                    utána bármit finomhangolhatsz.
                                </P>
                            </Sub>

                            <Sub title="Napi korlátok">
                                <Table
                                    headers={[
                                        'Beállítás',
                                        'Alap',
                                        'Mit állít?',
                                    ]}
                                    rows={[
                                        [
                                            'Új kártyák / nap',
                                            '20',
                                            'Hány ismeretlen kártya kerüljön be naponta — ne emeld túl magasra, hogy ne fulladj meg',
                                        ],
                                        [
                                            'Max ismétlések / nap',
                                            '200',
                                            'Legfeljebb hány esedékes kártyát mutasson — ha itt vagy, a tanulás véget ér aznap',
                                        ],
                                    ]}
                                />
                            </Sub>

                            <Sub title="Tanulási lépések">
                                <Table
                                    headers={[
                                        'Beállítás',
                                        'Alap',
                                        'Mit állít?',
                                    ]}
                                    rows={[
                                        [
                                            'Tanulási lépések',
                                            '1, 10 perc',
                                            'Percek sorozata, amelyen az új kártya végigmegy; adj hozzá pl. "1 óra"-t a jobb bevéséshez',
                                        ],
                                        [
                                            'Végzési intervallum',
                                            '1 nap',
                                            'Az utolsó tanulási lépés után hány napra kerül ismétlésre',
                                        ],
                                        [
                                            'Könnyű intervallum',
                                            '4 nap',
                                            'Ha tanulás közben "Könnyű"-t kap, azonnal ennyire ugrik',
                                        ],
                                    ]}
                                />
                            </Sub>

                            <Sub title="Ease és intervallum szorzók">
                                <Table
                                    headers={[
                                        'Beállítás',
                                        'Alap',
                                        'Mit állít?',
                                    ]}
                                    rows={[
                                        [
                                            'Kezdő nehézség',
                                            '250%',
                                            'Milyen szorzóval indul a kártya a végzés pillanatában',
                                        ],
                                        [
                                            'Könnyű bónusz',
                                            '130%',
                                            '"Könnyű"-nél az intervallum extra szorzója az ease-en felül',
                                        ],
                                        [
                                            'Nehéz szorzó',
                                            '120%',
                                            '"Nehéz"-nél az intervallum szorzója',
                                        ],
                                        [
                                            'Intervallum módosító',
                                            '100%',
                                            'Globális szorzó — 80%-ra állítva 20%-kal sűrűbb az ismétlés',
                                        ],
                                        [
                                            'Max intervallum',
                                            '365 nap',
                                            'Ennél hosszabb intervallum soha nem keletkezhet',
                                        ],
                                    ]}
                                />
                            </Sub>

                            <Sub title="Tévesztés beállítások">
                                <Table
                                    headers={[
                                        'Beállítás',
                                        'Alap',
                                        'Mit állít?',
                                    ]}
                                    rows={[
                                        [
                                            'Tévesztés utáni visszaesés',
                                            '0%',
                                            'Tévesztés után az előző intervallum hány %-ából indul újra (0% = 1 napról)',
                                        ],
                                        [
                                            'Problémás kártya küszöb',
                                            '8',
                                            'Ennyi tévesztés után kap a kártya problémás jelzést',
                                        ],
                                    ]}
                                />
                            </Sub>

                            <Sub title="Egyéb">
                                <Table
                                    headers={[
                                        'Beállítás',
                                        'Alap',
                                        'Mit állít?',
                                    ]}
                                    rows={[
                                        [
                                            'Kártyák keverése',
                                            'Bekapcsolva',
                                            'Véletlen sorrendben kérdezi a kártyákat a munkameneten belül — kikapcsolva mindig ugyanabban a sorrendben jönnek',
                                        ],
                                    ]}
                                />
                                <InfoBox type="tip">
                                    Ha egy pakli egyéni beállításait törlöd, a
                                    pakli innentől a globális beállításaidat
                                    követi — a kártyák és a tanulási haladás nem
                                    változik.
                                </InfoBox>
                            </Sub>
                        </Section>

                        {/* ── Szövegelemzés ── */}
                        <Section
                            id="szovegelemzes"
                            title="Szövegelemzés"
                            icon={FileText}
                        >
                            <P>
                                A szövegelemzés megmutatja, hogy egy adott
                                szövegben az összes szó hány százalékát ismered.
                                Az ismeretlen szavakat kiemeli, és lehetőséget
                                ad azok azonnali megtanulására.
                            </P>

                            <Sub title="Szöveg forrásai">
                                <P>
                                    A négy forrást a lap tetején lévő fülekkel
                                    választhatod ki:
                                </P>
                                <Table
                                    headers={['Fül', 'Hogyan?']}
                                    rows={[
                                        [
                                            'Szöveg',
                                            'Másold be a szöveget közvetlenül (max. 15 000 karakter)',
                                        ],
                                        [
                                            'YouTube',
                                            'A videó angol feliratát automatikusan kinyeri és elemzi',
                                        ],
                                        [
                                            'Weboldal',
                                            'Add meg az URL-t — az alkalmazás letölti és feldolgozza a szöveget',
                                        ],
                                        [
                                            'Könyv',
                                            'EPUB feltöltése (egy fájl max. 3 MB), utána oldalankénti navigáció',
                                        ],
                                    ]}
                                />
                            </Sub>

                            <Sub title="Mit látsz az elemzés után?">
                                <P>
                                    A szöveg szavanként ki van emelve, a
                                    szólistádban rögzített státusz színeivel. A
                                    jelmagyarázat mindig ott van az elemzés
                                    fölött:
                                </P>
                                <Table
                                    headers={['Kiemelés', 'Mit jelent?']}
                                    rows={[
                                        [
                                            <Badge color="green">Tudom</Badge>,
                                            'Ezt a szót már ismerted — beleszámít a megértési %-ba',
                                        ],
                                        [
                                            <Badge color="blue">Tanulom</Badge>,
                                            'Folyamatban lévő szó',
                                        ],
                                        [
                                            <Badge color="default">
                                                Top 10 000, de ismeretlen
                                            </Badge>,
                                            'Pirossal: a gyakorisági listán szerepel, de nincs még státusza — ezekkel érdemes kezdeni',
                                        ],
                                        [
                                            <Badge color="default">
                                                Tulajdonnév / ritka szó
                                            </Badge>,
                                            'Nincs kiemelve: nem szerepel a Top 10 000-ben (név, szakszó, ritka alak)',
                                        ],
                                    ]}
                                />
                                <P>
                                    A Később, Kiejtés és Gyakorlásra színek csak
                                    akkor jelennek meg a jelmagyarázatban, ha
                                    ilyen szó elő is fordul a szövegben.
                                </P>
                                <Ul
                                    items={[
                                        'A leggyakoribb ismeretlen szavak külön listában, gyakoriság szerint rendezve',
                                        'Egy szóra kattintva megjelenik a fordítása és az aktuális státusza',
                                        'Közvetlenül innen adhatsz státuszt és flashcard kártyát a szóhoz',
                                        'A megértési % azt mutatja, a szöveg összes szó-előfordulásának hány %-át ismered már',
                                    ]}
                                />
                            </Sub>

                            <Sub
                                title={
                                    <span className="flex items-center gap-2">
                                        AI kontextus magyarázat <AiBadge />
                                    </span>
                                }
                            >
                                <P>
                                    Egy szó részleteinél az AI-gombra kattintva
                                    az AI megmagyarázza, mit jelent a szó{' '}
                                    <em>pontosan abban a mondatban</em> — nem
                                    általánosságban, hanem ahogy az adott
                                    szövegkörnyezetben használják. Minden
                                    csomagban elérhető, a havi AI-keretedből
                                    fogyaszt.
                                </P>
                            </Sub>

                            <Sub title="Napi és tárhelykorlátok">
                                <Table
                                    headers={['Korlát', 'Ingyenes', 'Pro']}
                                    rows={[
                                        ['Szövegelemzés / nap', '2', '50'],
                                        ['Mentett könyv', '1', '3'],
                                        ['Mentett YouTube-felirat', '3', '40'],
                                        ['Könyv-tárhely', '30 MB', '30 MB'],
                                    ]}
                                />
                                <InfoBox>
                                    Egy feltöltött EPUB legfeljebb{' '}
                                    <strong>3 MB</strong> lehet, a mentett
                                    könyvek együtt pedig 30 MB-ot foglalhatnak.
                                    Egy könyv törlésével a tárhely azonnal
                                    felszabadul.
                                </InfoBox>
                            </Sub>

                            <Sub title="Könyvek kezelése">
                                <Ul
                                    items={[
                                        'A feltöltött könyvek a bal oldali könyvtárban jelennek meg',
                                        'Oldalankénti navigáció nyilakkal vagy lapszám beírásával',
                                        'Bármikor törölheted a könyvet — a felvett szavaid megmaradnak',
                                    ]}
                                />
                            </Sub>
                        </Section>

                        {/*
                         * INDULÁSKOR KIVEZETVE (2026-07-29): a Kvíz, a Mondatkiegészítés, a
                         * Szabad írás és a Rendhagyó igék nem részei az induló feature-körnek —
                         * a route-jaik ki vannak kommentelve (routes/words.php), a sidebar-
                         * linkjeik elrejtve. A szekciók szövege itt marad, hogy visszahozáskor
                         * ne kelljen újraírni; a `sections` tömb megfelelő elemeivel együtt
                         * élesítendők.
                         *
                         *    ── Kvíz ──
                         * <Section id="kviz" title="Kvíz" icon={HelpCircle}>
                         *     <P>
                         *         A kvíz gyors szókincstesztet biztosít: az
                         *         alkalmazás szavakat választ ki a szótárból és
                         *         négy válaszlehetőséget kínál.
                         *     </P>
                         *     <Ul
                         *         items={[
                         *             'Szűrheted szintre, státuszra vagy mappára — csak azzal a szócsoporttal tesztelj, amire fókuszálsz',
                         *             'Kérdéstípusok: EN→HU és HU→EN fordítás, vegyesen',
                         *             'A befejezésekor megtekintheted az elrontott szavakat',
                         *             'Az eredmény beleszámít a teljesítmény-statisztikákba',
                         *         ]}
                         *     />
                         * </Section>
                         *
                         *    ── Mondatkiegészítés ──
                         * <Section
                         *     id="cloze"
                         *     title="Mondatkiegészítés"
                         *     icon={Zap}
                         * >
                         *     <P>
                         *         A mondatkiegészítés (cloze) feladatban valós
                         *         példamondatokból hiányzik egy szó — neked kell
                         *         beírni. Ez az egyik leghatékonyabb tanulási
                         *         technika, mert a szót kontextusban kell
                         *         felidézni, nem csak felismerni.
                         *     </P>
                         *     <Ul
                         *         items={[
                         *             'A hiányzó szó helyét jelzés mutatja, a betűk száma is látható segítségként',
                         *             'Szűrheted szintre: csak az adott nehézségi fokból kap feladatot',
                         *             'Megoldás után látod a helyes szót és a fordítást',
                         *         ]}
                         *     />
                         * </Section>
                         *
                         *    ── Szabad írás ──
                         * <Section
                         *     id="szabad-iras"
                         *     title="Szabad írás"
                         *     icon={NotebookPen}
                         * >
                         *     <P>
                         *         A szabad írás gyakorlóban angol szöveget írhatsz
                         *         szabadon, miközben az AI ellenőrzi, hogy a
                         *         megadott célszavakat helyesen és természetesen
                         *         használtad-e, és visszajelzést ad a
                         *         grammatikáról is.
                         *     </P>
                         *     <Sub title="Hogyan működik?">
                         *         <Steps
                         *             items={[
                         *                 'Adj hozzá célszavakat (max. 10) a szólistádból kereséssel, vagy gépeld be kézzel.',
                         *                 'Írj szabadon angol szöveget — próbáld természetesen beépíteni a célszavakat.',
                         *                 'Kattints az „Ellenőrzés" gombra — az AI feldolgozza a szöveget.',
                         *                 'Minden célszónál látod, hogy helyesen használtad-e, és miért.',
                         *             ]}
                         *         />
                         *     </Sub>
                         *     <Sub title="Mit kapsz vissza?">
                         *         <Ul
                         *             items={[
                         *                 'Szavanként: helyes / helytelen / nem használt jelzés, magyarázattal',
                         *                 'Grammatikai megjegyzések: szintaktikai vagy idiomatikus hibák listája',
                         *                 'Javított változat: az AI átírja a szöveget, ha volt hiba',
                         *                 'Összefoglaló értékelés magyarul a teljes szövegről',
                         *             ]}
                         *         />
                         *     </Sub>
                         *     <Sub title="Tipp">
                         *         <P>
                         *             A szólistában a „Gyakorlásra" státuszú
                         *             szavak automatikusan megjelennek a célszavak
                         *             között — ezeket könnyedén hozzáadhatod
                         *             egyetlen kattintással. A funkció AI-t
                         *             (Claude) használ, ezért internet-kapcsolat
                         *             szükséges.
                         *         </P>
                         *     </Sub>
                         * </Section>
                         *
                         *    ── Rendhagyó igék ──
                         * <Section
                         *     id="irregular"
                         *     title="Rendhagyó igék"
                         *     icon={GitBranch}
                         * >
                         *     <P>
                         *         A modul a leggyakoribb szabálytalan angol igék
                         *         három alakját gyakoroltatja: infinitive
                         *         (alapalak), past simple (múlt idő), past
                         *         participle (befejezett melléknévi igenév).
                         *     </P>
                         *     <Ul
                         *         items={[
                         *             'Kártyaszerű megjelenítés — forgasd a kártyát, ha ismered az igét',
                         *             'Szűrheted nehézségi szint alapján',
                         *             'Beépített példamondatok segítik a kontextusos megjegyzést',
                         *             'Kvíz mód: add meg a három alakot és ellenőrzöm az eredményt',
                         *         ]}
                         *     />
                         * </Section>
                         */}

                        {/* ── Teljesítmények ── */}
                        <Section
                            id="teljesitmenyek"
                            title="Teljesítmények"
                            icon={Award}
                        >
                            <P>
                                A teljesítmény rendszer jelvényekkel jutalmaz a
                                haladásodért — motivációt ad és vizuálisan
                                mutatja, mennyit fejlődtél. A{' '}
                                <strong>Teljesítmények</strong> oldalon
                                csoportonként látod, mit szereztél már meg, és
                                szűrhetsz a feloldott / hátralévő jelvényekre.
                            </P>
                            <Table
                                headers={['Csoport', 'Mire kapsz jelvényt?']}
                                rows={[
                                    [
                                        'Sorozat',
                                        '3, 7, 14, 30 és 100 egymást követő tanulási nap',
                                    ],
                                    [
                                        'Szókincs',
                                        '10, 50, 100, 500, 1 000 megjelölt szó (bármelyik státusszal)',
                                    ],
                                    [
                                        'Ismert szavak',
                                        '10, 50, 100, 500, 1 000 „Tudom" státuszú szó',
                                    ],
                                    [
                                        'Szintek',
                                        'Egy teljes gyakorisági szint (pl. Top 1 000) minden szava „Tudom"',
                                    ],
                                    [
                                        'Saját szavak',
                                        'Az első, majd a 10. és 50. saját szó felvétele',
                                    ],
                                    [
                                        'Flashcards',
                                        'Az első pakli létrehozása, majd 10, 100 és 500 megtanult kártya',
                                    ],
                                    [
                                        'Szövegelemzés',
                                        'Az első és a 10. elemzés, valamint 90%+ érthetőség egy szövegen',
                                    ],
                                ]}
                            />
                            <P>
                                A jelvény megszerzésekor egy értesítő jelenik
                                meg az alkalmazásban.
                            </P>
                        </Section>

                        {/* ── Chrome bővítmény ── */}
                        <Section
                            id="extension"
                            title="Chrome bővítmény"
                            icon={Chrome}
                        >
                            <P>
                                A TopWords Chrome bővítménnyel bármely
                                weboldalon azonnal megnézheted egy szó
                                fordítását — anélkül, hogy el kellene hagynod az
                                oldalt, amit épp olvasol.{' '}
                                <strong>
                                    Telepítsd a bővítményt, és élvezd az
                                    előnyeit
                                </strong>{' '}
                                — így a szótanulás beépül a mindennapi
                                böngészésedbe:
                            </P>
                            <InfoBox type="info">
                                A bővítmény telepítése és használata (keresés,
                                fordítás, felirat-kiemelés, YouTube/Netflix
                                átirat) mindenkinek elérhető, Ingyenes csomaggal
                                is. Csak a{' '}
                                <strong>bővítményből indított írások</strong>{' '}
                                (új szó/flashcard felvétele, státusz módosítása)
                                esnek közös napi keretbe Ingyenes csomagnál —
                                Pro csomaggal ez is korlátlan.
                            </InfoBox>
                            <div className="rounded-2xl border-2 border-indigo-200 bg-linear-to-br from-indigo-50 to-blue-50/80 p-5 dark:border-indigo-800/60 dark:from-indigo-950/30 dark:to-blue-950/10">
                                <div className="mb-4 flex items-center gap-2">
                                    <Star className="size-4 text-indigo-600 dark:text-indigo-400" />
                                    <span className="text-sm font-bold tracking-wide text-indigo-700 uppercase dark:text-indigo-300">
                                        Bővített funkciók
                                    </span>
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="flex flex-col gap-3 rounded-xl border border-indigo-100 bg-white p-4 shadow-sm dark:border-indigo-900/40 dark:bg-neutral-900/60">
                                        <div className="flex items-center gap-2.5">
                                            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-red-500 text-white">
                                                <Youtube className="size-4" />
                                            </div>
                                            <span className="font-semibold">
                                                YouTube
                                            </span>
                                        </div>
                                        <P>
                                            Videók nézése közben a feliratokat
                                            valós időben dolgozza fel — a szavak
                                            státuszuk szerint kiszíneződnek a
                                            feliratsávban.
                                        </P>
                                        <Ul
                                            items={[
                                                <>
                                                    <strong>
                                                        Felirat-kiemelés
                                                    </strong>{' '}
                                                    valós időben — zöld, kék,
                                                    narancs, lila a tanult
                                                    szavak alatt
                                                </>,
                                                <>
                                                    <strong>
                                                        Dupla kattintás
                                                    </strong>{' '}
                                                    a feliraton: fordítás és
                                                    státuszkezelés a videó
                                                    megállítása nélkül
                                                </>,
                                                <>
                                                    <strong>
                                                        Átirat panel:
                                                    </strong>{' '}
                                                    a teljes videó szövege
                                                    oldalpanelben — görgethető,
                                                    kereshető, szavanként
                                                    kattintható
                                                </>,
                                                <>
                                                    Egy kattintással
                                                    megnyithatod az átiratot{' '}
                                                    <strong>
                                                        szövegelemzésre
                                                    </strong>{' '}
                                                    a TopWords-ben
                                                </>,
                                            ]}
                                        />
                                        <InfoBox type="tip">
                                            Automatikusan generált felirattal
                                            (auto CC) is működik.
                                        </InfoBox>
                                    </div>

                                    <div className="flex flex-col gap-3 rounded-xl border border-indigo-100 bg-white p-4 shadow-sm dark:border-indigo-900/40 dark:bg-neutral-900/60">
                                        <div className="flex items-center gap-2.5">
                                            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white">
                                                <Tv2 className="size-4" />
                                            </div>
                                            <span className="font-semibold">
                                                Netflix
                                            </span>
                                        </div>
                                        <P>
                                            Netflix-nézés közben a feliratokat
                                            ugyanúgy dolgozza fel, mint
                                            YouTube-on — valós idejű kiemelés és
                                            azonnali fordítás sorozatnézés
                                            közben.
                                        </P>
                                        <Ul
                                            items={[
                                                <>
                                                    <strong>
                                                        Felirat-kiemelés
                                                    </strong>{' '}
                                                    valós időben — zöld, kék,
                                                    narancs, lila aláhúzások a
                                                    tanult szavak alatt
                                                </>,
                                                <>
                                                    <strong>
                                                        Dupla kattintás
                                                    </strong>{' '}
                                                    a feliraton: fordítás és
                                                    státuszkezelés a sorozat
                                                    megállítása nélkül
                                                </>,
                                                <>
                                                    <strong>
                                                        1–5 billentyűkkel
                                                    </strong>{' '}
                                                    gyorsan állíthatod a
                                                    státuszt a popup nyitva
                                                    tartása nélkül is
                                                </>,
                                            ]}
                                        />
                                        <InfoBox type="warning">
                                            Csak böngészős Netflix-nél működik
                                            (nem az asztali appban). Bekapcsolt
                                            angol felirat szükséges.
                                        </InfoBox>
                                    </div>
                                </div>
                            </div>

                            <Ul
                                items={[
                                    <>
                                        <strong>Azonnali fordítás</strong> dupla
                                        kattintással bármely weboldalon,
                                        kiejtéssel együtt
                                    </>,
                                    <>
                                        <strong>Szavak kiemelése</strong> az
                                        oldalon a státuszuk szerint — egyből
                                        látod, mit tanultál már
                                    </>,
                                    <>
                                        <strong>Gyors keresőpaletta</strong>{' '}
                                        (Ctrl+Shift+F) AI-kitöltéssel: új szót
                                        pár másodperc alatt felveszel
                                    </>,
                                    <>
                                        <strong>YouTube-feliratok</strong>{' '}
                                        színezése és átirat, hogy nézés közben
                                        is tanulj
                                    </>,
                                    <>
                                        <strong>Státuszkezelés helyben</strong>{' '}
                                        (1–5 billentyűk) — nem kell átváltanod a
                                        TopWords oldalára
                                    </>,
                                    <>
                                        <strong>
                                            Automatikus bejelentkezés
                                        </strong>
                                        : a meglévő TopWords munkamenetedet
                                        használja, külön belépés nélkül
                                    </>,
                                ]}
                            />

                            {/*
                             * A fejlesztői módú telepítés lépései TÖRÖLVE (2026-07-29):
                             * a bővítmény a Chrome Web Store-ból fog települni, a .zip
                             * letöltése `can:admin` mögé került (routes/web.php). A régi
                             * 6 lépéses útmutató a git-előzményben marad meg — ha mégis
                             * kellene, onnan hozható vissza.
                             */}
                            <Sub title="Telepítés">
                                {extensionStoreUrl ? (
                                    <>
                                        <P>
                                            A bővítmény a Chrome Web Store-ból
                                            egyetlen kattintással telepíthető,
                                            és automatikusan frissül.
                                        </P>
                                        <div className="mt-3 mb-4">
                                            <a
                                                href={extensionStoreUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                                            >
                                                <Chrome className="size-4" />
                                                Telepítés a Chrome Web Store-ból
                                            </a>
                                        </div>
                                    </>
                                ) : (
                                    <P>
                                        A bővítmény hamarosan elérhető lesz a
                                        Chrome Web Store-ban — onnan egyetlen
                                        kattintással telepíthető, és
                                        automatikusan frissül. A megjelenésig az
                                        app többi funkciója bővítmény nélkül is
                                        teljes értékű.
                                    </P>
                                )}
                                <InfoBox type="warning">
                                    <strong>Fontos:</strong> A bővítmény csak
                                    akkor működik, ha be vagy jelentkezve a
                                    TopWords-be — különben nem tud kommunikálni
                                    a rendszerrel.
                                </InfoBox>
                                <InfoBox type="tip">
                                    Az AI-funkciók (AI-kitöltés a keresőben) itt
                                    is minden csomagban működnek, a havi
                                    AI-keretedből.
                                </InfoBox>
                            </Sub>

                            <Sub title="Szókeresés dupla kattintással">
                                <P>
                                    Ha egy weboldalon duplán kattintasz egy
                                    szóra és nyomva tartod egy pillanatot,
                                    megjelenik egy kis popup az azonnali
                                    fordítással.
                                </P>
                                <Ul
                                    items={[
                                        'Látod a szó magyar fordítását és szófaját',
                                        'Ha már van státusza (pl. "Tanulom"), az is megjelenik',
                                        'A 🔊 gombra kattintva meghallgatod a kiejtést',
                                        '1–5 billentyűkkel gyorsan beállíthatod a státuszt (ha be vagy jelentkezve)',
                                    ]}
                                />
                            </Sub>

                            <Sub title="Gyorsgesztusok a kiemelt szavakon">
                                <P>
                                    A már kiemelt szavakon (weboldalon, YouTube-
                                    és Netflix-feliraton egyaránt) a popup
                                    megnyitása nélkül is állíthatsz státuszt:
                                </P>
                                <Table
                                    headers={['Gesztus', 'Mit csinál?']}
                                    rows={[
                                        [
                                            'Egyszeri kattintás',
                                            'Megnyitja a szó-popupot',
                                        ],
                                        [
                                            'Dupla kattintás',
                                            'Azonnal „Tudom" státuszt ad (újra rákattintva leveszi)',
                                        ],
                                        [
                                            'Hosszú nyomás (fél másodperc)',
                                            'Azonnal „Később" státuszt ad',
                                        ],
                                    ]}
                                />
                            </Sub>

                            <Sub title="Gyors keresőpaletta">
                                <P>
                                    A{' '}
                                    <kbd className="rounded border px-1.5 py-0.5 font-mono text-xs">
                                        Ctrl+Shift+F
                                    </kbd>{' '}
                                    (Mac:{' '}
                                    <kbd className="rounded border px-1.5 py-0.5 font-mono text-xs">
                                        Cmd+Shift+F
                                    </kbd>
                                    ) vagy az{' '}
                                    <kbd className="rounded border px-1.5 py-0.5 font-mono text-xs">
                                        Alt+W
                                    </kbd>{' '}
                                    (Mac:{' '}
                                    <kbd className="rounded border px-1.5 py-0.5 font-mono text-xs">
                                        Option+W
                                    </kbd>
                                    ) billentyűkombinációval bármikor megnyílik
                                    egy gyors keresőablak.
                                </P>
                                <Ul
                                    items={[
                                        'Keress bármely szóra a TopWords szótárban',
                                        'Ha nincs az adatbázisban, egy kattintással hozzáadhatod saját szóként',
                                        <>
                                            Az <strong>"✨ AI kitöltés"</strong>{' '}
                                            gombbal a Gemini automatikusan
                                            kitölti a jelentést, szinonimákat és
                                            ragozást — azonnal hozzáadhatod
                                        </>,
                                        'Státuszokat közvetlenül innen is kezelhetsz',
                                    ]}
                                />
                                <InfoBox type="tip">
                                    Ha egy szót kijelölsz az oldalon, majd
                                    megnyomod a Ctrl+Shift+F-et, a keresőbe
                                    automatikusan bekerül a kijelölt szó.
                                </InfoBox>
                            </Sub>

                            <Sub title="Oldalon lévő szavak kiemelése">
                                <P>
                                    A bővítmény képes kiemelni az oldalon az
                                    összes szót, amelyhez van státuszod — így
                                    azonnal látod, mit tanultál már és mit nem.
                                </P>
                                <Table
                                    headers={['Példa', 'Státusz']}
                                    rows={[
                                        [
                                            <span
                                                className="font-medium"
                                                style={{
                                                    backgroundColor:
                                                        '#22c55e33',
                                                    borderRadius: '3px',
                                                    padding: '1px 6px',
                                                }}
                                            >
                                                zöld háttér
                                            </span>,
                                            'Tudom',
                                        ],
                                        [
                                            <span
                                                className="font-medium"
                                                style={{
                                                    backgroundColor:
                                                        '#3b82f633',
                                                    borderRadius: '3px',
                                                    padding: '1px 6px',
                                                }}
                                            >
                                                kék háttér
                                            </span>,
                                            'Tanulom',
                                        ],
                                        [
                                            <span
                                                className="font-medium"
                                                style={{
                                                    backgroundColor:
                                                        '#f9731633',
                                                    borderRadius: '3px',
                                                    padding: '1px 6px',
                                                }}
                                            >
                                                narancs háttér
                                            </span>,
                                            'Később',
                                        ],
                                        [
                                            <span
                                                className="font-medium"
                                                style={{
                                                    backgroundColor:
                                                        '#8b5cf633',
                                                    borderRadius: '3px',
                                                    padding: '1px 6px',
                                                }}
                                            >
                                                lila háttér
                                            </span>,
                                            'Kiejtés',
                                        ],
                                        [
                                            <span
                                                className="font-medium"
                                                style={{
                                                    backgroundColor:
                                                        '#f43f5e33',
                                                    borderRadius: '3px',
                                                    padding: '1px 6px',
                                                }}
                                            >
                                                piros háttér
                                            </span>,
                                            'Gyakorlásra',
                                        ],
                                    ]}
                                />
                                <P>
                                    A kiemelést a bővítmény popup-jából
                                    kapcsolhatod be/ki.
                                </P>
                            </Sub>

                            <Sub title="Bejelentkezés">
                                <P>
                                    A bővítmény a böngésző meglévő TopWords
                                    bejelentkezésedet használja — külön belépés
                                    nem szükséges. Ha ki vagy jelentkezve, a
                                    popup tájékoztat és átirányít a
                                    bejelentkezési oldalra.
                                </P>
                            </Sub>

                            <InfoBox type="info">
                                <strong>Kompatibilitás:</strong> A bővítmény
                                Chrome 110+ és Chromium alapú böngészőkben
                                (Edge, Brave, Arc) is működik.
                            </InfoBox>
                        </Section>

                        {/* ── Desktop lejátszó ── */}
                        {/*
                         * INDULÁSKOR KIVEZETVE (2026-07-29): a topwords Player letöltése `can:admin`
                         * mögé került (routes/web.php), így a felhasználó nem tudja beszerezni az
                         * appot — a leírását sem hirdetjük. A szekció szövege itt marad;
                         * visszahozáskor a `sections` tömb `player` elemével együtt élesítendő
                         * (a showDownload / Download importok is kellenek).
                         *
                         * <Section
                         *     id="player"
                         *     title="Desktop lejátszó (topwords Player)"
                         *     icon={MonitorPlay}
                         * >
                         *     <P>
                         *         A topwords Player egy külön asztali alkalmazás
                         *         (Mac és Windows), amellyel videókat játszhatsz
                         *         le úgy, hogy a feliratok szavai a saját
                         *         szólistád státuszai szerint színeződnek — a
                         *         Chrome bővítmény YouTube/Netflix-élményéhez
                         *         hasonlóan, de helyi videófájlokra.
                         *     </P>
                         *
                         *     <div className="mb-4 flex flex-wrap gap-2">
                         *         <a
                         *             href={showDownload('player-mac').url}
                         *             download
                         *             className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                         *         >
                         *             <Download className="size-4" />
                         *             Player letöltése – macOS (.dmg)
                         *         </a>
                         *         <a
                         *             href={showDownload('player-win').url}
                         *             download
                         *             className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                         *         >
                         *             <Download className="size-4" />
                         *             Player letöltése – Windows (.exe)
                         *         </a>
                         *     </div>
                         *
                         *     <Sub title="Első megnyitás macOS-en">
                         *         <P>
                         *             A béta időszak alatt a lejátszó még nincs
                         *             hitelesítve az Apple által (nincs
                         *             Developer ID aláírás), ezért macOS
                         *             letöltés után figyelmeztetést mutat.
                         *         </P>
                         *         <InfoBox type="info">
                         *             Nyisd meg a{' '}
                         *             <strong>
                         *                 Rendszerbeállítások → Adatvédelem és
                         *                 biztonság
                         *             </strong>{' '}
                         *             oldalt, görgess le a „Biztonság" részhez,
                         *             és a Topwords Player üzenete mellett
                         *             kattints a{' '}
                         *             <strong>„Megnyitás mindenképp"</strong>{' '}
                         *             gombra.
                         *         </InfoBox>
                         *     </Sub>
                         *
                         *     <Sub title="Fiók összekötése">
                         *         <Steps
                         *             items={[
                         *                 'Nyisd meg a topwords Playert — a program felkínál egy párosító kódot.',
                         *                 'A lejátszó megnyitja a rendszer-böngésződet ezen az oldalon (Beállítások → Lejátszó összekötése).',
                         *                 'Írd be kézzel a lejátszóban látott kódot, majd kattints az "Összekötés jóváhagyása" gombra.',
                         *                 'A jóváhagyás után a lejátszó pár másodpercen belül automatikusan bejelentkezik.',
                         *             ]}
                         *         />
                         *         <InfoBox type="warning">
                         *             Csak a <strong>saját lejátszódban</strong>{' '}
                         *             megjelenő kódot írd be. A kódot szándékosan
                         *             nem lehet linkkel előre kitölteni, hogy egy
                         *             kapott linkkel senki ne tudjon idegen
                         *             párosítást jóváhagyatni — a jóváhagyás
                         *             mindig a te bejelentkezett munkameneteddel
                         *             történik, jelszó soha nem kerül a lejátszóba.
                         *         </InfoBox>
                         *     </Sub>
                         *
                         *     <Sub title="Mit tud a lejátszó?">
                         *         <Ul
                         *             items={[
                         *                 'Feliratos videók lejátszása, a szavak a szólista-státuszaid szerint kiszínezve (zöld/kék/narancs/lila/piros)',
                         *                 'A párosítási token 90 napig érvényes — ezután újra össze kell kötni a fiókodat',
                         *                 'A jelentés és a státuszkezelés a lejátszóból ugyanúgy elérhető, mint a bővítményben',
                         *             ]}
                         *         />
                         *     </Sub>
                         * </Section>
                         */}

                        {/* ── Előfizetés & számlázás ── */}
                        <Section
                            id="elofizetes"
                            title="Előfizetés & számlázás"
                            icon={CreditCard}
                        >
                            <P>
                                A TopWords <strong>Ingyenes</strong> és{' '}
                                <strong>Pro</strong> csomagban érhető el.
                                Ugyanazokat a funkciókat kapod mindkettőben — a
                                különbség a keretekben van.
                            </P>
                            <Table
                                headers={['Keret', 'Ingyenes', 'Pro']}
                                rows={[
                                    [
                                        'Tanulókártya / pakli',
                                        '50 kártya, 5 pakli',
                                        'Korlátlan',
                                    ],
                                    ['Szövegelemzés / nap', '2', '50'],
                                    [
                                        'Mentett könyv és YouTube-felirat',
                                        '1 könyv, 3 felirat',
                                        '3 könyv, 40 felirat',
                                    ],
                                    [
                                        'Mentés a Chrome-bővítményből / nap',
                                        '20',
                                        'Korlátlan',
                                    ],
                                    [
                                        'Havi AI-keret',
                                        'Kóstoló',
                                        'Teljes keret',
                                    ],
                                ]}
                            />

                            <Sub title="Előfizetés kezelése">
                                <P>
                                    A <strong>Beállítások → Előfizetés</strong>{' '}
                                    oldalon látod az aktuális csomagodat, az
                                    AI-kereted felhasználását és a fizetési
                                    módodat.
                                </P>
                                <Table
                                    headers={['Művelet', 'Mit csinál?']}
                                    rows={[
                                        [
                                            'Váltás Próra',
                                            'Átirányít az árazási oldalra, ahol kiválaszthatod az előfizetést',
                                        ],
                                        [
                                            'Számlák & kártyaadatok',
                                            'Megnyitja a Stripe ügyfélportált — itt módosíthatod a kártyaadatokat és tekintheted meg a korábbi terheléseket',
                                        ],
                                        [
                                            'Előfizetés lemondása',
                                            'A már kifizetett időszak végéig minden funkció megmarad, utána automatikusan az Ingyenes csomagra vált — a kártyát nem terheljük meg újra',
                                        ],
                                        [
                                            'Lemondás visszavonása',
                                            'A lejárat előtt bármikor visszavonható, ekkor az előfizetés a szokásos módon megújul tovább',
                                        ],
                                    ]}
                                />
                                <InfoBox type="warning">
                                    Ha egy terhelés sikertelen (pl. lejárt
                                    kártya), a Pro hozzáférés átmenetileg
                                    szünetel. A Stripe automatikusan
                                    újrapróbálja a terhelést — a{' '}
                                    <strong>Kártya frissítése</strong> gombbal
                                    tudod soron kívül rendezni, ezután a
                                    hozzáférés azonnal visszaáll.
                                </InfoBox>
                            </Sub>

                            <Sub title="Számlázási adatok és NAV-számlák">
                                <P>
                                    A{' '}
                                    <strong>
                                        Beállítások → Számlázási adatok
                                    </strong>{' '}
                                    oldalon adhatod meg, hogy magánszemélyként
                                    vagy cégként szeretnél számlázni (cégnél az
                                    adószám kötelező). Minden sikeres fizetés
                                    után automatikusan NAV-kompatibilis számla
                                    készül, amit az Előfizetés oldalon PDF-ként
                                    letölthetsz.
                                </P>
                            </Sub>
                        </Section>
                    </div>
                </div>
            </div>
        </HandbookShell>
    );
}
