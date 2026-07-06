<?php

use App\Models\BillingoInvoice;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;

test('subscription page marks non-subscribed premium-access users correctly', function (array $attributes) {
    // Lifetime / admin-adta (plan_override) hozzáférésnél nincs Stripe-előfizetés,
    // de a UI-nak prémium hozzáférést kell mutatnia — nem "Alap csomag" + CTA-t
    // (a checkout-gatekeeper úgyis elutasítaná a fizetést).
    $user = User::factory()->create($attributes);

    $this->actingAs($user)
        ->get(route('subscription.edit'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/subscription')
            ->where('hasActiveAccess', true)
            ->where('isSubscribed', false)
            ->where('isOnTrial', false)
        );
})->with([
    'plan_override' => [['plan_override' => 'premium']],
    'lifetime_access' => [['lifetime_access' => true]],
]);

test('cancel without an active subscription does not flash a fake success', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from(route('subscription.edit'))
        ->post(route('subscription.cancel'))
        ->assertRedirect(route('subscription.edit'))
        ->assertSessionMissing('success');
});

test('resume without a cancellation informs the user instead of staying silent', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from(route('subscription.edit'))
        ->post(route('subscription.resume'))
        ->assertRedirect(route('subscription.edit'))
        ->assertSessionHas('info')
        ->assertSessionMissing('success');
});

test('the subscription page lists only issued invoices', function () {
    $user = User::factory()->create();

    $issued = BillingoInvoice::create([
        'user_id' => $user->id,
        'stripe_invoice_id' => 'in_issued',
        'billingo_document_id' => 5001,
        'invoice_number' => 'TESZT-2026-1',
    ]);

    // Lefoglalt, de ki nem állított sor (nincs dokumentum-azonosítója) — nem tölthető le,
    // ezért nem szabad megjelennie a listában.
    BillingoInvoice::create([
        'user_id' => $user->id,
        'stripe_invoice_id' => 'in_reserved',
    ]);

    $this->actingAs($user)
        ->get(route('subscription.edit'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/subscription')
            ->has('invoices', 1)
            ->where('invoices.0.id', $issued->id)
            ->where('invoices.0.number', 'TESZT-2026-1')
        );
});

test('a user can download their own issued invoice pdf', function () {
    Http::fake([
        'api.billingo.hu/v3/documents/*/download' => Http::response('%PDF-1.4 fake', 200, ['Content-Type' => 'application/pdf']),
    ]);

    config(['services.billingo.api_key' => 'test-key']);

    $user = User::factory()->create();
    $invoice = BillingoInvoice::create([
        'user_id' => $user->id,
        'stripe_invoice_id' => 'in_dl',
        'billingo_document_id' => 5001,
        'invoice_number' => '2026/A/42',
    ]);

    $response = $this->actingAs($user)
        ->get(route('subscription.invoice.download', $invoice));

    $response->assertOk();
    expect($response->headers->get('content-type'))->toContain('application/pdf');
    expect($response->streamedContent())->toBe('%PDF-1.4 fake');
});

test('a user cannot download another users invoice', function () {
    $owner = User::factory()->create();
    $other = User::factory()->create();

    $invoice = BillingoInvoice::create([
        'user_id' => $owner->id,
        'stripe_invoice_id' => 'in_other',
        'billingo_document_id' => 5001,
        'invoice_number' => 'TESZT-2026-2',
    ]);

    $this->actingAs($other)
        ->get(route('subscription.invoice.download', $invoice))
        ->assertNotFound();
});

test('an unissued invoice cannot be downloaded', function () {
    $user = User::factory()->create();

    $invoice = BillingoInvoice::create([
        'user_id' => $user->id,
        'stripe_invoice_id' => 'in_unissued',
    ]);

    $this->actingAs($user)
        ->get(route('subscription.invoice.download', $invoice))
        ->assertNotFound();
});

test('the subscription portal route is rate limited', function () {
    // Stripe ügyfél nélkül a portál a /pricing-re irányít (nincs valódi Stripe-hívás),
    // így biztonságosan tesztelhető a throttle:10,1 korlát.
    $user = User::factory()->create();

    foreach (range(1, 10) as $i) {
        $this->actingAs($user)
            ->post(route('subscription.portal'))
            ->assertStatus(302);
    }

    $this->actingAs($user)
        ->post(route('subscription.portal'))
        ->assertStatus(429);
});
