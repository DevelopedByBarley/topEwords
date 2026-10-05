<?php

use App\Console\Commands\CloseDecision;
use App\Console\Commands\ReconcileOutcome;
use App\Console\Commands\ReconcileStripeSubscriptions;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Console\OutputStyle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Cashier\Subscription;
use Mockery\MockInterface;
use Stripe\ApiRequestor;
use Stripe\Exception\InvalidRequestException;
use Stripe\HttpClient\ClientInterface;
use Symfony\Component\Console\Input\ArrayInput;
use Symfony\Component\Console\Output\BufferedOutput;

uses(RefreshDatabase::class);

class ReconcilerProbe extends ReconcileStripeSubscriptions
{
    public function reconcilePublic(Subscription $subscription, bool $dryRun = false): CloseDecision|ReconcileOutcome
    {
        $this->dryRun = $dryRun;
        $this->setOutput(new OutputStyle(new ArrayInput([]), new BufferedOutput));

        return $this->reconcile($subscription);
    }

    public function stripeAccountIsVerifiedPublic(): bool
    {
        return $this->stripeAccountIsVerified();
    }
}

class KillSwitchProbe extends ReconcileStripeSubscriptions
{
    /** @var array<string, CloseDecision|ReconcileOutcome> */
    public array $decisions = [];

    /** @var array<int, string> */
    public array $closed = [];

    public bool $accountVerified = true;

    public int $accountChecks = 0;

    /** @var array<int, string> */
    public array $examined = [];

    public BufferedOutput $buffer;

    /**
     * @param  array<string, mixed>  $options
     */
    public function runHandle(array $options = []): int
    {
        $this->buffer = new BufferedOutput;
        $this->setInput(new ArrayInput($options, (new ReconcileStripeSubscriptions)->getDefinition()));
        $this->setOutput(new OutputStyle(new ArrayInput([]), $this->buffer));

        return $this->handle();
    }

    protected function stripeAccountIsVerified(): bool
    {
        $this->accountChecks++;

        return $this->accountVerified;
    }

    protected function reconcile(Subscription $subscription): CloseDecision|ReconcileOutcome
    {
        $this->examined[] = $subscription->stripe_id;

        return $this->decisions[$subscription->stripe_id] ?? ReconcileOutcome::Unchanged;
    }

    protected function closeDeadSubscription(Subscription $subscription, string $reason): void
    {
        $this->closed[] = $subscription->stripe_id;
        parent::closeDeadSubscription($subscription, $reason);
    }
}

function mockSubscriptionReturningStripeStatus(string $localStatus, string $stripeStatus): Subscription&MockInterface
{
    $subscription = Mockery::mock(Subscription::class)->makePartial();
    $subscription->stripe_status = $localStatus;
    $subscription->shouldReceive('asStripeSubscription')
        ->andReturn((object) ['status' => $stripeStatus]);

    return $subscription;
}

/**
 * @return array<int, string>
 */
function seedActiveSubscriptions(int $count): array
{
    $stripeIds = [];

    for ($i = 0; $i < $count; $i++) {
        $user = User::factory()->create(['stripe_id' => 'cus_'.uniqid()]);
        $stripeId = 'sub_'.uniqid();
        $user->subscriptions()->create([
            'type' => 'default',
            'stripe_id' => $stripeId,
            'stripe_status' => 'active',
            'stripe_price' => 'price_basic',
            'quantity' => 1,
            'ends_at' => null,
        ]);
        $stripeIds[] = $stripeId;
    }

    return $stripeIds;
}

test('a Stripe-nál törölt (canceled) előfizetésre lezárás-döntést ad', function () {
    $subscription = mockSubscriptionReturningStripeStatus(localStatus: 'active', stripeStatus: 'canceled');

    $subscription->shouldNotReceive('markAsCanceled');
    $subscription->shouldNotReceive('syncStripeStatus');

    $decision = (new ReconcilerProbe)->reconcilePublic($subscription);

    expect($decision)->toBeInstanceOf(CloseDecision::class);
    expect($decision->reason)->toBe('canceled');
});

