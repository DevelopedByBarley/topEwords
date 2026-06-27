<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('words', function (Blueprint $table) {
            $table->string('form_base', 100)->nullable()->after('part_of_speech');
            $table->string('verb_past', 100)->nullable()->after('form_base');
            $table->string('verb_past_participle', 100)->nullable()->after('verb_past');
            $table->string('verb_present_participle', 100)->nullable()->after('verb_past_participle');
            $table->string('verb_third_person', 100)->nullable()->after('verb_present_participle');
            $table->tinyInteger('is_irregular')->nullable()->after('verb_third_person');
            $table->string('noun_plural', 100)->nullable()->after('is_irregular');
            $table->string('adj_comparative', 100)->nullable()->after('noun_plural');
            $table->string('adj_superlative', 100)->nullable()->after('adj_comparative');
        });

        DB::statement('UPDATE `words` SET `form_base` = `word` WHERE `form_base` IS NULL');
    }

    public function down(): void
    {
        Schema::table('words', function (Blueprint $table) {
            $table->dropColumn([
                'form_base',
                'verb_past',
                'verb_past_participle',
                'verb_present_participle',
                'verb_third_person',
                'is_irregular',
                'noun_plural',
                'adj_comparative',
                'adj_superlative',
            ]);
        });
    }
};
