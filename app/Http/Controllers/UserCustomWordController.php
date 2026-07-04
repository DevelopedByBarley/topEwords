<?php

namespace App\Http\Controllers;

use App\Concerns\TogglesWordStatus;
use App\Http\Requests\StoreUserCustomWordRequest;
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
            'status' => ['nullable', 'in:known,learning,saved,pronunciation,practice'],
            'importance' => ['nullable', 'integer', 'min:1', 'max:5'],
        ]);

        $customWord->update($data);

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
