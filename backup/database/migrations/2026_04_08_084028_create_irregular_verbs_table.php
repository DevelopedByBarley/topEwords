<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('irregular_verbs', function (Blueprint $table) {
            $table->id();
            $table->string('infinitive', 100)->unique();
            $table->string('past_simple', 100)->nullable();
            $table->string('past_participle', 100)->nullable();
            $table->string('meaning_hu', 255)->nullable();
            $table->string('example_en', 500)->nullable();
            $table->string('notes', 255)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('irregular_verbs');
    }
};
