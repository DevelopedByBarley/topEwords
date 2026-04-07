import { router } from '@inertiajs/react';
import { BookMarked, CheckCheck, Clock, Mic, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { destroy, status as customStatus, store, update } from '@/routes/custom-words';

type WordStatus = 'known' | 'learning' | 'saved' | 'pronunciation';

interface CustomWord {
    id: number;
    word: string;
    meaning_hu: string | null;
    part_of_speech: string | null;
    example_en: string | null;
    status: WordStatus;
}

interface CustomStats {
    total: number;
    known: number;
    learning: number;
}

const STATUS_CONFIG: Record<WordStatus, { label: string; icon: React.ElementType; className: string }> = {
    known: { label: 'Tudom', icon: CheckCheck, className: 'text-green-600 dark:text-green-400' },
    learning: { label: 'Tanulom', icon: Clock, className: 'text-blue-600 dark:text-blue-400' },
    saved: { label: 'Később', icon: BookMarked, className: 'text-orange-500' },
    pronunciation: { label: 'Kiejtés', icon: Mic, className: 'text-violet-500' },
};

const POS_OPTIONS = [
    { value: 'noun', label: 'főnév' },
    { value: 'verb', label: 'ige' },
    { value: 'adj', label: 'melléknév' },
    { value: 'adv', label: 'határozószó' },
    { value: 'prep', label: 'elöljáró' },
    { value: 'conj', label: 'kötőszó' },
    { value: 'pron', label: 'névmás' },
];

interface AddFormState {
    word: string;
    meaning_hu: string;
    part_of_speech: string;
    example_en: string;
    status: WordStatus;
}

const EMPTY_FORM: AddFormState = {
    word: '',
    meaning_hu: '',
    part_of_speech: '',
    example_en: '',
    status: 'learning',
};

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    customWords: CustomWord[];
    customStats: CustomStats;
}

