<?php

namespace App\Http\Middleware;

use App\Services\AiUsageService;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Az AI-keretet fogyasztó JSON-végpontok válaszához hozzáfűzi a hívás UTÁNI
 * keret-állapotot (`ai_budget_warning`). Enélkül a fejléc-sáv csak a következő
 * oldalváltáskor frissülne, mert az Inertia megosztott prop az XHR-válaszokkal
 * nem megy ki — a felhasználó tehát a keret elfogyásának pillanatában nem
 * látná a jelzést.
 *
 * A kulcs akkor is kimegy, ha nincs mit jelezni (`null`): a kliens így a keret
 * felszabadulásakor (sikertelen hívás visszatérítése, periódus-váltás) el is
 * tudja tüntetni a sávot.
 */
class AttachAiBudgetWarning
{
    public function __construct(private AiUsageService $aiUsage) {}

    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);
        $user = $request->user();

        if ($user === null || ! $response instanceof JsonResponse) {
            return $response;
        }

        $data = $response->getData(true);

        // Csak kulcsolt választ bővítünk: egy lista-alakú JSON-be szúrt kulcs
        // elrontaná a tömb alakját a kliensen (objektummá válna).
        if (! is_array($data) || array_is_list($data)) {
            return $response;
        }

        return $response->setData([
            ...$data,
            'ai_budget_warning' => $this->aiUsage->warning($user),
        ]);
    }
}
