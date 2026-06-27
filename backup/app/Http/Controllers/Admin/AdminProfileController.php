<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Admin;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;

class AdminProfileController extends Controller
{
    public function editPassword()
    {
        return view('admin.profile.password');
    }

    public function updatePassword(Request $request)
    {
        $request->validate([
            'current_password' => ['required', 'current_password:admin'],
            'password' => ['required', 'confirmed', Password::min(8)],
        ]);

        /** @var Admin $admin */
        $admin = Auth::guard('admin')->user();
        $admin->password = Hash::make($request->password);
        $admin->save();

        return back()->with('success', 'Jelszó sikeresen megváltoztatva.');
    }
}
