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
    public function index(Request $request): Response
    {
        $levels = [
            'beginner' => ['label' => 'Kezdő', 'min' => 1, 'max' => 2000, 'difficulty' => 'beginner'],
            'intermediate' => ['label' => 'Középhaladó', 'min' => 2001, 'max' => 6000, 'difficulty' => 'intermediate'],
            'advanced' => ['label' => 'Haladó', 'min' => 6001, 'max' => 10000, 'difficulty' => 'advanced'],
        ];

        $userStats = DB::table('user_word')
            ->join('words', 'words.id', '=', 'user_word.word_id')
            ->where('user_word.user_id', $request->user()->id)
            ->selectRaw("
                SUM(CASE WHEN words.rank BETWEEN 1 AND 2000 AND user_word.status = 'known' THEN 1 ELSE 0 END) as beginner_known,
                SUM(CASE WHEN words.rank BETWEEN 1 AND 2000 AND user_word.status = 'learning' THEN 1 ELSE 0 END) as beginner_learning,
                SUM(CASE WHEN words.rank BETWEEN 1 AND 2000 AND user_word.status = 'saved' THEN 1 ELSE 0 END) as beginner_saved,
                SUM(CASE WHEN words.rank BETWEEN 1 AND 2000 AND user_word.status = 'pronunciation' THEN 1 ELSE 0 END) as beginner_pronunciation,
                SUM(CASE WHEN words.rank BETWEEN 2001 AND 6000 AND user_word.status = 'known' THEN 1 ELSE 0 END) as intermediate_known,
                SUM(CASE WHEN words.rank BETWEEN 2001 AND 6000 AND user_word.status = 'learning' THEN 1 ELSE 0 END) as intermediate_learning,
                SUM(CASE WHEN words.rank BETWEEN 2001 AND 6000 AND user_word.status = 'saved' THEN 1 ELSE 0 END) as intermediate_saved,
                SUM(CASE WHEN words.rank BETWEEN 2001 AND 6000 AND user_word.status = 'pronunciation' THEN 1 ELSE 0 END) as intermediate_pronunciation,
                SUM(CASE WHEN words.rank BETWEEN 6001 AND 10000 AND user_word.status = 'known' THEN 1 ELSE 0 END) as advanced_known,
                SUM(CASE WHEN words.rank BETWEEN 6001 AND 10000 AND user_word.status = 'learning' THEN 1 ELSE 0 END) as advanced_learning,
                SUM(CASE WHEN words.rank BETWEEN 6001 AND 10000 AND user_word.status = 'saved' THEN 1 ELSE 0 END) as advanced_saved,
                SUM(CASE WHEN words.rank BETWEEN 6001 AND 10000 AND user_word.status = 'pronunciation' THEN 1 ELSE 0 END) as advanced_pronunciation
            ")
            ->first();

        $levelStats = collect($levels)->map(function (array $level, string $key) use ($userStats) {
            $total = Word::whereBetween('rank', [$level['min'], $level['max']])->count();
            $known = (int) ($userStats->{$key.'_known'} ?? 0);
            $learning = (int) ($userStats->{$key.'_learning'} ?? 0);
            $saved = (int) ($userStats->{$key.'_saved'} ?? 0);
            $pronunciation = (int) ($userStats->{$key.'_pronunciation'} ?? 0);

            return [
                'label' => $level['label'],
                'difficulty' => $level['difficulty'],
                'range' => $level['min'].' – '.$level['max'],
                'total' => $total,
                'known' => $known,
                'learning' => $learning,
                'saved' => $saved,
                'pronunciation' => $pronunciation,
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
