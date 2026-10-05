<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreReportRequest;
use App\Models\Report;
use App\Notifications\ReportSubmitted;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use Throwable;

class ReportController extends Controller
{
    public function store(StoreReportRequest $request): RedirectResponse|JsonResponse
    {
        $today = Report::where('user_id', $request->user()->id)
            ->whereDate('created_at', today())
            ->count();

        if ($today >= 20) {
            throw ValidationException::withMessages([
                'description' => 'Elérted a napi bejelentési limitet. Próbáld holnap újra.',
            ]);
        }

        $report = $request->user()->reports()->create($request->validated());

        $this->notifyAdmin($report);

        if (! $request->hasHeader('X-Inertia') && $request->expectsJson()) {
            return response()->json(['ok' => true]);
        }

        return back();
    }

    private function notifyAdmin(Report $report): void
    {
        $adminEmail = config('app.admin_email');

        if (! $adminEmail) {
            return;
        }

        try {
            Notification::route('mail', $adminEmail)
                ->notifyNow(new ReportSubmitted($report->load(['user', 'word'])));
        } catch (Throwable $e) {
            report($e);
        }
    }
}
