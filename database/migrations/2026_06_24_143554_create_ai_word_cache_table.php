<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_word_cache', function (Blueprint $table) {
            $table->id();
            $table->string('cache_key')->unique();
            $table->string('task', 32);
            $table->string('word');
            $table->string('language', 8)->default('en');
            $table->unsignedSmallInteger('prompt_version')->default(1);
            $table->string('model', 64);
            $table->json('response');
            $table->timestamps();

            $table->index(['task', 'prompt_version']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_word_cache');
    }
};
