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
        Schema::create('flashcard_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('flashcard_id')->constrained('flashcards')->cascadeOnDelete();
            $table->enum('state', ['new', 'learning', 'review', 'relearning'])->default('new')->index();
            $table->dateTime('due_at')->nullable()->index();
            $table->unsignedSmallInteger('interval')->default(0);
            $table->unsignedSmallInteger('ease_factor')->default(250);
            $table->unsignedSmallInteger('repetitions')->default(0);
            $table->unsignedSmallInteger('lapses')->default(0);
            $table->unsignedTinyInteger('learning_step')->default(0);
            $table->boolean('is_leech')->default(false);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('flashcard_reviews');
    }
};
