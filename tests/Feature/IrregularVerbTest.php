<?php

use App\Models\User;
use App\Models\Word;

test('guests are redirected to the login page', function () {
    $this->get(route('irregular-verbs.index'))->assertRedirect(route('login'));
});

test('irregular verbs page lists only verbs with both past forms', function () {
    $this->actingAs(User::factory()->create());

    Word::insert([
        ['word' => 'go', 'meaning_hu' => 'megy', 'rank' => 1, 'is_irregular' => true, 'verb_past' => 'went', 'verb_past_participle' => 'gone', 'created_at' => now(), 'updated_at' => now()],
        // Modális ige participle nélkül — nem jelenhet meg a listában
        ['word' => 'can', 'meaning_hu' => 'tud, képes', 'rank' => 2, 'is_irregular' => true, 'verb_past' => 'could', 'verb_past_participle' => null, 'created_at' => now(), 'updated_at' => now()],
        ['word' => 'apple', 'meaning_hu' => 'alma', 'rank' => 3, 'is_irregular' => false, 'verb_past' => null, 'verb_past_participle' => null, 'created_at' => now(), 'updated_at' => now()],
    ]);

    $this->get(route('irregular-verbs.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('irregular-verbs/index')
            ->has('verbs', 1)
            ->where('verbs.0.infinitive', 'go')
            ->where('verbs.0.past_simple', 'went')
            ->where('verbs.0.past_participle', 'gone')
            ->where('verbs.0.meaning_hu', 'megy')
        );
});

test('irregular verbs page renders with an empty verb list', function () {
    $this->actingAs(User::factory()->create());

    $this->get(route('irregular-verbs.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('irregular-verbs/index')
            ->where('verbs', [])
        );
});
