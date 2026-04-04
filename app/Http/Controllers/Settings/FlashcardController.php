<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\FlashcardSettingRequest;
use App\Models\FlashcardSetting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class FlashcardController extends Controller
{
    public function edit(Request $request): Response
    {
        $settings = $request->user()->flashcardSettings ?? new FlashcardSetting([
            'new_cards_per_day' => 20,
            'max_reviews_per_day' => 200,
            'learning_steps' => [1, 10],
            'graduating_interval' => 1,
            'easy_interval' => 4,
            'starting_ease' => 250,
            'easy_bonus' => 130,
            'hard_interval_modifier' => 120,
            'interval_modifier' => 100,
            'max_interval' => 365,
            'lapse_new_interval' => 0,
            'leech_threshold' => 8,
        ]);

        return Inertia::render('settings/flashcards', [
            'settings' => $settings,
        ]);
    }

    public function update(FlashcardSettingRequest $request): RedirectResponse
    {
        $request->user()->flashcardSettings()->updateOrCreate(
            ['user_id' => $request->user()->id],
            $request->validated(),
        );

        return to_route('flashcard-settings.edit');
    }
}
