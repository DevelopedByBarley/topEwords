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
            // A számla partnernek való e-mailes kézbesítésének időpontja. A Billingo a
            // dokumentum létrehozásakor NEM küld e-mailt — azt külön végpont teszi.
            // Külön nyilvántartva, hogy a job-újrapróba ne küldje ki kétszer, és egy
            // korábban kiállított, de el nem küldött számla utólag is kimehessen.
            $table->timestamp('emailed_at')->nullable()->after('invoice_number');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('billingo_invoices', function (Blueprint $table) {
            $table->dropColumn('emailed_at');
        });
    }
};
