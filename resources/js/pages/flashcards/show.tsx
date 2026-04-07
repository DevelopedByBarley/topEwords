import { Form, Head, Link, router, usePage } from '@inertiajs/react';
import { BookOpen, Copy, Download, Edit2, FileUp, Import, Loader2, MoreHorizontal, MoveRight, Plus, RotateCcw, Search, Settings2, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { type RichTextEditorHandle } from '@/components/ui/rich-text-editor';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { RichTextContent, RichTextEditor } from '@/components/ui/rich-text-editor';
import { Separator } from '@/components/ui/separator';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { bulkDelete as bulkDeleteCards, bulkMove as bulkMoveCards, bulkReset as bulkResetCards, destroy as destroyCard, duplicate as duplicateCard, importMethod as importFromWord, move as moveCard, reset as resetProgress, store as storeCard, update as updateCard } from '@/routes/flashcards/cards';
import { exportMethod as csvExport, importMethod as csvImport } from '@/routes/flashcards/csv';
import { index, show, study } from '@/routes/flashcards';
import { destroy as destroyDeckSettings, update as updateDeckSettings } from '@/routes/flashcards/settings';
import { search as searchWords } from '@/routes/words';
import InputError from '@/components/input-error';

type Review = {
    state: 'new' | 'learning' | 'review' | 'relearning';
    interval: number;
    lapses: number;
    is_leech: boolean;
    due_at: string | null;
};

type Flashcard = {
    id: number;
    front: string;
    front_notes: string | null;
    front_speak: string | null;
    back: string;
    back_notes: string | null;
    back_speak: string | null;
    direction: 'front_to_back' | 'back_to_front' | 'both';
    color: string | null;
    word_id: number | null;
    review: Review | null;
};

type Deck = {
    id: number;
    name: string;
    description: string | null;
};

type OtherDeck = { id: number; name: string };

type DeckSettings = {
    new_cards_per_day: number;
    max_reviews_per_day: number;
    learning_steps: number[];
    graduating_interval: number;
    easy_interval: number;
    starting_ease: number;
    easy_bonus: number;
    hard_interval_modifier: number;
    interval_modifier: number;
    max_interval: number;
    lapse_new_interval: number;
    leech_threshold: number;
    shuffle_cards: boolean;
} | null;

const DEFAULT_SETTINGS: NonNullable<DeckSettings> = {
    new_cards_per_day: 20,
    max_reviews_per_day: 200,
    learning_steps: [1, 10],
    graduating_interval: 1,
    easy_interval: 4,
    starting_ease: 250,
    easy_bonus: 130,
    hard_interval_modifier: 120,
    interval_modifier: 100,
    max_interval: 365,
    lapse_new_interval: 0,
    leech_threshold: 8,
    shuffle_cards: false,
};

function SettingField({
    id, label, description, name, defaultValue, min, max, error, suffix,
}: {
    id: string; label: string; description?: string; name: string;
    defaultValue: number; min?: number; max?: number; error?: string; suffix?: string;
}) {
    return (
        <div className="grid gap-1.5">
            <Label htmlFor={id}>{label}</Label>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
            <div className="flex items-center gap-2">
                <Input id={id} type="number" name={name} defaultValue={defaultValue} min={min} max={max} className="w-28" />
                {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
            </div>
            <InputError message={error} />
        </div>
    );
}

function DeckSettingsDialog({ deck, deckSettings, open, onClose }: {
    deck: Deck;
    deckSettings: DeckSettings;
    open: boolean;
    onClose: () => void;
}) {
    const hasCustom = deckSettings !== null;
    const s = deckSettings ?? DEFAULT_SETTINGS;
    const [steps, setSteps] = useState<number[]>(s.learning_steps);

    const addStep = () => setSteps((prev) => [...prev, 10]);
    const removeStep = (i: number) => setSteps((prev) => prev.filter((_, idx) => idx !== i));
    const updateStep = (i: number, val: number) =>
        setSteps((prev) => prev.map((step, idx) => (idx === i ? val : step)));

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="sm:max-w-2xl w-[calc(100vw-2rem)] max-h-[92vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Settings2 className="size-4" />
                        Deck beállítások
                        {hasCustom && (
                            <span className="ml-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">egyéni</span>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <Form
                    action={updateDeckSettings(deck.id)}
                    options={{ preserveScroll: true, onSuccess: onClose }}
                    className="space-y-6 pt-2"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="space-y-4">
                                <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Napi korlátok</h4>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <SettingField
                                        id="ds_new" label="Új kártyák / nap"
                                        description="Hány új kártyát mutasson ebből a deckből naponta (pl. 20)"
                                        name="new_cards_per_day" defaultValue={s.new_cards_per_day} min={1} max={9999} error={errors.new_cards_per_day} suffix="db"
                                    />
                                    <SettingField
                                        id="ds_rev" label="Max ismétlések / nap"
                                        description="Esedékes (már tanult) kártyák maximuma naponta (pl. 200)"
                                        name="max_reviews_per_day" defaultValue={s.max_reviews_per_day} min={1} max={9999} error={errors.max_reviews_per_day} suffix="db"
                                    />
                                </div>
                            </div>

                            <Separator />

                            <div className="space-y-3">
                                <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Tanulási lépések</h4>
                                <p className="text-xs text-muted-foreground">
                                    Percek sorozata, amelyen az új kártya végigmegy, mielőtt „végez" és ismétlési fázisba kerül.
                                    Pl. <span className="font-medium">1 → 10</span> perc: először 1 perccel, ha jó, 10 perccel kerül visszatesztelésre.
                                </p>
                                <div className="flex flex-wrap gap-2 items-center">
                                    {steps.map((step, i) => (
                                        <div key={i} className="flex items-center gap-1">
                                            <Input type="number" name="learning_steps[]" value={step} onChange={(e) => updateStep(i, Number(e.target.value))} min={1} max={1440} className="w-20" />
                                            <span className="text-xs text-muted-foreground">perc</span>
                                            {steps.length > 1 && (
                                                <button type="button" onClick={() => removeStep(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                                                    <X className="size-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <Button type="button" variant="outline" size="sm" onClick={addStep}>
                                        <Plus className="size-3.5 mr-1" />
                                        Lépés
                                    </Button>
                                </div>
                                <InputError message={errors['learning_steps']} />
                            </div>

                            <Separator />

                            <div className="space-y-4">
                                <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Végzés & intervallumok</h4>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <SettingField
                                        id="ds_grad" label="Végzési intervallum"
                                        description='Hány napra kerül a kártya ismétlésre, ha „Jó"-t kap az utolsó tanulási lépésnél (pl. 1 nap)'
                                        name="graduating_interval" defaultValue={s.graduating_interval} min={1} max={365} error={errors.graduating_interval} suffix="nap"
                                    />
                                    <SettingField
                                        id="ds_easy" label="Könnyű intervallum"
                                        description='Ha tanulás közben „Könnyű"-t kapsz, azonnal ennyi napra ugrik (pl. 4 nap)'
                                        name="easy_interval" defaultValue={s.easy_interval} min={1} max={365} error={errors.easy_interval} suffix="nap"
                                    />
                                    <SettingField
                                        id="ds_max" label="Max intervallum"
                                        description="Két ismétlés közt maximálisan ennyi nap telhet el, még ha az algoritmus többet is számolna (pl. 365 nap)"
                                        name="max_interval" defaultValue={s.max_interval} min={1} max={36500} error={errors.max_interval} suffix="nap"
                                    />
                                    <SettingField
                                        id="ds_ease" label="Kezdő ease"
                                        description="Milyen szorzóval indul a kártya végzéskor (250 = 2,5×). Befolyásolja, mennyire nő az intervallum ismétlésenként."
                                        name="starting_ease" defaultValue={s.starting_ease} min={130} max={999} error={errors.starting_ease} suffix="%"
                                    />
                                    <SettingField
                                        id="ds_bonus" label="Könnyű bónusz"
                                        description='„Könnyű" értékeléskor az intervallum extra szorzója az ease-en felül (130 = 1,3×, tehát 30%-kal hosszabb)'
                                        name="easy_bonus" defaultValue={s.easy_bonus} min={100} max={999} error={errors.easy_bonus} suffix="%"
                                    />
                                    <SettingField
                                        id="ds_hard" label="Nehéz szorzó"
                                        description='„Nehéz" értékeléskor az intervallum szorzója (120 = 1,2×). Az ease csökken, az intervallum kicsit nő.'
                                        name="hard_interval_modifier" defaultValue={s.hard_interval_modifier} min={100} max={999} error={errors.hard_interval_modifier} suffix="%"
                                    />
                                    <SettingField
                                        id="ds_mod" label="Intervallum módosító"
                                        description="Globális szorzó minden kiszámolt intervallumra (100 = nincs változás, 80 = 20%-kal rövidebb intervallumok)"
                                        name="interval_modifier" defaultValue={s.interval_modifier} min={10} max={999} error={errors.interval_modifier} suffix="%"
                                    />
                                    <SettingField
                                        id="ds_lapse" label="Tévesztés utáni intervallum"
                                        description="Tévesztés után az előző intervallum hány %-ából indul újra (0 = elölről, 50 = felére csökken)"
                                        name="lapse_new_interval" defaultValue={s.lapse_new_interval} min={0} max={100} error={errors.lapse_new_interval} suffix="%"
                                    />
                                    <SettingField
                                        id="ds_leech" label="Leech küszöb"
                                        description={'Ennyi tévesztés után a kártya „leech"-nek minősül (jelzi, hogy nehezen megy – érdemes átgondolni)'}
                                        name="leech_threshold" defaultValue={s.leech_threshold} min={1} max={99} error={errors.leech_threshold} suffix="tévesztés"
                                    />
                                </div>
                            </div>

                            <Separator />

                            {/* Shuffle */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Sorrend</h4>
                                <label className="flex cursor-pointer items-start gap-3">
                                    <input
                                        type="checkbox"
                                        name="shuffle_cards"
                                        defaultChecked={s.shuffle_cards}
                                        value="1"
                                        className="mt-0.5 size-4 rounded border-input accent-primary cursor-pointer"
                                    />
                                    <div className="grid gap-0.5">
                                        <span className="text-sm font-medium">Kártyák keverése</span>
                                        <span className="text-xs text-muted-foreground">
                                            Véletlenszerű sorrendben mutatja a kártyákat — kétoldalú kártyáknál az előlap és hátlap nem kerül egymás mellé.
                                        </span>
                                    </div>
                                </label>
                            </div>

                            <div className="flex items-center justify-between gap-4 pt-1">
                                <Button type="submit" disabled={processing}>Mentés</Button>
                                {hasCustom && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="text-muted-foreground text-xs"
                                        onClick={() => {
                                            if (!confirm('Visszaállítod a globális / alapértelmezett beállításokra?')) return;
                                            router.delete(destroyDeckSettings(deck.id).url, {
                                                preserveScroll: true,
                                                onSuccess: onClose,
                                            });
                                        }}
                                    >
                                        Egyéni beállítások törlése
                                    </Button>
                                )}
                            </div>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}

const DIRECTION_LABELS = {
    front_to_back: 'Előlap → Hátlap',
    back_to_front: 'Hátlap → Előlap',
    both: 'Mindkét irány',
};

const STATE_LABELS: Record<string, string> = {
    new: 'Új',
    learning: 'Tanulás',
    review: 'Ismétlés',
    relearning: 'Újratanulás',
};

const STATE_COLORS: Record<string, string> = {
    new: 'text-blue-500',
    learning: 'text-amber-500',
    review: 'text-green-500',
    relearning: 'text-orange-500',
};

function formatDue(dueAt: string | null, state: string): string {
    if (state === 'new' || dueAt === null) return 'most esedékes';

    const diff = Math.round((new Date(dueAt).getTime() - Date.now()) / 1000);

    if (diff <= 0) return 'most esedékes';
    if (diff < 60) return `${diff} mp múlva`;
    if (diff < 3600) return `${Math.round(diff / 60)} perc múlva`;
    if (diff < 86400) return `${Math.round(diff / 3600)} óra múlva`;
    const days = Math.round(diff / 86400);
    return `${days} nap múlva`;
}

function CardRow({ card, deck, otherDecks, onEdit, selected, onSelect }: {
    card: Flashcard;
    deck: Deck;
    otherDecks: OtherDeck[];
    onEdit: (card: Flashcard) => void;
    selected: boolean;
    onSelect: (id: number, checked: boolean) => void;
}) {
    return (
        <div
            className={`flex items-start gap-3 rounded-lg border bg-card px-4 py-3 transition-colors ${selected ? 'bg-primary/5 border-primary/30' : ''}`}
            style={card.color ? { borderLeftColor: card.color, borderLeftWidth: 4 } : {}}
        >
            <input
                type="checkbox"
                checked={selected}
                onChange={(e) => onSelect(card.id, e.target.checked)}
                className="mt-0.5 shrink-0 size-4 rounded border-input accent-primary cursor-pointer"
                aria-label="Kártya kijelölése"
            />
            <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-medium text-sm line-clamp-1 **:m-0! **:p-0! **:inline">
                        <RichTextContent html={card.front} />
                    </div>
                    <span className="text-muted-foreground text-xs shrink-0">→</span>
                    <div className="text-sm text-muted-foreground line-clamp-1 **:m-0! **:p-0! **:inline">
                        <RichTextContent html={card.back} />
                    </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span>{DIRECTION_LABELS[card.direction]}</span>
                    {card.review ? (
                        <span className={STATE_COLORS[card.review.state]}>
                            {STATE_LABELS[card.review.state]}
                            {' · '}
                            {formatDue(card.review.due_at, card.review.state)}
                        </span>
                    ) : (
                        <span className="text-blue-500">Új · most esedékes</span>
                    )}
                    {card.review?.is_leech && (
                        <span className="text-destructive font-medium">⚠ leech</span>
                    )}
                    {card.word_id && (
                        <span className="text-muted-foreground/60">importált</span>
                    )}
                </div>
                {(card.front_notes || card.back_notes) && (
                    <div className="mt-1 line-clamp-1 text-xs text-muted-foreground **:m-0! **:p-0! **:inline">
                        <RichTextContent html={card.front_notes || card.back_notes} />
                    </div>
                )}
            </div>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0">
                        <MoreHorizontal className="size-4" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel className="text-xs">Kártya műveletek</DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    <DropdownMenuItem onClick={() => onEdit(card)}>
                        <Edit2 className="size-3.5 mr-2" />
                        Szerkesztés
                    </DropdownMenuItem>

                    <DropdownMenuItem
                        onClick={() => router.post(duplicateCard({ deck: deck.id, flashcard: card.id }), {}, { preserveScroll: true })}
                    >
                        <Copy className="size-3.5 mr-2" />
                        Másolat létrehozása
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    {otherDecks.length > 0 && (
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                                <MoveRight className="size-3.5 mr-2" />
                                Áthelyezés
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="w-48">
                                {otherDecks.map((d) => (
                                    <DropdownMenuItem
                                        key={d.id}
                                        onClick={() => router.post(
                                            moveCard({ deck: deck.id, flashcard: card.id }),
                                            { target_deck_id: d.id },
                                            { preserveScroll: true },
                                        )}
                                    >
                                        {d.name}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                    )}

                    <DropdownMenuItem
                        onClick={() => {
                            if (!confirm('Visszaállítod a kártya haladását? Az összes SRS adat törlődik.')) return;
                            router.post(resetProgress({ deck: deck.id, flashcard: card.id }), {}, { preserveScroll: true });
                        }}
                    >
                        <RotateCcw className="size-3.5 mr-2" />
                        Haladás visszaállítása
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => {
                            if (!confirm('Törlöd ezt a kártyát?')) return;
                            router.delete(destroyCard({ deck: deck.id, flashcard: card.id }), { preserveScroll: true });
                        }}
                    >
                        <Trash2 className="size-3.5 mr-2" />
                        Törlés
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

type DictDefinition = { definition: string; example?: string };
type DictMeaning = { partOfSpeech: string; definitions: DictDefinition[] };
type DictEntry = { word: string; phonetic?: string; meanings: DictMeaning[] };

function CardForm({
    deck,
    card,
    onCancel,
}: {
    deck: Deck;
    card?: Flashcard;
    onCancel: () => void;
}) {
    const isEdit = !!card;
    const action = isEdit
        ? updateCard({ deck: deck.id, flashcard: card.id })
        : storeCard(deck.id);

    const backEditorRef = useRef<RichTextEditorHandle>(null);
    const [frontText, setFrontText] = useState('');
    const [dictEntry, setDictEntry] = useState<DictEntry | null>(null);
    const [dictLoading, setDictLoading] = useState(false);
    const [dictError, setDictError] = useState('');

    const lookupWord = async () => {
        const word = frontText.trim();
        if (!word) return;
        setDictLoading(true);
        setDictError('');
        setDictEntry(null);
        try {
            const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
            if (!res.ok) throw new Error('not found');
            const data: DictEntry[] = await res.json();
            setDictEntry(data[0]);
        } catch {
            setDictError('Nem találtam ezt a szót a szótárban.');
        } finally {
            setDictLoading(false);
        }
    };

    const insertDefinition = (partOfSpeech: string, definition: string, example?: string) => {
        let html = `<p><em>${partOfSpeech}</em> — ${definition}</p>`;
        if (example) html += `<p><em>"${example}"</em></p>`;
        backEditorRef.current?.setContent(html);
        setDictEntry(null);
    };

    return (
        <Form
            action={action}
            method={isEdit ? 'patch' : 'post'}
            options={{ preserveScroll: true }}
            onSuccess={onCancel}
            className="space-y-4"
        >
            {({ processing, errors }) => (
                <>
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label>Előlap</Label>
                                <button
                                    type="button"
                                    onClick={lookupWord}
                                    disabled={!frontText.trim() || dictLoading}
                                    className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-40 disabled:no-underline"
                                >
                                    {dictLoading
                                        ? <><Loader2 className="size-3 animate-spin" /> Keresés...</>
                                        : '📖 Szótár'}
                                </button>
                            </div>
                            <RichTextEditor
                                name="front"
                                defaultValue={card?.front ?? ''}
                                placeholder="Angol szó, kérdés..."
                                minHeight="20rem"
                                speakName="front_speak"
                                defaultSpeakValue={card?.front_speak ?? ''}
                                onTextChange={setFrontText}
                            />
                            {errors.front && <p className="text-xs text-destructive">{errors.front}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label>Hátlap</Label>
                            <RichTextEditor
                                ref={backEditorRef}
                                name="back"
                                defaultValue={card?.back ?? ''}
                                placeholder="Magyar jelentés, válasz..."
                                minHeight="20rem"
                                speakName="back_speak"
                                defaultSpeakValue={card?.back_speak ?? ''}
                            />
                            {errors.back && <p className="text-xs text-destructive">{errors.back}</p>}
                        </div>
                    </div>

                    {/* Dictionary results */}
                    {dictError && (
                        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                            {dictError}
                        </div>
                    )}
                    {dictEntry && (
                        <div className="rounded-md border bg-muted/40 p-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-sm">{dictEntry.word}</span>
                                    {dictEntry.phonetic && (
                                        <span className="text-xs text-muted-foreground">{dictEntry.phonetic}</span>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setDictEntry(null)}
                                    className="rounded p-0.5 text-muted-foreground hover:bg-accent"
                                >
                                    <X className="size-3.5" />
                                </button>
                            </div>
                            <div className="space-y-2 max-h-56 overflow-y-auto">
                                {dictEntry.meanings.map((meaning, mi) => (
                                    <div key={mi}>
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{meaning.partOfSpeech}</p>
                                        <div className="space-y-1">
                                            {meaning.definitions.slice(0, 3).map((def, di) => (
                                                <button
                                                    key={di}
                                                    type="button"
                                                    onClick={() => insertDefinition(meaning.partOfSpeech, def.definition, def.example)}
                                                    className="w-full text-left rounded-md px-2.5 py-1.5 text-xs hover:bg-accent transition-colors border border-transparent hover:border-border"
                                                >
                                                    <span>{def.definition}</span>
                                                    {def.example && (
                                                        <span className="block text-muted-foreground mt-0.5 italic">"{def.example}"</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground">Kattints egy definícióra a hátlapba illesztéshez.</p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-1.5">
                            <Label>Irány</Label>
                            <Select name="direction" defaultValue={card?.direction ?? 'both'}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="both">Mindkét irány</SelectItem>
                                    <SelectItem value="front_to_back">Előlap → Hátlap</SelectItem>
                                    <SelectItem value="back_to_front">Hátlap → Előlap</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor={`color-${card?.id ?? 'new'}`}>Szín (opcionális)</Label>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="color"
                                    id={`color-${card?.id ?? 'new'}`}
                                    name="color"
                                    defaultValue={card?.color ?? '#6366f1'}
                                    className="h-9 w-12 rounded border cursor-pointer bg-transparent"
                                />
                                <span className="text-xs text-muted-foreground">Kártya szín</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <Button type="submit" size="sm" disabled={processing}>
                            {isEdit ? 'Mentés' : 'Kártya hozzáadása'}
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
                            <X className="size-4 mr-1" />
                            Mégse
                        </Button>
                    </div>
                </>
            )}
        </Form>
    );
}

function CsvImport({ deck }: { deck: Deck }) {
    const inputRef = useRef<HTMLInputElement>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const [uploading, setUploading] = useState(false);

    const handleChange = () => {
        if (!inputRef.current?.files?.length) return;
        setUploading(true);
        formRef.current?.submit();
    };

    return (
        <form
            ref={formRef}
            action={csvImport(deck.id).url}
            method="post"
            encType="multipart/form-data"
            className="contents"
        >
            <input type="hidden" name="_token" value={document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? ''} />
            <input
                ref={inputRef}
                type="file"
                name="csv_file"
                accept=".csv,.txt"
                className="sr-only"
                onChange={handleChange}
            />
            <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
            >
                {uploading ? <Loader2 className="size-4 mr-1 animate-spin" /> : <FileUp className="size-4 mr-1" />}
                CSV import
            </Button>
        </form>
    );
}

type WordResult = { id: number; word: string; meaning_hu: string | null };

function WordSearchImport({ deck, onImport }: { deck: Deck; onImport: (wordId: number) => void }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<WordResult[]>([]);
    const [selected, setSelected] = useState<WordResult | null>(null);
    const [open, setOpen] = useState(false);
    const [searching, setSearching] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleSearch = useCallback((value: string) => {
        setQuery(value);
        setSelected(null);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (value.length < 2) {
            setResults([]);
            setOpen(false);
            return;
        }
        debounceRef.current = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await fetch(searchWords({ query: { q: value } }).url, {
                    headers: { 'X-Requested-With': 'XMLHttpRequest' },
                });
                const data: WordResult[] = await res.json();
                setResults(data);
                setOpen(data.length > 0);
            } finally {
                setSearching(false);
            }
        }, 250);
    }, []);

    const handleSelect = (word: WordResult) => {
        setSelected(word);
        setQuery(word.word);
        setOpen(false);
    };

    const handleImport = () => {
        if (!selected) return;
        onImport(selected.id);
        setSelected(null);
        setQuery('');
        setResults([]);
    };

    return (
        <div className="flex gap-2 items-center relative">
            <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                <Input
                    value={query}
                    onChange={(e) => handleSearch(e.target.value)}
                    onFocus={() => results.length > 0 && setOpen(true)}
                    onBlur={() => setTimeout(() => setOpen(false), 150)}
                    placeholder="Szó a Top 10 000 listából..."
                    className="h-9 w-56 pl-8 text-sm"
                />
                {open && (
                    <div className="absolute z-50 top-full mt-1 left-0 w-72 rounded-md border bg-popover shadow-md overflow-hidden">
                        <div className="px-3 py-1.5 border-b bg-muted/50">
                            <span className="text-xs text-muted-foreground">Top 10 000 leggyakoribb angol szó</span>
                        </div>
                        {searching && (
                            <div className="px-3 py-2 text-xs text-muted-foreground">Keresés...</div>
                        )}
                        {results.map((word) => (
                            <button
                                key={word.id}
                                onMouseDown={() => handleSelect(word)}
                                className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent transition-colors"
                            >
                                <span className="font-medium">{word.word}</span>
                                {word.meaning_hu && (
                                    <span className="text-muted-foreground text-xs truncate">{word.meaning_hu}</span>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <Button size="sm" variant="outline" disabled={!selected} onClick={handleImport}>
                <Import className="size-4 mr-1" />
                Importálás
            </Button>
        </div>
    );
}

const STATE_FILTER_OPTIONS = [
    { value: '', label: 'Összes' },
    { value: 'new', label: 'Új' },
    { value: 'learning', label: 'Tanulás' },
    { value: 'review', label: 'Ismétlés' },
    { value: 'relearning', label: 'Újratanulás' },
] as const;

export default function FlashcardShow({
    deck,
    flashcards,
    dueCount,
    deckSettings,
    otherDecks,
}: {
    deck: Deck;
    flashcards: Flashcard[];
    dueCount: number;
    deckSettings: DeckSettings;
    otherDecks: OtherDeck[];
}) {
    const { flash } = usePage<{ flash: { success?: string | null } }>().props;
    const [showNewForm, setShowNewForm] = useState(false);
    const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [search, setSearch] = useState('');
    const [stateFilter, setStateFilter] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    const filtered = flashcards.filter((card) => {
        if (stateFilter) {
            const s = card.review?.state ?? 'new';
            if (s !== stateFilter) return false;
        }
        if (search) {
            const q = search.toLowerCase();
            return card.front.toLowerCase().includes(q) || card.back.toLowerCase().includes(q);
        }
        return true;
    });

    const stateCounts = {
        new: flashcards.filter((c) => !c.review || c.review.state === 'new').length,
        learning: flashcards.filter((c) => c.review?.state === 'learning').length,
        review: flashcards.filter((c) => c.review?.state === 'review').length,
        relearning: flashcards.filter((c) => c.review?.state === 'relearning').length,
    };

    const handleSelect = (id: number, checked: boolean) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (checked) next.add(id); else next.delete(id);
            return next;
        });
    };

    const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));
    const someSelected = selectedIds.size > 0;

    const toggleSelectAll = () => {
        if (allFilteredSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filtered.map((c) => c.id)));
        }
    };

    const clearSelection = () => setSelectedIds(new Set());

    const bulkAction = (url: string, extraData: Record<string, unknown> = {}) => {
        router.post(url, { ids: [...selectedIds], ...extraData }, {
            preserveScroll: true,
            onSuccess: clearSelection,
        });
    };

    const handleWordImport = (wordId: number) => {
        router.post(
            importFromWord(deck.id).url,
            { word_id: wordId },
            {
                preserveScroll: true,
                onSuccess: (page) => {
                    const updatedCards = (page.props as unknown as { flashcards: Flashcard[] }).flashcards;
                    const imported = [...updatedCards]
                        .reverse()
                        .find((c) => c.word_id === wordId);
                    if (imported) {
                        setShowNewForm(false);
                        setEditingCard(imported);
                    }
                },
            },
        );
    };

    return (
        <>
            <Head title={deck.name} />

            <div className="px-4 py-6 space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                    <Heading
                        title={deck.name}
                        description={deck.description ?? undefined}
                    />
                    <span className="text-sm text-muted-foreground shrink-0 mt-1">{flashcards.length} kártya</span>
                </div>

                {/* Study banner */}
                {flashcards.length > 0 && (
                    <div className={`flex items-center justify-between gap-4 rounded-xl border px-5 py-4 ${dueCount > 0 ? 'border-primary/30 bg-primary/5' : 'bg-muted/40'}`}>
                        <div>
                            {dueCount > 0 ? (
                                <>
                                    <p className="font-semibold text-sm">{dueCount} kártya esedékes</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">Folytathatod a tanulást!</p>
                                </>
                            ) : (
                                <>
                                    <p className="font-semibold text-sm text-muted-foreground">Nincs esedékes kártya</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">Gyere vissza később.</p>
                                </>
                            )}
                        </div>
                        {dueCount > 0 ? (
                            <Link href={study(deck.id)}>
                                <Button size="lg" className="shrink-0 gap-2 px-6">
                                    <BookOpen className="size-4" />
                                    Tanulás
                                </Button>
                            </Link>
                        ) : (
                            <Button size="lg" variant="outline" disabled className="shrink-0 gap-2 px-6">
                                <BookOpen className="size-4" />
                                Tanulás
                            </Button>
                        )}
                    </div>
                )}

                {/* Flash message */}
                {flash?.success && (
                    <div className="rounded-md border border-green-500/30 bg-green-500/10 px-4 py-2.5 text-sm text-green-700 dark:text-green-400">
                        {flash.success}
                    </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setShowNewForm(true); setEditingCard(null); }}
                    >
                        <Plus className="size-4 mr-1" />
                        Új kártya
                    </Button>
                    <WordSearchImport deck={deck} onImport={handleWordImport} />
                    <CsvImport deck={deck} />
                    {flashcards.length > 0 && (
                        <a href={csvExport(deck.id).url}>
                            <Button size="sm" variant="outline">
                                <Download className="size-4 mr-1" />
                                CSV export
                            </Button>
                        </a>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setShowSettings(true)} className="relative">
                        <Settings2 className="size-4 mr-1" />
                        Beállítások
                        {deckSettings !== null && (
                            <span className="absolute -top-1 -right-1 size-2 rounded-full bg-primary" title="Egyéni beállítások aktívak" />
                        )}
                    </Button>
                </div>

                <Separator />

                {/* Filters */}
                {flashcards.length > 0 && (
                    <div className="space-y-3">
                        {/* Search */}
                        <div className="relative max-w-sm">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Keresés az előlapon / hátlapon..."
                                className="pl-8 h-8 text-sm"
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="size-3.5" />
                                </button>
                            )}
                        </div>

                        {/* State filter chips */}
                        <div className="flex flex-wrap items-center gap-1.5">
                            <SlidersHorizontal className="size-3.5 text-muted-foreground" />
                            {STATE_FILTER_OPTIONS.map(({ value, label }) => {
                                const count = value === ''
                                    ? flashcards.length
                                    : stateCounts[value as keyof typeof stateCounts];
                                const active = stateFilter === value;
                                return (
                                    <button
                                        key={value}
                                        onClick={() => setStateFilter(value)}
                                        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                                            active
                                                ? 'border-primary bg-primary text-primary-foreground'
                                                : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                                        }`}
                                    >
                                        {label}
                                        <span className={`text-[10px] ${active ? 'opacity-80' : 'opacity-60'}`}>{count}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Result count */}
                        {(search || stateFilter) && (
                            <p className="text-xs text-muted-foreground">
                                {filtered.length} találat
                                {' · '}
                                <button onClick={() => { setSearch(''); setStateFilter(''); }} className="underline hover:no-underline">
                                    szűrők törlése
                                </button>
                            </p>
                        )}
                    </div>
                )}

                {/* Card list */}
                {flashcards.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                        <BookOpen className="size-12 mb-4 opacity-30" />
                        <p className="text-sm">Még nincs kártya ebben a deckben.</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">Nincs a szűrőknek megfelelő kártya.</div>
                ) : (
                    <div className="space-y-2">
                        {/* Select all + bulk action bar */}
                        <div className="flex items-center gap-3 px-1 pb-1">
                            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-muted-foreground">
                                <input
                                    type="checkbox"
                                    checked={allFilteredSelected}
                                    onChange={toggleSelectAll}
                                    className="size-4 rounded border-input accent-primary cursor-pointer"
                                />
                                {allFilteredSelected ? 'Kijelölés törlése' : `Összes kijelölése (${filtered.length})`}
                            </label>

                            {someSelected && (
                                <div className="flex items-center gap-1.5 ml-auto animate-in fade-in duration-150">
                                    <span className="text-xs text-muted-foreground mr-1">{selectedIds.size} kijelölve</span>

                                    <button
                                        onClick={() => {
                                            if (!confirm(`Visszaállítod ${selectedIds.size} kártya haladását?`)) return;
                                            bulkAction(bulkResetCards(deck.id).url);
                                        }}
                                        className="flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                                    >
                                        <RotateCcw className="size-3" />
                                        Haladás törlése
                                    </button>

                                    {otherDecks.length > 0 && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button className="flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                                                    <MoveRight className="size-3" />
                                                    Áthelyezés
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48">
                                                {otherDecks.map((d) => (
                                                    <DropdownMenuItem
                                                        key={d.id}
                                                        onClick={() => bulkAction(bulkMoveCards(deck.id).url, { target_deck_id: d.id })}
                                                    >
                                                        {d.name}
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}

                                    <button
                                        onClick={() => {
                                            if (!confirm(`Törlöd a kijelölt ${selectedIds.size} kártyát?`)) return;
                                            bulkAction(bulkDeleteCards(deck.id).url);
                                        }}
                                        className="flex items-center gap-1 rounded-md border border-destructive/40 px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                                    >
                                        <Trash2 className="size-3" />
                                        Törlés
                                    </button>
                                </div>
                            )}
                        </div>

                        {filtered.map((card) => (
                            <div key={card.id}>
                                <CardRow
                                        card={card}
                                        deck={deck}
                                        otherDecks={otherDecks}
                                        onEdit={(c) => { setEditingCard(c); setShowNewForm(false); }}
                                        selected={selectedIds.has(card.id)}
                                        onSelect={handleSelect}
                                    />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Deck settings dialog */}
            <DeckSettingsDialog
                deck={deck}
                deckSettings={deckSettings}
                open={showSettings}
                onClose={() => setShowSettings(false)}
            />

            {/* Card edit / new dialog */}
            <Dialog
                open={showNewForm || editingCard !== null}
                onOpenChange={(open) => { if (!open) { setShowNewForm(false); setEditingCard(null); } }}
            >
                <DialogContent className="sm:max-w-7xl w-[calc(100vw-2rem)] max-h-[92vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingCard ? 'Kártya szerkesztése' : 'Új kártya'}</DialogTitle>
                    </DialogHeader>
                    <CardForm
                        key={editingCard?.id ?? 'new'}
                        deck={deck}
                        card={editingCard ?? undefined}
                        onCancel={() => { setShowNewForm(false); setEditingCard(null); }}
                    />
                </DialogContent>
            </Dialog>
        </>
    );
}

FlashcardShow.layout = {
    breadcrumbs: [
        { title: 'Flashcard decks', href: index() },
        { title: 'Deck', href: '#' },
    ],
};
