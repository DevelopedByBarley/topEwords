import { Head, useForm } from '@inertiajs/react';
import { Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { store } from '@/routes/report';

const CATEGORY_LABELS: Record<string, string> = {
    bug: 'Hiba a rendszerben',
    missing_feature: 'Hiányzó funkció',
    word_data: 'Hibás szóadat',
    other: 'Egyéb',
};

export default function ReportIndex() {
    const form = useForm({
        category: 'bug',
        description: '',
        word_id: null as number | null,
    });

    function submit(e: React.FormEvent) {
        e.preventDefault();
        form.submit(store(), {
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    }

    return (
        <>
            <Head title="Hibabejelentés" />

            <div className="mx-auto flex max-w-2xl flex-1 flex-col gap-6 p-4 md:p-6">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                        <Flag className="size-6 text-primary" />
                        Hibabejelentés
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Találtál hibát, hiányzik egy funkció, vagy hibás egy
                        szó adata? Írd le, és a csapat megnézi.
                    </p>
                </div>

                <form
                    onSubmit={submit}
                    className="flex flex-col gap-5 rounded-2xl border bg-card p-6"
                >
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="category">Kategória</Label>
                        <Select
                            value={form.data.category}
                            onValueChange={(value) =>
                                form.setData('category', value)
                            }
                        >
                            <SelectTrigger id="category" className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(CATEGORY_LABELS).map(
                                    ([value, label]) => (
                                        <SelectItem key={value} value={value}>
                                            {label}
                                        </SelectItem>
                                    ),
                                )}
                            </SelectContent>
                        </Select>
                        {form.errors.category && (
                            <p className="text-sm text-destructive">
                                {form.errors.category}
                            </p>
                        )}
                    </div>

                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="description">Leírás</Label>
                            <span className="text-xs text-muted-foreground">
                                {form.data.description.length}/2000
                            </span>
                        </div>
                        <Textarea
                            id="description"
                            value={form.data.description}
                            onChange={(e) =>
                                form.setData('description', e.target.value)
                            }
                            maxLength={2000}
                            rows={6}
                            placeholder="Írd le részletesen, mi történt..."
                            required
                        />
                        {form.errors.description && (
                            <p className="text-sm text-destructive">
                                {form.errors.description}
                            </p>
                        )}
                    </div>

                    <Button
                        type="submit"
                        disabled={form.processing}
                        className="self-start"
                    >
                        {form.processing ? 'Küldés...' : 'Bejelentés küldése'}
                    </Button>

                    {form.wasSuccessful && (
                        <p className="text-sm font-medium text-primary">
                            Köszönjük a jelzést!
                        </p>
                    )}
                </form>
            </div>
        </>
    );
}
