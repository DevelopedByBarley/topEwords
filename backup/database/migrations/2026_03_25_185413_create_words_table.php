<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('words', function (Blueprint $table) {
            $table->id();
            $table->string('word')->unique();
            $table->string('meaning_hu')->nullable();
            $table->text('extra_meanings')->nullable();
            $table->string('synonyms')->nullable();
            $table->string('part_of_speech', 10)->nullable();
            $table->string('form_base', 100)->nullable();
            $table->string('verb_past', 100)->nullable();
            $table->string('verb_past_participle', 100)->nullable();
            $table->string('verb_present_participle', 100)->nullable();
            $table->string('verb_third_person', 100)->nullable();
            $table->tinyInteger('is_irregular')->nullable();
            $table->string('noun_plural', 100)->nullable();
            $table->string('adj_comparative', 100)->nullable();
            $table->string('adj_superlative', 100)->nullable();
            $table->string('example_en')->nullable();
            $table->string('example_hu')->nullable();
            $table->unsignedInteger('rank')->index();
            $table->tinyInteger('level')->unsigned()->default(1);
            $table->timestamps();
        });

        DB::statement('UPDATE `words` SET `form_base` = `word` WHERE `form_base` IS NULL');

        DB::statement('
            UPDATE words SET level = LEAST(6, FLOOR((rank - 1) * 6.0 / (SELECT MAX(rank) FROM (SELECT MAX(rank) AS max_rank FROM words) AS r)) + 1)
        ');
    }

    public function down(): void
    {
        Schema::dropIfExists('words');
    }
};
