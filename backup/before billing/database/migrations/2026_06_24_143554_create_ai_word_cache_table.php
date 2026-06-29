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
        Schema::create('ai_word_cache', function (Blueprint $table) {
            $table->id();
            // task:word:language:prompt_version — egy szó AI-válasza, minden
            // felhasználó között megosztva. Egyedi, mert ezen keresünk rá.
            $table->string('cache_key')->unique();
            $table->string('task', 32);
            $table->string('word');
            $table->string('language', 8)->default('en');
            // Verziózás: prompt vagy modell változásakor bumppal a régi sorok
            // elérhetetlenné válnak (új kulcs), és az ai:cache:clear kipucolja őket.
            $table->unsignedSmallInteger('prompt_version')->default(1);
            $table->string('model', 64);
            $table->json('response');
            $table->timestamps();

            // A prune/clear parancs task + verzió szerint takarít.
            $table->index(['task', 'prompt_version']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ai_word_cache');
    }
};
