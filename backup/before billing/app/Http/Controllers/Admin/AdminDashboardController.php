<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Program;
use App\Models\ProgramImage;
use App\Models\Topic;

class AdminDashboardController extends Controller
{
    public function index()
    {
        $stats = [
            'programs_total'  => Program::count(),
            'programs_active' => Program::where('active', true)->count(),
            'topics'          => Topic::count(),
            'views_total'     => Program::sum('views'),
        ];

        $recent = Program::with('coverImage')
            ->orderByDesc('created_at')
            ->limit(5)
            ->get();

        return view('admin.dashboard', compact('stats', 'recent'));
    }

    public function handbook()
    {
        return view('admin.handbook');
    }
}
