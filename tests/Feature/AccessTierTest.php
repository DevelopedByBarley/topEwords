<?php

use App\Models\User;
use Illuminate\Support\Facades\URL;

test('new user is on the free plan with limitations but an ai taste', function () {
    $user = User::factory()->create();

    // AI minden csomagon elérhető; a Free kis havi keretet (kóstolót) kap.
    expect($user->currentPlan())->toBe('free')
        ->and($user->hasActiveAccess())->toBeFalse()
        ->and($user->isOnFreePlan())->toBeTrue()
        ->and($user->hasAiAccess())->toBeTrue()
        ->and($user->aiMonthlyLimit())->toBe(config('plans.limits.free.ai_budget_micros'));
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

test('ai is available on the free plan (taste), gated by the monthly budget', function () {
    $user = User::factory()->create();

    expect($user->currentPlan())->toBe('free')
        ->and($user->hasAiAccess())->toBeTrue()
        ->and($user->aiMonthlyLimit())->toBeLessThan((int) config('plans.limits.premium.ai_budget_micros'));
});

test('free user can create multiple flashcard decks', function () {
    $user = User::factory()->create();
    $user->flashcardDecks()->create(['name' => 'Első pakli']);

    $this->actingAs($user)
        ->post(route('flashcards.store'), ['name' => 'Második pakli'])
        ->assertSessionHasNoErrors();

    expect($user->flashcardDecks()->count())->toBe(2);
});

test('free user is capped at fifty flashcards across all decks', function () {
    $user = User::factory()->create();
    $deckA = $user->flashcardDecks()->create(['name' => 'A']);
    $deckB = $user->flashcardDecks()->create(['name' => 'B']);

    $fill = fn ($deck, $n) => $deck->flashcards()->createMany(
        collect(range(1, $n))->map(fn ($i) => ['front' => "{$deck->id}-{$i}", 'back' => 'b'])->all()
    );
    $fill($deckA, 25);
    $fill($deckB, 24); // összesen 49, két pakliban szétosztva

    expect($user->canAddFlashcards())->toBeTrue();

    $fill($deckB, 1); // most 50

    expect($user->canAddFlashcards())->toBeFalse()
        ->and($user->flashcards()->count())->toBe(50);
});

test('pro user can create multiple flashcard decks', function () {
    $user = User::factory()->premium()->create();
    $user->flashcardDecks()->create(['name' => 'Első pakli']);

    $this->actingAs($user)
        ->post(route('flashcards.store'), ['name' => 'Második pakli'])
        ->assertSessionHasNoErrors();

    expect($user->flashcardDecks()->count())->toBe(2);
});

test('free user can add more than ten custom words', function () {
    $user = User::factory()->create();

    foreach (range(1, 11) as $i) {
        $user->customWords()->create(['word' => "word{$i}"]);
    }

    $this->actingAs($user)
        ->post(route('custom-words.store'), ['word' => 'twelfth', 'meaning_hu' => 'tizenkettedik'])
        ->assertSessionHasNoErrors();

    expect($user->customWords()->count())->toBe(12);
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

test('any active subscription maps to the single paid (Pro) plan, regardless of type name', function () {
    $user = User::factory()->create();
    // swap után a 'default' típusú előfizetésen is lehet a Pro ár — minden aktív
    // előfizetés = premium (egyetlen fizetős csomag van).
    makeSubscription($user, 'default', 'price_pro');

    expect($user->currentPlan())->toBe('premium')
        ->and($user->hasActiveAccess())->toBeTrue()
        ->and($user->hasAiAccess())->toBeTrue();
});

test('book limit follows the paid plan for any active subscription', function () {
    $user = User::factory()->create();
    makeSubscription($user, 'default', 'price_pro');

    $this->actingAs($user)
        ->getJson(route('text-analysis.books.index'))
        ->assertOk()
        ->assertJsonPath('bookLimit', 7);
});

test('youtube limit follows the paid plan for any active subscription', function () {
    $user = User::factory()->create();
    makeSubscription($user, 'default', 'price_pro');

    $this->actingAs($user)
        ->getJson(route('text-analysis.youtube.index'))
        ->assertOk()
        ->assertJsonPath('youtubeLimit', 40);
});

test('checkout redirects with info when buying the already active plan', function () {
    config([
        'services.stripe.enabled' => true,
        'services.stripe.premium_price_id' => 'price_pro',
        'cashier.key' => 'pk_test_real',
    ]);
    // withBilling(): a checkout számlázási kapuőrén át kell jutnia, hogy elérje a
    // "már ez az aktív csomagod" ágat (különben a billing.edit-re irányítana).
    $user = User::factory()->withBilling()->create();
    // Ugyanazon a Pro áron van már előfizetve — a swap-ág "már aktív"-ot ad.
    makeSubscription($user, 'premium', 'price_pro');

    // accept_terms: a checkout kötelező consent-ellenőrzésén is át kell jutni.
    $this->actingAs($user)
        ->post(route('pricing.checkout', 'premium'), ['accept_terms' => true])
        ->assertRedirect(route('pricing'))
        ->assertSessionHas('info');

    // A hozzájárulás naplózódott.
    expect($user->fresh()->terms_accepted_at)->not->toBeNull();
});

test('canceled subscription past its end date no longer grants access', function () {
    $user = User::factory()->create();
    $user->subscriptions()->create([
        'type' => 'default',
        'stripe_id' => 'sub_'.uniqid(),
        'stripe_status' => 'canceled',
        'stripe_price' => 'price_pro',
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
        ->post(route('admin.access.set'), ['email' => $target->email, 'plan' => 'none']);

    expect($target->refresh()->currentPlan())->toBe('free');
});

test('unverified user with the admin email is not an admin', function () {
    config(['app.admin_email' => 'admin@example.com']);
    // Az admin-email önmagában nem elég: megerősítetlen fiókkal (pl. az
    // admin-emailre való regisztrációval/e-mail-átírással) nem jár admin-jog.
    $impostor = User::factory()->unverified()->create(['email' => 'admin@example.com']);

    expect($impostor->isAdmin())->toBeFalse();

    $this->actingAs($impostor)
        ->post(route('admin.access.set'), ['email' => $impostor->email, 'plan' => 'premium'])
        ->assertRedirect(route('verification.notice'));

    expect($impostor->refresh()->plan_override)->toBeNull();
});

test('verified admin passes the admin gate', function () {
    config(['app.admin_email' => 'admin@example.com']);
    $admin = User::factory()->create(['email' => 'admin@example.com']);

    expect($admin->isAdmin())->toBeTrue();

    $this->actingAs($admin)->get(route('admin'))->assertOk();
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
        ->post(route('pricing.checkout', 'premium'))
        ->assertNotFound();
});

test('pricing page reports stripe state from config', function () {
    config([
        'services.stripe.enabled' => true,
        'services.stripe.premium_price_id' => 'price_test_pro',
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
        'stripe_price' => 'price_pro',
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
