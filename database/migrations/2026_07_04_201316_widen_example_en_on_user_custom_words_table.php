<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_custom_words', function (Blueprint $table) {
            $table->string('example_en', 500)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('user_custom_words', function (Blueprint $table) {
            $table->string('example_en', 255)->nullable()->change();
        });
    }
};
