<?php

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
        /*
         * Percenkénti sapkába futó Inertia-kérés ne cserélje le a teljes oldalt a
         * nyers „429 Too Many Requests" hibalapra. A 429 nem érvényes Inertia-válasz,
         * ezért a kliens elnavigál rá, és a felhasználó elveszti a helyét a listában
         * — pedig itt csak annyi történt, hogy egy pillanatra túl gyors volt. Vissza-
         * irányítunk az előző oldalra egy flash-üzenettel, amit a FlashToast mutat meg.
         *
         * Csak az Inertia-kéréseket alakítjuk át: az API-t és a bővítményt hívó kliens
         * a szabványos 429-et várja, és maga kezeli.
         */
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
