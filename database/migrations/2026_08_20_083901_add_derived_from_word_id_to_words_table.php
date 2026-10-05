<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('words', function (Blueprint $table) {
            $table->foreignId('derived_from_word_id')
                ->nullable()
                ->after('forms_checked_at')
                ->constrained('words')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('words', function (Blueprint $table) {
            $table->dropForeign(['derived_from_word_id']);
            $table->dropColumn('derived_from_word_id');
        });
    }
};
