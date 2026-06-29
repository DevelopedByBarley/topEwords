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
        // A validáció max:50-et enged, a DB-oszlop viszont varchar(255) volt — összehangoljuk.
        Schema::table('users', function (Blueprint $table) {
            $table->string('billing_tax_number', 50)->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('billing_tax_number', 255)->nullable()->change();
        });
    }
};
