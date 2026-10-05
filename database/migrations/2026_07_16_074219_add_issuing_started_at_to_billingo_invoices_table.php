<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('billingo_invoices', function (Blueprint $table) {
            $table->timestamp('issuing_started_at')->nullable()->after('invoice_number');
        });
    }

    public function down(): void
    {
        Schema::table('billingo_invoices', function (Blueprint $table) {
            $table->dropColumn('issuing_started_at');
        });
    }
};
