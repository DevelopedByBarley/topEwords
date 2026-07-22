<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Az AI a beírt ragozott/képzett alakot (pl. "successfully") a lemmára
     * ("successful") lemmatizálja, és a szó a lemma néven kerül be. A képzett
     * alakok (pl. az "-ly" határozószó) viszont nem esnek a meglévő ragozási
     * oszlopok egyikébe sem, így az eredeti beírt alak korábban elveszett és a
     * szó-felismerés (lookup/statuses/search/szövegelemzés) nem találta meg.
     *
     * Az extra_forms a szóhoz tartozó további felszíni alakokat tárolja
     * '/'-szeparálva, azonos formátumban a többi alak-oszloppal, így a
     * WordStatusFormExpander::FORM_COLUMNS-ba felvéve minden felület
     * automatikusan felismeri.
     */
    public function up(): void
    {
        Schema::table('words', function (Blueprint $table) {
            $table->string('extra_forms', 255)->nullable()->after('adj_superlative');
        });

        Schema::table('user_custom_words', function (Blueprint $table) {
            $table->string('extra_forms', 255)->nullable()->after('adj_superlative');
        });
    }

    public function down(): void
    {
        Schema::table('words', function (Blueprint $table) {
            $table->dropColumn('extra_forms');
        });

        Schema::table('user_custom_words', function (Blueprint $table) {
            $table->dropColumn('extra_forms');
        });
    }
};
