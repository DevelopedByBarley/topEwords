<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\View\View;

class AdminForgotPasswordController extends Controller
{
    public function showLinkRequestForm(): View
    {
        return view('admin.auth.forgot-password');
    }

    public function sendResetLinkEmail(Request $request): RedirectResponse
    {
        $request->validate(['email' => ['required', 'email']]);

        // Mindig elküldjük a kérést, de a választ nem differenciáljuk,
        // hogy ne lehessen kideríteni, melyik e-mail cím regisztrált.
        Password::broker('admins')->sendResetLink($request->only('email'));

        return back()->with('status', 'Ha ez az e-mail cím regisztrált, hamarosan megérkezik a visszaállítási link.');
    }
}
