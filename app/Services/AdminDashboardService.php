<?php

namespace App\Services;

use App\Models\Invite;
use App\Models\Report;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class AdminDashboardService
{
    /**
     * @return array<string, int>
     */
    public function stats(): array
    {
        $statusCounts = DB::table('user_word')
            ->select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status');

        return [
            'totalUsers' => User::count(),
            'verifiedUsers' => User::whereNotNull('email_verified_at')->count(),
            'usersThisWeek' => User::where('created_at', '>=', now()->startOfWeek())->count(),
            'usersThisMonth' => User::where('created_at', '>=', now()->startOfMonth())->count(),
            'activeToday' => User::whereDate('last_activity_date', today())->count(),
            'totalWordStatuses' => $statusCounts->sum(),
            'known' => $statusCounts['known'] ?? 0,
            'learning' => $statusCounts['learning'] ?? 0,
            'saved' => $statusCounts['saved'] ?? 0,
            'pronunciation' => $statusCounts['pronunciation'] ?? 0,
        ];
    }

    public function topStreaks(): Collection
    {
        return User::where('streak', '>', 0)
            ->orderByDesc('streak')
            ->limit(10)
            ->get(['name', 'email', 'streak', 'last_activity_date']);
    }

    public function recentUsers(): Collection
    {
        return User::latest()
            ->limit(20)
            ->get(['name', 'email', 'created_at', 'email_verified_at', 'streak', 'last_activity_date']);
    }

    public function mostActive(): Collection
    {
        return User::withCount('knownWords')
            ->orderByDesc('known_words_count')
            ->limit(10)
            ->get(['id', 'name', 'email', 'streak']);
    }

    public function registrationsByDay(): Collection
    {
        return User::select(
            DB::raw('DATE(created_at) as date'),
            DB::raw('count(*) as count')
        )
            ->where('created_at', '>=', now()->subDays(30))
            ->groupBy('date')
            ->orderBy('date')
            ->get();
    }

    /**
     * Teljes userlista a hozzáférés-kezelőhöz — az effektív csomaggal.
     */
    public function accessUsers(): Collection
    {
        return User::with('subscriptions')
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'plan_override', 'lifetime_access', 'trial_ends_at'])
            ->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'plan' => $u->currentPlan(),
                'plan_override' => $u->plan_override,
                'subscribed' => $u->activeSubscription() !== null,
                'subscription_plan' => $u->subscriptionPlan(),
                'trial_ends_at' => $u->onTrial() ? $u->trial_ends_at->toIso8601String() : null,
            ]);
    }

    public function invites(): Collection
    {
        return Invite::withCount('users')
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
    }

    public function reports(): Collection
    {
        return Report::with(['user:id,name,email', 'word:id,word'])
            ->latest()
            ->limit(100)
            ->get();
    }
}