test('a Stripe-nál már nem létező (resource_missing) előfizetésre lezárás-döntést ad', function () {
    $subscription = Mockery::mock(Subscription::class)->makePartial();
    $subscription->stripe_status = 'active';
    $subscription->shouldReceive('asStripeSubscription')
        ->andThrow(InvalidRequestException::factory('No such subscription', stripeCode: 'resource_missing'));

    $subscription->shouldNotReceive('markAsCanceled');

    $decision = (new ReconcilerProbe)->reconcilePublic($subscription);

    expect($decision)->toBeInstanceOf(CloseDecision::class);
    expect($decision->reason)->toBe('resource_missing');
});

test('a Stripe-nál is aktív előfizetést nem bántja (Unchanged)', function () {
    $subscription = mockSubscriptionReturningStripeStatus(localStatus: 'active', stripeStatus: 'active');

    $subscription->shouldNotReceive('markAsCanceled');
    $subscription->shouldNotReceive('syncStripeStatus');

    expect((new ReconcilerProbe)->reconcilePublic($subscription))->toBe(ReconcileOutcome::Unchanged);
});

test('az eltérő, de élő státuszt (pl. past_due) szinkronizálja, nem zárja le', function () {
    $subscription = mockSubscriptionReturningStripeStatus(localStatus: 'active', stripeStatus: 'past_due');

    $subscription->shouldReceive('syncStripeStatus')->once();
    $subscription->shouldNotReceive('markAsCanceled');

    expect((new ReconcilerProbe)->reconcilePublic($subscription))->toBe(ReconcileOutcome::Synced);
});

test('a resource_missingtől eltérő Stripe-hibát nem nyeli el (nem zár le tévedésből)', function () {
    $subscription = Mockery::mock(Subscription::class)->makePartial();
    $subscription->stripe_status = 'active';
    $subscription->shouldReceive('asStripeSubscription')
        ->andThrow(InvalidRequestException::factory('Too many requests', stripeCode: 'rate_limit'));

    $subscription->shouldNotReceive('markAsCanceled');
    $subscription->shouldNotReceive('syncStripeStatus');

    expect(fn () => (new ReconcilerProbe)->reconcilePublic($subscription))
        ->toThrow(InvalidRequestException::class);
});

test('REC-1: a kör-fék NEM zár le semmit, ha a lezárás-jelöltek a küszöb fölött az állomány többségét érintik', function () {
    $stripeIds = seedActiveSubscriptions(10);

    $probe = new KillSwitchProbe;
    foreach ($stripeIds as $id) {
        $probe->decisions[$id] = new CloseDecision('resource_missing');
    }

    $exitCode = $probe->runHandle();

    expect($probe->closed)->toBeEmpty();
    expect($exitCode)->toBe(ReconcileStripeSubscriptions::FAILURE);
    expect(Subscription::query()->active()->count())->toBe(10);
});

test('REC-1: a kör-fék ENGEDI a lezárást, ha csak néhány sor (küszöb alatti darabszám) halott', function () {
    $stripeIds = seedActiveSubscriptions(100);

    $probe = new KillSwitchProbe;
    $dead = array_slice($stripeIds, 0, 3);
    foreach ($dead as $id) {
        $probe->decisions[$id] = new CloseDecision('canceled');
    }

    $exitCode = $probe->runHandle();

    expect($probe->closed)->toHaveCount(3);
    expect($exitCode)->toBe(ReconcileStripeSubscriptions::SUCCESS);
    expect(Subscription::query()->active()->count())->toBe(97);
});

test('REC-1: a küszöb (5) fölötti, de az állomány kisebbségét érintő lezárás átmegy', function () {
    $stripeIds = seedActiveSubscriptions(100);

    $probe = new KillSwitchProbe;
    $dead = array_slice($stripeIds, 0, 10);
    foreach ($dead as $id) {
        $probe->decisions[$id] = new CloseDecision('canceled');
    }

    $exitCode = $probe->runHandle();

    expect($probe->closed)->toHaveCount(10);
    expect($exitCode)->toBe(ReconcileStripeSubscriptions::SUCCESS);
    expect(Subscription::query()->active()->count())->toBe(90);
});

