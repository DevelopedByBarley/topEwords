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
            $table->json('previous_state')->nullable()->after('is_leech');
        });
    }

    public function down(): void
    {
        Schema::table('flashcard_reviews', function (Blueprint $table) {
            $table->dropColumn('previous_state');
        });
    }
};
