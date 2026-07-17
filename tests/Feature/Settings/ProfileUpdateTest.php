<?php

use App\Models\User;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Notification;
use Laravel\Cashier\Subscription;

test('profile page is displayed', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->get(route('profile.edit'));

    $response->assertOk();
});

test('profile information can be updated', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->patch(route('profile.update'), [
            'name' => 'Test User',
            'email' => 'test@example.com',
        ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('profile.edit'));

    $user->refresh();

    expect($user->name)->toBe('Test User');
    expect($user->email)->toBe('test@example.com');
    expect($user->email_verified_at)->toBeNull();
});

test('changing the email address sends a new verification email', function () {
    Notification::fake();

    $user = User::factory()->create();

    $this->actingAs($user)
        ->patch(route('profile.update'), [
            'name' => $user->name,
            'email' => 'uj-cim@example.com',
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('profile.edit'));

    Notification::assertSentTo($user, VerifyEmail::class);
});

test('no verification email is sent when the email address is unchanged', function () {
    Notification::fake();

    $user = User::factory()->create();

    $this->actingAs($user)
        ->patch(route('profile.update'), [
            'name' => 'Test User',
            'email' => $user->email,
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('profile.edit'));

    Notification::assertNothingSent();
});

test('email verification status is unchanged when the email address is unchanged', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->patch(route('profile.update'), [
            'name' => 'Test User',
            'email' => $user->email,
        ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('profile.edit'));

    expect($user->refresh()->email_verified_at)->not->toBeNull();
});

test('user can delete their account', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->delete(route('profile.destroy'), [
            'password' => 'password',
        ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('home'));

    $this->assertGuest();
    expect($user->fresh())->toBeNull();
});

test('S-L4/W-L6: fióktörlés megőrzi a NAV-számla-nyilvántartást, csak a user-hivatkozást nullázza', function () {
    // A billingo_invoices FK nullOnDelete: a kiállított számlák könyvelési/megfelelőségi
    // nyilvántartása a törölt felhasználó után is megmarad (a Billingo a külső igazságforrás,
    // de a stripe↔billingo linkelést helyben is meg kell őriznünk). Korábban cascadeOnDelete
    // némán törölte.
    $user = User::factory()->create();
    $invoice = $user->billingoInvoices()->create([
        'stripe_invoice_id' => 'in_'.uniqid(),
        'billingo_document_id' => 987654,
        'invoice_number' => 'TEST-2026-1',
    ]);

    $this->actingAs($user)
        ->delete(route('profile.destroy'), ['password' => 'password'])
        ->assertRedirect(route('home'));

    $invoice->refresh();

    expect($user->fresh())->toBeNull()
        ->and($invoice->exists)->toBeTrue()
        ->and($invoice->user_id)->toBeNull()
        ->and($invoice->billingo_document_id)->toBe(987654)
        ->and($invoice->invoice_number)->toBe('TEST-2026-1');
});

test('deleting an account cancels every still-live stripe subscription', function () {
    $user = User::factory()->create();

    // Két élő előfizetést szimulálunk (pl. egy active + egy past_due) — a destroy()-nak
    // MINDET le kell mondania a törlés előtt, nem csak az elsőt/aktívat. A lekérdezést
    // és az előfizetéseket kimockoljuk, hogy ne induljon valódi Stripe-hívás.
    $activeSub = Mockery::mock(Subscription::class);
    $activeSub->shouldReceive('cancelNow')->once();

    $pastDueSub = Mockery::mock(Subscription::class);
    $pastDueSub->shouldReceive('cancelNow')->once();

    // A subscriptions() visszatérési típusa HasMany, ezért a relációt is annak mockoljuk.
    $query = Mockery::mock(HasMany::class);
    $query->shouldReceive('whereNotIn')
        ->with('stripe_status', ['canceled', 'incomplete_expired'])
        ->andReturnSelf();
    $query->shouldReceive('get')->andReturn(collect([$activeSub, $pastDueSub]));

    $userMock = Mockery::mock($user)->makePartial();
    $userMock->shouldReceive('subscriptions')->andReturn($query);

    $this->actingAs($userMock)
        ->delete(route('profile.destroy'), [
            'password' => 'password',
        ])
        ->assertRedirect(route('home'));

    $this->assertGuest();
    expect($user->fresh())->toBeNull();
});

test('deleting an account without a subscription works (no stripe call)', function () {
    $user = User::factory()->create();

    expect($user->activeSubscription())->toBeNull();

    $this->actingAs($user)
        ->delete(route('profile.destroy'), [
            'password' => 'password',
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('home'));

    expect($user->fresh())->toBeNull();
});

test('correct password must be provided to delete account', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->from(route('profile.edit'))
        ->delete(route('profile.destroy'), [
            'password' => 'wrong-password',
        ]);

    $response
        ->assertSessionHasErrors('password')
        ->assertRedirect(route('profile.edit'));

    expect($user->fresh())->not->toBeNull();
});
