<?php

use App\Models\User;

/**
 * A kézikönyv kézzel írt számokat közöl a csomag-keretekről és a jelvényekről.
 * Ezek a valódi forrásból (config/plans.php, AchievementService) élnek, és
 * csendben szét tudnak csúszni: a Pro könyv-kvótája 7-ről 3-ra ment, a
 * kézikönyv viszont hónapokig a régi számot írta. Ezek a tesztek a kettő
 * összhangját őrzik — ha egy limit változik, itt bukik el, nem a felhasználónál.
 */
function handbookSource(): string
{
    // A sortöréseket összevonjuk: a Prettier bármikor átformázhatja a
    // táblázat-sorokat, de a tartalomnak akkor is stimmelnie kell.
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

    // Az előfizetés-szekció összefoglaló táblája ugyanezeket a számokat írja
    // más tördelésben — a két hely nem csúszhat szét egymástól sem.
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

    // A kivezetett csoportokat (kvíz) nem hirdetjük megszerezhető jelvényként.
    expect($handbook)->not->toContain("'Kvíz', 'Mire kapsz");
});

test('az AI-funkciókat nem hirdetjük Pro-exkluzívnak', function () {
    // A User::hasAiAccess() minden csomagon igaz — az AI-t a havi keret
    // korlátozza, nem az előfizetés. Ha ez megfordul, ez a teszt szól.
    expect(User::factory()->create()->hasAiAccess())->toBeTrue();

    expect(handbookSource())
        ->not->toContain('Prémium funkció')
        ->not->toContain('Prémium előfizetés</strong> szükséges');
});
