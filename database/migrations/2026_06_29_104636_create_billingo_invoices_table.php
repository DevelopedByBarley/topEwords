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
        Schema::create('billingo_invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            // A Stripe invoice azonosítója egyben az idempotencia-kulcs: a webhookot a
            // Stripe többször is kézbesítheti, és a job is újrapróbálkozik — ez a unique
            // index garantálja, hogy egy fizetéshez pontosan egy Billingo számla szülessen.
            $table->string('stripe_invoice_id')->unique();

            // A Billingo dokumentum adatai. Null, amíg a foglalás megvan, de a Billingo
            // hívás még nem fejeződött be sikeresen — így egy újrafutó job folytatni tudja.
            $table->unsignedBigInteger('billingo_document_id')->nullable();
            $table->string('invoice_number')->nullable();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('billingo_invoices');
    }
};
