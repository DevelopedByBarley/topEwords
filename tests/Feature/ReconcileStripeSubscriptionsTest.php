<?php

use App\Console\Commands\ReconcileStripeSubscriptions;
use Laravel\Cashier\Subscription;
use Mockery\MockInterface;
use Stripe\Exception\InvalidRequestException;

/**
 * F2-W-3: az időzített Stripe-egyeztetés döntési logikája. A Stripe webhookok
 * legalább-egyszer és sorrend nélkül érkeznek; egy végleg elveszett
 * customer.subscription.deleted a helyi sort tartósan aktívan hagyná (beragadt
 * „ingyen prémium"). A parancs a Stripe-ot tekinti igazságforrásnak.
 *
 * A Stripe HTTP-rétegének felépítése helyett a döntési logikát (reconcile) mockolt
 * Subscription-nel gyakoroljuk: ez fedi le pontosan a biztonságkritikus viselkedést —
 * a Stripe-nál halott/eltűnt előfizetés helyi lezárását, az élő békén hagyását és az
 * eltérő státusz szinkronizálását.
 */

/**
 * A parancs protected reconcile()-jét publikussá tevő teszt-alosztály.
 */
class ReconcilerProbe extends ReconcileStripeSubscriptions
{
    public function reconcilePublic(Subscription $subscription): bool
    {
        return $this->reconcile($subscription);
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

test('a Stripe-nál törölt (canceled) előfizetést helyben lezárja', function () {
    $subscription = mockSubscriptionReturningStripeStatus(localStatus: 'active', stripeStatus: 'canceled');

    // A biztonság lényege: a beragadt sort le KELL zárni (markAsCanceled), Stripe-hívás nélkül.
    $subscription->shouldReceive('markAsCanceled')->once();
    $subscription->shouldNotReceive('syncStripeStatus');

    expect((new ReconcilerProbe)->reconcilePublic($subscription))->toBeTrue();
});

test('a Stripe-nál már nem létező (resource_missing) előfizetést helyben lezárja', function () {
    $subscription = Mockery::mock(Subscription::class)->makePartial();
    $subscription->stripe_status = 'active';
    $subscription->shouldReceive('asStripeSubscription')
        ->andThrow(InvalidRequestException::factory('No such subscription', stripeCode: 'resource_missing'));

    $subscription->shouldReceive('markAsCanceled')->once();

    expect((new ReconcilerProbe)->reconcilePublic($subscription))->toBeTrue();
});

test('a Stripe-nál is aktív előfizetést nem bántja', function () {
    $subscription = mockSubscriptionReturningStripeStatus(localStatus: 'active', stripeStatus: 'active');

    // Egyező, élő állapot → semmilyen korrekció.
    $subscription->shouldNotReceive('markAsCanceled');
    $subscription->shouldNotReceive('syncStripeStatus');

    expect((new ReconcilerProbe)->reconcilePublic($subscription))->toBeFalse();
});

test('az eltérő, de élő státuszt (pl. past_due) szinkronizálja, nem zárja le', function () {
    $subscription = mockSubscriptionReturningStripeStatus(localStatus: 'active', stripeStatus: 'past_due');

    // A Stripe-nál él (past_due), csak elveszett egy frissítés → szinkron, NEM lezárás.
    $subscription->shouldReceive('syncStripeStatus')->once();
    $subscription->shouldNotReceive('markAsCanceled');

    expect((new ReconcilerProbe)->reconcilePublic($subscription))->toBeTrue();
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
