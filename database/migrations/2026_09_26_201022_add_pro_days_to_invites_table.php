<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invites', function (Blueprint $table) {
            // Hány nap Pro-próbaidővel indul a meghívóval regisztráló; null = Ingyenes csomag.
            $table->unsignedSmallInteger('pro_days')->nullable()->after('max_uses');
        });
    }

    public function down(): void
    {
        Schema::table('invites', function (Blueprint $table) {
            $table->dropColumn('pro_days');
        });
    }
};
