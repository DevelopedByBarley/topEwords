<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Rendhagyó igék hiányzó alternatív alakjai (irr-verbs riport M2).
 *
 * A rendhagyó igék kvíze a helyes "gotten"/"proved"/"leaped" stb. válaszokat is
 * pirosra értékelte, mert a words táblában csak egyetlen alak volt rögzítve.
 * A Merriam-Webster "or"-szintű változatai kerülnek fel '/'-szeparálva; az első
 * változat az elsődleges (ezt mutatja a megjelenítés). Csak a meglévő sorok két
 * igealak-oszlopát írja, más adathoz nem nyúl. Az updated_at bump kötelező: a
 * WordFormMapService cache-ujjlenyomata a MAX(updated_at)-ból képződik.
 */
return new class extends Migration
{
    /** @var array<string, array{verb_past?: string, verb_past_participle?: string}> */
    private const ALTERNATIVE_FORMS = [
        'get' => ['verb_past_participle' => 'got/gotten'],
        'prove' => ['verb_past_participle' => 'proven/proved'],
        'show' => ['verb_past_participle' => 'shown/showed'],
        'mow' => ['verb_past_participle' => 'mown/mowed'],
        'sew' => ['verb_past_participle' => 'sewn/sewed'],
        'sow' => ['verb_past_participle' => 'sown/sowed'],
        'swell' => ['verb_past_participle' => 'swollen/swelled'],
        'shear' => ['verb_past_participle' => 'shorn/sheared'],
        'tread' => ['verb_past_participle' => 'trodden/trod'],
        'strive' => ['verb_past_participle' => 'striven/strived'],
        'shine' => ['verb_past' => 'shone/shined', 'verb_past_participle' => 'shone/shined'],
        'dwell' => ['verb_past' => 'dwelt/dwelled', 'verb_past_participle' => 'dwelt/dwelled'],
        'kneel' => ['verb_past' => 'knelt/kneeled', 'verb_past_participle' => 'knelt/kneeled'],
        'leap' => ['verb_past' => 'leapt/leaped', 'verb_past_participle' => 'leapt/leaped'],
        'spit' => ['verb_past' => 'spat/spit', 'verb_past_participle' => 'spat/spit'],
        'wed' => ['verb_past' => 'wed/wedded', 'verb_past_participle' => 'wed/wedded'],
        'shrink' => ['verb_past' => 'shrank/shrunk'],
        'sink' => ['verb_past' => 'sank/sunk'],
        'stink' => ['verb_past' => 'stank/stunk'],
    ];

    public function up(): void
    {
        foreach (self::ALTERNATIVE_FORMS as $word => $columns) {
            DB::table('words')
                ->where('word', $word)
                ->where('is_irregular', true)
                ->update([...$columns, 'updated_at' => now()]);
        }
    }

    /**
     * Visszaállítás: minden érintett oszlopban csak az elsődleges (első) változat
     * marad — ez azonos a migráció előtti értékkel.
     */
    public function down(): void
    {
        foreach (self::ALTERNATIVE_FORMS as $word => $columns) {
            $primaryOnly = array_map(
                fn (string $value): string => explode('/', $value)[0],
                $columns,
            );

            DB::table('words')
                ->where('word', $word)
                ->where('is_irregular', true)
                ->update([...$primaryOnly, 'updated_at' => now()]);
        }
    }
};
