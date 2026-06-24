<?php

namespace App\Concerns;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

trait TogglesWordStatus
{
    /** @var array<int, string> A szó/saját szó felvehető státuszai. */
    private const TOGGLE_STATUSES = ['known', 'learning', 'saved', 'pronunciation', 'practice'];

    /**
     * A státusz validálása úgy, hogy az üres string (a böngésző-bővítmény ezt
     * küldi „státusz levétele" jelentéssel) null-ként, érvényesen menjen át.
     */
    private function validatedToggleStatus(Request $request): ?string
    {
        if ($request->input('status') === '') {
            $request->merge(['status' => null]);
        }

        return $request->validate([
            'status' => ['nullable', 'string', 'in:'.implode(',', self::TOGGLE_STATUSES)],
        ])['status'] ?? null;
    }

    /**
     * A bővítmény rövid JSON-nyugtát vár (nincs felesleges redirect-követés,
     * ami minden mentésnél letöltené a teljes oldalt); az Inertia webfelület
     * viszont redirectet igényel a látogatás feloldásához. Inertia-kérésre
     * (ami szintén expectsJson()) ezért nem adhatunk JSON-t.
     */
    private function statusToggleResponse(Request $request, ?string $status): RedirectResponse|JsonResponse
    {
        if (! $request->hasHeader('X-Inertia') && $request->expectsJson()) {
            return response()->json(['ok' => true, 'status' => $status]);
        }

        return back();
    }
}
