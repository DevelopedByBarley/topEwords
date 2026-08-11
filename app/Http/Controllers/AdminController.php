<?php

namespace App\Http\Controllers;

use App\Models\Invite;
use App\Models\Report;
use App\Models\User;
use App\Services\AdminDashboardService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class AdminController extends Controller
{
    public function __construct(private AdminDashboardService $dashboard) {}

    public function index(): Response
    {
        return Inertia::render('admin/index', [
            'stats' => $this->dashboard->stats(),
            'topStreaks' => $this->dashboard->topStreaks(),
            'recentUsers' => $this->dashboard->recentUsers(),
            'mostActive' => $this->dashboard->mostActive(),
            'registrationsByDay' => $this->dashboard->registrationsByDay(),
            'accessUsers' => $this->dashboard->accessUsers(),
            'invites' => $this->dashboard->invites(),
            'inviteOnly' => (bool) config('registration.invite_only'),
            'reports' => $this->dashboard->reports(),
        ]);
    }

    /**
     * Új meghívókód generálása (egyéni kód, opcionális címkével/lejárattal).
     */
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

        Invite::create([
            'code' => $code,
            'label' => $data['label'] ?? null,
            'max_uses' => $data['max_uses'],
            'expires_at' => $data['expires_at'] ?? now()->addDays(7),
        ]);

        return back()->with('success', "Meghívókód létrehozva: {$code}");
    }

    public function destroyInvite(Invite $invite): RedirectResponse
    {
        $invite->delete();

        return back()->with('success', 'Meghívókód visszavonva.');
    }

    public function setAccess(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'exists:users,email'],
            'plan' => ['required', 'in:none,premium'],
        ]);

        $user = User::where('email', $data['email'])->firstOrFail();
        $user->plan_override = $data['plan'] === 'none' ? null : $data['plan'];
        $user->save();

        $message = match ($data['plan']) {
            'premium' => "{$user->name} Pro hozzáférést kapott.",
            default => "{$user->name} felülírása törölve, az előfizetése dönt.",
        };

        return back()->with('success', $message);
    }

    /**
     * Egy hónap ingyenes Pro kiosztása, a generikus próbaidővel
     * (users.trial_ends_at — a currentPlan() az onTrial()-on át már figyeli).
     * Halmozható: aktív próbaidőnél annak végéhez ad egy hónapot, egyébként
     * mostantól számít; lejáratkor a fiók magától visszaáll Free-re.
     */
    public function grantFreeMonth(User $user): RedirectResponse
    {
        $base = $user->onTrial() ? $user->trial_ends_at : now();
        $user->trial_ends_at = $base->copy()->addMonth();
        $user->save();

        $until = $user->trial_ends_at->isoFormat('YYYY. MM. DD.');

        return back()->with('success', "{$user->name} +1 hónap ingyen Prót kapott ({$until}-ig).");
    }

    public function updateReportStatus(Request $request, Report $report): RedirectResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(Report::STATUSES)],
        ]);

        $report->status = $data['status'];
        $report->save();

        return back()->with('success', 'Bejelentés állapota frissítve.');
    }
}
