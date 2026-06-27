<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Admin által kiosztott csomag-felülírás: null (Stripe dönt) | basic | premium
            $table->string('plan_override', 20)->nullable()->after('ai_access');
        });

        Schema::table('user_word', function (Blueprint $table) {
            $table->index(['user_id', 'status']);
        });

        Schema::table('words', function (Blueprint $table) {
            $table->index('level');
            $table->index('is_irregular');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('plan_override');
        });

        Schema::table('user_word', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'status']);
        });

        Schema::table('words', function (Blueprint $table) {
            $table->dropIndex(['level']);
            $table->dropIndex(['is_irregular']);
        });
    }
};
