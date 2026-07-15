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
     * A bővítményből indított ÍRÁS (státusz-felvétel vagy szó-létrehozás) a közös
     * napi extension-írás keretbe számít (config: extension_writes_per_day),
     * ugyanúgy, mint az ExtensionController::addWord/createFlashcard. A státusz-
     * levétel (detach) nem fogyaszt keretet, hogy a betelt keret ne akadályozza
     * a visszavonást.
     * A bővítményt az Origin azonosítja: a háttér-script fetch-e extension-
     * origint küld, amit weboldal nem tud hamisítani; az Origint elhagyó
     * kézi (curl/szkript) hívásokat a végpont throttle-ja fogja meg.
     * Betelt keretnél az ExtensionControllerrel azonos hibaforma megy vissza.
     */
    private function reserveExtensionStatusWrite(Request $request): ?JsonResponse
    {
        if ($this->isFromExtension($request) && ! $request->user()->reserveExtensionWrite()) {
            return response()->json(['error' => 'plan'], 403);
        }

        return null;
    }

    /**
     * A reserveExtensionStatusWrite által lefoglalt keret visszaadása, ha a
     * pivot-írás a foglalás UTÁN dobott — így a slot nem ragad benn, és a Free
     * user nem kap hamis „elfogyott a napi kereted" hibát. Csak akkor refundol,
     * ha a hívás extension-originből jött (szimmetrikus a foglalással).
     */
    private function refundExtensionStatusWrite(Request $request): void
    {
        if ($this->isFromExtension($request)) {
            $request->user()->refundExtensionWrite();
        }
    }

    /**
     * A háttér-script fetch-e extension-origint küld, amit weboldal nem tud
     * hamisítani; az Origint elhagyó kézi hívásokat a végpont throttle-ja fogja meg.
     */
    private function isFromExtension(Request $request): bool
    {
        $origin = (string) $request->header('Origin');

        return str_starts_with($origin, 'chrome-extension://')
            || str_starts_with($origin, 'moz-extension://')
            || str_starts_with($origin, 'safari-web-extension://');
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
