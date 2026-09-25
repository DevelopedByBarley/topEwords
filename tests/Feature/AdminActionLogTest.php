<?php

use App\Models\Invite;
use App\Models\Report;
use App\Models\User;
use App\Models\Word;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Mockery\MockInterface;
use Psr\Log\LoggerInterface;

/**
 * Admin-műveletnapló (F9C-L2): minden admin-írás egy sort kap az `admin`
 * csatornán — ki, mit, kin, régi → új érték. Enélkül utólag nem derülne ki,
 * ki adott Prót egy usernek vagy ki írta át a közös szótárat.
 */
beforeEach(function () {
    config(['app.admin_email' => 'admin@example.com']);

    $this->admin = User::factory()->withTwoFactor()->create(['email' => 'admin@example.com']);

    Log::spy();
    $this->adminLog = Mockery::spy(LoggerInterface::class);
    Log::shouldReceive('channel')->with('admin')->andReturn($this->adminLog);
});

/**
 * @param  callable(array<string, mixed>): bool  $contextMatches
 */
function expectAdminLogEntry(MockInterface $adminLog, string $action, callable $contextMatches): void
{
    $adminLog->shouldHaveReceived('info')
        ->withArgs(fn (string $message, array $context) => $message === "admin.{$action}"
            && $context['action'] === $action
            && $context['admin_email'] === 'admin@example.com'
            && $contextMatches($context))
        ->once();
}

test('a Pro-felülírás naplózza a régi és az új értéket', function () {
    $target = User::factory()->create();

    $this->actingAs($this->admin)
        ->post(route('admin.access.set'), ['email' => $target->email, 'plan' => 'premium'])
        ->assertRedirect();

    expectAdminLogEntry($this->adminLog, 'access.set', fn (array $context) => $context['admin_id'] === $this->admin->id
        && $context['target_id'] === $target->id
        && $context['plan_override'] === ['old' => null, 'new' => 'premium']);
});

test('az ingyen hónap naplózza a próbaidő régi és új végét', function () {
    $target = User::factory()->create();

    $this->actingAs($this->admin)
        ->post(route('admin.free-month.grant', $target))
        ->assertRedirect();

    $newTrialEnd = $target->refresh()->trial_ends_at->toIso8601String();

    expectAdminLogEntry($this->adminLog, 'free-month.grant', fn (array $context) => $context['target_id'] === $target->id
        && $context['trial_ends_at'] === ['old' => null, 'new' => $newTrialEnd]);
});

test('a meghívó létrehozása és visszavonása naplózódik', function () {
    $this->actingAs($this->admin)
        ->post(route('admin.invites.store'), ['label' => 'Béta', 'max_uses' => 3])
        ->assertRedirect();

    $invite = Invite::firstOrFail();

    expectAdminLogEntry($this->adminLog, 'invite.store', fn (array $context) => $context['target_id'] === $invite->id
        && $context['code'] === $invite->code
        && $context['max_uses'] === 3);

    $this->actingAs($this->admin)
        ->delete(route('admin.invites.destroy', $invite))
        ->assertRedirect();

    expectAdminLogEntry($this->adminLog, 'invite.destroy', fn (array $context) => $context['target_id'] === $invite->id
        && $context['code'] === $invite->code);
});

test('a bejelentés állapotváltása naplózódik', function () {
    $report = Report::factory()->create();

    $this->actingAs($this->admin)
        ->patch(route('admin.reports.update-status', $report), ['status' => 'resolved'])
        ->assertRedirect();

    expectAdminLogEntry($this->adminLog, 'report.update-status', fn (array $context) => $context['target_id'] === $report->id
        && $context['status'] === ['old' => 'open', 'new' => 'resolved']);
});

test('a szó módosítása csak a ténylegesen változott mezőket naplózza', function () {
    $word = Word::create(['word' => 'happy', 'rank' => 1, 'meaning_hu' => 'boldog']);

    $this->actingAs($this->admin)
        ->patch(route('words.update', $word), ['meaning_hu' => 'vidám', 'synonyms' => null])
        ->assertRedirect();

    expectAdminLogEntry($this->adminLog, 'word.update', fn (array $context) => $context['target_id'] === $word->id
        && $context['changes'] === ['meaning_hu' => ['old' => 'boldog', 'new' => 'vidám']]);
});

test('a változás nélküli szó-mentés nem ír naplót', function () {
    $word = Word::create(['word' => 'happy', 'rank' => 1, 'meaning_hu' => 'boldog']);

    $this->actingAs($this->admin)
        ->patch(route('words.update', $word), ['meaning_hu' => 'boldog'])
        ->assertRedirect();

    $this->adminLog->shouldNotHaveReceived('info');
});

test('a szó törlése naplózódik', function () {
    $word = Word::create(['word' => 'happy', 'rank' => 1]);

    $this->actingAs($this->admin)
        ->delete(route('words.destroy', $word))
        ->assertRedirect();

    expectAdminLogEntry($this->adminLog, 'word.destroy', fn (array $context) => $context['target_id'] === $word->id
        && $context['word'] === 'happy');
});

test('az AI-alakkitöltő naplózza a kitöltött mezőket', function () {
    config(['services.gemini.api_key' => 'test-key']);
    Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
        'candidates' => [['content' => ['parts' => [['text' => json_encode([
            'is_real_word' => true,
            'base_form' => 'happy',
            'meaning_hu' => 'boldog',
            'adj_comparative' => 'happier',
            'adj_superlative' => 'happiest',
        ])]]]]],
        'usageMetadata' => ['promptTokenCount' => 300, 'candidatesTokenCount' => 200],
    ])]);
    $word = Word::create(['word' => 'happy', 'rank' => 1, 'part_of_speech' => 'adj']);

    $this->actingAs($this->admin)
        ->postJson(route('words.ai-fill', $word))
        ->assertSuccessful();

    expectAdminLogEntry($this->adminLog, 'word.ai-fill', fn (array $context) => $context['target_id'] === $word->id
        && $context['filled'] === ['adj_comparative' => 'happier', 'adj_superlative' => 'happiest']);
});

test('az admin csatorna napi forgatású, egy éves megőrzéssel, külön fájlban', function () {
    expect(config('logging.channels.admin'))
        ->driver->toBe('daily')
        ->days->toBe(365)
        ->path->toBe(storage_path('logs/admin.log'));
});
