<?php

namespace App\Http\Responses;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Laravel\Fortify\Contracts\RegisterResponse as RegisterResponseContract;
use Symfony\Component\HttpFoundation\Response;

/**
 * Email-verification-first registration response.
 *
 * Fortify logs the new user in immediately after registration. We override that
 * here: the user is logged back out and sent to the login screen with a notice
 * to confirm their address first. The verification email itself is already sent
 * by Laravel's SendEmailVerificationNotification listener on the Registered event.
 */
class RegisterResponse implements RegisterResponseContract
{
    public function toResponse($request): RedirectResponse|Response
    {
        Auth::guard('web')->logout();

        if ($request instanceof Request) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return redirect()->route('login')->with(
            'status',
            'Elküldtük a megerősítő e-mailt. Kérjük, erősítsd meg a címed a levélben lévő linkkel, mielőtt belépsz.'
        );
    }
}
