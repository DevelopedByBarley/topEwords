<?php

namespace App\Http\Controllers;

use App\Models\FlashcardDeck;
use App\Models\FlashcardFolder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class FlashcardFolderDeckController extends Controller
{
    public function update(Request $request, FlashcardFolder $flashcardFolder, FlashcardDeck $flashcardDeck): RedirectResponse
    {
        Gate::authorize('update', $flashcardFolder);

        $inFolder = $request->validate(['in_folder' => 'required|boolean'])['in_folder'];

        if ($inFolder) {
            $flashcardFolder->decks()->syncWithoutDetaching([$flashcardDeck->id]);
        } else {
            $flashcardFolder->decks()->detach($flashcardDeck->id);
        }

        return back();
    }
}
