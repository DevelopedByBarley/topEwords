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
        Schema::table('billingo_invoices', function (Blueprint $table) {
            // A Billingo createDocument-hívás MEGKEZDÉSÉNEK időpontja. A Billingo v3-nak
            // nincs idempotency-key headere, és a NAV-számla a createDocument sikeres
            // válaszakor már ki van adva — ha a worker a válasz és a billingo_document_id
            // elmentése közti ablakban meghal (OOM, deploy-restart), a retry isIssued()===false-t
            // látna, és MÁSODIK NAV-számlát állítana ki új sorszámmal. Ez a jelző a hívás ELŐTT
            // perzisztálódik: ha a retry beállítva de dokumentum-id nélkül találja, előbb
            // Billingo-oldali ellenőrzés keresi meg a már kiadott számlát, és csak akkor
            // állít ki újat, ha ott sincs nyoma.
            $table->timestamp('issuing_started_at')->nullable()->after('invoice_number');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('billingo_invoices', function (Blueprint $table) {
            $table->dropColumn('issuing_started_at');
        });
    }
};
