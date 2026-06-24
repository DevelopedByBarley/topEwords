<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('billing_name')->nullable()->after('email');
            $table->string('billing_tax_number')->nullable()->after('billing_name');
            $table->string('billing_country', 2)->default('HU')->after('billing_tax_number');
            $table->string('billing_zip', 10)->nullable()->after('billing_country');
            $table->string('billing_city')->nullable()->after('billing_zip');
            $table->string('billing_address')->nullable()->after('billing_city');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'billing_name',
                'billing_tax_number',
                'billing_country',
                'billing_zip',
                'billing_city',
                'billing_address',
            ]);
        });
    }
};
