<?php

namespace App\Listeners;

use Illuminate\Mail\Events\MessageSent;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Mime\Address;

/**
 * Minden kimenő levelet naplóz a `mail` csatornába (storage/logs/mail-*.log).
 *
 * A sikeres SMTP-átadás nem jelent kézbesítést: greylisting, spam-szűrés vagy a
 * szolgáltató kimenő sora miatt a levél órákat csúszhat, vagy el is tűnhet. Ha
 * egy felhasználó azt jelzi, hogy „nem jött meg az e-mail", enélkül nem lehet
 * eldönteni, hogy az app egyáltalán elküldte-e. A naplózott Message-ID-val a
 * levél a szolgáltató kimenő naplójában is azonosítható.
 *
 * A kudarcot nem itt fogjuk: ha a transport kivételt dob, az a szokásos hiba-
 * naplóba kerül (és az AlertAdminOfLoggedError riaszt is rá).
 */
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
            // A szolgáltató kimenő naplójában ezzel kereshető a levél.
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
