<?php

namespace App\Http\Controllers;

use App\Services\AchievementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class QuizController extends Controller
{
    public function complete(Request $request, AchievementService $service): JsonResponse
    {
        $perfect = (bool) $request->input('perfect', false);

        $newAchievements = $service->checkAndAwardQuiz($request->user(), $perfect);

        return response()->json(['achievements' => $newAchievements]);
    }
}
