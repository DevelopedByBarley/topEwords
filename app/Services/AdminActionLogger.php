<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Admin-műveletnapló (F9C-L2): minden admin-írás egy sort kap az `admin`
 * csatornán (storage/logs/admin-*.log, 365 napos megőrzés).
 *
 * Miért log-csatorna és nem adatbázis-tábla: a napló célja az utólagos
 * rekonstrukció (ki, mikor, kin, mit, régi → új érték), nem egy admin-felület.
 * A fájl az alkalmazáson KÍVÜL él — egy eltérített admin-session semmilyen
 * webes úton nem tudja törölni vagy átírni, egy DB-tábla viszont ugyanazzal a
 * jogosultsággal írható, mint amit naplóz. Séma és migráció sem kell hozzá, és
 * a `mail` csatorna mintáját követi (egyetlen grep-pel kereshető).
 */
class AdminActionLogger
{
    public function __construct(private Request $request) {}

    /**
     * @param  string  $action  pl. `access.set`, `word.update`
     * @param  array<string, mixed>  $context  a célpont és a változott értékek
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
     * A modell legutóbbi mentésének változásai `mező => [régi, új]` alakban.
     * A save() UTÁN hívandó (getChanges/getPrevious), így a mutatorok által
     * normalizált végleges érték kerül a naplóba.
     *
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
