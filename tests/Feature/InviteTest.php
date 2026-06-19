<?php

use App\Actions\Fortify\CreateNewUser;
use App\Models\Invite;
use App\Models\User;
use Illuminate\Validation\ValidationException;

function validRegistration(array $extra = []): array
{
    return array_merge([
        'name' => 'Teszt User',
        'email' => 'teszt@example.com',
        'password' => 'Password123!@#x',
        'password_confirmation' => 'Password123!@#x',
    ], $extra);
}

test('registration works without an invite when invite-only is off', function () {
    config(['registration.invite_only' => false]);

    $this->post(route('register.store'), validRegistration())->assertRedirect();

    expect(User::where('email', 'teszt@example.com')->exists())->toBeTrue();
});

test('registration requires a valid invite when invite-only is on', function () {
    config(['registration.invite_only' => true]);

    $this->post(route('register.store'), validRegistration())
        ->assertSessionHasErrors('invite');

    expect(User::where('email', 'teszt@example.com')->exists())->toBeFalse();
});

test('a valid invite allows registration and is consumed, starting on the free plan', function () {
    config(['registration.invite_only' => true]);
    $invite = Invite::create(['code' => 'BETA2026', 'max_uses' => 1]);

    $this->post(route('register.store'), validRegistration(['invite' => 'BETA2026']))
        ->assertRedirect();

    $user = User::where('email', 'teszt@example.com')->first();
    expect($user)->not->toBeNull();
    expect($user->invite_id)->toBe($invite->id);
    // Registration grants no trial — new accounts start free (trial is subscription-only).
    expect($user->trial_ends_at)->toBeNull();
    expect($user->currentPlan())->toBe('free');
    expect($invite->fresh()->uses)->toBe(1);
});

test('an exhausted invite is rejected', function () {
    config(['registration.invite_only' => true]);
    $invite = Invite::create(['code' => 'USED', 'max_uses' => 1]);
    $invite->increment('uses'); // uses = max_uses

    $this->post(route('register.store'), validRegistration(['invite' => 'USED']))
        ->assertSessionHasErrors('invite');

    expect(User::where('email', 'teszt@example.com')->exists())->toBeFalse();
});

test('an invite cannot be consumed beyond max_uses', function () {
    config(['registration.invite_only' => true]);
    $invite = Invite::create(['code' => 'ONCE', 'max_uses' => 1]);
    $action = app(CreateNewUser::class);

    $action->create([
        'name' => 'First', 'email' => 'first@example.com',
        'password' => 'Password123!@#x', 'password_confirmation' => 'Password123!@#x',
        'invite' => 'ONCE',
    ]);

    expect($invite->fresh()->uses)->toBe(1);

    // A second consumption of the now-exhausted code must fail atomically.
    expect(fn () => $action->create([
        'name' => 'Second', 'email' => 'second@example.com',
        'password' => 'Password123!@#x', 'password_confirmation' => 'Password123!@#x',
        'invite' => 'ONCE',
    ]))->toThrow(ValidationException::class);

    expect($invite->fresh()->uses)->toBe(1);
    expect(User::where('email', 'second@example.com')->exists())->toBeFalse();
});

test('an expired invite is rejected', function () {
    config(['registration.invite_only' => true]);
    Invite::create(['code' => 'OLD', 'max_uses' => 5, 'expires_at' => now()->subDay()]);

    $this->post(route('register.store'), validRegistration(['invite' => 'OLD']))
        ->assertSessionHasErrors('invite');
});

test('admin can create and revoke invites', function () {
    config(['app.admin_email' => 'admin@example.com']);
    $admin = User::factory()->create(['email' => 'admin@example.com']);

    $this->actingAs($admin)
        ->post(route('admin.invites.store'), ['max_uses' => 3])
        ->assertRedirect();

    $invite = Invite::first();
    expect($invite)->not->toBeNull();
    expect($invite->max_uses)->toBe(3);
    expect($invite->code)->not->toBeEmpty();

    $this->actingAs($admin)
        ->delete(route('admin.invites.destroy', $invite))
        ->assertRedirect();

    expect(Invite::find($invite->id))->toBeNull();
});

test('non-admin cannot create invites', function () {
    $this->actingAs(User::factory()->create())
        ->post(route('admin.invites.store'), ['max_uses' => 1])
        ->assertForbidden();
});