test('REC-1: kis állományon a fék nem akad be (1 sorból 1 lezárás = 100%, de a küszöb alatt)', function () {
    $stripeIds = seedActiveSubscriptions(2);

    $probe = new KillSwitchProbe;
    $probe->decisions[$stripeIds[0]] = new CloseDecision('resource_missing');

    $exitCode = $probe->runHandle();

    expect($probe->closed)->toHaveCount(1);
    expect($exitCode)->toBe(ReconcileStripeSubscriptions::SUCCESS);
    expect(Subscription::query()->active()->count())->toBe(1);
});

test('F9A-L2: rossz fiókú kulcsnál kis állományon sem zár le semmit (a fék 5 alatt nem véd)', function () {
    $stripeIds = seedActiveSubscriptions(3);

    $probe = new KillSwitchProbe;
    $probe->accountVerified = false;
    foreach ($stripeIds as $id) {
        $probe->decisions[$id] = new CloseDecision('resource_missing');
    }

    $exitCode = $probe->runHandle();

    expect($probe->closed)->toBeEmpty()
        ->and($exitCode)->toBe(ReconcileStripeSubscriptions::FAILURE)
        ->and(Subscription::query()->active()->count())->toBe(3);
});

test('F9A-L2: igazolt fiókkal a valódi resource_missing lezárása 1 előfizetőnél is lefut', function () {
    $stripeIds = seedActiveSubscriptions(1);

    $probe = new KillSwitchProbe;
    $probe->decisions[$stripeIds[0]] = new CloseDecision('resource_missing');

    expect($probe->runHandle())->toBe(ReconcileStripeSubscriptions::SUCCESS)
        ->and($probe->closed)->toBe($stripeIds)
        ->and($probe->accountChecks)->toBe(1);
});

test('F9A-L2: Stripe-státusz alapú (canceled) lezárásnál nincs fiók-ellenőrzés — a kulcs bizonyítottan jó', function () {
    $stripeIds = seedActiveSubscriptions(3);

    $probe = new KillSwitchProbe;
    $probe->accountVerified = false;
    $probe->decisions[$stripeIds[0]] = new CloseDecision('canceled');

    expect($probe->runHandle())->toBe(ReconcileStripeSubscriptions::SUCCESS)
        ->and($probe->closed)->toBe([$stripeIds[0]])
        ->and($probe->accountChecks)->toBe(0);
});

test('F9A-L2: a pontosan fél állomány lezárása is tripeli a féket (inkluzív határ)', function () {
    $stripeIds = seedActiveSubscriptions(10);

    $probe = new KillSwitchProbe;
    foreach (array_slice($stripeIds, 0, 5) as $id) {
        $probe->decisions[$id] = new CloseDecision('canceled');
    }

    expect($probe->runHandle())->toBe(ReconcileStripeSubscriptions::FAILURE)
        ->and($probe->closed)->toBeEmpty()
        ->and(Subscription::query()->active()->count())->toBe(10);
});

test('F9A-L2: a --dry-run semmit nem zár le, de kilistázza a jelölteket', function () {
    $stripeIds = seedActiveSubscriptions(3);

    $probe = new KillSwitchProbe;
    $probe->decisions[$stripeIds[0]] = new CloseDecision('resource_missing');

    $exitCode = $probe->runHandle(['--dry-run' => true]);

    expect($exitCode)->toBe(ReconcileStripeSubscriptions::SUCCESS)
        ->and($probe->closed)->toBeEmpty()
        ->and(Subscription::query()->active()->count())->toBe(3)
        ->and($probe->buffer->fetch())->toContain('[dry-run] lezárná')->toContain($stripeIds[0]);
});

test('F9A-L2: a --dry-run a fiók-ellenőrzést is lefuttatja, és rossz kulcsnál hibával jelez', function () {
    $stripeIds = seedActiveSubscriptions(2);

    $probe = new KillSwitchProbe;
    $probe->accountVerified = false;
    $probe->decisions[$stripeIds[0]] = new CloseDecision('resource_missing');

    expect($probe->runHandle(['--dry-run' => true]))->toBe(ReconcileStripeSubscriptions::FAILURE)
        ->and($probe->closed)->toBeEmpty();
});

