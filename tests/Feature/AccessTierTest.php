<?php

use App\Models\User;
use Illuminate\Support\Facades\URL;

test('new user is on the free plan with limitations', function () {
    $user = User::factory()->create();

    expect($user->currentPlan())->toBe('free')
        ->and($user->hasActiveAccess())->toBeFalse()
        ->and($user->isOnFreePlan())->toBeTrue()
        ->and($user->hasAiAccess())->toBeFalse();
});

test('basic override grants unlimited access without ai', function () {
    $user = User::factory()->basic()->create();

    expect($user->currentPlan())->toBe('basic')
        ->and($user->hasActiveAccess())->toBeTrue()
        ->and($user->isOnFreePlan())->toBeFalse()
        ->and($user->hasAiAccess())->toBeFalse();
});

test('premium override grants unlimited access with ai', function () {
    $user = User::factory()->premium()->create();

    expect($user->currentPlan())->toBe('premium')
        ->and($user->hasActiveAccess())->toBeTrue()
        ->and($user->hasAiAccess())->toBeTrue();
});

test('lifetime access maps to premium', function () {
    $user = User::factory()->create(['lifetime_access' => true]);

    expect($user->currentPlan())->toBe('premium')
        ->and($user->hasAiAccess())->toBeTrue();
});

test('ai_access flag grants ai even on free plan', function () {
    $user = User::factory()->create(['ai_access' => true]);

    expect($user->currentPlan())->toBe('free')
        ->and($user->hasAiAccess())->toBeTrue();
});

test('free user cannot create a second flashcard deck', function () {
    $user = User::factory()->create();
    $user->flashcardDecks()->create(['name' => 'Első pakli']);

    $this->actingAs($user)
        ->post(route('flashcards.store'), ['name' => 'Második pakli'])
        ->assertSessionHas('error');

    expect($user->flashcardDecks()->count())->toBe(1);
});

test('basic user can create multiple flashcard decks', function () {
    $user = User::factory()->basic()->create();
    $user->flashcardDecks()->create(['name' => 'Első pakli']);

    $this->actingAs($user)
        ->post(route('flashcards.store'), ['name' => 'Második pakli'])
        ->assertSessionHasNoErrors();

    expect($user->flashcardDecks()->count())->toBe(2);
});

test('free user is limited to ten custom words', function () {
    $user = User::factory()->create();

    foreach (range(1, 10) as $i) {
        $user->customWords()->create(['word' => "word{$i}"]);
    }

    $this->actingAs($user)
        ->post(route('custom-words.store'), ['word' => 'eleventh', 'meaning_hu' => 'tizenegyedik'])
        ->assertSessionHas('error');

    expect($user->customWords()->count())->toBe(10);
});

// ── Stripe előfizetés → csomag (ár-alapú) ─────────────────────────────────────

function makeSubscription(User $user, string $type, string $price): void
{
    $user->subscriptions()->create([
        'type' => $type,
        'stripe_id' => 'sub_'.uniqid(),
        'stripe_status' => 'active',
        'stripe_price' => $price,
        'quantity' => 1,
    ]);
}

test('basic price subscription maps to basic plan', function () {
    config(['services.stripe.basic_price_id' => 'price_basic', 'services.stripe.premium_price_id' => 'price_premium']);
    $user = User::factory()->create();
    makeSubscription($user, 'default', 'price_basic');

    expect($user->currentPlan())->toBe('basic')
        ->and($user->hasAiAccess())->toBeFalse();
});

test('premium price subscription maps to premium plan regardless of type name', function () {
    config(['services.stripe.basic_price_id' => 'price_basic', 'services.stripe.premium_price_id' => 'price_premium']);
    $user = User::factory()->create();
    // swap után a 'default' típusú előfizetésen is lehet prémium ár
    makeSubscription($user, 'default', 'price_premium');

    expect($user->currentPlan())->toBe('premium')
        ->and($user->hasAiAccess())->toBeTrue();
});

test('book limit follows the subscription price, not the type name', function () {
    config(['services.stripe.basic_price_id' => 'price_basic', 'services.stripe.premium_price_id' => 'price_premium']);
    $user = User::factory()->create();
    // swap után prémium árú, de 'default' típusú előfizetés: ár alapján prémium limit jár.
    makeSubscription($user, 'default', 'price_premium');

    $this->actingAs($user)
        ->getJson(route('text-analysis.books.index'))
        ->assertOk()
        ->assertJsonPath('bookLimit', 5);
});

test('youtube limit follows the subscription price, not the type name', function () {
    config(['services.stripe.basic_price_id' => 'price_basic', 'services.stripe.premium_price_id' => 'price_premium']);
    $user = User::factory()->create();
    makeSubscription($user, 'default', 'price_premium');

    $this->actingAs($user)
        ->getJson(route('text-analysis.youtube.index'))
        ->assertOk()
        ->assertJsonPath('youtubeLimit', 10);
});

