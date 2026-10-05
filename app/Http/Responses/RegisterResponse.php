<?php

namespace App\Http\Responses;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Laravel\Fortify\Contracts\RegisterResponse as RegisterResponseContract;
use Symfony\Component\HttpFoundation\Response;

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
