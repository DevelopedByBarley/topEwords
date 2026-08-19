<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Mikor futott le utoljára az admin alak-kitöltő ezen a szón.
     *
     * A kitöltő akkor is beállítja, ha nem talált üres mezőt — épp ez a lényege:
     * a függvényszavaknak (the, of, and) sosem lesz kitöltött alakja, mégis ki
     * kell esniük a „még nincs ellenőrizve" listából, különben örökre benne
     * ragadnának, és a 10 000 szó végigkattintása követhetetlen lenne.
     *
     * Indexelt, mert a szólista szűrője erre az oszlopra megy.
     */
    public function up(): void
    {
        Schema::table('words', function (Blueprint $table) {
            $table->timestamp('forms_checked_at')->nullable()->index()->after('extra_forms');
        });
    }

    public function down(): void
    {
        Schema::table('words', function (Blueprint $table) {
            $table->dropIndex(['forms_checked_at']);
            $table->dropColumn('forms_checked_at');
        });
    }
};
