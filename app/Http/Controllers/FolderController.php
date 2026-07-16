<?php

namespace App\Http\Controllers;

use App\Models\Folder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class FolderController extends Controller
{
    /**
     * Per-user mappa-plafon: bőven a valós használat fölött, de megfogja a
     * szkriptelt tömeges létrehozást (DB/render-terhelés).
     */
    private const MAX_FOLDERS_PER_USER = 100;

    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();

        $name = $request->validate([
            'name' => [
                'required',
                'string',
                'max:50',
                Rule::unique('folders')->where('user_id', $user->id),
            ],
        ])['name'];

        if ($user->folders()->count() >= self::MAX_FOLDERS_PER_USER) {
            return back()->withErrors(['name' => 'Elérted a mappák maximális számát ('.self::MAX_FOLDERS_PER_USER.').']);
        }

        $user->folders()->create(['name' => $name]);

        return back();
    }

    public function update(Request $request, Folder $folder): RedirectResponse
    {
        Gate::authorize('update', $folder);

        $name = $request->validate([
            'name' => [
                'required',
                'string',
                'max:50',
                Rule::unique('folders')->where('user_id', $folder->user_id)->ignore($folder->id),
            ],
        ])['name'];

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
