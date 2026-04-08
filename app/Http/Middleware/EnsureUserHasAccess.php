<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserHasAccess
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user()?->hasActiveAccess()) {
            if ($request->expectsJson()) {
                return response()->json([
                    'error' => 'subscription_required',
                    'message' => 'Ez a funkció csak prémium előfizetőknek érhető el.',
                    'upgrade_url' => route('pricing'),
                ], 403);
            }

            return redirect()->route('pricing')
                ->with('warning', 'Ez a funkció csak prémium előfizetőknek érhető el.');
        }

        return $next($request);
    }
}
