<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A validáció (max:500) hosszabb volt, mint az oszlop (varchar 255) —
     * 256–500 karakteres példamondat strict módban 500-as hibát dobott.
     * Az example_hu és az irregular_verbs.example_en már eddig is 500 volt.
     */
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
