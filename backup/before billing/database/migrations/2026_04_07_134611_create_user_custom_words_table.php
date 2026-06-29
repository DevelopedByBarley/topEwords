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
            $table->string('extra_meanings', 500)->nullable();
            $table->string('synonyms', 255)->nullable();
            $table->string('part_of_speech', 20)->nullable();
            $table->string('example_en')->nullable();
            $table->string('example_hu', 500)->nullable();
            $table->string('form_base', 100)->nullable();
            $table->string('verb_past', 100)->nullable();
            $table->string('verb_past_participle', 100)->nullable();
            $table->string('verb_present_participle', 100)->nullable();
            $table->string('verb_third_person', 100)->nullable();
            $table->boolean('is_irregular')->default(false);
            $table->string('noun_plural', 100)->nullable();
            $table->string('adj_comparative', 100)->nullable();
            $table->string('adj_superlative', 100)->nullable();
            $table->string('status', 20)->nullable()->default(null);
            $table->date('reviewed_at')->nullable();
            $table->unsignedTinyInteger('importance')->nullable();
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
