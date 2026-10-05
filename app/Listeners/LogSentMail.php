<?php

namespace App\Listeners;

use Illuminate\Mail\Events\MessageSent;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Mime\Address;

class LogSentMail
{
    public function handle(MessageSent $event): void
    {
        $message = $event->message;

        Log::channel('mail')->info('Levél elküldve', [
            'mailer' => $event->data['mailer'] ?? config('mail.default'),
            'to' => $this->addresses($message->getTo()),
            'cc' => $this->addresses($message->getCc()),
            'bcc' => $this->addresses($message->getBcc()),
            'subject' => $message->getSubject(),
            'message_id' => $event->sent->getMessageId(),
        ]);
    }

    /**
     * @param  array<int, Address>  $addresses
     * @return array<int, string>
     */
    private function addresses(array $addresses): array
    {
        return array_map(fn (Address $address): string => $address->getAddress(), $addresses);
    }
}
