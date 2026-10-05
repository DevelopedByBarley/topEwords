<?php

use App\Http\Controllers\StripeWebhookController;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Laravel\Cashier\Subscription;

function makeActiveSubscription(User $user, string $price): void
{
    makeCleanupSubscription($user, $price, 'active');
}

function makeCleanupSubscription(User $user, string $price, string $status): Subscription
{
    return $user->subscriptions()->create([
        'type' => 'default',
        'stripe_id' => 'sub_'.uniqid(),
        'stripe_status' => $status,
        'stripe_price' => $price,
        'quantity' => 1,
    ]);
}

test('a single active subscription has no duplicates to cancel', function () {
    $user = User::factory()->create();
    makeActiveSubscription($user, 'price_basic');

    $duplicates = (new StripeWebhookController)->duplicateSubscriptionsFor($user);

    expect($duplicates)->toHaveCount(0);
});

test('a duplikátum lemondása critical riasztást ad — kézi refund és Billingo-sztornó kellhet', function () {
    $user = User::factory()->create();
    makeActiveSubscription($user, 'price_basic');
    makeActiveSubscription($user, 'price_premium');

    Log::spy();

    (new StripeWebhookController)->cancelDuplicateSubscriptions($user);

    Log::shouldHaveReceived('critical')
        ->once()
        ->withArgs(fn (string $message, array $context) => $context['user_id'] === $user->id);
});

test('egyetlen előfizetésnél nincs riasztás', function () {
    $user = User::factory()->create();
    makeActiveSubscription($user, 'price_basic');

    Log::spy();

    (new StripeWebhookController)->cancelDuplicateSubscriptions($user);

    Log::shouldNotHaveReceived('critical');
});

test('W-L5: ha a user-szintű lockot már más birtokolja, a takarítás kimarad (nem buktat, nem mond le)', function () {
    $user = User::factory()->create();
    makeActiveSubscription($user, 'price_basic');
    makeActiveSubscription($user, 'price_premium');

    $held = Cache::lock("stripe:dup-subs:{$user->id}", 30);
    expect($held->get())->toBeTrue();

    $controller = new class extends StripeWebhookController
    {
        protected int $duplicateCleanupLockWaitSeconds = 0;
    };

    Log::spy();

    $controller->cancelDuplicateSubscriptions($user);

    Log::shouldHaveReceived('critical')
        ->once()
        ->withArgs(fn (string $message, array $context): bool => str_contains($message, 'lock foglalt')
            && $context['user_id'] === $user->id);
    expect($user->subscriptions()->whereNull('ends_at')->count())->toBe(2);

    $held->release();
});

test('the earliest active subscription is kept and later ones are duplicates', function () {
    $user = User::factory()->create();
    $older = makeCleanupSubscription($user, 'price_basic', 'active');
    $older->forceFill(['created_at' => now()->subDays(2)])->save();
    $newer = makeCleanupSubscription($user, 'price_premium', 'active');

    $duplicates = (new StripeWebhookController)->duplicateSubscriptionsFor($user);

    expect($duplicates->pluck('id')->all())->toBe([$newer->id]);
});

test('F9A-L5: a keeper a created_at szerinti legrégebbi, akkor is, ha a nagyobb id-jű', function () {
    $user = User::factory()->create();
    $newerByTime = makeCleanupSubscription($user, 'price_basic', 'active');
    $newerByTime->forceFill(['created_at' => now()->subHour()])->save();
    $olderByTime = makeCleanupSubscription($user, 'price_premium', 'active');
    $olderByTime->forceFill(['created_at' => now()->subDays(3)])->save();

    $duplicates = (new StripeWebhookController)->duplicateSubscriptionsFor($user);

    expect($duplicates->pluck('id')->all())->toBe([$newerByTime->id])
        ->and($user->refresh()->activeSubscription()?->is($olderByTime))->toBeTrue();
});

test('F9A-L5: a takarítás ténylegesen a legrégebbi érvényes sort tartja meg, az újabbat mondja le', function () {
    $user = User::factory()->create();
    $older = makeCleanupSubscription($user, 'price_basic', 'active');
    $older->forceFill(['created_at' => now()->subDays(2)])->save();
    $newer = makeCleanupSubscription($user, 'price_premium', 'active');

    $cancelled = [];
    $controller = new class($cancelled) extends StripeWebhookController
    {
        /** @param  array<int, int>  $cancelled */
        public function __construct(private array &$cancelled) {}

        public function duplicateSubscriptionsFor(User $user): Collection
        {
            return parent::duplicateSubscriptionsFor($user)->map(function (Subscription $subscription): Subscription {
                $this->cancelled[] = $subscription->id;

                $mock = Mockery::mock(Subscription::class)->makePartial();
                $mock->setRawAttributes($subscription->getAttributes(), true);
                $mock->exists = true;
                $mock->shouldReceive('cancelNow')->once()->andReturnSelf();

                return $mock;
            });
        }
    };

    Log::spy();

    $controller->cancelDuplicateSubscriptions($user);

    expect($cancelled)->toBe([$newer->id]);
    Log::shouldHaveReceived('critical')
        ->once()
        ->withArgs(fn (string $message, array $context): bool => $context['duplicate_subscription_stripe_id'] === $newer->stripe_id);
});

