<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('flashcard_settings', function (Blueprint $table) {
            $table->boolean('shuffle_cards')->default(false)->after('leech_threshold');
        });

        Schema::table('flashcard_deck_settings', function (Blueprint $table) {
            $table->boolean('shuffle_cards')->default(false)->after('leech_threshold');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('flashcard_settings', function (Blueprint $table) {
            $table->dropColumn('shuffle_cards');
        });

        Schema::table('flashcard_deck_settings', function (Blueprint $table) {
            $table->dropColumn('shuffle_cards');
        });
    }
};
