<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('user_word', 'importance')) {
            Schema::table('user_word', function (Blueprint $table) {
                $table->unsignedTinyInteger('importance')->nullable()->after('status');
            });
        }

        if (! Schema::hasColumn('user_custom_words', 'importance')) {
            Schema::table('user_custom_words', function (Blueprint $table) {
                $table->unsignedTinyInteger('importance')->nullable()->after('status');
            });
        }
    }

    public function down(): void
    {
        Schema::table('user_word', function (Blueprint $table) {
            $table->dropColumn('importance');
        });

        Schema::table('user_custom_words', function (Blueprint $table) {
            $table->dropColumn('importance');
        });
    }
};