test('F9A-L2: a --dry-run az eltérő státuszt nem írja át', function () {
    $subscription = mockSubscriptionReturningStripeStatus(localStatus: 'active', stripeStatus: 'past_due');

    $subscription->shouldNotReceive('syncStripeStatus');
    $subscription->shouldNotReceive('markAsCanceled');

    expect((new ReconcilerProbe)->reconcilePublic($subscription, dryRun: true))->toBe(ReconcileOutcome::Synced);
});

test('F9A-L2: hiányzó STRIPE_PRO_PRICE_ID mellett a fiók nem igazolható (fail-closed, Stripe-hívás nélkül)', function () {
    config(['services.stripe.premium_price_id' => null]);

    expect((new ReconcilerProbe)->stripeAccountIsVerifiedPublic())->toBeFalse();
});

test('F9A-L2: a --dry-run kapcsoló a valódi parancson regisztrálva van', function () {
    $this->artisan('cashier:reconcile-subscriptions', ['--dry-run' => true])
        ->expectsOutputToContain('dry-run')
        ->assertSuccessful();
});

function fakeStripePriceEndpoint(int $status): ArrayObject
{
    $calls = new ArrayObject;

    ApiRequestor::setHttpClient(new class($status, $calls) implements ClientInterface
    {
        public function __construct(private int $status, private ArrayObject $calls) {}

        public function request($method, $absUrl, $headers, $params, $hasFile, $apiMode = 'v1', $maxNetworkRetries = null)
        {
            $this->calls[] = $absUrl;

            $body = $this->status === 200
                ? ['id' => 'price_pro_test', 'object' => 'price']
                : ['error' => ['type' => 'invalid_request_error', 'code' => 'resource_missing', 'message' => 'No such price']];

            return [json_encode($body), $this->status, []];
        }
    });

    return $calls;
}

test('F9A-L2: a fiók-ellenőrzés a konfigurált Pro árat kéri le a Stripe-tól', function (int $status, bool $expected) {
    config(['cashier.secret' => 'sk_test_fake', 'services.stripe.premium_price_id' => 'price_pro_test']);
    $calls = fakeStripePriceEndpoint($status);

    try {
        expect((new ReconcilerProbe)->stripeAccountIsVerifiedPublic())->toBe($expected)
            ->and($calls->getArrayCopy())->toHaveCount(1)
            ->and($calls[0])->toEndWith('/v1/prices/price_pro_test');
    } finally {
        ApiRequestor::setHttpClient(null);
    }
})->with([
    'az ár létezik → a kulcs a jó fiókhoz tartozik' => [200, true],
    'az ár ismeretlen → rossz fiókú/módú kulcs' => [404, false],
]);

function seedTrialingSubscription(array $userAttributes = []): User
{
    $user = User::factory()->create(['stripe_id' => 'cus_'.uniqid(), ...$userAttributes]);
    $user->subscriptions()->create([
        'type' => 'premium',
        'stripe_id' => 'sub_'.uniqid(),
        'stripe_status' => 'trialing',
        'stripe_price' => 'price_premium',
        'quantity' => 1,
        'trial_ends_at' => now()->addDays(10),
        'ends_at' => null,
    ]);

    return $user;
}

test('F9A-L4: a Stripe-nál lemondott trialing előfizetés lezárása azonnal megszünteti a hozzáférést', function () {
    $user = seedTrialingSubscription();
    $subscription = $user->subscriptions()->first();
    expect($user->hasActiveAccess())->toBeTrue();

    $probe = new KillSwitchProbe;
    $probe->decisions[$subscription->stripe_id] = new CloseDecision('canceled');

    expect($probe->runHandle())->toBe(ReconcileStripeSubscriptions::SUCCESS);

    $subscription->refresh();
    $user->refresh();

    expect($subscription->stripe_status)->toBe('canceled')
        ->and($subscription->trial_ends_at)->toBeNull()
        ->and($subscription->ends_at)->not->toBeNull()
        ->and($subscription->valid())->toBeFalse()
        ->and($user->hasActiveAccess())->toBeFalse()
        ->and($user->isOnAnyTrial())->toBeFalse();
});

