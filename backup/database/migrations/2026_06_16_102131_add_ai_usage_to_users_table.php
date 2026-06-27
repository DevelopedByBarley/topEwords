<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedInteger('ai_credits_used')->default(0)->after('ai_access');
            $table->timestamp('ai_credits_reset_at')->nullable()->after('ai_credits_used');
            // Per-user felülírás; null = a konfigurációs alap havi keret.
            $table->unsignedInteger('ai_credit_limit')->nullable()->after('ai_credits_reset_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['ai_credits_used', 'ai_credits_reset_at', 'ai_credit_limit']);
        });
    }
};
