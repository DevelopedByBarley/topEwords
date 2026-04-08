<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreUserCustomWordRequest;
use App\Models\UserCustomWord;
use App\Services\AchievementService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class UserCustomWordController extends Controller
{
    private const WORD_FIELDS = [
        'word', 'meaning_hu', 'extra_meanings', 'synonyms', 'part_of_speech',
        'example_en', 'example_hu', 'form_base', 'verb_past', 'verb_past_participle',
        'verb_present_participle', 'verb_third_person', 'is_irregular',
        'noun_plural', 'adj_comparative', 'adj_superlative',
    ];

    public function store(StoreUserCustomWordRequest $request): RedirectResponse
    {
        if ($request->user()->isOnFreePlan() && $request->user()->customWords()->count() >= 10) {
            return back()->with('error', 'Elérted az ingyenes saját szó limitet (10 szó). Frissíts prémiumra a korlátlan hozzáféréshez.');
        }

        $request->user()->customWords()->create($request->validated());

        if ($request->user()->updateStreak()) {
            session()->flash('streak_triggered', $request->user()->streak);
        }

        $newAchievements = app(AchievementService::class)->checkAndAward($request->user(), ['streak', 'vocab', 'custom']);
        if ($newAchievements) {
            session()->flash('achievements', $newAchievements);
        }

        return back();
    }

    public function update(Request $request, UserCustomWord $customWord): RedirectResponse
    {
        Gate::authorize('update', $customWord);

        $data = $request->validate([
            'word' => ['sometimes', 'string', 'max:100'],
            'meaning_hu' => ['nullable', 'string', 'max:255'],
            'extra_meanings' => ['nullable', 'string', 'max:500'],
            'synonyms' => ['nullable', 'string', 'max:255'],
            'part_of_speech' => ['nullable', 'string', 'max:20'],
            'example_en' => ['nullable', 'string', 'max:500'],
            'example_hu' => ['nullable', 'string', 'max:500'],
            'form_base' => ['nullable', 'string', 'max:100'],
            'verb_past' => ['nullable', 'string', 'max:100'],
            'verb_past_participle' => ['nullable', 'string', 'max:100'],
            'verb_present_participle' => ['nullable', 'string', 'max:100'],
            'verb_third_person' => ['nullable', 'string', 'max:100'],
            'is_irregular' => ['boolean'],
            'noun_plural' => ['nullable', 'string', 'max:100'],
            'adj_comparative' => ['nullable', 'string', 'max:100'],
            'adj_superlative' => ['nullable', 'string', 'max:100'],
        ]);

        $customWord->update($data);

        return back();
    }

    public function status(Request $request, UserCustomWord $customWord): RedirectResponse
    {
        Gate::authorize('update', $customWord);

        $status = $request->validate(['status' => 'required|in:known,learning,saved,pronunciation'])['status'];

        if ($customWord->status === $status) {
            $customWord->update(['status' => null]);
        } else {
            $customWord->update(['status' => $status]);

            if ($request->user()->updateStreak()) {
                session()->flash('streak_triggered', $request->user()->streak);
            }

            $newAchievements = app(AchievementService::class)->checkAndAward($request->user(), ['streak', 'vocab', 'known', 'custom']);
            if ($newAchievements) {
                session()->flash('achievements', $newAchievements);
            }
        }

        return back();
    }

    public function destroy(UserCustomWord $customWord): RedirectResponse
    {
        Gate::authorize('delete', $customWord);

        $customWord->delete();

        return back();
    }
}
