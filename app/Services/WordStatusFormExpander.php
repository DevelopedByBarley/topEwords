<?php

namespace App\Services;

/**
 * Egy megjelölt szót (vagy saját szót) a böngésző-bővítmény státusz-térképéhez
 * tartozó összes felszíni alakjára bont.
 *
 * A felhasználó egy alapszót jelöl meg (pl. "run"), de a kiemeléshez a ragozott
 * alakokat is ugyanarra a státuszra kell mappelni ("ran", "running", "runs").
 * Ez a logika korábban csak a teljes térképet építő ExtensionController::statuses()
 * végpontban élt; mostantól innen használja a státusz-váltó végpont is, hogy a
 * kliens egyetlen szó alakjait helyben tudja frissíteni a teljes újratöltés nélkül.
 */
class WordStatusFormExpander
{
    /**
     * A words/user_custom_words táblák ragozott- és képzett-alak oszlopai.
     *
     * Az extra_forms a lemmatizáláskor eldobott, de a felhasználó által beírt
     * eredeti alakokat tárolja (pl. a "successful" lemmához a "successfully"
     * határozószót), hogy a szó-felismerés minden felületen megtalálja őket.
     *
     * @var array<int, string>
     */
    public const FORM_COLUMNS = [
        'form_base', 'verb_past', 'verb_past_participle', 'verb_present_participle',
        'verb_third_person', 'noun_plural', 'adj_comparative', 'adj_superlative',
        'extra_forms',
    ];

    /**
     * Egyetlen sor (szó + ragozott-alak oszlopok) felszíni alakjai, normalizálva
     * és deduplikálva. A nulladik elem mindig az "elsődleges" kulcs (maga a szó/
     * kifejezés); a többi a ragozott alak.
     *
     * @return array<int, string>
     */
    public function formsFor(object $row): array
    {
        $word = (string) $row->word;
        $forms = [];

        // A form-oszlopok '/'-szeparált alternatívákat tartalmazhatnak (pl.
        // "got/gotten", "was/were") — a szóköz-szűrés és a térkép-kulcs is
        // változatonként értendő, ezért minden érték előbb szétbontódik.
        $columnValues = array_map(fn ($column) => $row->{$column} ?? null, self::FORM_COLUMNS);

        if (str_contains($word, ' ')) {
            // Többszavas kifejezés (pl. "used to", "cut through"): az alap-kifejezés,
            // és bármely TÖBBSZAVAS ragozott alak (pl. "make for" → "made for").
            // Az egyszavas form-oszlopokat szándékosan kihagyjuk, különben a "cut"
            // elvinné a "cut through" státuszát minden sima előforduláskor.
            $forms[] = mb_strtolower($word);

            foreach (WordFormVariants::splitAll($columnValues) as $variant) {
                if (str_contains($variant, ' ')) {
                    $forms[] = mb_strtolower(trim((string) preg_replace('/\s+/', ' ', $variant)));
                }
            }
        } else {
            // Egyszavas alak: maga a szó, és minden EGYSZAVAS ragozott alak.
            // A körülírásos közép-/felsőfokok ("more desperate") szóközösek, ezért
            // kimaradnak — különben a kliens kifejezésként emelné ki őket.
            foreach (WordFormVariants::splitAll([$word, ...$columnValues]) as $variant) {
                if (! str_contains($variant, ' ')) {
                    $forms[] = mb_strtolower($variant);
                }
            }
        }

        return array_values(array_unique($forms));
    }

    /**
     * A megjelölt sorokból felépíti a teljes felszíni-alak → státusz térképet.
     *
     * Az elsődleges kulcs (a szó maga) mindig felülírja az ütközőt; a ragozott
     * alakok csak akkor kerülnek be, ha az adott kulcs még üres — így egy
     * kifejezés ragozott alakja nem írja felül egy explicit módon megjelölt szót.
     *
     * @param  iterable<int, object>  $rows
     * @return array<string, string>
     */
    public function mapFrom(iterable $rows): array
    {
        $statuses = [];

        foreach ($rows as $row) {
            foreach ($this->formsFor($row) as $index => $form) {
                if ($index === 0) {
                    $statuses[$form] = $row->status;
                } else {
                    $statuses[$form] ??= $row->status;
                }
            }
        }

        return $statuses;
    }
}
