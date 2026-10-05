<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class AdminActionLogger
{
    public function __construct(private Request $request) {}

    /**
     * @param  array<string, mixed>  $context
     */
    public function record(User $admin, string $action, ?int $targetId, array $context = []): void
    {
        Log::channel('admin')->info("admin.{$action}", [
            'admin_id' => $admin->id,
            'admin_email' => $admin->email,
            'action' => $action,
            'target_id' => $targetId,
            ...$context,
            'ip' => $this->request->ip(),
        ]);
    }

    /**
     * @return array<string, array{old: mixed, new: mixed}>
     */
    public static function changesOf(Model $model): array
    {
        $previous = $model->getPrevious();

        return collect($model->getChanges())
            ->except(['updated_at'])
            ->map(fn (mixed $new, string $key): array => ['old' => $previous[$key] ?? null, 'new' => $new])
            ->all();
    }
}
