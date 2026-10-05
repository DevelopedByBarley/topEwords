<?php

use App\Models\User;

test('a store-link megosztott propként megy ki, ha be van állítva', function () {
    config(['extension.store_url' => 'https://chromewebstore.google.com/detail/abc123']);

    $this->actingAs(User::factory()->create(['onboarding_completed_at' => now()]))
        ->get('/dashboard')
        ->assertSuccessful()
        ->assertInertia(fn ($page) => $page->where(
            'extensionStoreUrl',
            'https://chromewebstore.google.com/detail/abc123',
        ));
});

test('beállítatlan store-link esetén a prop null', function () {
    config(['extension.store_url' => null]);

    $this->actingAs(User::factory()->create(['onboarding_completed_at' => now()]))
        ->get('/dashboard')
        ->assertSuccessful()
        ->assertInertia(fn ($page) => $page->where('extensionStoreUrl', null));
});

test('a landing vendégként is megkapja a store-linket', function () {
    config(['extension.store_url' => 'https://chromewebstore.google.com/detail/abc123']);

    $this->get('/')
        ->assertSuccessful()
        ->assertInertia(fn ($page) => $page->where(
            'extensionStoreUrl',
            'https://chromewebstore.google.com/detail/abc123',
        ));
});
