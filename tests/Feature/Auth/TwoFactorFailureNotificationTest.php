<?php

use App\Listeners\NotifyUserOfTwoFactorFailures;
use App\Models\User;
use App\Notifications\TwoFactorChallengeFailing;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;

/**
 * Sorozatos hibás 2FA-kód → e-mail a fióktulajdonosnak (F9C-L5). A challenge-ig
 * csak a jelszó birtokában lehet eljutni, tehát ez kiszivárgott jelszóra utal.
 */
function loginToTwoFactorChallenge(User $user): void
{
    test()->post(route('login'), ['email' => $user->email, 'password' => 'password'])
        ->assertRedirect(route('two-factor.login'));
}

test('a küszöbnyi hibás 2FA-kód után a felhasználó e-mailt kap, és warning kerül a naplóba', function () {
    Notification::fake();
    Log::spy();
    $user = User::factory()->withTwoFactor()->create();

    loginToTwoFactorChallenge($user);

    for ($i = 0; $i < NotifyUserOfTwoFactorFailures::THRESHOLD; $i++) {
        $this->post(route('two-factor.login.store'), ['recovery_code' => "wrong-{$i}"]);
    }

    Notification::assertSentToTimes($user, TwoFactorChallengeFailing::class, 1);
    Log::shouldHaveReceived('warning')
        ->withArgs(fn (string $message, array $context) => $context['user_id'] === $user->id)
        ->once();
    $this->assertGuest();
});

test('a küszöb alatt nincs értesítés', function () {
    Notification::fake();
    $user = User::factory()->withTwoFactor()->create();

    loginToTwoFactorChallenge($user);

    for ($i = 0; $i < NotifyUserOfTwoFactorFailures::THRESHOLD - 1; $i++) {
        $this->post(route('two-factor.login.store'), ['recovery_code' => "wrong-{$i}"]);
    }

    Notification::assertNothingSent();
});

test('egy órán belül legfeljebb egy levél megy ki, akárhány hiba jön', function () {
    Notification::fake();
    $user = User::factory()->withTwoFactor()->create();

    loginToTwoFactorChallenge($user);

    for ($i = 0; $i < NotifyUserOfTwoFactorFailures::THRESHOLD * 2; $i++) {
        $this->post(route('two-factor.login.store'), ['recovery_code' => "wrong-{$i}"]);
        // A percenkénti limiter ne állítsa meg a próbákat a teszt közben.
        $this->travel(15)->seconds();
    }

    Notification::assertSentToTimes($user, TwoFactorChallengeFailing::class, 1);
});

test('a levél a Biztonság oldalra (jelszócsere) mutat', function () {
    $user = User::factory()->create();

    $mail = (new TwoFactorChallengeFailing(5, '203.0.113.9'))->toMail($user);

    expect($mail->subject)->toBe('Sikertelen belépési kísérletek a fiókodba')
        ->and($mail->actionUrl)->toBe(route('security.edit'))
        ->and(implode(' ', $mail->introLines))->toContain('203.0.113.9');
});
