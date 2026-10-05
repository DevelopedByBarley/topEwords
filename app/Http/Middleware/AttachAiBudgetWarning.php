<?php

namespace App\Http\Middleware;

use App\Services\AiUsageService;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

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

        if (! is_array($data) || array_is_list($data)) {
            return $response;
        }

        return $response->setData([
            ...$data,
            'ai_budget_warning' => $this->aiUsage->warning($user),
        ]);
    }
}
