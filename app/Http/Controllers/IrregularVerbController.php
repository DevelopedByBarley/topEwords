<?php

namespace App\Http\Controllers;

use App\Models\Word;
use Inertia\Inertia;
use Inertia\Response;

class IrregularVerbController extends Controller
{
    public function index(): Response
    {
        $verbs = Word::where('is_irregular', true)
            ->whereNotNull('verb_past')
            ->whereNotNull('verb_past_participle')
            ->orderBy('word')
            ->get(['id', 'word as infinitive', 'verb_past as past_simple', 'verb_past_participle as past_participle', 'meaning_hu', 'example_en'])
            ->all();

        return Inertia::render('irregular-verbs/index', [
            'verbs' => $verbs,
        ]);
    }
}
