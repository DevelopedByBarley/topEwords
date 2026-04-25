import { Head } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import {
    BookOpen, Zap, LayoutGrid, Chrome, Brain, Settings2,
    FileText, HelpCircle, GitBranch, Award, ChevronRight,
    Lightbulb, AlertCircle, CheckCircle2, Star,
} from 'lucide-react';

const sections = [
    { id: 'attekintes',    label: 'Áttekintés',          icon: LayoutGrid },
    { id: 'szavak',        label: 'Szavak',               icon: BookOpen },
    { id: 'flashcards',    label: 'Flashcards',           icon: Brain },
    { id: 'srs',           label: 'SRS algoritmus',       icon: GitBranch },
    { id: 'deck-settings', label: 'Deck beállítások',     icon: Settings2 },
    { id: 'szovegelemzes', label: 'Szövegelemzés',        icon: FileText },
    { id: 'kviz',          label: 'Kvíz',                 icon: HelpCircle },
    { id: 'cloze',         label: 'Mondatkiegészítés',    icon: Zap },
    { id: 'irregular',     label: 'Rendhagyó igék',       icon: GitBranch },
    { id: 'teljesitmenyek',label: 'Teljesítmények',       icon: Award },
    { id: 'extension',     label: 'Chrome bővítmény',     icon: Chrome },
];

function Section({ id, title, icon: Icon, children }: { id: string; title: string; icon?: React.ElementType; children: React.ReactNode }) {
    return (
        <section id={id} className="scroll-mt-6 space-y-5">
            <div className="flex items-center gap-3 border-b pb-3">
                {Icon && <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></div>}
                <h2 className="text-xl font-bold tracking-tight">{title}</h2>
            </div>
            {children}
        </section>
    );
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="space-y-2.5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
            {children}
        </div>
    );
}

function P({ children }: { children: React.ReactNode }) {
    return <p className="text-sm text-muted-foreground leading-relaxed">{children}</p>;
}

function Steps({ items }: { items: React.ReactNode[] }) {
    return (
        <ol className="space-y-2">
            {items.map((item, i) => (
                <li key={i} className="flex gap-3 text-sm text-muted-foreground">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary mt-0.5">{i + 1}</span>
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
                <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                    <ChevronRight className="size-3.5 shrink-0 mt-1 text-primary/50" />
                    <span className="leading-relaxed">{item}</span>
                </li>
            ))}
        </ul>
    );
}

