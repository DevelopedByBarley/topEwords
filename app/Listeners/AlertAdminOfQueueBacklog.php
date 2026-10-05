<?php

namespace App\Listeners;

use App\Notifications\QueueBacklogDetected;
use Illuminate\Queue\Events\QueueBusy;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Notification;

class AlertAdminOfQueueBacklog
{
    private const THROTTLE_CACHE_KEY_PREFIX = 'queue-monitoring:backlog-alerted';

    public function handle(QueueBusy $event): void
    {
        $adminEmail = config('app.admin_email');

        if (! $adminEmail) {
            return;
        }

        $throttleKey = self::THROTTLE_CACHE_KEY_PREFIX.":{$event->connectionName}:{$event->queue}";

        if (! Cache::add($throttleKey, true, now()->addHour())) {
            return;
        }

        Notification::route('mail', $adminEmail)
            ->notifyNow(new QueueBacklogDetected($event->connectionName, $event->queue, $event->size));
    }
}
