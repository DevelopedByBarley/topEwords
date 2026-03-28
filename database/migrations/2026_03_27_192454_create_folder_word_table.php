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
        Schema::create('folder_word', function (Blueprint $table) {
            $table->foreignId('folder_id')->constrained()->cascadeOnDelete();
            $table->foreignId('word_id')->constrained()->cascadeOnDelete();

            $table->primary(['folder_id', 'word_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('folder_word');
    }
};
