<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A desktop lejátszó eszköz-párosítási kérelmei (device-flow minta).
     * Egy sor egy folyamatban lévő párosítás: az app kapja a user_code-ot
     * (a felhasználó a böngészőben ezt hagyja jóvá) és a poll_secret-et
     * (csak hash-elve tároljuk — adatbázis-szivárgás esetén sem váltható tokenre).
     * A sor a token kiadásakor törlődik, ezért a beváltás egyszer használatos.
     */
    public function up(): void
    {
        Schema::create('player_pairings', function (Blueprint $table) {
            $table->id();
            $table->string('user_code', 9)->unique();
            $table->string('poll_secret_hash', 64)->unique();
            $table->string('device_name', 100);
            $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->dateTime('expires_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('player_pairings');
    }
};
