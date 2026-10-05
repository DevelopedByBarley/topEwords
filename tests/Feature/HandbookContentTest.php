<?php

use App\Models\User;

function handbookSource(): string
{
    return preg_replace('/\s+/', ' ', file_get_contents(resource_path('js/pages/handbook.tsx')));
}

test('a kézikönyv bejelentkezés nélkül és belépve is megnyitható', function () {
    $this->get('/handbook')->assertSuccessful();

    $this->actingAs(User::factory()->create(['onboarding_completed_at' => now()]))
        ->get('/handbook')
        ->assertSuccessful();
});

test('a dokumentált csomag-keretek megegyeznek a config/plans.php értékeivel', function () {
    $handbook = handbookSource();
    $free = config('plans.limits.free');
    $pro = config('plans.limits.premium');

    $rows = [
        "['Szövegelemzés / nap', '{$free['text_analyses_per_day']}', '{$pro['text_analyses_per_day']}']",
        "['Mentett könyv', '{$free['books']}', '{$pro['books']}']",
        "['Mentett YouTube-felirat', '{$free['youtube_transcripts']}', '{$pro['youtube_transcripts']}']",
    ];

    foreach ($rows as $row) {
        expect($handbook)->toContain($row);
    }

    expect($handbook)
        ->toContain("'{$free['flashcards']} kártya, {$free['decks']} pakli'")
        ->toContain("'{$free['books']} könyv, {$free['youtube_transcripts']} felirat'")
        ->toContain("'{$pro['books']} könyv, {$pro['youtube_transcripts']} felirat'")
        ->toContain("'Mentés a Chrome-bővítményből / nap', '{$free['extension_writes_per_day']}'");
});

test('a kézikönyv a ténylegesen látható teljesítmény-csoportokat sorolja fel', function () {
    $handbook = handbookSource();

    $groupLabels = collect(
        $this->actingAs(User::factory()->create(['onboarding_completed_at' => now()]))
            ->get('/achievements')
            ->viewData('page')['props']['grouped']
    )->pluck('label');

    foreach ($groupLabels as $label) {
        expect($handbook)->toContain("'{$label}'");
    }

    expect($handbook)->not->toContain("'Kvíz', 'Mire kapsz");
});

test('az AI-funkciókat nem hirdetjük Pro-exkluzívnak', function () {
    expect(User::factory()->create()->hasAiAccess())->toBeTrue();

    expect(handbookSource())
        ->not->toContain('Prémium funkció')
        ->not->toContain('Prémium előfizetés</strong> szükséges');
});
