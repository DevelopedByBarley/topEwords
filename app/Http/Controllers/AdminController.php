<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Support\Facades\DB;
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
        ]);
    }
}
