<?php

use App\Services\WordStatusFormExpander;

test('splits slash-separated alternative forms into separate variants', function () {
    $expander = new WordStatusFormExpander;

    $forms = $expander->formsFor((object) [
        'word' => 'get',
        'status' => 'known',
        'verb_past' => 'got',
        'verb_past_participle' => 'got/gotten',
    ]);

    expect($forms)->toContain('get')
        ->toContain('got')
        ->toContain('gotten')
        ->not->toContain('got/gotten');
});

test('phrase rows keep only the multi-word variants of slash-separated forms', function () {
    $expander = new WordStatusFormExpander;

    // A "got on/gotten on" mindkét változata többszavas, ezért bekerül; az
    // egyszavas form_base ("get") kifejezésnél továbbra is kimarad.
    $forms = $expander->formsFor((object) [
        'word' => 'get on',
        'status' => 'saved',
        'form_base' => 'get',
        'verb_past' => 'got on/gotten on',
    ]);

    expect($forms)->toBe(['get on', 'got on', 'gotten on']);
});
