<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreReportRequest;
use App\Models\Report;
use Illuminate\Http\RedirectResponse;
use Illuminate\Validation\ValidationException;

class ReportController extends Controller
{
    public function store(StoreReportRequest $request): RedirectResponse
    {
        $today = Report::where('user_id', $request->user()->id)
            ->whereDate('created_at', today())
            ->count();

        if ($today >= 20) {
            throw ValidationException::withMessages([
                'description' => 'Elérted a napi bejelentési limitet. Próbáld holnap újra.',
            ]);
        }

        $request->user()->reports()->create($request->validated());

        return back()->with('success', 'Köszönjük a jelzést!');
    }
}
