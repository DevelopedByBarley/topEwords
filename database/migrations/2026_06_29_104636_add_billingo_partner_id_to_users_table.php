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
            // A felhasználóhoz tartozó Billingo partner azonosítója. Egyszer hozzuk
            // létre a számlázási adatokból, utána újrahasználjuk — így a Billingóban
            // nem keletkezik minden számlánál új, duplikált partner. Rendszer által
            // kezelt mező, ezért nem fillable.
            $table->unsignedBigInteger('billingo_partner_id')->nullable()->after('billing_type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('billingo_partner_id');
        });
    }
};
