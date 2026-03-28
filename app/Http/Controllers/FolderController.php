<?php

namespace App\Http\Controllers;

use App\Models\Folder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class FolderController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $name = $request->validate(['name' => 'required|string|max:50'])['name'];

        $request->user()->folders()->create(['name' => $name]);

        return back();
    }

    public function update(Request $request, Folder $folder): RedirectResponse
    {
        Gate::authorize('update', $folder);

        $name = $request->validate(['name' => 'required|string|max:50'])['name'];

        $folder->update(['name' => $name]);

        return back();
    }

    public function destroy(Folder $folder): RedirectResponse
    {
        Gate::authorize('delete', $folder);

        $folder->delete();

        return back();
    }
}