test('F9A-L4: a lezárás nem nyit új ingyenes próbaidőt, és az admin-ajándék hónapot sem veszi el', function () {
    $giftEndsAt = now()->addWeeks(3)->startOfSecond();
    $user = seedTrialingSubscription(['trial_ends_at' => $giftEndsAt]);
    $subscription = $user->subscriptions()->first();

    $probe = new KillSwitchProbe;
    $probe->decisions[$subscription->stripe_id] = new CloseDecision('canceled');
    $probe->runHandle();

    $user->refresh();

    expect($user->isEligibleForSubscriptionTrial())->toBeFalse()
        ->and($user->trial_ends_at->timestamp)->toBe($giftEndsAt->timestamp)
        ->and($user->currentPlan())->toBe('premium');
});

function seedSubscriptionWithStatus(string $status, ?CarbonInterface $endsAt = null): string
{
    $user = User::factory()->create(['stripe_id' => 'cus_'.uniqid()]);
    $stripeId = 'sub_'.uniqid();
    $user->subscriptions()->create([
        'type' => 'premium',
        'stripe_id' => $stripeId,
        'stripe_status' => $status,
        'stripe_price' => 'price_premium',
        'quantity' => 1,
        'ends_at' => $endsAt,
    ]);

    return $stripeId;
}

test('F9A-L3: az aktívak mellett a past_due és unpaid sorokat is egyezteti, a lezártakat nem', function () {
    $active = seedSubscriptionWithStatus('active');
    $pastDue = seedSubscriptionWithStatus('past_due');
    $unpaid = seedSubscriptionWithStatus('unpaid');
    $pastDueOnGrace = seedSubscriptionWithStatus('past_due', now()->addDays(3));
    seedSubscriptionWithStatus('past_due', now()->subDay());
    seedSubscriptionWithStatus('canceled', now()->subDay());
    seedSubscriptionWithStatus('incomplete_expired');

    $probe = new KillSwitchProbe;

    expect($probe->runHandle())->toBe(ReconcileStripeSubscriptions::SUCCESS)
        ->and($probe->examined)->toEqualCanonicalizing([$active, $pastDue, $unpaid, $pastDueOnGrace]);
});

test('F9A-L3: a Stripe-nál már újra active past_due sort rásimítja — a fizetett user visszakapja a hozzáférést', function () {
    $subscription = mockSubscriptionReturningStripeStatus(localStatus: 'past_due', stripeStatus: 'active');

    $subscription->shouldReceive('syncStripeStatus')->once();
    $subscription->shouldNotReceive('markAsCanceled');

    expect((new ReconcilerProbe)->reconcilePublic($subscription))->toBe(ReconcileOutcome::Synced);
});

test('F9A-L3: a Stripe-nál már törölt unpaid sort lezárja', function () {
    $unpaid = seedSubscriptionWithStatus('unpaid');

    $probe = new KillSwitchProbe;
    $probe->decisions[$unpaid] = new CloseDecision('canceled');

    expect($probe->runHandle())->toBe(ReconcileStripeSubscriptions::SUCCESS)
        ->and($probe->closed)->toBe([$unpaid])
        ->and(Subscription::query()->where('stripe_id', $unpaid)->value('stripe_status'))->toBe('canceled');
});

test('F9A-L3: a past_due sorok lezárására is érvényes a fiók-ellenőrzés és a kör-fék', function () {
    $stripeIds = [seedSubscriptionWithStatus('past_due'), seedSubscriptionWithStatus('unpaid')];

    $probe = new KillSwitchProbe;
    $probe->accountVerified = false;
    foreach ($stripeIds as $id) {
        $probe->decisions[$id] = new CloseDecision('resource_missing');
    }

    expect($probe->runHandle())->toBe(ReconcileStripeSubscriptions::FAILURE)
        ->and($probe->closed)->toBeEmpty();

    $more = [seedSubscriptionWithStatus('past_due'), seedSubscriptionWithStatus('past_due'), seedSubscriptionWithStatus('unpaid')];
    seedSubscriptionWithStatus('active');

    $probe = new KillSwitchProbe;
    foreach ([...$stripeIds, ...$more] as $id) {
        $probe->decisions[$id] = new CloseDecision('canceled');
    }

    expect($probe->runHandle())->toBe(ReconcileStripeSubscriptions::FAILURE)
        ->and($probe->closed)->toBeEmpty();
});
