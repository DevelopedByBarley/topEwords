<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $request->user(),
                'isAdmin' => $request->user() ? Gate::check('admin', $request->user()) : false,
                'subscription' => $request->user() ? (function () use ($request) {
                    $isPremium = $request->user()->subscribed('premium');

                    return [
                        'hasActiveAccess' => $request->user()->hasActiveAccess(),
                        'isSubscribed' => $request->user()->subscribed('default') || $isPremium,
                        'isPremium' => $isPremium,
                        'hasAiAccess' => $request->user()->ai_access || $isPremium,
                        'isOnTrial' => $request->user()->onTrial(),
                    ];
                })() : null,
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
            'flash' => [
                'streakTriggered' => session('streak_triggered'),
                'success' => session('success'),
                'achievements' => session('achievements', []),
                'calibrationPrompt' => session('calibration_prompt'),
                'showTour' => session('show_tour', false),
                'importedCardId' => session('imported_card_id'),
            ],
        ];
    }
}
