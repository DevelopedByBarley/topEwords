<?php

return [
    /*
    | Csomagonkénti funkció-limitek. A kulcs a User::currentPlan() értéke
    | ('free' | 'premium'). Egy limit `null` értéke KORLÁTLAN-t jelent.
    |
    | Két csomag van: Free (próbahozzáférés mindenből) és Pro (a `premium` kulcs). Minden
    | kulcsnak MINDEN csomagban szerepelnie kell (ezt teszt is védi), hogy egy
    | elgépelt kulcs ne váljon véletlenül korlátlanná. A limitek egyetlen forrása
    | ez a fájl — a controllerek a User helper metódusokon keresztül olvassák
    | (planLimit()), sehol ne legyen hardkódolt érték.
    |
    | `ai_budget_micros`: havi AI-költségkeret mikro-dollárban (1e6 = $1). A Free
    | kap egy kis próba-keretet, a Pro a teljes keretet. Admin = korlátlan (User).
    | `extension_writes_per_day`: a bővítményből indított írások (státusz + egyéni
    | szó + flashcard) KÖZÖS napi számlálója; állítható itt, Pro = korlátlan.

    1 000 000 mikro = 1 USD
    */
    'limits' => [
        'free' => [
            'flashcards' => 50,
            'decks' => 5,
            'quiz_per_round' => 10,
            'cloze_per_round' => 10,
            'text_analyses_per_day' => 2,
            'books' => 1,
            'youtube_transcripts' => 3,
            'extension_writes_per_day' => 20,
            'ai_budget_micros' => 8000,
        ],
        'premium' => [
            'flashcards' => null,
            'decks' => null,
            'quiz_per_round' => null,
            'cloze_per_round' => null,
            'text_analyses_per_day' => 50,
            'books' => 3,
            'youtube_transcripts' => 40,
            'extension_writes_per_day' => null,
            'ai_budget_micros' => 500000,
        ],
    ],
];
