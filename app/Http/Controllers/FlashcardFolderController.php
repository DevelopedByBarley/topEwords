<?php

namespace App\Http\Controllers;

use App\Models\FlashcardFolder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class FlashcardFolderController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $name = $request->validate(['name' => 'required|string|max:50'])['name'];

        $request->user()->flashcardFolders()->create(['name' => $name]);

        return back();
    }

    public function update(Request $request, FlashcardFolder $flashcardFolder): RedirectResponse
    {
        Gate::authorize('update', $flashcardFolder);

        $name = $request->validate(['name' => 'required|string|max:50'])['name'];

        $flashcardFolder->update(['name' => $name]);

        return back();
    }

    public function destroy(FlashcardFolder $flashcardFolder): RedirectResponse
    {
        Gate::authorize('delete', $flashcardFolder);

        $flashcardFolder->delete();

        return back();
    }
}
