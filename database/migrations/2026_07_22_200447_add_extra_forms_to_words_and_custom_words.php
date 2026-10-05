<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('words', function (Blueprint $table) {
            $table->string('extra_forms', 255)->nullable()->after('adj_superlative');
        });

        Schema::table('user_custom_words', function (Blueprint $table) {
            $table->string('extra_forms', 255)->nullable()->after('adj_superlative');
        });
    }

    public function down(): void
    {
        Schema::table('words', function (Blueprint $table) {
            $table->dropColumn('extra_forms');
        });

        Schema::table('user_custom_words', function (Blueprint $table) {
            $table->dropColumn('extra_forms');
        });
    }
};
