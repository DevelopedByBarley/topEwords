<?php

namespace App\Concerns;

use App\Services\WordStatusFormExpander;
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
     *
     * A bővítménynek a megváltozott szó összes felszíni alakját ($forms) is
     * visszaküldjük, így a háttér-cache-t helyben tudja foltozni a teljes
     * státusz-térkép újraletöltése nélkül — ez fogja vissza a szerverterhelést.
     *
     * @param  array<int, string>  $forms
     */
    private function statusToggleResponse(Request $request, ?string $status, array $forms = []): RedirectResponse|JsonResponse
    {
        if (! $request->hasHeader('X-Inertia') && $request->expectsJson()) {
            return response()->json(['ok' => true, 'status' => $status, 'forms' => $forms]);
        }

        return back();
    }

    /**
     * A megváltozott szó/saját szó normalizált felszíni alakjai a kliens-oldali
     * cache foltozásához (ugyanaz a logika, mint az ExtensionController teljes
     * térképénél), egyetlen forrásból.
     *
     * @return array<int, string>
     */
    private function statusFormsFor(object $row): array
    {
        return app(WordStatusFormExpander::class)->formsFor($row);
    }
}
