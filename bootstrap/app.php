<?php

use App\Http\Middleware\AttachAiBudgetWarning;
use App\Http\Middleware\EnsureAdminHasTwoFactor;
use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\SecurityHeaders;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Illuminate\Session\Middleware\AuthenticateSession;
use Laravel\Sanctum\Http\Middleware\CheckAbilities;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->encryptCookies(except: ['appearance', 'sidebar_state']);

        $middleware->alias([
            'abilities' => CheckAbilities::class,
            'ai.budget' => AttachAiBudgetWarning::class,
            'admin.2fa' => EnsureAdminHasTwoFactor::class,
        ]);

        $middleware->validateCsrfTokens(except: ['stripe/*']);

        $middleware->web(append: [
            AuthenticateSession::class,
            HandleAppearance::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
            SecurityHeaders::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->respond(function (Response $response, Throwable $exception, Request $request) {
            if ($response->getStatusCode() !== 429 || ! $request->header('X-Inertia')) {
                return $response;
            }

            $retryAfter = (int) $response->headers->get('Retry-After');

            return back()->with('error', $retryAfter > 0
                ? "Túl gyorsan érkeztek a kérések — várj {$retryAfter} másodpercet, és folytasd."
                : 'Túl gyorsan érkeztek a kérések — várj pár másodpercet, és folytasd.');
        });
    })->create();
