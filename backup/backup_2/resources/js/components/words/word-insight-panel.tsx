import { Info, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface InsightData {
    areas: { name_hu: string; description_hu: string; example_en: string; example_hu: string }[];
    register_hu: string;
    tip_hu: string;
}

/**
 * AI-alapú "Szó a valóságban" panel. Saját állapotot kezel;
 * a hívó oldalon `key={word}` használatával resetelődik szóváltáskor.
 */
export default function WordInsightPanel({ word }: { word: string }) {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<InsightData | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function loadInsight() {
        setData(null);
        setError(null);
        setLoading(true);

        try {
            const res = await fetch(`/text-analysis/word-insight?word=${encodeURIComponent(word)}`, { headers: { Accept: 'application/json' } });
            const json = await res.json();

            if (!res.ok || json.error) {
                setError(json.error ?? 'Hiba történt.');
            } else {
                setData(json);
            }
        } catch {
            setError('Kapcsolódási hiba.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <Button
                variant="outline"
                size="sm"
                className="w-full border-violet-300 text-violet-700 hover:bg-violet-50 hover:text-violet-800 dark:border-violet-700 dark:text-violet-400 dark:hover:bg-violet-950/30"
                disabled={loading}
                onClick={loadInsight}
            >
                {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Info className="size-3.5" />}
                Szó infók (AI)
            </Button>

            {error && <p className="text-xs text-red-500">{error}</p>}

            {data && (
                <div className="rounded-xl border bg-violet-50/50 dark:bg-violet-950/10 px-4 py-3.5 flex flex-col gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">Szó a valóságban</p>
                    {data.areas.map((area, i) => (
                        <div key={i} className="flex flex-col gap-1">
                            <p className="text-xs font-semibold text-foreground">{area.name_hu}</p>
                            <p className="text-xs text-muted-foreground">{area.description_hu}</p>
                            <p className="text-xs italic">"{area.example_en}"</p>
                            <p className="text-xs text-muted-foreground">"{area.example_hu}"</p>
                        </div>
                    ))}
                    {data.register_hu && (
                        <div className="rounded-lg bg-background/70 px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Stílus / regiszter</p>
                            <p className="text-xs">{data.register_hu}</p>
                        </div>
                    )}
                    {data.tip_hu && (
                        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-0.5">Tipp</p>
                            <p className="text-xs">{data.tip_hu}</p>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
