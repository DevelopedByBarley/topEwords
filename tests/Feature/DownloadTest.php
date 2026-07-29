<?php

use App\Models\User;
use Illuminate\Support\Facades\Storage;

/**
 * A letöltő felület 2026-07-29 óta admin-only: a bővítmény a Chrome Web
 * Store-ból települ majd, a desktop lejátszót pedig nem hirdetjük. A friss
 * buildekhez ez az egyetlen hely, a felhasználók elől el van rejtve.
 */
beforeEach(function () {
    Storage::fake('local');
    Storage::disk('local')->put('downloads/topwords-extension.zip', 'zip-contents');
    config(['app.admin_email' => 'admin@example.com']);
});

function adminUser(): User
{
    return User::factory()->create(['email' => 'admin@example.com']);
}

test('guests cannot view the downloads page', function () {
    $this->get('/downloads')->assertRedirect('/login');
});

test('guests cannot download files', function () {
    $this->get('/downloads/extension')->assertRedirect('/login');
});

test('non-admin users cannot view the downloads page', function () {
    $this->actingAs(User::factory()->create())
        ->get('/downloads')
        ->assertForbidden();
});

test('non-admin users cannot download files', function () {
    $this->actingAs(User::factory()->create())
        ->get('/downloads/extension')
        ->assertForbidden();
});

test('admins can view the downloads page', function () {
    $this->actingAs(adminUser())
        ->get('/downloads')
        ->assertSuccessful();
});

test('admins can download a known file', function () {
    $this->actingAs(adminUser())
        ->get('/downloads/extension')
        ->assertSuccessful()
        ->assertDownload('topwords-extension.zip');
});

test('unknown download slugs are rejected', function () {
    $this->actingAs(adminUser())
        ->get('/downloads/does-not-exist')
        ->assertNotFound();
});

test('missing file on disk returns 404 even for a valid slug', function () {
    $this->actingAs(adminUser())
        ->get('/downloads/player-mac')
        ->assertNotFound();
});
