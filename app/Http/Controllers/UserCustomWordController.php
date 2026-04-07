<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreUserCustomWordRequest;
use App\Models\UserCustomWord;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class UserCustomWordController extends Controller
{
    public function store(StoreUserCustomWordRequest $request): RedirectResponse
    {
        $request->user()->customWords()->create($request->validated());

        if ($request->user()->updateStreak()) {
            session()->flash('streak_triggered', $request->user()->streak);
        }

        return back();
    }

    public function update(Request $request, UserCustomWord $customWord): RedirectResponse
    {
        Gate::authorize('update', $customWord);

        $data = $request->validate([
            'word' => ['sometimes', 'string', 'max:100'],
            'meaning_hu' => ['nullable', 'string', 'max:255'],
            'part_of_speech' => ['nullable', 'string', 'max:20'],
            'example_en' => ['nullable', 'string', 'max:500'],
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