test('a healthy subscription is kept even when an unhealthy one was created earlier', function () {
    $user = User::factory()->create();
    $broken = makeCleanupSubscription($user, 'price_basic', 'past_due');
    $broken->forceFill(['created_at' => now()->subDays(2)])->save();
    $healthy = makeCleanupSubscription($user, 'price_premium', 'active');

    $duplicates = (new StripeWebhookController)->duplicateSubscriptionsFor($user);

    expect($duplicates)->toHaveCount(1)
        ->and($duplicates->first()->id)->toBe($broken->id)
        ->and($duplicates->pluck('id'))->not->toContain($healthy->id);
});

test('with no healthy subscription the earliest is still the keeper', function () {
    $user = User::factory()->create();
    $first = makeCleanupSubscription($user, 'price_basic', 'past_due');
    $first->forceFill(['created_at' => now()->subDays(2)])->save();
    $second = makeCleanupSubscription($user, 'price_premium', 'incomplete');

    $duplicates = (new StripeWebhookController)->duplicateSubscriptionsFor($user);

    expect($duplicates)->toHaveCount(1)
        ->and($duplicates->first()->id)->toBe($second->id);
});

test('already-canceled subscriptions are not counted as duplicates', function () {
    $user = User::factory()->create();
    makeActiveSubscription($user, 'price_basic');

    $user->subscriptions()->create([
        'type' => 'default',
        'stripe_id' => 'sub_'.uniqid(),
        'stripe_status' => 'active',
        'stripe_price' => 'price_premium',
        'quantity' => 1,
        'ends_at' => now()->addDays(5),
    ]);

    $duplicates = (new StripeWebhookController)->duplicateSubscriptionsFor($user);

    expect($duplicates)->toHaveCount(0);
});

test('F9A-L1: régebbi élő + újabb lemondott sor mellett a user nem esik Free-re', function () {
    $user = User::factory()->create();
    $older = makeCleanupSubscription($user, 'price_premium', 'active');
    $older->forceFill(['created_at' => now()->subDays(2)])->save();
    makeCleanupSubscription($user, 'price_premium', 'canceled')
        ->forceFill(['ends_at' => now()->subMinute()])->save();

    $user->refresh();

    expect($user->activeSubscription()?->is($older))->toBeTrue()
        ->and($user->hasActiveAccess())->toBeTrue()
        ->and($user->currentPlan())->toBe('premium');
});

test('F9A-L1: a takarító keepere és az activeSubscription() ugyanaz a sor', function () {
    $user = User::factory()->create();
    $older = makeCleanupSubscription($user, 'price_premium', 'active');
    $older->forceFill(['created_at' => now()->subDays(2)])->save();
    $newer = makeCleanupSubscription($user, 'price_premium', 'past_due');

    $duplicates = (new StripeWebhookController)->duplicateSubscriptionsFor($user);

    expect($duplicates->pluck('id')->all())->toBe([$newer->id])
        ->and($user->refresh()->activeSubscription()?->is($older))->toBeTrue();
});

test('F9A-L1: grace period-os régi sor mellett az új, nem lemondott előfizetés számít', function () {
    $user = User::factory()->create();
    $graced = makeCleanupSubscription($user, 'price_premium', 'active');
    $graced->forceFill(['created_at' => now()->subDays(2), 'ends_at' => now()->addDays(5)])->save();
    $fresh = makeCleanupSubscription($user, 'price_premium', 'active');

    expect($user->refresh()->activeSubscription()?->is($fresh))->toBeTrue();
});

test('F9A-L1: csak grace period-os sor esetén azt adja vissza (a hozzáférés a periódus végéig él)', function () {
    $user = User::factory()->create();
    $graced = makeCleanupSubscription($user, 'price_premium', 'active');
    $graced->forceFill(['ends_at' => now()->addDays(5)])->save();

    expect($user->refresh()->activeSubscription()?->is($graced))->toBeTrue()
        ->and($user->activeSubscription()->onGracePeriod())->toBeTrue();
});

test('F9A-L1: a megosztott Inertia isSubscribed a régebbi élő sort is látja', function () {
    $user = User::factory()->create(['onboarding_completed_at' => now()]);
    $older = makeCleanupSubscription($user, 'price_premium', 'active');
    $older->forceFill(['created_at' => now()->subDays(2)])->save();
    makeCleanupSubscription($user, 'price_premium', 'canceled')
        ->forceFill(['ends_at' => now()->subMinute()])->save();

    $this->actingAs($user)
        ->get('/handbook')
        ->assertInertia(fn ($page) => $page
            ->where('auth.subscription.isSubscribed', true)
            ->where('auth.subscription.hasActiveAccess', true));
});
