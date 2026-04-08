<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_word', function (Blueprint $table) {
            $table->date('reviewed_at')->nullable()->after('status');
        });

        Schema::table('user_custom_words', function (Blueprint $table) {
            $table->date('reviewed_at')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('user_word', function (Blueprint $table) {
            $table->dropColumn('reviewed_at');
        });

        Schema::table('user_custom_words', function (Blueprint $table) {
            $table->dropColumn('reviewed_at');
        });
    }
};
