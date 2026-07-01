<?php

return [
    /*
    | Csomagonkénti funkció-limitek. A kulcs a User::currentPlan() értéke
    | ('free' | 'basic' | 'premium'). Egy limit `null` értéke KORLÁTLAN-t jelent.
    |
    | Minden kulcsnak MINDEN csomagban szerepelnie kell (ezt teszt is védi), hogy
    | egy elgépelt kulcs ne váljon véletlenül korlátlanná. A limitek egyetlen
    | forrása ez a fájl — a controllerek a User helper metódusokon keresztül
    | olvassák (planLimit()), sehol ne legyen hardkódolt érték.
    */
    'limits' => [
        'free' => [
            'flashcards' => 50,
            'decks' => 5,
            'quiz_per_round' => 10,
            'cloze_per_round' => 5,
            'text_analyses_per_day' => 2,
            'books' => 1,
            'youtube_transcripts' => 3,
        ],
        'basic' => [
            'flashcards' => 2000,
            'decks' => 50,
            'quiz_per_round' => 100,
            'cloze_per_round' => 100,
            'text_analyses_per_day' => 20,
            'books' => 2,
            'youtube_transcripts' => 15,
        ],
        'premium' => [
            'flashcards' => null,
            'decks' => null,
            'quiz_per_round' => null,
            'cloze_per_round' => null,
            'text_analyses_per_day' => 50,
            'books' => 7,
            'youtube_transcripts' => 40,
        ],
    ],
];
