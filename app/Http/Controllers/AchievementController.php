<?php

namespace App\Http\Controllers;

use App\Services\AchievementService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AchievementController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();

        $unlocked = $user->achievements()
            ->orderBy('unlocked_at')
            ->pluck('unlocked_at', 'achievement_key');

        // A kivezetett funkciók csoportjai (pl. 'quiz') itt szándékosan
        // hiányoznak — lásd AchievementService::HIDDEN_GROUPS.
        $groups = [
            'streak' => 'Sorozat',
            'vocab' => 'Szókincs',
            'known' => 'Ismert szavak',
            'level' => 'Szintek',
            'custom' => 'Saját szavak',
            'flashcard' => 'Flashcards',
            'analysis' => 'Szövegelemzés',
        ];

        $visible = AchievementService::visibleAchievements();

        $grouped = [];
        foreach ($groups as $groupKey => $groupLabel) {
            $items = [];
            foreach ($visible as $key => $achievement) {
                if ($achievement['group'] !== $groupKey) {
                    continue;
                }
                $items[] = [
                    'key' => $key,
                    'title' => $achievement['title'],
                    'description' => $achievement['description'],
                    'icon' => $achievement['icon'],
                    'unlocked' => $unlocked->has($key),
                    'unlocked_at' => $unlocked->get($key)?->format('Y. m. d.'),
                ];
            }
            $grouped[] = ['label' => $groupLabel, 'key' => $groupKey, 'items' => $items];
        }

        // A haladás csak a látható jelvényekből számol: egy korábban megszerzett
        // kvíz-jelvény különben 100%-nál nagyobb arányt adna.
        $totalUnlocked = $unlocked->keys()->intersect(array_keys($visible))->count();
        $totalAchievements = count($visible);

        return Inertia::render('achievements/index', [
            'grouped' => $grouped,
            'totalUnlocked' => $totalUnlocked,
            'totalAchievements' => $totalAchievements,
        ]);
    }
}
