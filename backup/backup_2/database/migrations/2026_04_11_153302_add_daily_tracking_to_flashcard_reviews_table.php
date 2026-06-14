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
        Schema::table('flashcard_reviews', function (Blueprint $table) {
            // Date when the card first left 'new' state — used for new_cards_per_day daily cap
            $table->date('introduced_on')->nullable()->after('previous_state');
            // Date of the last actual review — used for max_reviews_per_day daily cap
            $table->date('reviewed_on')->nullable()->after('introduced_on');
        });
    }

    public function down(): void
    {
        Schema::table('flashcard_reviews', function (Blueprint $table) {
            $table->dropColumn(['introduced_on', 'reviewed_on']);
        });
    }
};
