<?php

namespace App\Http\Controllers;

use App\Mail\ContactMail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class ContactController extends Controller
{
    public function store(Request $request)
    {
        if ($request->filled('website')) {
            return back()->with('contact_success', true)->withFragment('contact');
        }

        $request->validate([
            'name'    => ['required', 'string', 'max:100'],
            'email'   => ['required', 'email', 'max:150'],
            'subject' => ['nullable', 'string', 'max:255'],
            'message' => ['required', 'string', 'max:2000'],
        ], [
            'name.required'    => 'A név megadása kötelező.',
            'email.required'   => 'Az e-mail cím megadása kötelező.',
            'email.email'      => 'Kérjük, érvényes e-mail címet adjon meg.',
            'message.required' => 'Az üzenet megadása kötelező.',
        ]);

        Mail::to(config('mail.from.address'))->send(new ContactMail($request->only('name', 'email', 'subject', 'message')));

        return back()->with('contact_success', true)->withFragment('contact');
    }
}
