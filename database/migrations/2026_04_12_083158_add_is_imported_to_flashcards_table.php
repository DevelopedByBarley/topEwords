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
        Schema::table('flashcards', function (Blueprint $table): void {
            $table->boolean('is_imported')->default(false)->after('color');
        });
    }

    public function down(): void
    {
        Schema::table('flashcards', function (Blueprint $table): void {
            $table->dropColumn('is_imported');
        });
    }
};
