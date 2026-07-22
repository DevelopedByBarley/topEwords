<?php

use App\Models\User;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('local');
    Storage::disk('local')->put('downloads/topwords-extension.zip', 'zip-contents');
});

test('guests cannot view the downloads page', function () {
    $this->get('/downloads')->assertRedirect('/login');
});

test('guests cannot download files', function () {
    $this->get('/downloads/extension')->assertRedirect('/login');
});

test('authenticated users can view the downloads page', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get('/downloads')
        ->assertSuccessful();
});

test('authenticated users can download a known file', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get('/downloads/extension')
        ->assertSuccessful()
        ->assertDownload('topwords-extension.zip');
});

test('unknown download slugs are rejected', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get('/downloads/does-not-exist')
        ->assertNotFound();
});

test('missing file on disk returns 404 even for a valid slug', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get('/downloads/player-mac')
        ->assertNotFound();
});
