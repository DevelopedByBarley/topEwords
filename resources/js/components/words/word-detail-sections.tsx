import { Volume2 } from 'lucide-react';
import { speak } from '@/components/words/word-config';

/**
 * A részletező kártyák által megjelenített szóadat. Szándékosan strukturális
 * (nem `Word | CustomWord`): ugyanezt a nézetet kapja a szólista fő szava, a
 * saját szó és a szövegelemző lookup-találata is, és ezek külön típusok.
 */
export interface WordDetailData {
    word: string;
    meaning_hu: string | null;
    extra_meanings?: string | null;
    synonyms?: string | null;
    form_base?: string | null;
    verb_past?: string | null;
    verb_past_participle?: string | null;
    verb_present_participle?: string | null;
    verb_third_person?: string | null;
    noun_plural?: string | null;
    adj_comparative?: string | null;
    adj_superlative?: string | null;
    extra_forms?: string | null;
    example_en?: string | null;
    example_hu?: string | null;
}

interface WordDetailSectionsProps {
    data: WordDetailData;
    /**
     * Fordított kártya (szólista „flip" mód): a fejlécben a magyar jelentés áll,
     * ezért a jelentés-kártya az angol szót mutatja felolvasás-gombbal.
     */
    flipMode?: boolean;
}

/**
 * Egy szó részletei: jelentés, alakok, szinonimák, példamondat.
 *
 * A szólista két részletező modálja és a szövegelemző lookup-dialógusa
 * ugyanezt a nézetet rendereli — a felhasználó ugyanazt a szót ugyanolyan
 * bontásban látja, akárhonnan nyitja meg. Korábban három, egymástól elcsúszott
 * másolat élt (a szövegelemzőben csak a jelentés + egy példamondat), ezért az
 * alakok és a további jelentések ott láthatatlanok voltak.
 *
 * Csak megjelenítés: a státusz, a fontosság és az AI-panelek a hívó dolga,
 * mert mindhárom felület más végponton írja őket.
 */
export default function WordDetailSections({
    data,
    flipMode = false,
}: WordDetailSectionsProps) {
    const baseForm = data.form_base || data.word;

    const verbForms = (
        [
            { label: 'Alap', value: baseForm },
            { label: 'Múlt idő', value: data.verb_past },
            { label: 'Befejezett igenév', value: data.verb_past_participle },
            { label: 'Folyamatos (-ing)', value: data.verb_present_participle },
            { label: 'E/3 jelen', value: data.verb_third_person },
        ] as const
    ).filter(({ value }) => value);

    const grades = (
        [
            { label: 'Alapfok', value: baseForm },
            { label: 'Középfok', value: data.adj_comparative },
            { label: 'Felsőfok', value: data.adj_superlative },
        ] as const
    ).filter(({ value }) => value);

    const synonyms = (data.synonyms ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    return (
        <>
            {/* Jelentés */}
            <div className="rounded-xl border bg-card px-4 py-3.5">
                <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                    {flipMode ? 'Angol' : 'Magyar jelentés'}
                </p>
                {flipMode ? (
                    <p className="flex items-center gap-2 text-lg font-semibold">
                        {data.word}
                        <button
                            onClick={() => speak(data.word)}
                            title="Felolvasás"
                            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                        >
                            <Volume2 className="size-3.5" />
                        </button>
                    </p>
                ) : data.meaning_hu ? (
                    <>
                        <p className="text-lg leading-snug font-semibold">
                            {data.meaning_hu}
                        </p>
                        {data.extra_meanings && (
                            <p className="mt-1 text-sm text-muted-foreground">
                                {data.extra_meanings}
                            </p>
                        )}
                    </>
                ) : (
                    <p className="text-muted-foreground italic">
                        Nincs fordítás megadva
                    </p>
                )}
            </div>

            {/* Igealakok — a szófajtól függetlenül látszik, ha a szó hordoz
                igealakot (pl. "interest" főnév + ige) */}
            {data.verb_past && (
                <div className="rounded-xl border bg-card px-4 py-3.5">
                    <p className="mb-3 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                        Igealakok
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {verbForms.map(({ label, value }) => (
                            <div
                                key={label}
                                className="rounded-lg bg-muted/50 px-3 py-2"
                            >
                                <p className="text-[10px] text-muted-foreground">
                                    {label}
                                </p>
                                <p className="font-semibold">{value}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Képzett alakok (extra_forms): azonos tövű, más szófajú alakok —
                ezekre a szövegelemzés és a bővítmény is ehhez a szóhoz köti a státuszt. */}
            {data.extra_forms && (
                <div className="rounded-xl border bg-card px-4 py-3.5">
                    <p className="mb-3 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                        Képzett alakok
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        {data.extra_forms.split('/').map((form) => (
                            <span
                                key={form}
                                className="rounded-lg bg-muted/50 px-3 py-2 font-semibold"
                            >
                                {form.trim()}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Többes szám — szófajtól függetlenül, ha van adat */}
            {data.noun_plural && (
                <div className="rounded-xl border bg-card px-4 py-3.5">
                    <p className="mb-3 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                        Többes szám
                    </p>
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-muted/50 px-3 py-2">
                            <p className="text-[10px] text-muted-foreground">
                                Egyes szám
                            </p>
                            <p className="font-semibold">{baseForm}</p>
                        </div>
                        <span className="text-muted-foreground">→</span>
                        <div className="rounded-lg bg-muted/50 px-3 py-2">
                            <p className="text-[10px] text-muted-foreground">
                                Többes szám
                            </p>
                            <p className="font-semibold">{data.noun_plural}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Fokozás — szófajtól függetlenül, ha van adat */}
            {(data.adj_comparative || data.adj_superlative) && (
                <div className="rounded-xl border bg-card px-4 py-3.5">
                    <p className="mb-3 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                        Fokozás
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        {grades.map(({ label, value }, i) => (
                            <div
                                key={label}
                                className="flex items-center gap-2"
                            >
                                {i > 0 && (
                                    <span className="text-muted-foreground">
                                        →
                                    </span>
                                )}
                                <div className="rounded-lg bg-muted/50 px-3 py-2">
                                    <p className="text-[10px] text-muted-foreground">
                                        {label}
                                    </p>
                                    <p className="font-semibold">{value}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Szinonimák */}
            {synonyms.length > 0 && (
                <div>
                    <p className="mb-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                        Szinonimák
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {synonyms.map((s) => (
                            <span
                                key={s}
                                className="rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-medium"
                            >
                                {s}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Példamondat */}
            {(data.example_en || data.example_hu) && (
                <div className="rounded-xl border-l-4 border-primary/40 bg-muted/30 px-4 py-3.5">
                    <p className="mb-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                        Példamondat
                    </p>
                    {data.example_en && (
                        <p className="text-sm font-medium italic">
                            "{data.example_en}"
                        </p>
                    )}
                    {data.example_hu && (
                        <p className="mt-1 text-sm text-muted-foreground">
                            "{data.example_hu}"
                        </p>
                    )}
                </div>
            )}
        </>
    );
}
