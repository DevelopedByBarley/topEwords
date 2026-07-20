<?php

use App\Console\Commands\CloseDecision;
use App\Console\Commands\ReconcileOutcome;
use App\Console\Commands\ReconcileStripeSubscriptions;
use App\Models\User;
use Illuminate\Console\OutputStyle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Cashier\Subscription;
use Mockery\MockInterface;
use Stripe\Exception\InvalidRequestException;
use Symfony\Component\Console\Input\ArrayInput;
use Symfony\Component\Console\Output\BufferedOutput;

uses(RefreshDatabase::class);

/**
 * F2-W-3 / REC-1: az időzített Stripe-egyeztetés döntési logikája ÉS a kör-féke.
 *
 * A Stripe webhookok legalább-egyszer és sorrend nélkül érkeznek; egy végleg elveszett
 * customer.subscription.deleted a helyi sort tartósan aktívan hagyná (beragadt
 * „ingyen prémium"). A parancs a Stripe-ot tekinti igazságforrásnak.
 *
 * REC-1 kör-fék: egy rossz módú/fiókú STRIPE_SECRET a Stripe MINDEN retrieve-jére
 * resource_missing-et adna → a parancs fék nélkül lezárná az ÖSSZES fizető állományt.
 * A kör-fék: ha egy futás az aktív állomány túl nagy hányadát zárná le, NEM zár le
 * semmit, hanem riaszt és FAILURE-rel kilép.
 *
 * A Stripe HTTP-rétegének felépítése helyett a döntési logikát (reconcile) mockolt
 * Subscription-nel, a handle()-szintű féket pedig előre-programozott döntés-térképpel
 * gyakoroljuk (lásd ReconcilerProbe / KillSwitchProbe).
 */

/**
 * A parancs protected reconcile()-jét publikussá tevő teszt-alosztály.
 */
class ReconcilerProbe extends ReconcileStripeSubscriptions
{
    public function reconcilePublic(Subscription $subscription): CloseDecision|ReconcileOutcome
    {
        return $this->reconcile($subscription);
    }
}

/**
 * A handle() kör-fékét HTTP nélkül tesztelő alosztály: a reconcile()-t egy előre
 * megadott döntés-térképpel (stripe_id → döntés) helyettesíti, így valós DB-sorokon
 * futtatható a teljes fék-logika a Stripe-hívás felépítése nélkül. Rögzíti, mely
 * sorok kerültek ténylegesen lezárásra (closeDeadSubscription meghívva).
 */
class KillSwitchProbe extends ReconcileStripeSubscriptions
{
    /** @var array<string, CloseDecision|ReconcileOutcome> stripe_id → döntés */
    public array $decisions = [];

    /** @var array<int, string> a ténylegesen lezárt subok stripe_id-jai */
    public array $closed = [];

    /**
     * A handle() a $this->info()/$this->error()-t hívja, ami setInput/setOutput nélkül
     * (közvetlen hívásnál, nem artisan()-on át) null $output-ra írna. Bekötünk egy
     * buffered output-ot, hogy a fék-logika HTTP és Stripe nélkül futtatható legyen.
     */
    public function runHandle(): int
    {
        $this->setInput(new ArrayInput([]));
        $this->setOutput(new OutputStyle(new ArrayInput([]), new BufferedOutput));

        return $this->handle();
    }

    protected function reconcile(Subscription $subscription): CloseDecision|ReconcileOutcome
    {
        return $this->decisions[$subscription->stripe_id] ?? ReconcileOutcome::Unchanged;
    }

    protected function closeDeadSubscription(Subscription $subscription, string $reason): void
    {
        $this->closed[] = $subscription->stripe_id;
        parent::closeDeadSubscription($subscription, $reason);
    }
}

/**
 * Egy Stripe-státuszt visszaadó, mockolt előfizetés — a retrieve egy sima
 * (status property-vel bíró) objektumot ad, ahogy a Stripe SDK is tenné.
 */
function mockSubscriptionReturningStripeStatus(string $localStatus, string $stripeStatus): Subscription&MockInterface
{
    $subscription = Mockery::mock(Subscription::class)->makePartial();
    $subscription->stripe_status = $localStatus;
    $subscription->shouldReceive('asStripeSubscription')
        ->andReturn((object) ['status' => $stripeStatus]);

    return $subscription;
}

