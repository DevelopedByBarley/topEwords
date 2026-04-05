<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('flashcards', function (Blueprint $table) {
            $table->text('front_notes')->nullable()->after('front');
            $table->renameColumn('notes', 'back_notes');
        });
    }

    public function down(): void
    {
        Schema::table('flashcards', function (Blueprint $table) {
            $table->dropColumn('front_notes');
            $table->renameColumn('back_notes', 'notes');
        });
    }
};
