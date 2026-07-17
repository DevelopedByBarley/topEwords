<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A billingo_invoices.user_id FK eredetileg cascadeOnDelete volt: fiók törlésekor a
 * helyi NAV-számla-nyilvántartás (stripe_invoice_id ↔ billingo_document_id linkelés) is
 * némán törlődött. Ez könyvelési/megfelelőségi nyilvántartás, amit a törölt felhasználó
 * után is meg kell őriznünk. A FK-t nullOnDelete-re váltjuk (a user_id nullable lesz),
 * így fióktörléskor a számla-sor megmarad, csak a user-hivatkozása nullázódik.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('billingo_invoices', function (Blueprint $table) {
            // Előbb a FK-t bontjuk, hogy az oszlopot nullable-lé lehessen tenni,
            // majd nullOnDelete szabállyal építjük újra.
            $table->dropForeign(['user_id']);
        });

        Schema::table('billingo_invoices', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->change();
        });

        Schema::table('billingo_invoices', function (Blueprint $table) {
            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('billingo_invoices', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
        });

        Schema::table('billingo_invoices', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable(false)->change();
        });

        Schema::table('billingo_invoices', function (Blueprint $table) {
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }
};
