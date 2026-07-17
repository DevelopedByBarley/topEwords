<?php

namespace App\Http\Controllers;

use App\Models\Invite;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class AdminController extends Controller
{
    public function index(): Response
    {
        $totalUsers = User::count();
        $verifiedUsers = User::whereNotNull('email_verified_at')->count();
        $usersThisWeek = User::where('created_at', '>=', now()->startOfWeek())->count();
        $usersThisMonth = User::where('created_at', '>=', now()->startOfMonth())->count();
        $activeToday = User::whereDate('last_activity_date', today())->count();

        $totalWordStatuses = DB::table('user_word')->count();
        $statusCounts = DB::table('user_word')
            ->select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status');

        $topStreaks = User::where('streak', '>', 0)
            ->orderByDesc('streak')
            ->limit(10)
            ->get(['name', 'email', 'streak', 'last_activity_date']);

        $recentUsers = User::latest()
            ->limit(20)
            ->get(['name', 'email', 'created_at', 'email_verified_at', 'streak', 'last_activity_date']);

        $mostActive = User::withCount('knownWords')
            ->orderByDesc('known_words_count')
            ->limit(10)
            ->get(['id', 'name', 'email', 'streak']);

        $registrationsByDay = User::select(
            DB::raw('DATE(created_at) as date'),
            DB::raw('count(*) as count')
        )
            ->where('created_at', '>=', now()->subDays(30))
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        // Teljes userlista a hozzáférés-kezelőhöz — az effektív csomaggal
        $accessUsers = User::with('subscriptions')
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'plan_override', 'lifetime_access', 'trial_ends_at'])
            ->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'plan' => $u->currentPlan(),
                'plan_override' => $u->plan_override,
                // Valódi (fizető) Stripe-előfizetés van-e, és milyen csomag — az
                // admin felülírástól / próbaidőtől / lifetime-tól függetlenül.
                'subscribed' => $u->activeSubscription() !== null,
                'subscription_plan' => $u->subscriptionPlan(),
                // Aktív generikus próbaidő (admin-adta ingyen hónap) vége, ha van.
                'trial_ends_at' => $u->onTrial() ? $u->trial_ends_at->toIso8601String() : null,
            ]);

        $invites = Invite::withCount('users')
            ->with('users:id,invite_id,email')
            ->latest()
            ->get()
            ->map(fn (Invite $i) => [
                'id' => $i->id,
                'code' => $i->code,
                'label' => $i->label,
                'uses' => $i->uses,
                'max_uses' => $i->max_uses,
                'expires_at' => $i->expires_at?->toIso8601String(),
                'usable' => $i->isUsable(),
                'url' => url('/register').'?invite='.$i->code,
                'used_by' => $i->users->pluck('email')->all(),
            ]);

        return Inertia::render('admin/index', [
            'stats' => [
                'totalUsers' => $totalUsers,
                'verifiedUsers' => $verifiedUsers,
                'usersThisWeek' => $usersThisWeek,
                'usersThisMonth' => $usersThisMonth,
                'activeToday' => $activeToday,
                'totalWordStatuses' => $totalWordStatuses,
                'known' => $statusCounts['known'] ?? 0,
                'learning' => $statusCounts['learning'] ?? 0,
                'saved' => $statusCounts['saved'] ?? 0,
                'pronunciation' => $statusCounts['pronunciation'] ?? 0,
            ],
            'topStreaks' => $topStreaks,
            'recentUsers' => $recentUsers,
            'mostActive' => $mostActive,
            'registrationsByDay' => $registrationsByDay,
            'accessUsers' => $accessUsers,
            'invites' => $invites,
            'inviteOnly' => (bool) config('registration.invite_only'),
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
            'expires_at' => $data['expires_at'] ?? null,
        ]);

        return back()->with('success', "Meghívókód létrehozva: {$code}");
    }

    public function destroyInvite(Invite $invite): RedirectResponse
    {
        $invite->delete();

        return back()->with('success', 'Meghívókód visszavonva.');
    }

    /**
     * Csomag-felülírás kiosztása vagy visszavonása email alapján.
     * 'none' visszaállítja az alapértelmezettre (Stripe előfizetés dönt).
     */
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
     * Egy hónap ingyenes Pro kiosztása email alapján, a generikus próbaidővel
     * (users.trial_ends_at — a currentPlan() az onTrial()-on át már figyeli).
     * Halmozható: aktív próbaidőnél annak végéhez ad egy hónapot, egyébként
     * mostantól számít; lejáratkor a fiók magától visszaáll Free-re.
     */
    public function grantFreeMonth(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'exists:users,email'],
        ]);

        $user = User::where('email', $data['email'])->firstOrFail();

        $base = $user->onTrial() ? $user->trial_ends_at : now();
        $user->trial_ends_at = $base->copy()->addMonth();
        $user->save();

        $until = $user->trial_ends_at->timezone(config('app.timezone'))->isoFormat('YYYY. MM. DD.');

        return back()->with('success', "{$user->name} +1 hónap ingyen Prót kapott ({$until}-ig).");
    }
}
