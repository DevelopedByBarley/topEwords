<?php

namespace App\Http\Controllers;

use App\Models\Folder;
use App\Models\Word;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class FolderWordController extends Controller
{
    public function update(Request $request, Folder $folder, Word $word): RedirectResponse
    {
        Gate::authorize('update', $folder);

        $inFolder = $request->validate(['in_folder' => 'required|boolean'])['in_folder'];

        if ($inFolder) {
            $folder->words()->syncWithoutDetaching([$word->id]);
        } else {
            $folder->words()->detach($word->id);
        }

        return back();
    }
}
