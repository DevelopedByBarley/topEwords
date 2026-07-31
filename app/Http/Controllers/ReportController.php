<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreReportRequest;
use App\Models\Report;
use App\Notifications\ReportSubmitted;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use Throwable;

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

        $report = $request->user()->reports()->create($request->validated());

        $this->notifyAdmin($report);

        // Nincs flash-üzenet: a sikert az oldal saját visszaigazoló panelje mutatja
        // (pages/report/index.tsx). A globális toast ugyanazt a mondatot ismételné meg.
        return back();
    }

    /**
     * Értesíti az admint az új bejelentésről. A levélküldés hibája nem bukhat ki a
     * felhasználóig: a bejelentés ekkor már el van mentve, a visszajelzése nem
     * függhet az SMTP-től.
     */
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
