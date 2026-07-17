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
        // Központi Stripe event-id idempotencia. A Stripe legalább-egyszer kézbesít
        // (lassú vagy hibás válasznál újraküld ugyanazzal az evt_… id-val), ezért minden
        // eseményt feldolgozás ELŐTT ide szúrunk be; az egyedi event_id ütközés jelzi a
        // duplikátumot, amit érdemi munka nélkül nyugtázunk. A sort csak sikeres feldolgozás
        // után hagyjuk állni — kivételkor töröljük, hogy a Stripe-újraküldés újrapróbálhasson.
        Schema::create('stripe_webhook_events', function (Blueprint $table) {
            $table->id();
            $table->string('event_id')->unique();
            $table->string('type')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('stripe_webhook_events');
    }
};
