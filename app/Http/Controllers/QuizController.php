<?php

namespace App\Http\Controllers;

use App\Services\AchievementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class QuizController extends Controller
{
    public function complete(Request $request, AchievementService $service): JsonResponse
    {
        $request->validate(['perfect' => ['boolean']]);

        if ($request->user()->updateStreak()) {
            session()->flash('streak_triggered', $request->user()->streak);
        }

        $newAchievements = $service->checkAndAwardQuiz($request->user(), $request->boolean('perfect'));
        $newAchievements = [...$newAchievements, ...$service->checkAndAward($request->user(), ['streak'])];

        return response()->json(['achievements' => $newAchievements]);
    }
}
