<?php

use App\Models\PlayerPairing;
use App\Models\User;
use App\Models\Word;

beforeEach(function () {
    $this->user = User::factory()->premium()->create();
});

/**
 * Elindít egy párosítást az API-n és visszaadja a lejátszónak szánt választ.
 *
 * @return array{user_code: string, poll_secret: string, verification_url: string}
 */
function startPairing(): array
{
    return test()->postJson(route('player.pair'), ['device_name' => 'Teszt gép'])
        ->assertSuccessful()
        ->json();
}

// ── Párosítás indítása ────────────────────────────────────────────────────────

test('pair returns a user code and poll secret without authentication', function () {
    $pair = startPairing();

    expect($pair['user_code'])->toMatch('/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/')
        ->and($pair['poll_secret'])->toHaveLength(64)
        ->and($pair['verification_url'])->toContain('/player/connect');
});

test('pair stores only the hash of the poll secret', function () {
    $pair = startPairing();

    $pairing = PlayerPairing::firstOrFail();

    expect($pairing->poll_secret_hash)->toBe(hash('sha256', $pair['poll_secret']))
        ->and($pairing->poll_secret_hash)->not->toBe($pair['poll_secret']);
});

test('pair requires a device name', function () {
    $this->postJson(route('player.pair'), [])->assertUnprocessable();
});

test('pair strips control characters from the device name', function () {
    $this->postJson(route('player.pair'), ['device_name' => "Gonosz\x00\x1bnév"])->assertSuccessful();

    expect(PlayerPairing::firstOrFail()->device_name)->toBe('Gonosznév');
});

test('pair deletes expired pairing requests', function () {
    PlayerPairing::create([
        'user_code' => 'AAAA-BBBB',
        'poll_secret_hash' => hash('sha256', 'stale'),
        'device_name' => 'Régi gép',
        'expires_at' => now()->subMinute(),
    ]);

    startPairing();

    expect(PlayerPairing::where('user_code', 'AAAA-BBBB')->exists())->toBeFalse();
});

// ── Jóváhagyás a böngészőben ──────────────────────────────────────────────────

test('connect page requires authentication', function () {
    $this->get(route('player.connect'))->assertRedirect(route('login'));
});

test('connect page renders with the prefilled code', function () {
    $this->actingAs($this->user)
        ->get(route('player.connect', ['code' => 'abcd efgh']))
        ->assertSuccessful()
        ->assertInertia(fn ($page) => $page
            ->component('player/connect')
            ->where('prefillCode', 'ABCD-EFGH'));
});

test('approve marks the pairing as approved for the logged in user', function () {
    $pair = startPairing();

    $this->actingAs($this->user)
        ->post(route('player.approve'), ['code' => $pair['user_code']])
        ->assertRedirect()
        ->assertSessionHas('success');

    $pairing = PlayerPairing::firstOrFail();

    expect($pairing->isApproved())->toBeTrue()
        ->and($pairing->user_id)->toBe($this->user->id);
});

test('approve accepts the code without dash and in lowercase', function () {
    $pair = startPairing();

    $this->actingAs($this->user)
        ->post(route('player.approve'), ['code' => strtolower(str_replace('-', '', $pair['user_code']))])
        ->assertRedirect()
        ->assertSessionHas('success');

    expect(PlayerPairing::firstOrFail()->isApproved())->toBeTrue();
});

test('approve rejects an unknown code', function () {
    $this->actingAs($this->user)
        ->post(route('player.approve'), ['code' => 'XXXX-XXXX'])
        ->assertSessionHasErrors('code');
});

test('approve rejects an expired code', function () {
    $pair = startPairing();
    PlayerPairing::query()->update(['expires_at' => now()->subMinute()]);

    $this->actingAs($this->user)
        ->post(route('player.approve'), ['code' => $pair['user_code']])
        ->assertSessionHasErrors('code');
});

test('approve rejects an already approved code', function () {
    $pair = startPairing();

    $this->actingAs($this->user)->post(route('player.approve'), ['code' => $pair['user_code']]);

    $other = User::factory()->create();

    $this->actingAs($other)
        ->post(route('player.approve'), ['code' => $pair['user_code']])
        ->assertSessionHasErrors('code');
});

test('approve requires authentication', function () {
    $this->post(route('player.approve'), ['code' => 'XXXX-XXXX'])->assertRedirect(route('login'));
});

// ── Token-beváltás ────────────────────────────────────────────────────────────

test('exchange returns pending before approval', function () {
    $pair = startPairing();

    $this->postJson(route('player.pair.exchange'), [
        'user_code' => $pair['user_code'],
        'poll_secret' => $pair['poll_secret'],
    ])->assertSuccessful()->assertJson(['status' => 'pending']);
});

