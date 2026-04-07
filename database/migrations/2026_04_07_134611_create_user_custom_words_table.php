<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_custom_words', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('word');
            $table->string('meaning_hu')->nullable();
            $table->string('part_of_speech', 20)->nullable();
            $table->string('example_en')->nullable();
            $table->string('status', 20)->default('learning');
            $table->timestamps();

            $table->unique(['user_id', 'word']);
            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_custom_words');
    }
};
