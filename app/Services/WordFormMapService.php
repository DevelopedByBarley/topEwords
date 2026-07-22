<?php

namespace App\Services;

use App\Models\Word;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * A teljes szólista (top 10k) szóalak→szó térképének felhasználó-független
 * gyorsítótára.
 *
 * A szövegelemzés minden tokenjét a 9 ragozási oszlopra kellett illeszteni egy
 * nehéz, indexeletlen OR-IN lekérdezéssel — felhasználónként és szövegenként
 * újra. A szólista viszont mindenki számára azonos és ritkán változik, ezért a
 * szóalak→azonosító térképet egyszer felépítjük és cache-eljük; nagy könyveknél
 * ez egy tábla-szintű lekérdezést egyetlen, memóriában futó kikereséssé alakít.
 *
 * A felhasználó-egyedi rész (tanult/ismert státusz) NEM kerül ide: azt a hívó a
 * térképből kapott szó-azonosítókra szűkített, indexelt lekérdezéssel tölti.
 */
class WordFormMapService
{
    /**
     * 1 nap. A fingerprint a szólista tényleges változásakor (beszúrás/törlés/
     * módosítás) azonnal új cache-kulcsra vált, így a TTL csak a végső
     * önttisztító háló — kézi ürítésre nincs szükség.
     */
    private const TTL_SECONDS = 86400;

    /**
     * Kérésen belüli memoizálás: ugyanazon kérés több elemzése (pl. teljes könyv
     * lapozása) ne fizesse újra sem a fingerprint-lekérdezést, sem a cache-olvasás
     * deszerializációját.
     *
     * @var array{forms: array<string, int>, words: array<int, array{word: string, rank: int|null, meaning_hu: string|null}>}|null
     */
    private ?array $memo = null;

    /**
     * A teljes szólista szóalak-térképe.
     *
     * - `forms`: kisbetűs szóalak → szó-azonosító (minden ragozott alak is)
     * - `words`: szó-azonosító → a megjelenítéshez szükséges mezők
     *
     * @return array{forms: array<string, int>, words: array<int, array{word: string, rank: int|null, meaning_hu: string|null}>}
     */
    public function map(): array
    {
        return $this->memo ??= Cache::remember(
            'word_form_map:'.$this->fingerprint(),
            self::TTL_SECONDS,
            fn (): array => $this->build(),
        );
    }

    /**
     * A szólista állapot-ujjlenyomata. A darabszám + legnagyobb id + legutóbbi
     * módosítás együtt minden beszúrást, törlést és módosítást megfog, így a
     * cache-kulcs a szólista bármely változására automatikusan rotál. Ez egyetlen
     * könnyű aggregált lekérdezés a korábbi nehéz szóalak-illesztés helyett.
     */
    private function fingerprint(): string
    {
        $state = DB::table('words')
            ->selectRaw('COUNT(*) AS total, COALESCE(MAX(id), 0) AS max_id, COALESCE(MAX(updated_at), 0) AS last_change')
            ->first();

        return "{$state->total}:{$state->max_id}:{$state->last_change}";
    }

    /**
     * Felépíti a teljes szóalak-térképet. Csak cache-tévesztéskor fut (ritkán).
     *
     * @return array{forms: array<string, int>, words: array<int, array{word: string, rank: int|null, meaning_hu: string|null}>}
     */
    private function build(): array
    {
        $forms = [];
        $words = [];

        // id szerint növekvő: szóalak-ütközésnél (két szó azonos ragozott alakja)
        // determinisztikusan a kisebb id-jű — korábban felvett — szó nyer.
        Word::query()
            ->select(['id', 'word', 'rank', 'meaning_hu', ...WordStatusFormExpander::FORM_COLUMNS])
            ->orderBy('id')
            ->chunkById(2000, function ($chunk) use (&$forms, &$words): void {
                foreach ($chunk as $word) {
                    $words[$word->id] = [
                        'word' => $word->word,
                        'rank' => $word->rank,
                        'meaning_hu' => $word->meaning_hu,
                    ];

                    // Az oszlopok '/'-szeparált alternatívákat tartalmazhatnak
                    // ("got/gotten") — a térképbe változatonként kell kulcsolni.
                    $columnValues = array_map(
                        fn (string $column) => $word->{$column},
                        WordStatusFormExpander::FORM_COLUMNS,
                    );

                    foreach (
                        WordFormVariants::splitAll([$word->word, ...$columnValues]) as $form
                    ) {
                        $forms[mb_strtolower($form)] ??= $word->id;
                    }
                }
            });

        return ['forms' => $forms, 'words' => $words];
    }
}
