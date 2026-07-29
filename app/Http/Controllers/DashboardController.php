<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\UserCustomWord;
use App\Models\Word;
use App\Services\FlashcardSrsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public const LEVELS = [
        1 => ['label' => 'Top 1 000', 'color' => 'green'],
        2 => ['label' => '1 001 – 2 000', 'color' => 'blue'],
        3 => ['label' => '2 001 – 4 000', 'color' => 'yellow'],
        4 => ['label' => '4 001 – 6 000', 'color' => 'orange'],
        5 => ['label' => '6 001 – 8 000', 'color' => 'purple'],
        6 => ['label' => '8 001 – 10 000', 'color' => 'red'],
    ];

    public function index(Request $request, FlashcardSrsService $srs): Response
    {
        $user = $request->user();

        $userStats = DB::table('user_word')
            ->join('words', 'words.id', '=', 'user_word.word_id')
            ->where('user_word.user_id', $user->id)
            ->selectRaw("
                words.level,
                SUM(CASE WHEN user_word.status = 'known' THEN 1 ELSE 0 END) as known,
                SUM(CASE WHEN user_word.status = 'learning' THEN 1 ELSE 0 END) as learning,
                SUM(CASE WHEN user_word.status = 'saved' THEN 1 ELSE 0 END) as saved,
                SUM(CASE WHEN user_word.status = 'pronunciation' THEN 1 ELSE 0 END) as pronunciation
            ")
            ->groupBy('words.level')
            ->get()
            ->keyBy('level');

        $wordCounts = Word::selectRaw('level, COUNT(*) as total')
            ->groupBy('level')
            ->pluck('total', 'level');

        $levelStats = collect(self::LEVELS)->map(function (array $level, int $key) use ($userStats, $wordCounts) {
            $stats = $userStats->get($key);
            $total = (int) ($wordCounts->get($key) ?? 0);
            $known = (int) ($stats->known ?? 0);

            return [
                'level' => $key,
                'label' => $level['label'],
                'color' => $level['color'],
                'total' => $total,
                'known' => $known,
                'learning' => (int) ($stats->learning ?? 0),
                'saved' => (int) ($stats->saved ?? 0),
                'pronunciation' => (int) ($stats->pronunciation ?? 0),
                'percent' => $total > 0 ? round(($known / $total) * 100) : 0,
            ];
        })->values();

        $totalKnown = $levelStats->sum('known');
        $totalWords = Word::count();

        $customWords = UserCustomWord::where('user_id', $user->id)
            ->selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status');

        $customStats = [
            'total' => $customWords->sum(),
            'known' => (int) ($customWords['known'] ?? 0),
            'learning' => (int) ($customWords['learning'] ?? 0),
            'saved' => (int) ($customWords['saved'] ?? 0),
            'pronunciation' => (int) ($customWords['pronunciation'] ?? 0),
        ];

        return Inertia::render('dashboard', [
            'levelStats' => $levelStats,
            'totalKnown' => $totalKnown,
            'totalWords' => $totalWords,
            'totalPercent' => $totalWords > 0 ? round(($totalKnown / $totalWords) * 100) : 0,
            'streak' => $user->currentStreak(),
            'studiedToday' => (bool) $user->last_activity_date?->isToday(),
            'lastActivityDate' => $user->last_activity_date?->toDateString(),
            'customStats' => $customStats,
            // A számolás pakliként végigmegy az SRS-en, ezért deferred: a lap
            // azonnal megjelenik, a „ma esedékes" doboz utólag töltődik be.
            'dueFlashcards' => Inertia::defer(fn () => $this->countDueFlashcards($user, $srs)),
        ]);
    }

    /**
     * A felhasználó összes paklijában ma esedékes tanulnivaló.
     *
     * A `countDueCards` a tanulás-sor kanonikus számlálója (ugyanazok a napi
     * limitek és kizárások), így a dashboard száma megegyezik azzal, amit a
     * flashcard-oldal deck-badge-ei mutatnak.
     *
     * @return array{cards: int, decks: int}
     */
    private function countDueFlashcards(User $user, FlashcardSrsService $srs): array
    {
        $decks = $user->flashcardDecks()->with('deckSettings')->get();
        $userSettings = $user->flashcardSettings;
        $defaultSettings = $srs->defaultSettings();

        $cards = 0;
        $decksWithDue = 0;

        foreach ($decks as $deck) {
            $settings = $deck->deckSettings ?? $userSettings ?? $defaultSettings;
            $due = array_sum($srs->countDueCards($deck->id, $settings));

            if ($due > 0) {
                $cards += $due;
                $decksWithDue++;
            }
        }

        return ['cards' => $cards, 'decks' => $decksWithDue];
    }
}