function Table({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
    return (
        <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b bg-muted/50">
                        {headers.map((h, i) => (
                            <th key={i} className="px-4 py-2.5 text-left font-semibold text-foreground">{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? '' : 'bg-muted/20'}>
                            {row.map((cell, j) => (
                                <td key={j} className="px-4 py-2.5 text-muted-foreground align-top">{cell}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function Badge({ children, color = 'default' }: { children: React.ReactNode; color?: 'blue' | 'green' | 'orange' | 'purple' | 'default' }) {
    const colors = {
        blue:    'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
        green:   'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300',
        orange:  'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
        purple:  'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
        default: 'bg-muted text-foreground',
    };
    return (
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${colors[color]}`}>
            {children}
        </span>
    );
}

function InfoBox({ children, type = 'info' }: { children: React.ReactNode; type?: 'info' | 'tip' | 'warning' }) {
    const styles = {
        info:    { wrap: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300',    icon: <AlertCircle className="size-4 shrink-0 mt-0.5" /> },
        tip:     { wrap: 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300', icon: <Lightbulb className="size-4 shrink-0 mt-0.5" /> },
        warning: { wrap: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300', icon: <AlertCircle className="size-4 shrink-0 mt-0.5" /> },
    };
    const s = styles[type];
    return (
        <div className={`flex gap-2.5 rounded-xl border px-4 py-3 text-sm ${s.wrap}`}>
            {s.icon}
            <div className="leading-relaxed">{children}</div>
        </div>
    );
}

function PremiumBadge() {
    return (
        <span className="inline-flex items-center gap-1 rounded-md bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
            <Star className="size-3" />Prémium
        </span>
    );
}

function CardGrid({ cards }: { cards: { icon: React.ElementType; title: string; desc: string }[] }) {
    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {cards.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex flex-col gap-1.5 rounded-xl border bg-card p-3.5">
                    <div className="flex items-center gap-2">
                        <Icon className="size-4 text-primary" />
                        <span className="text-sm font-semibold">{title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
            ))}
        </div>
    );
}

export default function Guide() {
    const [activeId, setActiveId] = useState('attekintes');
    const observerRef = useRef<IntersectionObserver | null>(null);

    useEffect(() => {
        observerRef.current = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) setActiveId(entry.target.id);
                }
            },
            { rootMargin: '-20% 0px -70% 0px' },
        );
        sections.forEach(({ id }) => {
            const el = document.getElementById(id);
            if (el) observerRef.current?.observe(el);
        });
        return () => observerRef.current?.disconnect();
    }, []);

    return (
        <>
            <Head title="Kézikönyv" />

            <div className="flex gap-0 px-4 py-6 md:px-6">
                {/* Sticky TOC sidebar */}
                <aside className="hidden lg:block w-56 shrink-0 mr-10">
                    <div className="sticky top-6 space-y-0.5">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tartalom</p>
                        {sections.map(({ id, label, icon: Icon }) => (
                            <a
                                key={id}
                                href={`#${id}`}
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
                <div className="flex-1 min-w-0 space-y-14 max-w-3xl">

                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Kézikönyv</h1>
                        <p className="mt-2 text-muted-foreground">Minden, amit a TopWords alkalmazásról tudni kell — lépésről lépésre.</p>
                    </div>

                    {/* ── Áttekintés ── */}
                    <Section id="attekintes" title="Áttekintés" icon={LayoutGrid}>
                        <P>
                            A TopWords egy angol szókincsfejlesztő alkalmazás, amely a tudományosan bevált
                            spaced repetition módszert kombinálja AI-alapú eszközökkel. A cél egyszerű:
                            minél több szót tarts meg minél kevesebb idő alatt.
                        </P>

                        <CardGrid cards={[
                            { icon: BookOpen,  title: 'Szavak',             desc: '8 000+ szó hat nehézségi szinten, saját mappákkal' },
                            { icon: Brain,     title: 'Flashcards',         desc: 'Okos kártyás ismétlés SRS algoritmussal' },
                            { icon: FileText,  title: 'Szövegelemzés',      desc: 'Könyv, web, YouTube — melyik szót nem ismered?' },
                            { icon: HelpCircle,title: 'Kvíz',               desc: 'Gyors fordításteszt bármely szintből' },
                            { icon: Zap,       title: 'Mondatkiegészítés',  desc: 'Valós mondatokban kell megtalálni a szót' },
                            { icon: Chrome,    title: 'Chrome bővítmény',   desc: 'Azonnali fordítás bármely weboldalon' },
                        ]} />

                        <Sub title="Első lépések — hol kezdjem?">
                            <Steps items={[
                                'Nyisd meg az Angol szavak oldalt és nézd meg, melyik szintből ismered a legtöbbet.',
                                'Jelöld meg a szavakat státusszal (Tudom / Tanulom) — ettől frissül a haladásod.',
                                'Hozz létre egy flashcard paklit (decket) és adj hozzá szavakat.',
                                'Minden nap kattints a Tanulás gombra — az SRS algoritmus elvégzi a többit.',
                                'Telepítsd a Chrome bővítményt, hogy tanulás közben se kelljen abbahagyni az olvasást.',
                            ]} />
                        </Sub>

                        <Sub title="Dashboard">
                            <P>
                                A főoldalon látod az összesített haladásodat szintenként (Kezdő → Mester),
                                a napi sorozatodat (streak) és az aktuális statisztikáidat.
                                Minden szinthez tartozik egy sáv: hány szót jelöltél meg abból a szintből.
                            </P>
                        </Sub>
                    </Section>

                    {/* ── Szavak ── */}
                    <Section id="szavak" title="Angol szavak" icon={BookOpen}>
                        <P>
                            A beépített szótár több mint 8 000 angol szót tartalmaz, szógyakoriság szerint
                            hat szintbe rendezve. Minden szóhoz látható a magyar jelentés, szófaj,
                            ragozási alakok és egy példamondat.
                        </P>

                        <Sub title="Szintek">
                            <Table
                                headers={['Szint', 'Megnevezés', 'Mikor érdemes?']}
                                rows={[
                                    ['1', 'Kezdő',     'Alapvető szavak — ezeket mindenképp érdemes elsőre megtanulni'],
                                    ['2', 'Alapszint', 'Hétköznapi kommunikációhoz elegendő'],
                                    ['3', 'Középszint','Folyékony olvasáshoz és halláshoz szükséges'],
                                    ['4', 'Haladó',    'Szakmai szövegek és irodalom megértéséhez'],
                                    ['5', 'Szakértő',  'Ritka szavak, közel anyanyelvi szint'],
                                    ['6', 'Mester',    'Nagyon ritka, speciális szókincs'],
                                ]}
                            />
                        </Sub>

                        <Sub title="Szóstátuszok">
                            <P>Minden szóhoz négy státuszt rendelhetsz. Egyszerre csak egy aktív — ha újra megnyomod, törlődik.</P>
                            <Table
                                headers={['Státusz', 'Mire jó?']}
                                rows={[
                                    [<Badge color="green">Tudom</Badge>, 'Beleszámít a haladásba és a dashboard %-ba — ha egy szót valóban ismersz, ezt jelöld'],
                                    [<Badge color="blue">Tanulom</Badge>, 'Aktívan tanulod — emlékeztetőként jelölöd meg, pl. flashcard mellé'],
                                    [<Badge color="orange">Mentett</Badge>, 'Elmentetted, de még nem foglalkozol vele — "majd egyszer" lista'],
                                    [<Badge color="purple">Kiejtés</Badge>, 'A jelentést tudod, de a kiejtést kell még begyakorolni'],
                                ]}
                            />
                        </Sub>

                        <Sub title="Mappák">
                            <P>
                                Saját tematikus mappákat hozhatsz létre (pl. "Üzleti szavak", "Utazás") és szavakat
                                rendelhetsz hozzájuk. Egy szó több mappában is szerepelhet. A szólistát mappára szűrheted.
                            </P>
                        </Sub>

                        <Sub title="Saját szavak hozzáadása">
                            <P>
                                Ha egy szó nincs az adatbázisban, felveheted saját szóként. Megadhatod a jelentést,
                                példamondatot, ragozási alakokat — ugyanúgy működik, mint a beépített szavak.
                            </P>
                            <InfoBox type="tip">
                                A Chrome bővítménnyel az Alt+W keresőből közvetlenül hozzáadhatod az ismeretlen szavakat,
                                az AI-os automatikus kitöltéssel.
                            </InfoBox>
                        </Sub>

                        <Sub title={<span className="flex items-center gap-2">AI szótár (Gemini) <PremiumBadge /></span> as unknown as string}>
                            <P>
                                A szó oldalán a lila Gemini gombra kattintva az AI automatikusan kitölti
                                a magyar jelentést, szinonimákat, ragozási alakokat és egy példamondatot.
                                Prémium funkció.
                            </P>
                        </Sub>
                    </Section>

                    {/* ── Flashcards ── */}
                    <Section id="flashcards" title="Flashcards" icon={Brain}>
                        <P>
                            A flashcard rendszer a TopWords magja. Saját kártyacsomagokat (decket) hozhatsz létre,
                            minden kártya két oldalból áll, és az SRS algoritmus automatikusan ütemezi az ismétléseket.
                        </P>

                        <Sub title="Deck létrehozása">
                            <Steps items={[
                                'A Flashcards főoldalán kattints az "Új deck" gombra.',
                                'Adj meg nevet (kötelező) és opcionálisan leírást.',
                                'Hozzárendelheted egy mappához is — ez segít az átláthatóságban, ha sok decked van.',
                            ]} />
                        </Sub>

                        <Sub title="Kártyák hozzáadása">
                            <Table
                                headers={['Módszer', 'Mikor használd?']}
                                rows={[
                                    ['Kézi szerkesztő', 'Saját mondatoknál, képeknél, speciális formázásnál — teljes Rich Text szerkesztő'],
                                    ['Szó importálás', 'Ha már megvan a szó az adatbázisban: keresd meg és egy kattintással importálod'],
                                    ['CSV import', 'Ha sok kártyát szeretnél egyszerre feltölteni — Anki exportok is működnek'],
                                ]}
                            />
                            <InfoBox type="tip">
                                CSV importhoz az első oszlop az előlap, a második a hátlap. Anki .apkg exportból
                                a "Notes as CSV" opcióval tudod kinyerni.
                            </InfoBox>
                        </Sub>

                        <Sub title="CSV import — irányválasztás">
                            <P>
                                Fájl kiválasztása után megjelenik egy dialóg, ahol megadhatod az tanulás irányát:
                            </P>
                            <Table
                                headers={['Irány', 'Magyarázat']}
                                rows={[
                                    ['Elölap → Hátlap', 'Pl. angol szó látszik, a magyar fordítást kell felidézni (alapértelmezett)'],
                                    ['Hátlap → Elölap', 'Fordított irány — pl. magyar szóból kell az angolt'],
                                    ['Mindkét irány',   'Az algoritmus mindkét irányból kérdez — kétszer annyi munka, kétszer annyira hatékony'],
                                ]}
                            />
                        </Sub>

                        <Sub title="Kártya szerkesztő">
                            <Ul items={[
                                <>Előlap és hátlap Rich Text szerkesztőben — formázás, kép, hang beágyazható.</>,
                                <>Hang (TTS): minden oldalhoz megadható egy szöveg, amelyet tanulás közben felolvas.</>,
                                <>Irány: beállítható kártyánként — lehet front_to_back, back_to_front vagy mindkettő.</>,
                                <>Szín: a kártya bal szegélyének kiemelő színe — hasznos ha témák szerint csoportosítasz.</>,
                            ]} />
                        </Sub>

                        <Sub title={<span className="flex items-center gap-2">Gemini AI kitöltés <PremiumBadge /></span> as unknown as string}>
                            <P>
                                Írd be az angol szót az előlapra, majd kattints a lila "Generálás" gombra.
                                A Gemini AI kitölti a hátlapot (magyar fordítás, példamondat) — az előlap
                                változatlan marad, így a saját szövegedet nem írja felül. Prémium funkció.
                            </P>
                        </Sub>

                        <Sub title="Kalibráció (CSV import után)">
                            <P>
                                Tömeges importnál az alkalmazás felajánlja a kalibrálást: egyenként megmutatja
                                a kártyákat, te értékeled mennyre ismered. Ez megakadályozza, hogy 1 000 kártyán
                                nulláról kelljen kezdeni — a már ismert kártyák azonnal hosszabb intervallumon indulnak.
                            </P>
                            <Table
                                headers={['Értékelés', 'Hatás']}
                                rows={[
                                    ['Nem tudom (1)', 'Normál új kártyaként kerül a tanulási sorba'],
                                    ['Valamennyire (2)', 'Kb. 3–7 napon belül fog megjelenni'],
                                    ['Tudom (3)', 'Kb. 1–3 héten belül jelenik meg'],
                                    ['Jól tudom (4)', 'Kb. 3–7 héten belül jelenik meg'],
                                ]}
                            />
                            <InfoBox type="tip">
                                A kalibrálást bármikor megszakíthatod és később folytathatod — a már értékelt
                                kártyák nem jelennek meg újra. A "Végleg kihagyás" gomb az összes maradék kártyát
                                azonnal a normál tanulási sorba teszi.
                            </InfoBox>
                        </Sub>

                        <Sub title="Tanulási munkamenet">
                            <Steps items={[
                                'A deck főoldalán kattints a "Tanulás" gombra — csak akkor aktív, ha van esedékes kártya.',
                                'Megjelenik az előlap — próbáld felidézni a választ.',
                                'A "Mutatás" gombra (vagy szóközzel) a hátlap is láthatóvá válik.',
                                'Értékeld a felidézést: Újra / Nehéz / Jó / Könnyű.',
                                'Az algoritmus a választásod alapján ütemezi a következő megjelenést.',
                            ]} />
                            <InfoBox type="tip">
                                Az Undo gombbal visszavonhatod az utolsó értékelést, ha elütötted.
                            </InfoBox>
                        </Sub>

                        <Sub title="Értékelési gombok">
                            <Table
                                headers={['Gomb', 'Mikor nyomd?', 'Hatás']}
                                rows={[
                                    ['Újra', 'Egyáltalán nem tudtad', 'Visszakerül a sorba, pár percen belül ismét megjelenik'],
                                    ['Nehéz', 'Tudtad, de sokat gondolkodtál', 'Kicsit hosszabb mint "Újra", az ease csökken'],
                                    ['Jó', 'Felidézted rendesen', 'Normál SRS ugrás — általában ezt nyomkod leggyakrabban'],
                                    ['Könnyű', 'Teljesen automatikusan jött', 'Nagyobb intervallum + ease növekszik'],
                                ]}
                            />
                        </Sub>
                    </Section>

                    {/* ── SRS ── */}
                    <Section id="srs" title="SRS algoritmus" icon={GitBranch}>
                        <P>
                            Az SRS (Spaced Repetition System) mögött az az alapelv áll, hogy egy szót
                            pontosan akkor érdemes ismételni, amikor épp el akarnád felejteni.
                            Ez a módszer – tudományos kísérletek alapján – akár 5–10× hatékonyabb,
                            mint a hagyományos "minden nap ugyanazokat olvasom" megközelítés.
                        </P>

                        <Sub title="Kártya állapotok">
                            <Table
                                headers={['Állapot', 'Mit jelent?']}
                                rows={[
                                    [<Badge color="blue">Új</Badge>, 'Még soha nem tanult kártya — a napi "új kártyák" limit szerint kerül sorra'],
                                    [<Badge color="orange">Tanulás</Badge>, 'Épp most tanulja az algoritmus — rövid időközökkel ismétlődik (percek, akár órák)'],
                                    [<Badge color="green">Ismétlés</Badge>, 'Elvégezte a tanulási lépéseket — napokban, hetekben mért intervallumok'],
                                    [<Badge>Újratanulás</Badge>, 'Korábban tudta, de "Újra"-t kapott — visszakerül a tanulási lépésekbe'],
                                ]}
                            />
                        </Sub>

                        <Sub title="Hogyan számítja az intervallumot?">
                            <P>
                                Minden kártyának van egy <strong>ease factor</strong> értéke (alapból 250%).
                                Ismétlés állapotban:
                            </P>
                            <Table
                                headers={['Értékelés', 'Következő intervallum (közelítő)']}
                                rows={[
                                    ['Újra', 'Visszaesik tanulásba, majd a tévesztési intervallum % szerint indul újra'],
                                    ['Nehéz', 'régi × hard_modifier (alap 120%) — az ease csökken 15-tel'],
                                    ['Jó', 'régi × ease × interval_modifier (alap 100%)'],
                                    ['Könnyű', 'jó_intervallum × easy_bonus (alap 130%) — az ease nő 15-tel'],
                                ]}
                            />
                        </Sub>

                        <Sub title="Tanulási lépések">
                            <P>
                                Mielőtt egy kártya "végez" (graduating) és bekerül az ismétlési fázisba,
                                végig kell mennie a tanulási lépéseken. Alapértelmezés: 1 perc → 10 perc.
                            </P>
                            <Ul items={[
                                'Újra: visszaesik az első lépésre',
                                'Jó: továbblép a következő lépésre; az utolsó lépésnél "végez" és elkerül az ismétlési fázisba',
                                'Könnyű: azonnal végez, az easy_interval-on (alap 4 nap) kerül ismétlésre',
                            ]} />
                        </Sub>

                        <Sub title="Leech — nehéz kártyák">
                            <P>
                                Ha egy kártya eléri a leech küszöböt (alap 8 tévesztés), megkapja a "leech"
                                jelzést. Ez azt jelzi, hogy az adott kártya különlegesen nehéz neked —
                                érdemes átgondolni az emlékezési stratégiát: kép, mnemonika, kontextus hozzáadása.
                            </P>
                        </Sub>
                    </Section>

                    {/* ── Deck beállítások ── */}
                    <Section id="deck-settings" title="Deck beállítások" icon={Settings2}>
                        <P>
                            Minden decknek saját beállítása lehet, amely felülírja a globális SRS paramétereket.
                            A beállítások dialóg a deck oldalán a "Beállítások" gombbal érhető el.
                        </P>
                        <InfoBox>
                            Ha nincs egyéni deck beállítás, az algoritmus a globális (Beállítások → Flashcard beállítások)
                            értékeket használja. Ha az sincs, a rendszer alapértékei érvényesek.
                        </InfoBox>

                        <Sub title="Gyors előbeállítások">
                            <P>
                                A beállítások tetején három előbeállítást találsz: <strong>Lassú</strong> (kevés kártya naponta, lazább haladás),
                                <strong>Normál</strong> (alapértelmezett), <strong>Gyors</strong> (sok kártya, rövidebb intervallumok).
                                Ezek csak kiindulópontok — utána bármit finomhangolhatsz.
                            </P>
                        </Sub>

                        <Sub title="Napi korlátok">
                            <Table
                                headers={['Beállítás', 'Alap', 'Mit állít?']}
                                rows={[
                                    ['Új kártyák / nap', '20', 'Hány ismeretlen kártya kerüljön be naponta — ne emeld túl magasra, hogy ne fulladj meg'],
                                    ['Max ismétlések / nap', '200', 'Legfeljebb hány esedékes kártyát mutasson — ha itt vagy, a tanulás véget ér aznap'],
                                ]}
                            />
                        </Sub>

                        <Sub title="Tanulási lépések">
                            <Table
                                headers={['Beállítás', 'Alap', 'Mit állít?']}
                                rows={[
                                    ['Tanulási lépések', '1, 10 perc', 'Percek sorozata, amelyen az új kártya végigmegy; adj hozzá pl. "1 óra"-t a jobb bevéséshez'],
                                    ['Végzési intervallum', '1 nap', 'Az utolsó tanulási lépés után hány napra kerül ismétlésre'],
                                    ['Könnyű intervallum', '4 nap', 'Ha tanulás közben "Könnyű"-t kap, azonnal ennyire ugrik'],
                                ]}
                            />
                        </Sub>

                        <Sub title="Ease és intervallum szorzók">
                            <Table
                                headers={['Beállítás', 'Alap', 'Mit állít?']}
                                rows={[
                                    ['Kezdő ease', '250%', 'Milyen szorzóval indul a kártya a végzés pillanatában'],
                                    ['Könnyű bónusz', '130%', '"Könnyű"-nél az intervallum extra szorzója az ease-en felül'],
                                    ['Nehéz szorzó', '120%', '"Nehéz"-nél az intervallum szorzója'],
                                    ['Intervallum módosító', '100%', 'Globális szorzó — 80%-ra állítva 20%-kal sűrűbb az ismétlés'],
                                    ['Max intervallum', '365 nap', 'Ennél hosszabb intervallum soha nem keletkezhet'],
                                ]}
                            />
                        </Sub>

                        <Sub title="Tévesztés beállítások">
                            <Table
                                headers={['Beállítás', 'Alap', 'Mit állít?']}
                                rows={[
                                    ['Tévesztés utáni intervallum', '0%', 'Tévesztés után az előző intervallum hány %-ából indul újra (0% = 1 napról)'],
                                    ['Leech küszöb', '8', 'Ennyi tévesztés után kap a kártya "leech" jelzést'],
                                ]}
                            />
                        </Sub>
                    </Section>

                    {/* ── Szövegelemzés ── */}
                    <Section id="szovegelemzes" title="Szövegelemzés" icon={FileText}>
                        <P>
                            A szövegelemzés megmutatja, hogy egy adott szövegben az összes szó hány százalékát
                            ismered. Az ismeretlen szavakat kiemeli, és lehetőséget ad azok azonnali megtanulására.
                        </P>

                        <Sub title="Szöveg forrásai">
                            <Table
                                headers={['Forrás', 'Hogyan?']}
                                rows={[
                                    ['Beillesztett szöveg', 'Másold be a szöveget közvetlenül (max. 15 000 karakter)'],
                                    ['Weblap URL', 'Add meg az URL-t — az alkalmazás letölti és feldolgozza a szöveget'],
                                    ['YouTube URL', 'A videó angol feliratát automatikusan kinyeri és elemzi'],
                                    ['Könyv (PDF/EPUB)', 'Feltöltés után oldalankénti navigáció érhető el'],
                                ]}
                            />
                        </Sub>

                        <Sub title="Mit látsz az elemzés után?">
                            <Ul items={[
                                'A szöveg szavanként kiemelve: zöld = tudod, kék = tanulod, szürke = ismeretlen',
                                'Jobb oldalon a leggyakoribb ismeretlen szavak listája',
                                'Egy szóra kattintva megjelenik a fordítása és az aktuális státusza',
                                'Közvetlenül innen hozzáadhatsz státuszt és flashcard kártyát',
                                'A megértési % mutatja, az összes szóhossz hány %-át fedik az ismert szavak',
                            ]} />
                        </Sub>

                        <Sub title={<span className="flex items-center gap-2">AI kontextus magyarázat <PremiumBadge /></span> as unknown as string}>
                            <P>
                                Egy szó részleteinél a Gemini gombra kattintva az AI megmagyarázza,
                                mit jelent a szó <em>pontosan abban a mondatban</em> — nem általánosságban,
                                hanem ahogy az adott szövegkörnyezetben használják. Prémium funkció.
                            </P>
                        </Sub>

                        <Sub title="Könyvek kezelése">
                            <Ul items={[
                                'Feltöltött könyv baloldalon jelenik meg a könyvtárban',
                                'Oldalankénti navigáció nyilakkal vagy lapszám beírásával',
                                'Tárhelykorlát: Alap csomagon 3 könyv / 30 MB, Prémiumon 5 könyv / 30 MB',
                                'Bármikor törölheted a könyvet — a tárhelyed felszabadul',
                            ]} />
                        </Sub>
                    </Section>

                    {/* ── Kvíz ── */}
                    <Section id="kviz" title="Kvíz" icon={HelpCircle}>
                        <P>
                            A kvíz gyors szókincstesztet biztosít: az alkalmazás szavakat választ ki a szótárból
                            és négy válaszlehetőséget kínál.
                        </P>
                        <Ul items={[
                            'Szűrheted szintre, státuszra vagy mappára — csak azzal a szócsoporttal tesztelj, amire fókuszálsz',
                            'Kérdéstípusok: EN→HU és HU→EN fordítás, vegyesen',
                            'A befejezésekor megtekintheted az elrontott szavakat',
                            'Az eredmény beleszámít a teljesítmény-statisztikákba',
                        ]} />
                    </Section>

                    {/* ── Mondatkiegészítés ── */}
                    <Section id="cloze" title="Mondatkiegészítés" icon={Zap}>
                        <P>
                            A mondatkiegészítés (cloze) feladatban valós példamondatokból hiányzik egy szó —
                            neked kell beírni. Ez az egyik leghatékonyabb tanulási technika, mert a szót
                            kontextusban kell felidézni, nem csak felismerni.
                        </P>
                        <Ul items={[
                            'A hiányzó szó helyét jelzés mutatja, a betűk száma is látható segítségként',
                            'Szűrheted szintre: csak az adott nehézségi fokból kap feladatot',
                            'Megoldás után látod a helyes szót és a fordítást',
                        ]} />
                    </Section>

                    {/* ── Rendhagyó igék ── */}
                    <Section id="irregular" title="Rendhagyó igék" icon={GitBranch}>
                        <P>
                            A modul a leggyakoribb szabálytalan angol igék három alakját gyakoroltatja:
                            infinitive (alapalak), past simple (múlt idő), past participle (befejezett melléknévi igenév).
                        </P>
                        <Ul items={[
                            'Kártyaszerű megjelenítés — forgasd a kártyát, ha ismered az igét',
                            'Szűrheted nehézségi szint alapján',
                            'Beépített példamondatok segítik a kontextusos megjegyzést',
                            'Kvíz mód: add meg a három alakot és ellenőrzöm az eredményt',
                        ]} />
                    </Section>

                    {/* ── Teljesítmények ── */}
                    <Section id="teljesitmenyek" title="Teljesítmények" icon={Award}>
                        <P>
                            A teljesítmény rendszer érmekkel jutalmaz a haladásodért —
                            motivációt ad és vizuálisan mutatja, mennyit fejlődtél.
                        </P>
                        <Table
                            headers={['Kategória', 'Mire kapsz érmet?']}
                            rows={[
                                ['Szótanulás', 'X db szó "Tudom" státuszra állítása (50, 200, 500, 1 000...)'],
                                ['Streak', 'Egymást követő napok száma (7, 30, 100 nap...)'],
                                ['Kvíz', 'Elvégzett kvízek száma és tökéletes eredmények'],
                                ['Szövegelemzés', 'Elemzett szövegek száma'],
                                ['Flashcard', 'Tanult kártyák száma és befejezett munkamenetek'],
                            ]}
                        />
                        <P>Az érem megszerzésekor egy értesítő jelenik meg az alkalmazásban.</P>
                    </Section>

                    {/* ── Chrome bővítmény ── */}
                    <Section id="extension" title="Chrome bővítmény" icon={Chrome}>
                        <P>
                            A TopWords Chrome bővítménnyel bármely weboldalon azonnal megnézheted egy szó
                            fordítását — anélkül, hogy el kellene hagynod az oldalt, amit épp olvasol.
                        </P>

                        <Sub title="Telepítés">
                            <Steps items={[
                                <>Keresd meg a Chrome Web Store-ban: <strong>TopWords – English Vocabulary</strong>, vagy kattints a lenti gombra.</>,
                                'Kattints a "Hozzáadás Chrome-hoz" gombra — egy másodperc alatt kész.',
                                <>Klikkelj a puzzle ikonra a Chrome eszköztáron, majd a <strong>TopWords</strong> melletti rajzszög ikonra, hogy kitűzd.</>,
                                'Kész — a bővítmény automatikusan felismeri, hogy be vagy-e jelentkezve a TopWords-be.',
                            ]} />
                            <div className="mt-3">
                                <a
                                    href="https://chrome.google.com/webstore"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                                >
                                    <Chrome className="size-4" />
                                    Megnyitás Chrome Web Store-ban
                                </a>
                            </div>
                        </Sub>

                        <Sub title="Szókeresés dupla kattintással">
                            <P>
                                Ha egy weboldalon duplán kattintasz egy szóra és nyomva tartod egy pillanatot,
                                megjelenik egy kis popup az azonnali fordítással.
                            </P>
                            <Ul items={[
                                'Látod a szó magyar fordítását és szófaját',
                                'Ha már van státusza (pl. "Tanulom"), az is megjelenik',
                                'A 🔊 gombra kattintva meghallgatod a kiejtést',
                                '1–4 billentyűkkel gyorsan beállíthatod a státuszt (ha be vagy jelentkezve)',
                            ]} />
                        </Sub>

                        <Sub title="Alt+W keresőpaletta">
                            <P>
                                Az <kbd className="rounded border px-1.5 py-0.5 text-xs font-mono">Alt+W</kbd> billentyűkombinációval
                                bármikor megnyílik egy gyors keresőablak.
                            </P>
                            <Ul items={[
                                'Keress bármely szóra a TopWords szótárban',
                                'Ha nincs az adatbázisban, egy kattintással hozzáadhatod saját szóként',
                                <>Az <strong>"✨ AI kitöltés"</strong> gombbal a Gemini automatikusan kitölti a jelentést, szinonimákat és ragozást — azonnal hozzáadhatod</>,
                                'Státuszokat közvetlenül innen is kezelhetsz',
                            ]} />
                            <InfoBox type="tip">
                                Ha egy szót kijelölsz az oldalon, majd megnyomod az Alt+W-t, a keresőbe
                                automatikusan bekerül a kijelölt szó.
                            </InfoBox>
                        </Sub>

                        <Sub title="Oldalon lévő szavak kiemelése">
                            <P>
                                A bővítmény képes aláhúzni az oldalon az összes szót, amelyhez van státuszod —
                                így azonnal látod, mit tanultál már és mit nem.
                            </P>
                            <Table
                                headers={['Szín', 'Státusz']}
                                rows={[
                                    [<span className="font-medium" style={{borderBottom:'2px solid #22c55e'}}>zöld aláhúzás</span>, 'Tudom'],
                                    [<span className="font-medium" style={{borderBottom:'2px solid #3b82f6'}}>kék aláhúzás</span>, 'Tanulom'],
                                    [<span className="font-medium" style={{borderBottom:'2px solid #f97316'}}>narancs aláhúzás</span>, 'Mentett'],
                                    [<span className="font-medium" style={{borderBottom:'2px solid #8b5cf6'}}>lila aláhúzás</span>, 'Kiejtés'],
                                ]}
                            />
                            <P>A kiemelést a bővítmény popup-jából kapcsolhatod be/ki.</P>
                        </Sub>

                        <Sub title="Bejelentkezés">
                            <P>
                                A bővítmény a böngésző meglévő TopWords bejelentkezésedet használja —
                                külön belépés nem szükséges. Ha ki vagy jelentkezve, a popup tájékoztat és
                                átirányít a bejelentkezési oldalra.
                            </P>
                        </Sub>

                        <InfoBox type="info">
                            <strong>Kompatibilitás:</strong> A bővítmény Chrome 88+ és Chromium alapú böngészőkben
                            (Edge, Brave, Arc) is működik.
                        </InfoBox>
                    </Section>

                </div>
            </div>
        </>
    );
}

Guide.layout = {
    breadcrumbs: [{ title: 'Kézikönyv', href: '/guide' }],
};
