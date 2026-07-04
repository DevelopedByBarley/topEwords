<?php

namespace App\Http\Controllers;

use App\Concerns\TogglesWordStatus;
use App\Http\Requests\StoreUserCustomWordRequest;
use App\Http\Requests\UpdateUserCustomWordRequest;
use App\Models\UserCustomWord;
use App\Services\AchievementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class UserCustomWordController extends Controller
{
    use TogglesWordStatus;

    private const WORD_FIELDS = [
        'word', 'meaning_hu', 'extra_meanings', 'synonyms', 'part_of_speech',
        'example_en', 'example_hu', 'form_base', 'verb_past', 'verb_past_participle',
        'verb_present_participle', 'verb_third_person', 'is_irregular',
        'noun_plural', 'adj_comparative', 'adj_superlative',
    ];

    public function store(StoreUserCustomWordRequest $request): RedirectResponse
    {
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

    public function update(UpdateUserCustomWordRequest $request, UserCustomWord $customWord): RedirectResponse
    {
        Gate::authorize('update', $customWord);

        $customWord->update($request->validated());

        return back();
    }

    public function status(Request $request, UserCustomWord $customWord): RedirectResponse|JsonResponse
    {
        Gate::authorize('update', $customWord);

        $status = $this->validatedToggleStatus($request);
        $forms = $this->statusFormsFor($customWord);

        // Üres státusz, vagy az aktív gomb újrakattintása → levétel.
        if ($status === null || $customWord->status === $status) {
            $customWord->update(['status' => null]);

            return $this->statusToggleResponse($request, null, $forms);
        }

        if ($limitResponse = $this->reserveExtensionStatusWrite($request)) {
            return $limitResponse;
        }

        $customWord->update(['status' => $status]);

        if ($request->user()->updateStreak()) {
            session()->flash('streak_triggered', $request->user()->streak);
        }

        $newAchievements = app(AchievementService::class)->checkAndAward($request->user(), ['streak', 'vocab', 'known', 'custom']);
        if ($newAchievements) {
            session()->flash('achievements', $newAchievements);
        }

        return $this->statusToggleResponse($request, $status, $forms);
    }

    public function importance(Request $request, UserCustomWord $customWord): RedirectResponse
    {
        Gate::authorize('update', $customWord);

        $importance = $request->validate(['importance' => 'nullable|integer|min:1|max:5'])['importance'];

        $customWord->update(['importance' => $importance]);

        return back();
    }

    public function destroy(UserCustomWord $customWord): RedirectResponse
    {
        Gate::authorize('delete', $customWord);

        $customWord->delete();

        return back();
    }
}
