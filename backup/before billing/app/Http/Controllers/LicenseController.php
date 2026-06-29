<?php

// ============================================================
// API RÉSZ — ezt a fájlt másold át a saját szerveredre
// ============================================================

namespace App\Http\Controllers;

use App\Models\License;
use Illuminate\Http\JsonResponse;

class LicenseController extends Controller
{
    public function check(string $key): JsonResponse
    {
        $license = License::where('key', $key)->first();

        if (! $license) {
            return response()->json(['active' => false]);
        }

        return response()->json(['active' => $license->isActive()]);
    }
}
