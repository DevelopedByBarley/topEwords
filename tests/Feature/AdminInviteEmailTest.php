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
            $body = (string) $notification->toMail($notifiable)->render();

            return $notifiable->routes['mail'] === 'janos@example.com'
                && str_contains($body, 'href="'.url('/register').'?invite='.$invite->code.'"')
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
            $body = (string) $notification->toMail($notifiable)->render();

            return str_contains($body, 'Regisztrálok') && ! str_contains($body, 'Chrome-bővítmény');
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

/**
 * A kirenderelt (HTML) levél, a benne lévő szöveges ellenőrzésekhez.
 */
function invitationMailBody(Invite $invite): string
{
    return (string) (new InvitationSent($invite))->toMail(new AnonymousNotifiable)->render();
}

test('Pro induló csomaggal a meghívó eltárolja a napokat, és a levél megemlíti', function () {
    Notification::fake();

    $this->actingAs($this->admin)
        ->post(route('admin.invites.store'), ['max_uses' => 1, 'pro_days' => 30, 'email' => 'janos@example.com'])
        ->assertRedirect();

    $invite = Invite::sole();
    expect($invite->pro_days)->toBe(30);
    expect(invitationMailBody($invite))->toContain('30 napig ingyen tiéd a Pro csomag');
});

test('Ingyenes induló csomagnál a levél nem ígér Pro-t', function () {
    $invite = Invite::create(['code' => 'FREE1234', 'max_uses' => 1]);

    expect(invitationMailBody($invite))->not->toContain('Pro csomag');
});

test('a pro_days csak 1 és 365 közötti egész lehet', function (mixed $proDays) {
    $this->actingAs($this->admin)
        ->post(route('admin.invites.store'), ['max_uses' => 1, 'pro_days' => $proDays])
        ->assertSessionHasErrors('pro_days');

    expect(Invite::count())->toBe(0);
})->with([0, 366, 'harminc']);

test('a levél a hibabejelentő oldalra mutat', function () {
    $invite = Invite::create(['code' => 'REPORT12', 'max_uses' => 1]);

    expect(invitationMailBody($invite))->toContain(route('report.index'));
});

/**
 * @param  array<string, mixed>  $overrides
 */
function configureStripe(array $overrides = []): void
{
    config([
        'services.stripe.enabled' => true,
        'cashier.key' => 'pk_test_abc',
        'cashier.secret' => 'sk_test_abc',
        'services.stripe.premium_price_id' => 'price_abc',
        ...$overrides,
    ]);
}

test('teszt-módú Stripe-pal a levél megadja a tesztkártyát', function () {
    configureStripe();
    $invite = Invite::create(['code' => 'CARD1234', 'max_uses' => 1]);

    expect(invitationMailBody($invite))
        ->toContain('4242 4242 4242 4242')
        ->toContain('valódi pénz nem mozdul');
});

test('éles vagy kikapcsolt Stripe-nál a tesztkártya nem kerül a levélbe', function (array $overrides) {
    configureStripe($overrides);
    $invite = Invite::create(['code' => 'CARD5678', 'max_uses' => 1]);

    expect(invitationMailBody($invite))->not->toContain('4242');
})->with([
    'éles kulcs' => [['cashier.key' => 'pk_live_abc', 'cashier.secret' => 'sk_live_abc']],
    'kikapcsolt fizetés' => [['services.stripe.enabled' => false]],
]);
