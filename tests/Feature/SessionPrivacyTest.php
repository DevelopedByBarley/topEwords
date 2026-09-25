<?php

use App\Models\User;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/*
 * F3-L1 (GDPR): a sessions tábla IP-címet és böngésző-azonosítót tárol, a
 * user_id mögött nincs FK, így a fiók törlése után ezek bennmaradtak.
 */

function insertSessionRow(?int $userId, string $ip = '203.0.113.7'): string
{
    $id = Str::random(40);

    DB::table('sessions')->insert([
        'id' => $id,
        'user_id' => $userId,
        'ip_address' => $ip,
        'user_agent' => 'Mozilla/5.0 (Test)',
        'payload' => base64_encode(serialize([])),
        'last_activity' => now()->getTimestamp(),
    ]);

    return $id;
}

test('fióktörlés a felhasználó minden eszközének session-sorát törli, másokét nem', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();

    insertSessionRow($user->id);
    insertSessionRow($user->id, '198.51.100.23');
    $otherUsersSession = insertSessionRow($otherUser->id);
    $guestSession = insertSessionRow(null);

    $this->actingAs($user)
        ->delete(route('profile.destroy'), ['password' => 'password'])
        ->assertRedirect(route('home'));

    expect(DB::table('sessions')->where('user_id', $user->id)->count())->toBe(0)
        ->and(DB::table('sessions')->pluck('id')->sort()->values()->all())
        ->toBe(collect([$otherUsersSession, $guestSession])->sort()->values()->all());
});

test('fióktörlés valódi database session driverrel is hibátlan, és nem marad user-hez kötött sor', function () {
    // Éles konfiguráció: itt a törlés a kérés SAJÁT session-sorát is érinti, amit
    // utána az invalidate() és a kérés végi mentés is kezel.
    config(['session.driver' => 'database']);
    app('session')->forgetDrivers();

    $user = User::factory()->create();
    insertSessionRow($user->id);

    $this->actingAs($user)
        ->delete(route('profile.destroy'), ['password' => 'password'])
        ->assertRedirect(route('home'));

    $this->assertGuest();

    // A kérés végén mentett új, névtelen session bizonyítja, hogy tényleg a
    // database driver futott.
    expect(User::find($user->id))->toBeNull()
        ->and(DB::table('sessions')->whereNull('user_id')->count())->toBe(1)
        ->and(DB::table('sessions')->whereNotNull('user_id')->count())->toBe(0);
});

test('hibás jelszóval a fióktörlés nem nyúl a session-sorokhoz', function () {
    $user = User::factory()->create();
    insertSessionRow($user->id);

    $this->actingAs($user)
        ->from(route('profile.edit'))
        ->delete(route('profile.destroy'), ['password' => 'wrong-password'])
        ->assertSessionHasErrors('password');

    expect(DB::table('sessions')->where('user_id', $user->id)->count())->toBe(1);
});

test('a sessions:prune-orphaned csak a nem létező felhasználók sorait törli', function () {
    config(['session.driver' => 'database']);

    $user = User::factory()->create();
    $deletedUser = User::factory()->create();

    $liveSession = insertSessionRow($user->id);
    $guestSession = insertSessionRow(null);
    insertSessionRow($deletedUser->id);
    insertSessionRow($deletedUser->id);

    // A fióktörlésen kívüli út (pl. tinker), ami a session-sorokat nem takarítja.
    $deletedUser->delete();

    $this->artisan('sessions:prune-orphaned')
        ->expectsOutputToContain('2 árva session-sor törölve.')
        ->assertExitCode(0);

    expect(DB::table('sessions')->pluck('id')->sort()->values()->all())
        ->toBe(collect([$liveSession, $guestSession])->sort()->values()->all());
});

test('a sessions:prune-orphaned nem database session driveren nem csinál semmit', function () {
    config(['session.driver' => 'redis']);

    insertSessionRow(999_999);

    $this->artisan('sessions:prune-orphaned')->assertExitCode(0);

    expect(DB::table('sessions')->count())->toBe(1);
});

test('a sessions:prune-orphaned be van ütemezve', function () {
    $scheduled = collect(app(Schedule::class)->events())
        ->contains(fn ($event) => str_contains((string) $event->command, 'sessions:prune-orphaned'));

    expect($scheduled)->toBeTrue();
});
