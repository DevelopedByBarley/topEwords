<?php

namespace App\Concerns;

use App\Services\WordStatusFormExpander;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

trait TogglesWordStatus
{
    /** @var array<int, string> */
    private const TOGGLE_STATUSES = ['known', 'learning', 'saved', 'pronunciation', 'practice'];

    private function validatedToggleStatus(Request $request): ?string
    {
        if ($request->input('status') === '') {
            $request->merge(['status' => null]);
        }

        return $request->validate([
            'status' => ['nullable', 'string', 'in:'.implode(',', self::TOGGLE_STATUSES)],
        ])['status'] ?? null;
    }

    private function reserveExtensionStatusWrite(Request $request): ?JsonResponse
    {
        if ($this->isFromExtension($request) && ! $request->user()->reserveExtensionWrite()) {
            return response()->json(['error' => 'plan'], 403);
        }

        return null;
    }

    private function refundExtensionStatusWrite(Request $request): void
    {
        if ($this->isFromExtension($request)) {
            $request->user()->refundExtensionWrite();
        }
    }

    private function isFromExtension(Request $request): bool
    {
        $origin = (string) $request->header('Origin');

        return str_starts_with($origin, 'chrome-extension://')
            || str_starts_with($origin, 'moz-extension://')
            || str_starts_with($origin, 'safari-web-extension://');
    }

    /**
     * @param  array<int, string>  $forms
     * @param  array<int, array{key: string, title: string, description: string, icon: string}>  $achievements
     */
    private function statusToggleResponse(Request $request, ?string $status, array $forms = [], array $achievements = []): RedirectResponse|JsonResponse
    {
        if (! $request->hasHeader('X-Inertia') && $request->expectsJson()) {
            return response()->json(['ok' => true, 'status' => $status, 'forms' => $forms, 'achievements' => $achievements]);
        }

        $this->flashAchievements($achievements);

        return back();
    }

    /**
     * @param  array<int, array{key: string, title: string, description: string, icon: string}>  $achievements
     */
    private function importanceToggleResponse(Request $request, ?int $importance, array $achievements = []): RedirectResponse|JsonResponse
    {
        if (! $request->hasHeader('X-Inertia') && $request->expectsJson()) {
            return response()->json(['ok' => true, 'importance' => $importance, 'achievements' => $achievements]);
        }

        $this->flashAchievements($achievements);

        return back();
    }

    /**
     * @param  array<int, array{key: string, title: string, description: string, icon: string}>  $achievements
     */
    private function flashAchievements(array $achievements): void
    {
        if ($achievements !== []) {
            session()->flash('achievements', $achievements);
        }
    }

    /**
     * @return array<int, string>
     */
    private function statusFormsFor(object $row): array
    {
        return app(WordStatusFormExpander::class)->formsFor($row);
    }
}
