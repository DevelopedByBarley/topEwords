<?php

namespace App\Http\Controllers;

use App\Models\Invite;
use App\Models\Report;
use App\Models\User;
use App\Services\AdminActionLogger;
use App\Services\AdminDashboardService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class AdminController extends Controller
{
    public function __construct(
        private AdminDashboardService $dashboard,
        private AdminActionLogger $actionLog,
    ) {}

    /**
     * A propok closure-ök: a hozzáférés-kezelő keresése / lapozása partial
     * reloaddal (`only: ['accessUsers', 'accessSearch']`) csak a userlistát
     * kéri le, a többi (drágább) lekérdezés ilyenkor le sem fut.
     */
    public function index(Request $request): Response
    {
        // Nem validate(): egy GET-oldalon a hibás paraméter back()-je önmagára
        // irányíthatna vissza. A keresőszót csonkoljuk, a lapszámot a paginator
        // maga kezeli (nem szám → 1. oldal).
        $accessSearch = mb_substr(trim($request->string('access_search')->toString()), 0, 100);

        return Inertia::render('admin/index', [
            'stats' => fn () => $this->dashboard->stats(),
            'topStreaks' => fn () => $this->dashboard->topStreaks(),
            'recentUsers' => fn () => $this->dashboard->recentUsers(),
            'mostActive' => fn () => $this->dashboard->mostActive(),
            'registrationsByDay' => fn () => $this->dashboard->registrationsByDay(),
            'accessUsers' => fn () => $this->dashboard->accessUsers($accessSearch),
            'accessSearch' => $accessSearch,
            'invites' => fn () => $this->dashboard->invites(),
            'inviteOnly' => (bool) config('registration.invite_only'),
            'reports' => fn () => $this->dashboard->reports(),
        ]);
    }

    public function storeInvite(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'label' => ['nullable', 'string', 'max:100'],
            'max_uses' => ['required', 'integer', 'min:1', 'max:10000'],
            'expires_at' => ['nullable', 'date', 'after:now'],
        ]);

        do {
            $code = Str::upper(Str::random(8));
        } while (Invite::where('code', $code)->exists());

        $invite = Invite::create([
            'code' => $code,
            'label' => $data['label'] ?? null,
            'max_uses' => $data['max_uses'],
            'expires_at' => $data['expires_at'] ?? now()->addDays(7),
        ]);

        $this->actionLog->record($request->user(), 'invite.store', $invite->id, [
            'code' => $invite->code,
            'label' => $invite->label,
            'max_uses' => $invite->max_uses,
            'expires_at' => $invite->expires_at?->toIso8601String(),
        ]);

        return back()->with('success', "Meghívókód létrehozva: {$code}");
    }

    public function destroyInvite(Request $request, Invite $invite): RedirectResponse
    {
        $invite->delete();

        $this->actionLog->record($request->user(), 'invite.destroy', $invite->id, [
            'code' => $invite->code,
            'label' => $invite->label,
            'uses' => $invite->uses,
        ]);

        return back()->with('success', 'Meghívókód visszavonva.');
    }

    public function setAccess(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'exists:users,email'],
            'plan' => ['required', 'in:none,premium'],
        ]);

        $user = User::where('email', $data['email'])->firstOrFail();
        $previousOverride = $user->plan_override;
        $user->plan_override = $data['plan'] === 'none' ? null : $data['plan'];
        $user->save();

        $this->actionLog->record($request->user(), 'access.set', $user->id, [
            'target_email' => $user->email,
            'plan_override' => ['old' => $previousOverride, 'new' => $user->plan_override],
        ]);

        $message = match ($data['plan']) {
            'premium' => "{$user->name} Pro hozzáférést kapott.",
            default => "{$user->name} felülírása törölve, az előfizetése dönt.",
        };

        return back()->with('success', $message);
    }

    public function grantFreeMonth(Request $request, User $user): RedirectResponse
    {
        $previousTrialEnd = $user->trial_ends_at;
        $base = $user->onTrial() ? $user->trial_ends_at : now();
        $user->trial_ends_at = $base->copy()->addMonth();
        $user->save();

        $this->actionLog->record($request->user(), 'free-month.grant', $user->id, [
            'target_email' => $user->email,
            'trial_ends_at' => [
                'old' => $previousTrialEnd?->toIso8601String(),
                'new' => $user->trial_ends_at->toIso8601String(),
            ],
        ]);

        $until = $user->trial_ends_at->isoFormat('YYYY. MM. DD.');

        return back()->with('success', "{$user->name} +1 hónap ingyen Prót kapott ({$until}-ig).");
    }

    public function updateReportStatus(Request $request, Report $report): RedirectResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(Report::STATUSES)],
        ]);

        $previousStatus = $report->status;
        $report->status = $data['status'];
        $report->save();

        $this->actionLog->record($request->user(), 'report.update-status', $report->id, [
            'status' => ['old' => $previousStatus, 'new' => $report->status],
        ]);

        return back()->with('success', 'Bejelentés állapota frissítve.');
    }
}
