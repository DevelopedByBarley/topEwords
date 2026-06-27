import { Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

export interface PracticeWord {
    word: string;
    meaning_hu: string | null;
}

interface PracticeResult {
    used: boolean;
    correct: boolean;
    feedback_hu: string;
    grammar_issues: (string | { explanation_hu?: string; issue?: string })[];
    overall_hu: string;
    corrected_text: string | null;
}

interface PracticeModalProps {
    word: PracticeWord | null;
    onClose: () => void;
}

function grammarIssueText(issue: string | { explanation_hu?: string; issue?: string }): string {
    if (typeof issue === 'string') {
return issue;
}

    return issue.explanation_hu ?? issue.issue ?? JSON.stringify(issue);
}

/** AI-alapú mondatírás gyakorló modal egy adott szóhoz. */
export default function PracticeModal({ word, onClose }: PracticeModalProps) {
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<PracticeResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    function handleOpenChange(open: boolean) {
        if (!open) {
            setText('');
            setResult(null);
            setError(null);
            onClose();
        }
    }

    async function handleCheck() {
        if (!word || text.trim().length < 5) {
return;
}

        setLoading(true);
        setError(null);
        setResult(null);
        const cookie = document.cookie.split('; ').find((r) => r.startsWith('XSRF-TOKEN='));
        const xsrf = cookie ? decodeURIComponent(cookie.substring('XSRF-TOKEN='.length)) : '';

        try {
            const res = await fetch('/words/practice/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-XSRF-TOKEN': xsrf },
                body: JSON.stringify({ words: [word], text: text.trim() }),
            });
            const data = await res.json();

            if (!res.ok || data.error) {
                setError(data.error ?? 'Ismeretlen hiba.');
            } else {
                const wordResult = data.words?.[0];
                setResult({ ...wordResult, grammar_issues: data.grammar_issues ?? [], overall_hu: data.overall_hu ?? '', corrected_text: data.corrected_text ?? null });
            }
        } catch {
            setError('Kapcsolódási hiba.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={word !== null} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="size-4 text-violet-500" />
                        Gyakorlás: <span className="text-violet-600 dark:text-violet-400">{word?.word}</span>
                    </DialogTitle>
                    {word?.meaning_hu && <p className="text-sm text-muted-foreground">{word.meaning_hu}</p>}
                </DialogHeader>
                <div className="space-y-3 pt-1">
                    <Textarea
                        autoFocus
                        value={text}
                        onChange={(e) => {
 setText(e.target.value); setResult(null);
}}
                        placeholder={`Írj mondatokat a "${word?.word}" szóval...`}
                        className="min-h-32 resize-none text-base leading-relaxed"
                    />
                    <Button
                        onClick={handleCheck}
                        disabled={text.trim().length < 5 || loading}
                        className="w-full gap-2 bg-gradient-to-br from-violet-500 to-violet-400 hover:bg-violet-700 text-white"
                    >
                        {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                        {loading ? 'Ellenőrzés...' : 'Ellenőrzés'}
                    </Button>

                    {error && <p className="text-sm text-destructive">{error}</p>}

                    {result && (
                        <div className="space-y-2 animate-in fade-in duration-200">
                            <div className={`rounded-lg border px-3 py-2.5 text-sm ${result.correct ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30' : result.used ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30' : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'}`}>
                                <span className="font-medium">{result.correct ? '✅' : result.used ? '⚠️' : '❌'} </span>
                                {result.feedback_hu}
                            </div>
                            {result.overall_hu && (
                                <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-sm text-violet-800 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-300">
                                    {result.overall_hu}
                                </div>
                            )}
                            {result.grammar_issues.length > 0 && (
                                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-800 dark:bg-amber-950/30">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-1">Grammatika</p>
                                    <ul className="space-y-0.5">
                                        {result.grammar_issues.map((issue, i) => (
                                            <li key={i} className="text-sm text-amber-700 dark:text-amber-400">• {grammarIssueText(issue)}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {result.corrected_text && (
                                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 dark:border-blue-800 dark:bg-blue-950/30">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400 mb-1">Javított változat</p>
                                    <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">{result.corrected_text}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </DialogCon