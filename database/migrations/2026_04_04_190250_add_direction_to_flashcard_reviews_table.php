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
        Schema::table('flashcard_reviews', function (Blueprint $table) {
            $table->enum('direction', ['front_to_back', 'back_to_front'])
                ->default('front_to_back')
                ->after('flashcard_id');
            $table->unique(['flashcard_id', 'direction']);
        });
    }

    public function down(): void
    {
        Schema::table('flashcard_reviews', function (Blueprint $table) {
            $table->dropUnique(['flashcard_id', 'direction']);
            $table->dropColumn('direction');
            $table->unique('flashcard_id');
        });
    }
};
