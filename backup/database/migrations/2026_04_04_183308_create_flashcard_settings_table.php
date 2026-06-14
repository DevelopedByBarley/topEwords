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
        Schema::create('flashcard_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete()->unique();

            // Daily limits
            $table->unsignedSmallInteger('new_cards_per_day')->default(20);
            $table->unsignedSmallInteger('max_reviews_per_day')->default(200);

            // Learning steps (JSON array of minutes, e.g. [1, 10])
            $table->json('learning_steps')->default('[1, 10]');
            $table->unsignedSmallInteger('graduating_interval')->default(1);
            $table->unsignedSmallInteger('easy_interval')->default(4);

            // Ease factors (stored as integer percentages, e.g. 250 = 2.5x)
            $table->unsignedSmallInteger('starting_ease')->default(250);
            $table->unsignedSmallInteger('easy_bonus')->default(130);
            $table->unsignedSmallInteger('hard_interval_modifier')->default(120);
            $table->unsignedSmallInteger('interval_modifier')->default(100);

            // Interval cap
            $table->unsignedSmallInteger('max_interval')->default(365);

            // Lapse (forgotten card) settings
            $table->unsignedTinyInteger('lapse_new_interval')->default(0);
            $table->unsignedTinyInteger('leech_threshold')->default(8);

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('flashcard_settings');
    }
};