/**
 * N darab helyileg AKTÍV előfizetés-sor egy-egy friss userhez (az active() scope-ba
 * esnek: stripe_status='active', ends_at=null). Visszaadja a stripe_id-k tömbjét.
 *
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

// ── reconcile() döntési logika ────────────────────────────────────────────────

test('a Stripe-nál törölt (canceled) előfizetésre lezárás-döntést ad', function () {
    $subscription = mockSubscriptionReturningStripeStatus(localStatus: 'active', stripeStatus: 'canceled');

    // A close-ágon NEM ír DB-t (a handle() teszi, a fék után) — csak döntést ad.
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

    // A Stripe-nál él (past_due), csak elveszett egy frissítés → szinkron, NEM lezárás.
    $subscription->shouldReceive('syncStripeStatus')->once();
    $subscription->shouldNotReceive('markAsCanceled');

    expect((new ReconcilerProbe)->reconcilePublic($subscription))->toBe(ReconcileOutcome::Synced);
});

test('a resource_missingtől eltérő Stripe-hibát nem nyeli el (nem zár le tévedésből)', function () {
    // Átmeneti Stripe-hiba (pl. rate_limit) NEM jelenti, hogy az előfizetés halott —
    // a kivételnek tovább kell buknia, hogy a handle() hibaágán naplózódjon, és a sor
    // érintetlen maradjon. Semmiképp nem zárhatunk le élő előfizetést egy API-hiba miatt.
    $subscription = Mockery::mock(Subscription::class)->makePartial();
    $subscription->stripe_status = 'active';
    $subscription->shouldReceive('asStripeSubscription')
        ->andThrow(InvalidRequestException::factory('Too many requests', stripeCode: 'rate_limit'));

    $subscription->shouldNotReceive('markAsCanceled');
    $subscription->shouldNotReceive('syncStripeStatus');

    expect(fn () => (new ReconcilerProbe)->reconcilePublic($subscription))
        ->toThrow(InvalidRequestException::class);
});

// ── REC-1 kör-fék (handle-szint, valós DB-sorokon) ────────────────────────────

test('REC-1: a kör-fék NEM zár le semmit, ha a lezárás-jelöltek a küszöb fölött az állomány többségét érintik', function () {
    // 10 aktív sor, mind resource_missing (a rossz módú STRIPE_SECRET esete) → 100%.
    $stripeIds = seedActiveSubscriptions(10);

    $probe = new KillSwitchProbe;
    foreach ($stripeIds as $id) {
        $probe->decisions[$id] = new CloseDecision('resource_missing');
    }

    $exitCode = $probe->runHandle();

    // A fék tripelt: SEMMI nem záródott le, FAILURE-rel tért vissza, az állomány érintetlen.
    expect($probe->closed)->toBeEmpty();
    expect($exitCode)->toBe(ReconcileStripeSubscriptions::FAILURE);
    expect(Subscription::query()->active()->count())->toBe(10);
});

test('REC-1: a kör-fék ENGEDI a lezárást, ha csak néhány sor (küszöb alatti darabszám) halott', function () {
    // 100 aktív sorból csak 3 halott → 3% és 3 < küszöb (5) → a fék NEM aktív, lezár.
    $stripeIds = seedActiveSubscriptions(100);

    $probe = new KillSwitchProbe;
    $dead = array_slice($stripeIds, 0, 3);
    foreach ($dead as $id) {
        $probe->decisions[$id] = new CloseDecision('canceled');
    }

    $exitCode = $probe->runHandle();

    // A 3 halott lezárult, a többi érintetlen, SUCCESS.
    expect($probe->closed)->toHaveCount(3);
    expect($exitCode)->toBe(ReconcileStripeSubscriptions::SUCCESS);
    expect(Subscription::query()->active()->count())->toBe(97);
});

test('REC-1: a küszöb (5) fölötti, de az állomány kisebbségét érintő lezárás átmegy', function () {
    // 100 aktív sorból 10 halott → 10% ≤ 50% (a fél alatt) ÉS 10 ≥ 5 → a fék NEM tripel, lezár.
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
    // A legitim „1-2 beragadt sor" apró állományon: 2 sorból 1 halott → 50% de 1 < küszöb (5).
    $stripeIds = seedActiveSubscriptions(2);

    $probe = new KillSwitchProbe;
    $probe->decisions[$stripeIds[0]] = new CloseDecision('resource_missing');

    $exitCode = $probe->runHandle();

    expect($probe->closed)->toHaveCount(1);
    expect($exitCode)->toBe(ReconcileStripeSubscriptions::SUCCESS);
    expect(Subscription::query()->active()->count())->toBe(1);
});