test('checkout redirects with info when buying the already active plan', function () {
    config([
        'services.stripe.enabled' => true,
        'services.stripe.basic_price_id' => 'price_basic',
        'services.stripe.premium_price_id' => 'price_premium',
        'cashier.key' => 'pk_test_real',
    ]);
    // withBilling(): a checkout számlázási kapuőrén át kell jutnia, hogy elérje a
    // "már ez az aktív csomagod" ágat (különben a billing.edit-re irányítana).
    $user = User::factory()->withBilling()->create();
    makeSubscription($user, 'default', 'price_basic');

    // accept_terms: a checkout kötelező consent-ellenőrzésén is át kell jutni.
    $this->actingAs($user)
        ->post(route('pricing.checkout', 'basic'), ['accept_terms' => true])
        ->assertRedirect(route('pricing'))
        ->assertSessionHas('info');

    // A hozzájárulás naplózódott.
    expect($user->fresh()->terms_accepted_at)->not->toBeNull();
});

test('canceled subscription past its end date no longer grants access', function () {
    config(['services.stripe.basic_price_id' => 'price_basic', 'services.stripe.premium_price_id' => 'price_premium']);
    $user = User::factory()->create();
    $user->subscriptions()->create([
        'type' => 'default',
        'stripe_id' => 'sub_'.uniqid(),
        'stripe_status' => 'canceled',
        'stripe_price' => 'price_basic',
        'quantity' => 1,
        'ends_at' => now()->subDay(),
    ]);

    expect($user->currentPlan())->toBe('free');
});

// ── Admin hozzáférés-kiosztás ─────────────────────────────────────────────────

test('admin can grant any plan by email', function () {
    config(['app.admin_email' => 'admin@example.com']);
    $admin = User::factory()->create(['email' => 'admin@example.com']);
    $target = User::factory()->create();

    $this->actingAs($admin)
        ->post(route('admin.access.set'), ['email' => $target->email, 'plan' => 'premium'])
        ->assertRedirect();

    expect($target->refresh()->currentPlan())->toBe('premium');

    $this->actingAs($admin)
        ->post(route('admin.access.set'), ['email' => $target->email, 'plan' => 'basic']);

    expect($target->refresh()->currentPlan())->toBe('basic');

    $this->actingAs($admin)
        ->post(route('admin.access.set'), ['email' => $target->email, 'plan' => 'none']);

    expect($target->refresh()->currentPlan())->toBe('free');
});

test('non-admin cannot grant access', function () {
    config(['app.admin_email' => 'admin@example.com']);
    $user = User::factory()->create();
    $target = User::factory()->create();

    $this->actingAs($user)
        ->post(route('admin.access.set'), ['email' => $target->email, 'plan' => 'premium'])
        ->assertForbidden();

    expect($target->refresh()->plan_override)->toBeNull();
});

test('checkout is unavailable when stripe is disabled', function () {
    config(['services.stripe.enabled' => false]);
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('pricing.checkout', 'basic'))
        ->assertNotFound();

    $this->actingAs($user)
        ->post(route('pricing.checkout', 'premium'))
        ->assertNotFound();
});

test('pricing page reports stripe state from config', function () {
    config([
        'services.stripe.enabled' => true,
        'services.stripe.basic_price_id' => 'price_test_basic',
        'services.stripe.premium_price_id' => 'price_test_premium',
        'cashier.key' => 'pk_test_real',
    ]);

    $this->get(route('pricing'))
        ->assertInertia(fn ($page) => $page->where('stripeConfigured', true));

    config(['services.stripe.enabled' => false]);

    $this->get(route('pricing'))
        ->assertInertia(fn ($page) => $page->where('stripeConfigured', false));
});

test('billingEnabled is shared and reflects config', function () {
    config(['services.stripe.enabled' => false]);
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertInertia(fn ($page) => $page->where('billingEnabled', false));
});

test('cancelled checkout redirects with an info message', function () {
    $this->get(route('pricing', ['checkout' => 'cancelled']))
        ->assertRedirect(route('pricing'))
        ->assertSessionHas('info');
});

test('success route flashes a confirmation message', function () {
    $user = User::factory()->create();
    // Aktív előfizetés kell a "sikeres" üzenethez — webhook nélkül a success oldal
    // "feldolgozás alatt" (info) üzenetet ad (lásd PricingController::success, Kö1).
    $user->subscriptions()->create([
        'type' => 'default',
        'stripe_id' => 'sub_'.uniqid(),
        'stripe_status' => 'active',
        'stripe_price' => 'price_basic',
        'quantity' => 1,
    ]);

    $this->actingAs($user)
        ->get(URL::temporarySignedRoute('pricing.success', now()->addMinutes(10)))
        ->assertRedirect(route('pricing'))
        ->assertSessionHas('success');
});

test('admin access endpoint rejects invalid plans', function () {
    config(['app.admin_email' => 'admin@example.com']);
    $admin = User::factory()->create(['email' => 'admin@example.com']);
    $target = User::factory()->create();

    $this->actingAs($admin)
        ->post(route('admin.access.set'), ['email' => $target->email, 'plan' => 'godmode'])
        ->assertSessionHasErrors('plan');
});
