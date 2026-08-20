<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Melyik tőből származik ez a szó, ha az admin alak-kitöltő hozta létre.
     *
     * A képzett alakok (basic → basically) nem a tő extra_forms-ába kerülnek,
     * hanem saját sorként a fő listába — mert saját jelentésük van, és a tő alá
     * kerülve a tő státuszát örökölnék. Ez az oszlop tartja nyilván, mi honnan
     * jött, hogy a beszúrás szűrhető, auditálható és tömegesen visszavonható
     * legyen, ha kiderül, hogy az AI rosszat gyártott.
     *
     * A tő törlésekor null-ra vált (a képzett alak önmagában is érvényes szó).
     */
    public function up(): void
    {
        Schema::table('words', function (Blueprint $table) {
            $table->foreignId('derived_from_word_id')
                ->nullable()
                ->after('forms_checked_at')
                ->constrained('words')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('words', function (Blueprint $table) {
            $table->dropForeign(['derived_from_word_id']);
            $table->dropColumn('derived_from_word_id');
        });
    }
};
