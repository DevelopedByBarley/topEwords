<?php

namespace App\Http\Middleware;

use App\Support\Billing;
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
                    $user = $request->user();
                    $plan = $user->currentPlan();

                    return [
                        'plan' => $plan,
                        'hasActiveAccess' => $plan !== 'free',
                        'isSubscribed' => $user->subscribed('default') || $user->subscribed('premium'),
                        'isPremium' => $plan === 'premium',
                        'hasAiAccess' => $user->hasAiAccess(),
                        'isOnTrial' => $user->onTrial(),
                    ];
                })() : null,
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
            'billingEnabled' => Billing::enabled(),
            'flash' => [
                'streakTriggered' => session('streak_triggered'),
                'success' => session('success'),
                'error' => session('error'),
                'info' => session('info'),
                'achievements' => session('achievements', []),
                'calibrationPrompt' => session('calibration_prompt'),
                'showTour' => session('show_tour', false),
                'importedCardId' => session('imported_card_id'),
            ],
        ];
    }
}
