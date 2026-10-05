import { absorbAiBudget } from '@/lib/ai-budget';
import { csrfHeaders } from '@/lib/csrf';
import { httpErrorMessage } from '@/lib/http';
import { withMinDuration } from '@/lib/min-duration';
import { geminiLookup } from '@/routes/text-analysis';
import type { WordFormData } from '@/types/words';

export interface GeminiWordData {
    is_real_word?: boolean;
    base_form?: string | null;
    normalized_from_input?: string | null;
    meaning_hu?: string | null;
    extra_meanings?: string | null;
    synonyms?: string | null;
    part_of_speech?: string | null;
    example_en?: string | null;
    example_hu?: string | null;
    verb_past?: string | null;
    verb_past_participle?: string | null;
    verb_present_participle?: string | null;
    verb_third_person?: string | null;
    is_irregular?: boolean;
    noun_plural?: string | null;
    adj_comparative?: string | null;
    adj_superlative?: string | null;
    derived_forms?: string | null;
    context_explanation?: string | null;
    error?: string | null;
    message?: string | null;
}

export function geminiErrorMessage(
    status: number,
    data: GeminiWordData,
): string {
    if (data.error === 'ai_limit' && typeof data.message === 'string') {
        return data.message;
    }

    if (status === 429) {
        return httpErrorMessage(429);
    }

    if (typeof data.error === 'string' && data.error !== '') {
        return data.error;
    }

    return httpErrorMessage(
        status,
        'Az AI-kitöltés nem sikerült — próbáld újra.',
    );
}

const EXTRA_FORMS_MAX_LENGTH = 255;

function mergeExtraForms(...sources: Array<string | null | undefined>): string {
    const forms: string[] = [];
    let length = 0;

    for (const source of sources) {
        for (const raw of (source ?? '').split('/')) {
            const form = raw.trim().toLowerCase();

            if (form === '' || forms.includes(form)) {
                continue;
            }

            const next = length + form.length + (forms.length === 0 ? 0 : 1);

            if (next > EXTRA_FORMS_MAX_LENGTH) {
                return forms.join('/');
            }

            forms.push(form);
            length = next;
        }
    }

    return forms.join('/');
}

export function mergeGeminiData(
    prev: WordFormData,
    data: GeminiWordData,
    wordOverride?: string,
): WordFormData {
    return {
        ...prev,
        word: wordOverride ?? prev.word,
        extra_forms: mergeExtraForms(
            prev.extra_forms,
            wordOverride && wordOverride !== prev.word ? prev.word : null,
        ),
        meaning_hu: data.meaning_hu || prev.meaning_hu,
        extra_meanings: data.extra_meanings || prev.extra_meanings,
        synonyms: data.synonyms || prev.synonyms,
        part_of_speech: data.part_of_speech || prev.part_of_speech,
        example_en: data.example_en || prev.example_en,
        example_hu: data.example_hu || prev.example_hu,
        verb_past: data.verb_past || prev.verb_past,
        verb_past_participle:
            data.verb_past_participle || prev.verb_past_participle,
        verb_present_participle:
            data.verb_present_participle || prev.verb_present_participle,
        verb_third_person: data.verb_third_person || prev.verb_third_person,
        is_irregular: data.is_irregular ?? prev.is_irregular,
        noun_plural: data.noun_plural || prev.noun_plural,
        adj_comparative: data.adj_comparative || prev.adj_comparative,
        adj_superlative: data.adj_superlative || prev.adj_superlative,
    };
}

export type GeminiWordResult =
    | {
          ok: true;
          data: GeminiWordData;
          lemma: string | null;
      }
    | { ok: false; error: string };

export async function fetchGeminiWord(
    word: string,
    context?: string | null,
): Promise<GeminiWordResult> {
    const trimmed = word.trim();

    if (!trimmed) {
        return { ok: false, error: 'Adj meg egy szót az AI-kitöltéshez.' };
    }

    const query: Record<string, string> = { word: trimmed };

    if (context) {
        query.context = context;
    }

    let res: Response;
    let data: GeminiWordData;

    try {
        res = await withMinDuration(
            fetch(geminiLookup.url({ query }), {
                headers: { Accept: 'application/json', ...csrfHeaders() },
            }),
        );
        data = (await res.json().catch(() => ({}))) as GeminiWordData;
    } catch {
        return {
            ok: false,
            error: 'Nincs hálózati kapcsolat — az AI-kitöltés nem sikerült.',
        };
    }

    absorbAiBudget(data);

    if (!res.ok || data.error) {
        return { ok: false, error: geminiErrorMessage(res.status, data) };
    }

    if (data.is_real_word === false) {
        return {
            ok: false,
            error:
                data.message ??
                'Ez nem tűnik valódi angol szónak. Ellenőrizd a helyesírást.',
        };
    }

    return {
        ok: true,
        data,
        lemma:
            data.normalized_from_input && data.base_form
                ? data.base_form
                : null,
    };
}

export function lemmaNotice(
    word: string,
    lemma: string,
    switchWord: boolean,
): string {
    return switchWord
        ? `A(z) „${word.trim()}" a(z) „${lemma}" ragozott alakja — az alapszóból indultunk ki.`
        : `A(z) „${word.trim()}" a(z) „${lemma}" ragozott alakja. A kitöltött alakok az alapszóra vonatkoznak.`;
}
