<?php

namespace App\Services;

use App\Models\Word;
use Illuminate\Contracts\Cache\LockTimeoutException;
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
     * 1 nap. A szólista tényleges változását (beszúrás/törlés/módosítás) a
     * tárolt fingerprint eltérése azonnal jelzi, így a TTL csak a végső
     * öntisztító háló — kézi ürítésre nincs szükség.
     */
    private const TTL_SECONDS = 86400;

    /**
     * Stabil cache-kulcs (F9D-L4). Korábban a kulcs a fingerprintből képződött,
     * így minden szólista-változás egy új ~2 MB-os sort írt, a régi pedig a
     * TTL lejártáig árván maradt a `cache` táblában. Most a fingerprint az
     * értékben utazik, és az újraépítés ugyanazt a sort írja felül.
     */
    private const CACHE_KEY = 'word_form_map';

    /**
     * Az újraépítés zárja: fingerprint-váltáskor csak egy kérés épít (~1 s), a
     * többi megvárja és a friss sort olvassa — nincs cache stampede.
     */
    private const LOCK_KEY = 'word_form_map:rebuild';

    /** A zár élettartama: bőven az építési idő fölött, de egy elhalt építő ne tartsa sokáig. */
    private const LOCK_SECONDS = 60;

    /** Ennyit vár egy kérés a más által épített térképre, mielőtt maga építene. */
    private const LOCK_WAIT_SECONDS = 10;

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
        return $this->memo ??= $this->loadOrRebuild();
    }

    /**
     * A cache-elt térkép, ha a fingerprintje egyezik a szólista mostani
     * állapotával; egyébként zár alatt újraépíti és ugyanarra a kulcsra írja.
     *
     * A fingerprintet az építés ELŐTT rögzítjük: ha a szólista építés közben
     * változik, a sor a régi fingerprinttel kerül el, és a következő kérés újraépít.
     *
     * @return array{forms: array<string, int>, words: array<int, array{word: string, rank: int|null, meaning_hu: string|null}>}
     */
    private function loadOrRebuild(): array
    {
        $fingerprint = $this->fingerprint();

        if (($cached = $this->cachedMap($fingerprint)) !== null) {
            return $cached;
        }

        try {
            return Cache::lock(self::LOCK_KEY, self::LOCK_SECONDS)->block(
                self::LOCK_WAIT_SECONDS,
                function () use ($fingerprint): array {
                    // A zárra várva egy másik kérés már felépíthette.
                    if (($cached = $this->cachedMap($fingerprint)) !== null) {
                        return $cached;
                    }

                    $map = $this->build();

                    Cache::put(self::CACHE_KEY, ['fingerprint' => $fingerprint, 'map' => $map], self::TTL_SECONDS);

                    return $map;
                },
            );
        } catch (LockTimeoutException) {
            // Az elemzés ne álljon meg egy elakadt építő miatt: cache-írás nélkül
            // saját térképet építünk (a sort a zár birtokosa írja).
            return $this->build();
        }
    }

    /**
     * A cache-elt térkép, ha a tárolt fingerprint egyezik; egyébként null.
     *
     * @return array{forms: array<string, int>, words: array<int, array{word: string, rank: int|null, meaning_hu: string|null}>}|null
     */
    private function cachedMap(string $fingerprint): ?array
    {
        $cached = Cache::get(self::CACHE_KEY);

        if (! is_array($cached) || ($cached['fingerprint'] ?? null) !== $fingerprint || ! is_array($cached['map'] ?? null)) {
            return null;
        }

        return $cached['map'];
    }

    /**
     * A szólista állapot-ujjlenyomata. A darabszám + legnagyobb id + legutóbbi
     * módosítás együtt minden beszúrást, törlést és módosítást megfog, így a
     * cache-elt térkép a szólista bármely változására automatikusan elavul. Ez egyetlen
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
