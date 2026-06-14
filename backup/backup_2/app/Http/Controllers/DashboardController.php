<?php

namespace App\Http\Controllers;

use App\Models\UserCustomWord;
use App\Models\Word;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public const LEVELS = [
        1 => ['label' => 'Kezdő', 'color' => 'green'],
        2 => ['label' => 'Alapszint', 'color' => 'blue'],
        3 => ['label' => 'Középszint', 'color' => 'yellow'],
        4 => ['label' => 'Haladó', 'color' => 'orange'],
        5 => ['label' => 'Szakértő', 'color' => 'purple'],
        6 => ['label' => 'Mester', 'color' => 'red'],
    ];

    public function index(Request $request): Response
    {
        $userStats = DB::table('user_word')
            ->join('words', 'words.id', '=', 'user_word.word_id')
            ->where('user_word.user_id', $request->user()->id)
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

        $customWords = UserCustomWord::where('user_id', $request->user()->id)
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
            'streak' => $request->user()->streak,
            'customStats' => $customStats,
        ]);
    }
}
