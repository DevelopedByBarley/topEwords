import { absorbAiBudget } from '@/lib/ai-budget';
import { csrfHeaders } from '@/lib/csrf';
import { httpErrorMessage } from '@/lib/http';
import { withMinDuration } from '@/lib/min-duration';
import { geminiLookup } from '@/routes/text-analysis';
import type { WordFormData } from '@/types/words';

/** A `text-analysis.gemini-lookup` végpont válasza (TextAnalysisController@geminiLookup). */
export interface GeminiWordData {
    is_real_word?: boolean;
    /** A szótári alapszó (lemma) — a többi mező MINDIG erre vonatkozik. */
    base_form?: string | null;
    /** Csak akkor van kitöltve, ha a lemma eltér a beírt alaktól. */
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
    /** Csak `context` átadásakor: mit jelent a szó ABBAN a mondatban. */
    context_explanation?: string | null;
    error?: string | null;
    message?: string | null;
}

/**
 * Hibaüzenet az AI-kitöltéshez. Az AI-kvóta 429-e saját magyar üzenettel
 * érkezik (`error: 'ai_limit'` + `message`); a route-throttle 429 viszont csak
 * angol `message`-et ad, arra a közös magyar szöveget mutatjuk. A 422/502
 * `error` mezője már felhasználóbarát magyar szöveg a backendről.
 */
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

/**
 * Az AI által visszaadott mezőket beolvasztja a meglévő űrlapba. Ahol az AI ad
 * értéket, az felülírja a korábbit (admin szerkesztésnél így újratölt), ahol
 * nem, ott a meglévő érték marad. A `wordOverride` (ha meg van adva) az
 * alapszó, amire a `word` mezőt is átállítjuk — csak új szó felvitelekor.
 */
export function mergeGeminiData(
    prev: WordFormData,
    data: GeminiWordData,
    wordOverride?: string,
): WordFormData {
    return {
        ...prev,
        word: wordOverride ?? prev.word,
        // Lemmára váltáskor (pl. „successfully" → „successful") a beírt eredeti
        // alakot külön elmentjük, hogy a szó-felismerés később arra is találjon.
        extra_forms:
            wordOverride && wordOverride !== prev.word
                ? prev.word
                : prev.extra_forms,
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

/** Az AI-lekérés eredménye: pontosan az egyik ág van kitöltve. */
export type GeminiWordResult =
    | {
          ok: true;
          data: GeminiWordData;
          /** Az alapszó, ha a beírt alak ragozott volt — különben null. */
          lemma: string | null;
      }
    | { ok: false; error: string };

/**
 * Egy szó AI-adatainak lekérése a kitöltéshez.
 *
 * A szólista (saját szó felvitele + admin szerkesztés) és a szövegelemző
 * lookup-dialógusa is ezt hívja, hogy a kitöltés MINDENHOL ugyanúgy működjön:
 * ugyanaz a lemmatizálás, ugyanazok a hibaüzenetek (AI-keret, throttle,
 * „nem valódi szó"), és a `mergeGeminiData`-val ugyanaz a mező-beolvasztás
 * (mind a 8 alak-mező, a szófajtól függetlenül). Korábban a szövegelemző saját,
 * szűkebb másolatot futtatott.
 *
 * A `context` (a mondat, amiben a szó áll) opcionális: csak a szövegelemző adja
 * át, és ilyenkor a válasz `context_explanation` mezőt is hoz.
 */
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

    // Az AI nem létező szónak ítélte (gibberish / elgépelés): nem töltünk ki
    // kamu adatot, csak jelezzük.
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
        // A beírt szó ragozott alak volt (helped): az AI a „help" alapszóra
        // lemmatizált, és MINDEN mezőt arra töltött ki.
        lemma:
            data.normalized_from_input && data.base_form
                ? data.base_form
                : null,
    };
}

/**
 * A lemma-váltás jelzése a felhasználónak (információ, nem hiba).
 *
 * @param switchWord Új szó felvitelekor a `word` mező is az alapszóra vált;
 *                   admin-szerkesztésnél csak jelzünk, mert ott egy konkrét,
 *                   létező sort szerkeszt a felhasználó — a szó néma átírása
 *                   véletlen átnevezés lenne.
 */
export function lemmaNotice(
    word: string,
    lemma: string,
    switchWord: boolean,
): string {
    return switchWord
        ? `A(z) „${word.trim()}" a(z) „${lemma}" ragozott alakja — az alapszóból indultunk ki.`
        : `A(z) „${word.trim()}" a(z) „${lemma}" ragozott alakja. A kitöltött alakok az alapszóra vonatkoznak.`;
}
