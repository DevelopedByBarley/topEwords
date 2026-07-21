import { Head } from '@inertiajs/react';
import {
    BookOpen,
    Zap,
    LayoutGrid,
    Chrome,
    Brain,
    Settings2,
    FileText,
    HelpCircle,
    GitBranch,
    Award,
    ChevronRight,
    Lightbulb,
    AlertCircle,
    Star,
    RefreshCw,
    ListChecks,
    NotebookPen,
    Download,
    Tv2,
    Youtube,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ChromeExtensionsLink from '@/components/chrome-extensions-link';

const sections = [
    { id: 'attekintes', label: 'Áttekintés', icon: LayoutGrid },
    { id: 'szavak', label: 'Szavak', icon: BookOpen },
    { id: 'szoismetles', label: 'Szóismétlés', icon: RefreshCw },
    { id: 'flashcards', label: 'Flashcards', icon: Brain },
    { id: 'srs', label: 'SRS algoritmus', icon: GitBranch },
    { id: 'deck-settings', label: 'Deck beállítások', icon: Settings2 },
    { id: 'szovegelemzes', label: 'Szövegelemzés', icon: FileText },
    { id: 'kviz', label: 'Kvíz', icon: HelpCircle },
    { id: 'cloze', label: 'Mondatkiegészítés', icon: Zap },
    { id: 'szabad-iras', label: 'Szabad írás', icon: NotebookPen },
    { id: 'irregular', label: 'Rendhagyó igék', icon: GitBranch },
    { id: 'teljesitmenyek', label: 'Teljesítmények', icon: Award },
    { id: 'extension', label: 'Chrome bővítmény', icon: Chrome },
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
        <section id={id} className="scroll-mt-6 space-y-5">
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
    title: string;
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
    color?: 'blue' | 'green' | 'orange' | 'purple' | 'default';
}) {
    const colors = {
        blue: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
        green: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300',
        orange: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
        purple: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
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

function PremiumBadge() {
    return (
        <span className="inline-flex items-center gap-1 rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
            <Star className="size-3" />
            Prémium
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

export default function Handbook() {
    const [activeId, setActiveId] = useState('attekintes');
    const observerRef = useRef<IntersectionObserver | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const root = scrollRef.current;
        observerRef.current = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        setActiveId(entry.target.id);
                    }
                }
            },
            { root, rootMargin: '-20% 0px -70% 0px' },
        );
        sections.forEach(({ id }) => {
            const el = document.getElementById(id);

            if (el) {
                observerRef.current?.observe(el);
            }
        });

        return () => observerRef.current?.disconnect();
    }, []);

    return (
        <>
            <Head title="Kézikönyv" />

            <div
                ref={scrollRef}
                className="overflow-y-auto"
                style={{ height: 'calc(100dvh - 64px)' }}
            >
                <div className="flex gap-0 px-4 py-6 md:px-6">
                    {/* Sticky TOC sidebar */}
                    <aside className="sticky top-6 mr-10 hidden w-56 shrink-0 self-start lg:block">
                        <div className="max-h-[calc(100dvh-5rem)] space-y-0.5 overflow-y-auto">
                            <p className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                                Tartalom
                            </p>
                            {sections.map(({ id, label, icon: Icon }) => (
                                <a
                                    key={id}
                                    href={`#${id}`}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        document
                                            .getElementById(id)
                                            ?.scrollIntoView({
                                                behavior: 'smooth',
                                                block: 'start',
                                            });
                                    }}
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
                        </div>
                    </aside>

                    {/* Main content */}
                    <div className="max-w-3xl min-w-0 flex-1 space-y-14">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">
                                Kézikönyv
                            </h1>
                            <p className="mt-2 text-muted-foreground">
                                Minden, amit a TopWords alkalmazásról tudni kell
                                — lépésről lépésre.
                            </p>
                        </div>

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
                                        desc: '8 000+ szó hat nehézségi szinten, saját mappákkal',
                                    },
                                    {
                                        icon: Brain,
                                        title: 'Flashcards',
                                        desc: 'Okos kártyás ismétlés SRS algoritmussal',
                                    },
                                    {
                                        icon: RefreshCw,
                                        title: 'Szóismétlés',
                                        desc: 'Státuszalapú szóismétlő kvíz, 1–14 napos intervallumon',
                                    },
                                    {
                                        icon: FileText,
                                        title: 'Szövegelemzés',
                                        desc: 'Könyv, web, YouTube — melyik szót nem ismered?',
                                    },
                                    {
                                        icon: HelpCircle,
                                        title: 'Kvíz',
                                        desc: 'Gyors fordításteszt bármely szintből',
                                    },
                                    {
                                        icon: Zap,
                                        title: 'Mondatkiegészítés',
                                        desc: 'Valós mondatokban kell megtalálni a szót',
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
                                        'Hozz létre egy flashcard paklit (decket) és adj hozzá szavakat.',
                                        'Minden nap kattints a Tanulás gombra — az SRS algoritmus elvégzi a többit.',
                                        'Telepítsd a Chrome bővítményt, hogy tanulás közben se kelljen abbahagyni az olvasást.',
                                    ]}
                                />
                            </Sub>

                            <Sub title="Dashboard">
                                <P>
                                    A főoldalon látod az összesített haladásodat
                                    szintenként (Top 1 000 → 8 001–10 000), a
                                    napi sorozatodat (streak) és az aktuális
                                    statisztikáidat. Minden szinthez tartozik
                                    egy sáv: hány szót jelöltél meg abból a
                                    szintből.
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
                                A beépített szótár több mint 8 000 angol szót
                                tartalmaz, szógyakoriság szerint hat szintbe
                                rendezve. Minden szóhoz látható a magyar
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
                                    Minden szóhoz négy státuszt rendelhetsz.
                                    Egyszerre csak egy aktív — ha újra
                                    megnyomod, törlődik.
                                </P>
                                <Table
                                    headers={['Státusz', 'Mire jó?']}
                                    rows={[
                                        [
                                            <Badge color="green">Tudom</Badge>,
                                            'Beleszámít a haladásba és a dashboard %-ba — ha egy szót valóban ismersz, ezt jelöld',
                                        ],
                                        [
                                            <Badge color="blue">Tanulom</Badge>,
                                            'Aktívan tanulod — emlékeztetőként jelölöd meg, pl. flashcard mellé',
                                        ],
                                        [
                                            <Badge color="orange">
                                                Mentett
                                            </Badge>,
                                            'Elmentetted, de még nem foglalkozol vele — "majd egyszer" lista',
                                        ],
                                        [
                                            <Badge color="purple">
                                                Kiejtés
                                            </Badge>,
                                            'A jelentést tudod, de a kiejtést kell még begyakorolni',
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
                                    (
                                        <span className="flex items-center gap-2">
                                            AI szótár (Gemini) <PremiumBadge />
                                        </span>
                                    ) as unknown as string
                                }
                            >
                                <P>
                                    A szó oldalán a lila Gemini gombra kattintva
                                    az AI automatikusan kitölti a magyar
                                    jelentést, szinonimákat, ragozási alakokat
                                    és egy példamondatot. Prémium funkció.
                                </P>
                            </Sub>
                        </Section>

                        {/* ── Szóismétlés ── */}
                        <Section
                            id="szoismetles"
                            title="Szóismétlés"
                            icon={RefreshCw}
                        >
                            <P>
                                A Szóismétlés egy egyszerűsített kvízrendszer,
                                amely automatikusan ismételteti veled az
                                esedékes szavakat státuszuk alapján. Ez a
                                flashcard SRS-szel párhuzamosan működik — a
                                szótárban megjelölt szavakat tartja frissen,
                                visszahívással erősítve a memóriát.
                            </P>

                            <Sub title="Ismétlési intervallumok">
                                <P>
                                    Minden státuszhoz más ismétlési időköz
                                    tartozik. Ha egy szót sikeresen felismersz a
                                    munkamenetben, az ismétlési ideje újraindul.
                                </P>
                                <Table
                                    headers={['Státusz', 'Ismétlési időköz']}
                                    rows={[
                                        [
                                            <Badge color="blue">Tanulom</Badge>,
                                            '1 nap',
                                        ],
                                        [
                                            <Badge color="orange">
                                                Mentett
                                            </Badge>,
                                            '3 nap',
                                        ],
                                        [
                                            <Badge color="purple">
                                                Kiejtés
                                            </Badge>,
                                            '7 nap',
                                        ],
                                        [
                                            <Badge color="green">Tudom</Badge>,
                                            '14 nap',
                                        ],
                                    ]}
                                />
                            </Sub>

                            <Sub title="Hogyan működik?">
                                <Steps
                                    items={[
                                        'Nyisd meg a Szóismétlés oldalt — látod, mennyi szó esedékes státuszok szerint.',
                                        'Kattints a "Kezdés" gombra — legfeljebb 50 szó kerül be egy munkamenetbe.',
                                        'Megjelenik a szó angolul, és négy magyar fordítás közül kell a helyeset választani.',
                                        'Helyes válasz esetén a szó megkapja a mai dátumot, és az intervallum újraindul.',
                                        'A munkamenet végén látod az eredményedet és az elrontott szavakat.',
                                    ]}
                                />
                                <InfoBox type="tip">
                                    A szóismétlés nem befolyásolja a flashcard
                                    SRS állapotát — a két rendszer egymástól
                                    függetlenül működik, de egymást kiegészítve
                                    erőteljesebb bevésést adnak.
                                </InfoBox>
                            </Sub>
                        </Section>

                        {/* ── Flashcards ── */}
                        <Section
                            id="flashcards"
                            title="Flashcards"
                            icon={Brain}
                        >
                            <P>
                                A flashcard rendszer a TopWords magja. Saját
                                kártyacsomagokat (decket) hozhatsz létre, minden
                                kártya két oldalból áll, és az SRS algoritmus
                                automatikusan ütemezi az ismétléseket.
                            </P>

                            <Sub title="Deck létrehozása és mappák">
                                <Steps
                                    items={[
                                        'A Flashcards főoldalán kattints az "Új deck" gombra.',
                                        'Adj meg nevet (kötelező) és opcionálisan leírást.',
                                        'Hozzárendelheted egy mappához is — ez segít az átláthatóságban, ha sok decked van.',
                                    ]}
                                />
                                <P>
                                    A mappákat a{' '}
                                    <strong>"Mappák kezelése"</strong> gombbal
                                    kezelheted (átnevezés, törlés, új mappa).
                                    Egy deck több mappához is rendelhető — a
                                    kártyákon a mappa ikon jelzi ezt.
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
                                    második a hátlap. Anki .apkg exportból a
                                    "Notes as CSV" opcióval tudod kinyerni.
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
                                    (
                                        <span className="flex items-center gap-2">
                                            Gemini AI kitöltés <PremiumBadge />
                                        </span>
                                    ) as unknown as string
                                }
                            >
                                <P>
                                    Írd be az angol szót az előlapra, majd
                                    kattints a lila "Generálás" gombra. A Gemini
                                    AI kitölti a hátlapot (magyar fordítás,
                                    példamondat) — az előlap változatlan marad,
                                    így a saját szövegedet nem írja felül.
                                    Prémium funkció.
                                </P>
                            </Sub>

                            <Sub title="Egyedi kártya-műveletek">
                                <P>
                                    Minden kártya sorában (deck nézetben)
                                    elérhető néhány gyorsművelet:
                                </P>
                                <Table
                                    headers={['Művelet', 'Mit csinál?']}
                                    rows={[
                                        [
                                            'Másolás',
                                            'Készít egy azonos tartalmú kártyát ugyanabban a deckben',
                                        ],
                                        [
                                            'Áthelyezés',
                                            'Átmozgatja a kártyát egy másik deckbe',
                                        ],
                                        [
                                            'Haladás törlése',
                                            'Az SRS állapotot nullázza — a kártya újként kerül a sorba',
                                        ],
                                    ]}
                                />
                            </Sub>

                            <Sub
                                title={
                                    (
                                        <span className="flex items-center gap-2">
                                            Tömeges műveletek{' '}
                                            <ListChecks className="size-4 text-muted-foreground" />
                                        </span>
                                    ) as unknown as string
                                }
                            >
                                <P>
                                    A deck kártyalistájában a bal oldali
                                    jelölőnégyzetekkel több kártyát is
                                    kijelölhetsz egyszerre (vagy az "összes
                                    kijelölése" gombbal mindegyiket). A
                                    megjelenő műveletsávban:
                                </P>
                                <Table
                                    headers={['Művelet', 'Magyarázat']}
                                    rows={[
                                        [
                                            'Törlés',
                                            'A kijelölt kártyák végleg törlődnek',
                                        ],
                                        [
                                            'Irány módosítása',
                                            'Egyszerre állítod front→back / back→front / mindkét irányra',
                                        ],
                                        [
                                            'Megfordítás',
                                            'Az előlap és hátlap tartalma felcserélődik minden kijelölt kártyán',
                                        ],
                                        [
                                            'Áthelyezés',
                                            'A kijelölt kártyák egy másik deckbe kerülnek',
                                        ],
                                        [
                                            'Haladás törlése',
                                            'Minden kijelölt kártya SRS állapota nullázódik',
                                        ],
                                    ]}
                                />
                            </Sub>

                            <Sub title="CSV export">
                                <P>
                                    A deck oldalán a{' '}
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
                                        'A deck főoldalán kattints a "Tanulás" gombra — csak akkor aktív, ha van esedékes kártya.',
                                        'Megjelenik az előlap — próbáld felidézni a választ.',
                                        'A "Mutatás" gombra (vagy szóközzel) a hátlap is láthatóvá válik.',
                                        'Értékeld a felidézést: Újra / Nehéz / Jó / Könnyű.',
                                        'Az algoritmus a választásod alapján ütemezi a következő megjelenést.',
                                    ]}
                                />
                                <InfoBox type="tip">
                                    Az Undo gombbal visszavonhatod az utolsó
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
                                    <strong>ease factor</strong> értéke (alapból
                                    250%). Ismétlés állapotban:
                                </P>
                                <Table
                                    headers={[
                                        'Értékelés',
                                        'Következő intervallum (közelítő)',
                                    ]}
                                    rows={[
                                        [
                                            'Újra',
                                            'Visszaesik tanulásba, majd a tévesztési intervallum % szerint indul újra',
                                        ],
                                        [
                                            'Nehéz',
                                            'régi × hard_modifier (alap 120%) — az ease csökken 15-tel',
                                        ],
                                        [
                                            'Jó',
                                            'régi × ease × interval_modifier (alap 100%)',
                                        ],
                                        [
                                            'Könnyű',
                                            'jó_intervallum × easy_bonus (alap 130%) — az ease nő 15-tel',
                                        ],
                                    ]}
                                />
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

                            <Sub title="Leech — nehéz kártyák">
                                <P>
                                    Ha egy kártya eléri a leech küszöböt (alap 8
                                    tévesztés), megkapja a "leech" jelzést. Ez
                                    azt jelzi, hogy az adott kártya különlegesen
                                    nehéz neked — érdemes átgondolni az
                                    emlékezési stratégiát: kép, mnemonika,
                                    kontextus hozzáadása.
                                </P>
                            </Sub>
                        </Section>

                        {/* ── Deck beállítások ── */}
                        <Section
                            id="deck-settings"
                            title="Deck beállítások"
                            icon={Settings2}
                        >
                            <P>
                                Minden decknek saját beállítása lehet, amely
                                felülírja a globális SRS paramétereket. A
                                beállítások dialóg a deck oldalán a
                                "Beállítások" gombbal érhető el.
                            </P>
                            <InfoBox>
                                Ha nincs egyéni deck beállítás, az algoritmus a
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
                                            'Kezdő ease',
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
                                            'Tévesztés utáni intervallum',
                                            '0%',
                                            'Tévesztés után az előző intervallum hány %-ából indul újra (0% = 1 napról)',
                                        ],
                                        [
                                            'Leech küszöb',
                                            '8',
                                            'Ennyi tévesztés után kap a kártya "leech" jelzést',
                                        ],
                                    ]}
                                />
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
                                <Table
                                    headers={['Forrás', 'Hogyan?']}
                                    rows={[
                                        [
                                            'Beillesztett szöveg',
                                            'Másold be a szöveget közvetlenül (max. 15 000 karakter)',
                                        ],
                                        [
                                            'Weblap URL',
                                            'Add meg az URL-t — az alkalmazás letölti és feldolgozza a szöveget',
                                        ],
                                        [
                                            'YouTube URL',
                                            'A videó angol feliratát automatikusan kinyeri és elemzi',
                                        ],
                                        [
                                            'Könyv (EPUB)',
                                            'Feltöltés után oldalankénti navigáció érhető el',
                                        ],
                                    ]}
                                />
                            </Sub>

                            <Sub title="Mit látsz az elemzés után?">
                                <Ul
                                    items={[
                                        'A szöveg szavanként kiemelve: zöld = tudod, kék = tanulod, szürke = ismeretlen',
                                        'Jobb oldalon a leggyakoribb ismeretlen szavak listája',
                                        'Egy szóra kattintva megjelenik a fordítása és az aktuális státusza',
                                        'Közvetlenül innen hozzáadhatsz státuszt és flashcard kártyát',
                                        'A megértési % mutatja, az összes szóhossz hány %-át fedik az ismert szavak',
                                    ]}
                                />
                            </Sub>

                            <Sub
                                title={
                                    (
                                        <span className="flex items-center gap-2">
                                            AI kontextus magyarázat{' '}
                                            <PremiumBadge />
                                        </span>
                                    ) as unknown as string
                                }
                            >
                                <P>
                                    Egy szó részleteinél a Gemini gombra
                                    kattintva az AI megmagyarázza, mit jelent a
                                    szó <em>pontosan abban a mondatban</em> —
                                    nem általánosságban, hanem ahogy az adott
                                    szövegkörnyezetben használják. Prémium
                                    funkció.
                                </P>
                            </Sub>

                            <Sub title="Könyvek kezelése">
                                <Ul
                                    items={[
                                        'Feltöltött könyv baloldalon jelenik meg a könyvtárban',
                                        'Oldalankénti navigáció nyilakkal vagy lapszám beírásával',
                                        'Tárhelykorlát: Alap csomagon 3 könyv / 30 MB, Prémiumon 5 könyv / 30 MB',
                                        'Bármikor törölheted a könyvet — a tárhelyed felszabadul',
                                    ]}
                                />
                            </Sub>
                        </Section>

                        {/* ── Kvíz ── */}
                        <Section id="kviz" title="Kvíz" icon={HelpCircle}>
                            <P>
                                A kvíz gyors szókincstesztet biztosít: az
                                alkalmazás szavakat választ ki a szótárból és
                                négy válaszlehetőséget kínál.
                            </P>
                            <Ul
                                items={[
                                    'Szűrheted szintre, státuszra vagy mappára — csak azzal a szócsoporttal tesztelj, amire fókuszálsz',
                                    'Kérdéstípusok: EN→HU és HU→EN fordítás, vegyesen',
                                    'A befejezésekor megtekintheted az elrontott szavakat',
                                    'Az eredmény beleszámít a teljesítmény-statisztikákba',
                                ]}
                            />
                        </Section>

                        {/* ── Mondatkiegészítés ── */}
                        <Section
                            id="cloze"
                            title="Mondatkiegészítés"
                            icon={Zap}
                        >
                            <P>
                                A mondatkiegészítés (cloze) feladatban valós
                                példamondatokból hiányzik egy szó — neked kell
                                beírni. Ez az egyik leghatékonyabb tanulási
                                technika, mert a szót kontextusban kell
                                felidézni, nem csak felismerni.
                            </P>
                            <Ul
                                items={[
                                    'A hiányzó szó helyét jelzés mutatja, a betűk száma is látható segítségként',
                                    'Szűrheted szintre: csak az adott nehézségi fokból kap feladatot',
                                    'Megoldás után látod a helyes szót és a fordítást',
                                ]}
                            />
                        </Section>

                        {/* ── Szabad írás ── */}
                        <Section
                            id="szabad-iras"
                            title="Szabad írás"
                            icon={NotebookPen}
                        >
                            <P>
                                A szabad írás gyakorlóban angol szöveget írhatsz
                                szabadon, miközben az AI ellenőrzi, hogy a
                                megadott célszavakat helyesen és természetesen
                                használtad-e, és visszajelzést ad a
                                grammatikáról is.
                            </P>
                            <Sub title="Hogyan működik?">
                                <Steps
                                    items={[
                                        'Adj hozzá célszavakat (max. 10) a szólistádból kereséssel, vagy gépeld be kézzel.',
                                        'Írj szabadon angol szöveget — próbáld természetesen beépíteni a célszavakat.',
                                        'Kattints az „Ellenőrzés" gombra — az AI feldolgozza a szöveget.',
                                        'Minden célszónál látod, hogy helyesen használtad-e, és miért.',
                                    ]}
                                />
                            </Sub>
                            <Sub title="Mit kapsz vissza?">
                                <Ul
                                    items={[
                                        'Szavanként: helyes / helytelen / nem használt jelzés, magyarázattal',
                                        'Grammatikai megjegyzések: szintaktikai vagy idiomatikus hibák listája',
                                        'Javított változat: az AI átírja a szöveget, ha volt hiba',
                                        'Összefoglaló értékelés magyarul a teljes szövegről',
                                    ]}
                                />
                            </Sub>
                            <Sub title="Tipp">
                                <P>
                                    A szólistában a „Gyakorlásra" státuszú
                                    szavak automatikusan megjelennek a célszavak
                                    között — ezeket könnyedén hozzáadhatod
                                    egyetlen kattintással. A funkció AI-t
                                    (Claude) használ, ezért internet-kapcsolat
                                    szükséges.
                                </P>
                            </Sub>
                        </Section>

                        {/* ── Rendhagyó igék ── */}
                        <Section
                            id="irregular"
                            title="Rendhagyó igék"
                            icon={GitBranch}
                        >
                            <P>
                                A modul a leggyakoribb szabálytalan angol igék
                                három alakját gyakoroltatja: infinitive
                                (alapalak), past simple (múlt idő), past
                                participle (befejezett melléknévi igenév).
                            </P>
                            <Ul
                                items={[
                                    'Kártyaszerű megjelenítés — forgasd a kártyát, ha ismered az igét',
                                    'Szűrheted nehézségi szint alapján',
                                    'Beépített példamondatok segítik a kontextusos megjegyzést',
                                    'Kvíz mód: add meg a három alakot és ellenőrzöm az eredményt',
                                ]}
                            />
                        </Section>

                        {/* ── Teljesítmények ── */}
                        <Section
                            id="teljesitmenyek"
                            title="Teljesítmények"
                            icon={Award}
                        >
                            <P>
                                A teljesítmény rendszer érmekkel jutalmaz a
                                haladásodért — motivációt ad és vizuálisan
                                mutatja, mennyit fejlődtél.
                            </P>
                            <Table
                                headers={['Kategória', 'Mire kapsz érmet?']}
                                rows={[
                                    [
                                        'Szótanulás',
                                        'X db szó "Tudom" státuszra állítása (50, 200, 500, 1 000...)',
                                    ],
                                    [
                                        'Streak',
                                        'Egymást követő napok száma (7, 30, 100 nap...)',
                                    ],
                                    [
                                        'Kvíz',
                                        'Elvégzett kvízek száma és tökéletes eredmények',
                                    ],
                                    [
                                        'Szövegelemzés',
                                        'Elemzett szövegek száma',
                                    ],
                                    [
                                        'Flashcard',
                                        'Tanult kártyák száma és befejezett munkamenetek',
                                    ],
                                ]}
                            />
                            <P>
                                Az érem megszerzésekor egy értesítő jelenik meg
                                az alkalmazásban.
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
                            <div className="rounded-2xl border-2 border-indigo-200 bg-linear-to-br from-indigo-50 to-blue-50/80 p-5 dark:border-indigo-800/60 dark:from-indigo-950/30 dark:to-blue-950/10">
                                <div className="mb-4 flex items-center gap-2">
                                    <Star className="size-4 text-indigo-600 dark:text-indigo-400" />
                                    <span className="text-sm font-bold tracking-wide text-indigo-700 uppercase dark:text-indigo-300">
                                        Prémium funkciók
                                    </span>
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="flex flex-col gap-3 rounded-xl border border-indigo-100 bg-white p-4 shadow-sm dark:border-indigo-900/40 dark:bg-neutral-900/60">
                                        <div className="flex items-center gap-2.5">
                                            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-red-500 text-white">
                                                <Youtube className="size-4" />
                                            </div>
                                            <span className="font-semibold">YouTube</span>
                                            <PremiumBadge />
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
                                                    <strong>Felirat-kiemelés</strong>{' '}
                                                    valós időben — zöld, kék,
                                                    narancs, lila a tanult szavak
                                                    alatt
                                                </>,
                                                <>
                                                    <strong>Dupla kattintás</strong>{' '}
                                                    a feliraton: fordítás és
                                                    státuszkezelés a videó
                                                    megállítása nélkül
                                                </>,
                                                <>
                                                    <strong>Átirat panel:</strong>{' '}
                                                    a teljes videó szövege
                                                    oldalpanelben — görgethető,
                                                    kereshető, szavanként
                                                    kattintható
                                                </>,
                                                <>
                                                    Egy kattintással megnyithatod
                                                    az átiratot{' '}
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
                                            <span className="font-semibold">Netflix</span>
                                            <PremiumBadge />
                                        </div>
                                        <P>
                                            Netflix-nézés közben a feliratokat
                                            ugyanúgy dolgozza fel, mint YouTube-on
                                            — valós idejű kiemelés és azonnali
                                            fordítás sorozatnézés közben.
                                        </P>
                                        <Ul
                                            items={[
                                                <>
                                                    <strong>Felirat-kiemelés</strong>{' '}
                                                    valós időben — zöld, kék,
                                                    narancs, lila aláhúzások a
                                                    tanult szavak alatt
                                                </>,
                                                <>
                                                    <strong>Dupla kattintás</strong>{' '}
                                                    a feliraton: fordítás és
                                                    státuszkezelés a sorozat
                                                    megállítása nélkül
                                                </>,
                                                <>
                                                    <strong>
                                                        1–4 billentyűkkel
                                                    </strong>{' '}
                                                    gyorsan állíthatod a státuszt
                                                    a popup nyitva tartása nélkül
                                                    is
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
                                        (1–4 billentyűk) — nem kell átváltanod a
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

                            <Sub title="Telepítés (béta — fejlesztői mód)">
                                <P>
                                    A béta időszak alatt a bővítmény közvetlenül
                                    letölthető az oldalról, és néhány perc alatt
                                    telepíthető fejlesztői módban — nincs
                                    szükség Chrome Web Store-ra.
                                </P>
                                <div className="mt-3 mb-4">
                                    <div className="relative inline-flex">
                                        <span className="pointer-events-none absolute inset-0 animate-ping rounded-lg bg-primary opacity-40" />
                                        <a
                                            href="/downloads/topwords-extension.zip"
                                            download
                                            className="relative inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                                        >
                                            <Download className="size-4" />
                                            Bővítmény letöltése (.zip)
                                        </a>
                                    </div>
                                </div>
                                <Steps
                                    items={[
                                        'Kattints a fenti bővítmény letöltése gombra, majd csomagold ki a letöltött .zip fájlt egy mappába (jegyezd meg, hova).',
                                        <>
                                            Nyisd meg a böngészőben a Chrome
                                            bővítmények oldalát:{' '}
                                            <ChromeExtensionsLink /> — másold be
                                            a címsorba (az aktuális weboldal
                                            URL-je helyére) és nyomj Entert.
                                        </>,
                                        <>
                                            Kapcsold be a{' '}
                                            <strong>Fejlesztői mód</strong>{' '}
                                            (Developer mode) kapcsolót az oldal{' '}
                                            <strong>jobb felső sarkában</strong>.
                                        </>,
                                        <>
                                            Kattints a{' '}
                                            <strong>
                                                Kicsomagolt elemek betöltése
                                            </strong>{' '}
                                            (Load unpacked) gombra, válaszd ki
                                            az imént kicsomagolt mappát, lépj
                                            bele, majd kattints a{' '}
                                            <strong>Mappaválasztás</strong>{' '}
                                            gombra.
                                        </>,
                                        <>
                                            Ha szeretnéd mindig látni a bővítmény
                                            irányítópultját: kattints a jobb
                                            felső sarokban lévő{' '}
                                            <strong>puzzle ikonra</strong> (a
                                            címsor és a letöltések gomb között),
                                            majd a{' '}
                                            <strong>TopWords</strong> melletti{' '}
                                            <strong>kitűző ikonra</strong>.
                                        </>,
                                        <>
                                            Kész — a bővítmény automatikusan
                                            felismeri, hogy be vagy-e jelentkezve
                                            a TopWords-be. Indítsd újra a Google
                                            Chrome-ot és élvezd a tanulást!
                                        </>,
                                    ]}
                                />
                                <InfoBox type="warning">
                                    <strong>Fontos:</strong> A bővítmény csak
                                    akkor működik, ha be vagy jelentkezve a
                                    TopWords-be — különben nem tud kommunikálni a
                                    rendszerrel.
                                </InfoBox>
                                <InfoBox type="tip">
                                    Az AI funkciókhoz (fordítás, szókitöltés){' '}
                                    <strong>Prémium előfizetés</strong>{' '}
                                    szükséges.
                                </InfoBox>
                                <InfoBox type="tip">
                                    A kicsomagolt mappát ne töröld és ne helyezd
                                    át a telepítés után — a Chrome innen tölti
                                    be a bővítményt. Frissítéskor töltsd le az
                                    új .zip-et, cseréld le a mappa tartalmát,
                                    majd a bővítmények oldalán kattints a
                                    frissítés (🔄) ikonra.
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
                                        '1–4 billentyűkkel gyorsan beállíthatod a státuszt (ha be vagy jelentkezve)',
                                    ]}
                                />
                            </Sub>

                            <Sub title="Ctrl+Shift+F keresőpaletta">
                                <P>
                                    A{' '}
                                    <kbd className="rounded border px-1.5 py-0.5 font-mono text-xs">
                                        Ctrl+Shift+F
                                    </kbd>{' '}
                                    (Mac:{' '}
                                    <kbd className="rounded border px-1.5 py-0.5 font-mono text-xs">
                                        Cmd+Shift+F
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
                                                    backgroundColor: '#22c55e33',
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
                                                    backgroundColor: '#3b82f633',
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
                                                    backgroundColor: '#f9731633',
                                                    borderRadius: '3px',
                                                    padding: '1px 6px',
                                                }}
                                            >
                                                narancs háttér
                                            </span>,
                                            'Mentett',
                                        ],
                                        [
                                            <span
                                                className="font-medium"
                                                style={{
                                                    backgroundColor: '#8b5cf633',
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
                                                    backgroundColor: '#f43f5e33',
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
                                Chrome 88+ és Chromium alapú böngészőkben (Edge,
                                Brave, Arc) is működik.
                            </InfoBox>
                        </Section>
                    </div>
                </div>
            </div>
        </>
    );
}

Handbook.layout = {
    breadcrumbs: [{ title: 'Kézikönyv', href: '/handbook' }],
};