test('exchange returns a working token after approval and is single use', function () {
    $pair = startPairing();

    $this->actingAs($this->user)->post(route('player.approve'), ['code' => $pair['user_code']]);

    $response = $this->postJson(route('player.pair.exchange'), [
        'user_code' => $pair['user_code'],
        'poll_secret' => $pair['poll_secret'],
    ])->assertSuccessful()->assertJson([
        'status' => 'approved',
        'token_type' => 'Bearer',
        'user' => ['email' => $this->user->email],
    ]);

    // A párosítási sor törlődött → a beváltás nem ismételhető.
    expect(PlayerPairing::count())->toBe(0);

    $this->postJson(route('player.pair.exchange'), [
        'user_code' => $pair['user_code'],
        'poll_secret' => $pair['poll_secret'],
    ])->assertNotFound();

    // A kapott token használható a player API-n.
    $this->flushHeaders();

    $this->getJson(route('player.me'), ['Authorization' => 'Bearer '.$response->json('token')])
        ->assertSuccessful()
        ->assertJson(['email' => $this->user->email]);
});

test('exchange rejects a wrong poll secret', function () {
    $pair = startPairing();

    $this->actingAs($this->user)->post(route('player.approve'), ['code' => $pair['user_code']]);

    $this->postJson(route('player.pair.exchange'), [
        'user_code' => $pair['user_code'],
        'poll_secret' => str_repeat('0', 64),
    ])->assertNotFound();
});

test('exchange rejects and deletes an expired pairing', function () {
    $pair = startPairing();
    PlayerPairing::query()->update(['expires_at' => now()->subMinute()]);

    $this->postJson(route('player.pair.exchange'), [
        'user_code' => $pair['user_code'],
        'poll_secret' => $pair['poll_secret'],
    ])->assertGone();

    expect(PlayerPairing::count())->toBe(0);
});

// ── A player API védelme ──────────────────────────────────────────────────────

/**
 * Végigviszi a teljes párosítást és visszaadja a kiadott Bearer tokent.
 */
function issuePlayerToken(User $user): string
{
    $pair = startPairing();

    test()->actingAs($user)->post(route('player.approve'), ['code' => $pair['user_code']]);

    $token = test()->postJson(route('player.pair.exchange'), [
        'user_code' => $pair['user_code'],
        'poll_secret' => $pair['poll_secret'],
    ])->json('token');

    test()->flushHeaders();
    app('auth')->forgetGuards();

    return $token;
}

test('player endpoints reject requests without a token', function () {
    $this->getJson(route('player.lookup', ['word' => 'apple']))->assertUnauthorized();
    $this->getJson(route('player.statuses'))->assertUnauthorized();
    $this->postJson(route('player.add-word'))->assertUnauthorized();
});

test('player endpoints reject tokens without the player ability', function () {
    $token = $this->user->createToken('más célra', ['other-ability'])->plainTextToken;

    $this->getJson(route('player.statuses'), ['Authorization' => 'Bearer '.$token])
        ->assertForbidden();
});

test('player lookup works with an issued token and omits the csrf token', function () {
    Word::insert([
        ['word' => 'apple', 'meaning_hu' => 'alma', 'rank' => 1, 'created_at' => now(), 'updated_at' => now()],
    ]);

    $token = issuePlayerToken($this->user);

    $this->getJson(route('player.lookup', ['word' => 'apple']), ['Authorization' => 'Bearer '.$token])
        ->assertSuccessful()
        ->assertJson(['found' => true, 'word' => 'apple', 'meaning_hu' => 'alma', 'csrf' => null]);
});

test('player statuses works with an issued token', function () {
    Word::insert([
        ['word' => 'apple', 'meaning_hu' => 'alma', 'rank' => 1, 'created_at' => now(), 'updated_at' => now()],
    ]);
    $this->user->knownWords()->attach(Word::firstOrFail()->id, ['status' => 'learning']);

    $token = issuePlayerToken($this->user);

    $this->getJson(route('player.statuses'), ['Authorization' => 'Bearer '.$token])
        ->assertSuccessful()
        ->assertJsonPath('statuses.apple', 'learning');
});

test('disconnect revokes the current token', function () {
    $token = issuePlayerToken($this->user);
    $headers = ['Authorization' => 'Bearer '.$token];

    $this->postJson(route('player.disconnect'), [], $headers)->assertSuccessful();

    $this->flushHeaders();
    app('auth')->forgetGuards();

    $this->getJson(route('player.me'), $headers)->assertUnauthorized();
});

test('extension endpoints still return a csrf token for session clients', function () {
    Word::insert([
        ['word' => 'apple', 'meaning_hu' => 'alma', 'rank' => 1, 'created_at' => now(), 'updated_at' => now()],
    ]);

    $csrf = $this->actingAs($this->user)
        ->getJson(route('extension.lookup', ['word' => 'apple']))
        ->assertSuccessful()
        ->json('csrf');

    expect($csrf)->toBeString()->not->toBeEmpty();
});
