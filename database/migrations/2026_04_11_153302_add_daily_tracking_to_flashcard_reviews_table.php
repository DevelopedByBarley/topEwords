<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('flashcard_reviews', function (Blueprint $table) {
            $table->date('introduced_on')->nullable()->after('previous_state');
            $table->date('reviewed_on')->nullable()->after('introduced_on');
        });
    }

    public function down(): void
    {
        Schema::table('flashcard_reviews', function (Blueprint $table) {
            $table->dropColumn(['introduced_on', 'reviewed_on']);
        });
    }
};