export function CustomWordsSheet({ open, onOpenChange, customWords, customStats }: Props) {
    const [showAddForm, setShowAddForm] = useState(false);
    const [form, setForm] = useState<AddFormState>(EMPTY_FORM);
    const [editId, setEditId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<Partial<AddFormState>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});

    function handleAdd(e: React.FormEvent) {
        e.preventDefault();
        if (!form.word.trim()) {
            setErrors({ word: 'A szó megadása kötelező.' });
            return;
        }
        router.post(store(), {
            word: form.word.trim(),
            meaning_hu: form.meaning_hu.trim() || null,
            part_of_speech: form.part_of_speech || null,
            example_en: form.example_en.trim() || null,
            status: form.status,
        }, {
            preserveScroll: true,
            only: ['customWords', 'customStats'],
            onSuccess: () => {
                setForm(EMPTY_FORM);
                setShowAddForm(false);
                setErrors({});
            },
            onError: (e) => setErrors(e),
        });
    }

    function handleStatusChange(word: CustomWord, newStatus: WordStatus) {
        router.post(customStatus(word.id), { status: newStatus }, {
            preserveScroll: true,
            only: ['customWords', 'customStats'],
        });
    }

    function handleSaveEdit(word: CustomWord) {
        router.patch(update(word.id), editForm, {
            preserveScroll: true,
            only: ['customWords', 'customStats'],
            onSuccess: () => {
                setEditId(null);
                setEditForm({});
            },
        });
    }

    function handleDelete(wordId: number) {
        router.delete(destroy(wordId), {
            preserveScroll: true,
            only: ['customWords', 'customStats'],
        });
    }

    function startEdit(word: CustomWord) {
        setEditId(word.id);
        setEditForm({
            word: word.word,
            meaning_hu: word.meaning_hu ?? '',
            part_of_speech: word.part_of_speech ?? '',
            example_en: word.example_en ?? '',
        });
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-md overflow-y-auto">
                <SheetHeader className="mb-4">
                    <SheetTitle className="flex items-center justify-between">
                        <span>Saját szavak</span>
                        <span className="text-sm font-normal text-muted-foreground">
                            {customStats.total} szó · {customStats.known} ismert
                        </span>
                    </SheetTitle>
                </SheetHeader>

                {/* Add button */}
                {!showAddForm && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="mb-4 w-full"
                        onClick={() => setShowAddForm(true)}
                    >
                        <Plus className="size-4" />
                        Új szó hozzáadása
                    </Button>
                )}

                {/* Add form */}
                {showAddForm && (
                    <form onSubmit={handleAdd} className="mb-4 rounded-lg border bg-muted/40 p-3 flex flex-col gap-2">
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <Input
                                    placeholder="Angol szó *"
                                    value={form.word}
                                    onChange={(e) => setForm({ ...form, word: e.target.value })}
                                    autoFocus
                                />
                                {errors.word && <p className="mt-1 text-xs text-destructive">{errors.word}</p>}
                            </div>
                            <Input
                                placeholder="Magyar jelentés"
                                value={form.meaning_hu}
                                onChange={(e) => setForm({ ...form, meaning_hu: e.target.value })}
                                className="flex-1"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Select value={form.part_of_speech} onValueChange={(v) => setForm({ ...form, part_of_speech: v })}>
                                <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Szófaj" />
                                </SelectTrigger>
                                <SelectContent>
                                    {POS_OPTIONS.map((o) => (
                                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as WordStatus })}>
                                <SelectTrigger className="flex-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {(Object.keys(STATUS_CONFIG) as WordStatus[]).map((s) => (
                                        <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Input
                            placeholder="Példamondat (opcionális)"
                            value={form.example_en}
                            onChange={(e) => setForm({ ...form, example_en: e.target.value })}
                        />
                        <div className="flex gap-2">
                            <Button type="submit" size="sm" className="flex-1">Hozzáadás</Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => { setShowAddForm(false); setForm(EMPTY_FORM); setErrors({}); }}>
                                <X className="size-4" />
                            </Button>
                        </div>
                    </form>
                )}

                {/* Word list */}
                {customWords.length === 0 && !showAddForm && (
                    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                        Még nincs saját szavad. Adj hozzá egyet!
                    </div>
                )}

                <div className="flex flex-col gap-2">
                    {customWords.map((word) => {
                        const cfg = STATUS_CONFIG[word.status];
                        const Icon = cfg.icon;
                        const isEditing = editId === word.id;

                        return (
                            <div key={word.id} className="rounded-lg border bg-card p-3">
                                {isEditing ? (
                                    <div className="flex flex-col gap-2">
                                        <div className="flex gap-2">
                                            <Input
                                                value={editForm.word ?? ''}
                                                onChange={(e) => setEditForm({ ...editForm, word: e.target.value })}
                                                placeholder="Szó"
                                                className="flex-1"
                                            />
                                            <Input
                                                value={editForm.meaning_hu ?? ''}
                                                onChange={(e) => setEditForm({ ...editForm, meaning_hu: e.target.value })}
                                                placeholder="Jelentés"
                                                className="flex-1"
                                            />
                                        </div>
                                        <Input
                                            value={editForm.example_en ?? ''}
                                            onChange={(e) => setEditForm({ ...editForm, example_en: e.target.value })}
                                            placeholder="Példamondat"
                                        />
                                        <div className="flex gap-2">
                                            <Button size="sm" onClick={() => handleSaveEdit(word)} className="flex-1">
                                                <Save className="size-3.5" />
                                                Mentés
                                            </Button>
                                            <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>
                                                <X className="size-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-medium truncate">{word.word}</span>
                                                {word.part_of_speech && (
                                                    <span className="text-xs text-muted-foreground shrink-0">
                                                        {POS_OPTIONS.find(p => p.value === word.part_of_speech)?.label ?? word.part_of_speech}
                                                    </span>
                                                )}
                                            </div>
                                            {word.meaning_hu && (
                                                <p className="text-sm text-muted-foreground">{word.meaning_hu}</p>
                                            )}
                                            {word.example_en && (
                                                <p className="mt-0.5 text-xs italic text-muted-foreground truncate">{word.example_en}</p>
                                            )}
                                            {/* Status pills */}
                                            <div className="mt-1.5 flex gap-1 flex-wrap">
                                                {(Object.keys(STATUS_CONFIG) as WordStatus[]).map((s) => {
                                                    const c = STATUS_CONFIG[s];
                                                    const SIcon = c.icon;
                                                    return (
                                                        <button
                                                            key={s}
                                                            type="button"
                                                            onClick={() => handleStatusChange(word, s)}
                                                            className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs transition-colors ${
                                                                word.status === s
                                                                    ? 'border-current bg-current/10 ' + c.className
                                                                    : 'border-transparent text-muted-foreground hover:text-foreground'
                                                            }`}
                                                        >
                                                            <SIcon className="size-3" />
                                                            {c.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => startEdit(word)}
                                                className="rounded p-1 text-muted-foreground hover:text-foreground"
                                            >
                                                <Pencil className="size-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(word.id)}
                                                className="rounded p-1 text-muted-foreground hover:text-destructive"
                                            >
                                                <Trash2 className="size-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </SheetContent>
        </Sheet>
    );
}
