<?php

use App\Models\Invite;
use App\Models\User;
use App\Notifications\InvitationSent;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Notification;
use Symfony\Component\Mailer\Exception\TransportException;

beforeEach(function () {
    config(['app.admin_email' => 'admin@example.com']);

    $this->admin = User::factory()->withTwoFactor()->create(['email' => 'admin@example.com']);
});

test('generáláskor megadott e-mail-címre kimegy a meghívó a bővítmény linkjével', function () {
    Notification::fake();

    $this->actingAs($this->admin)
        ->post(route('admin.invites.store'), [
            'max_uses' => 1,
            'email' => 'janos@example.com',
            'extension_url' => 'https://chromewebstore.google.com/detail/abc',
        ])
        ->assertRedirect()
        ->assertSessionHas('success');

    $invite = Invite::sole();
    expect($invite->label)->toBe('janos@example.com');

    Notification::assertSentOnDemand(
        InvitationSent::class,
        function (InvitationSent $notification, array $channels, AnonymousNotifiable $notifiable) use ($invite) {
            $mail = $notification->toMail($notifiable);
            $body = implode("\n", [...$mail->introLines, ...$mail->outroLines]);

            return $notifiable->routes['mail'] === 'janos@example.com'
                && $mail->actionUrl === url('/register').'?invite='.$invite->code
                && str_contains($body, $invite->code)
                && str_contains($body, 'https://chromewebstore.google.com/detail/abc');
        },
    );
});

test('bővítmény-link nélkül is kimegy a meghívó, a bővítményről szóló sor nélkül', function () {
    Notification::fake();

    $this->actingAs($this->admin)
        ->post(route('admin.invites.store'), ['max_uses' => 1, 'email' => 'janos@example.com'])
        ->assertRedirect();

    Notification::assertSentOnDemand(
        InvitationSent::class,
        function (InvitationSent $notification, array $channels, AnonymousNotifiable $notifiable) {
            $body = implode("\n", $notification->toMail($notifiable)->outroLines);

            return ! str_contains($body, 'Chrome-bővítmény');
        },
    );
});

test('e-mail-cím nélkül csak a kód jön létre, levél nem megy ki', function () {
    Notification::fake();

    $this->actingAs($this->admin)
        ->post(route('admin.invites.store'), [
            'label' => 'Béta',
            'max_uses' => 1,
            'extension_url' => 'https://chromewebstore.google.com/detail/abc',
        ])
        ->assertRedirect();

    expect(Invite::sole()->label)->toBe('Béta');
    Notification::assertNothingSent();
});

test('a megadott címke felülírja az e-mail-címet mint címkét', function () {
    Notification::fake();

    $this->actingAs($this->admin)
        ->post(route('admin.invites.store'), ['label' => 'Kovács János', 'max_uses' => 1, 'email' => 'janos@example.com'])
        ->assertRedirect();

    expect(Invite::sole()->label)->toBe('Kovács János');
});

test('érvénytelen e-mail-cím vagy nem https bővítmény-link elutasítva', function (array $payload, string $field) {
    Notification::fake();

    $this->actingAs($this->admin)
        ->post(route('admin.invites.store'), ['max_uses' => 1, ...$payload])
        ->assertSessionHasErrors($field);

    expect(Invite::count())->toBe(0);
    Notification::assertNothingSent();
})->with([
    'hibás e-mail' => [['email' => 'nem-email'], 'email'],
    'http link' => [['email' => 'janos@example.com', 'extension_url' => 'http://example.com'], 'extension_url'],
    'javascript link' => [['email' => 'janos@example.com', 'extension_url' => 'javascript:alert(1)'], 'extension_url'],
]);

test('sikertelen küldésnél a kód megmarad, és az admin hibaüzenetet kap', function () {
    Notification::shouldReceive('send')->andThrow(new TransportException('SMTP down'));

    $this->actingAs($this->admin)
        ->post(route('admin.invites.store'), ['max_uses' => 1, 'email' => 'janos@example.com'])
        ->assertRedirect()
        ->assertSessionHas('error');

    expect(Invite::count())->toBe(1);
});

test('nem admin nem küldhet meghívót', function () {
    Notification::fake();
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('admin.invites.store'), ['max_uses' => 1, 'email' => 'janos@example.com'])
        ->assertForbidden();

    Notification::assertNothingSent();
});
