<?php

return [
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
