<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('flashcard_deck_folder', function (Blueprint $table) {
            $table->foreignId('flashcard_folder_id')->constrained()->cascadeOnDelete();
            $table->foreignId('flashcard_deck_id')->constrained()->cascadeOnDelete();

            $table->primary(['flashcard_folder_id', 'flashcard_deck_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('flashcard_deck_folder');
    }
};
