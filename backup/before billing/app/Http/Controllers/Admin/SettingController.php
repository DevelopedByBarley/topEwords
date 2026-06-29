<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class SettingController extends Controller
{
    public function edit(): View
    {
        return view('admin.settings.edit', [
            'whatsapp_phone' => Setting::get('whatsapp_phone', config('services.whatsapp.phone')),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'whatsapp_phone' => ['required', 'string', 'max:20', 'regex:/^[0-9]+$/'],
        ], [
            'whatsapp_phone.required' => 'A telefonszám megadása kötelező.',
            'whatsapp_phone.regex'    => 'Csak számokat adj meg (pl. 36201234567).',
            'whatsapp_phone.max'      => 'A telefonszám legfeljebb 20 karakter lehet.',
        ]);

        Setting::set('whatsapp_phone', $validated['whatsapp_phone']);

        return redirect()->route('admin.settings.edit')
            ->with('success', 'Beállítások sikeresen mentve.');
    }
}
