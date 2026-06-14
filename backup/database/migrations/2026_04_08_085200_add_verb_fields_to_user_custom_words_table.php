<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_custom_words', function (Blueprint $table) {
            $table->string('extra_meanings', 500)->nullable()->after('meaning_hu');
            $table->string('synonyms', 255)->nullable()->after('extra_meanings');
            $table->string('example_hu', 500)->nullable()->after('example_en');
            $table->string('form_base', 100)->nullable()->after('example_hu');
            $table->string('verb_past', 100)->nullable()->after('form_base');
            $table->string('verb_past_participle', 100)->nullable()->after('verb_past');
            $table->string('verb_present_participle', 100)->nullable()->after('verb_past_participle');
            $table->string('verb_third_person', 100)->nullable()->after('verb_present_participle');
            $table->boolean('is_irregular')->default(false)->after('verb_third_person');
            $table->string('noun_plural', 100)->nullable()->after('is_irregular');
            $table->string('adj_comparative', 100)->nullable()->after('noun_plural');
            $table->string('adj_superlative', 100)->nullable()->after('adj_comparative');
        });
    }

    public function down(): void
    {
        Schema::table('user_custom_words', function (Blueprint $table) {
            $table->dropColumn([
                'extra_meanings', 'synonyms', 'example_hu',
                'form_base', 'verb_past', 'verb_past_participle', 'verb_present_participle',
                'verb_third_person', 'is_irregular', 'noun_plural', 'adj_comparative', 'adj_superlative',
            ]);
        });
    }
};
