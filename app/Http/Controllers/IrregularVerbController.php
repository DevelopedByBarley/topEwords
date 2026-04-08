<?php

namespace App\Http\Controllers;

use App\Models\IrregularVerb;
use Inertia\Inertia;
use Inertia\Response;

class IrregularVerbController extends Controller
{
    public function index(): Response
    {
        $verbs = IrregularVerb::whereNotNull('past_simple')
            ->whereNotNull('past_participle')
            ->orderBy('infinitive')
            ->get(['id', 'infinitive', 'past_simple', 'past_participle', 'meaning_hu', 'example_en'])
            ->all();

        return Inertia::render('irregular-verbs/index', [
            'verbs' => $verbs,
        ]);
    }
}
