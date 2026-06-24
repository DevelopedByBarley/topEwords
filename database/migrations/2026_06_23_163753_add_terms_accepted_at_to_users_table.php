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
        Schema::table('users', function (Blueprint $table) {
            // Naplózható nyom arról, hogy a felhasználó a fizetés előtt kifejezetten
            // hozzájárult a teljesítés azonnali megkezdéséhez (a 14 napos elállási jog
            // elvesztéséhez) és elfogadta az ÁSZF-et. A checkout állítja be.
            $table->timestamp('terms_accepted_at')->nullable()->after('billing_type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('terms_accepted_at');
        });
    }
};
