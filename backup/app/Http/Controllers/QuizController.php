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

        $newAchievements = $service->checkAndAwardQuiz($request->user(), $request->boolean('perfect'));

        return response()->json(['achievements' => $newAchievements]);
    }
}
