<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Shuffle is now on by default. This only changes the default for newly
     * created settings rows (e.g. the calibration firstOrCreate); existing rows
     * keep whatever value they already have.
     */
    public function up(): void
    {
        Schema::table('flashcard_settings', function (Blueprint $table) {
            $table->boolean('shuffle_cards')->default(true)->change();
        });

        Schema::table('flashcard_deck_settings', function (Blueprint $table) {
            $table->boolean('shuffle_cards')->default(true)->change();
        });
    }

    public function down(): void
    {
        Schema::table('flashcard_settings', function (Blueprint $table) {
            $table->boolean('shuffle_cards')->default(false)->change();
        });

        Schema::table('flashcard_deck_settings', function (Blueprint $table) {
            $table->boolean('shuffle_cards')->default(false)->change();
        });
    }
};
