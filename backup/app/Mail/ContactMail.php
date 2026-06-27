<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ContactMail extends Mailable
{
    use SerializesModels;

    public function __construct(
        public readonly array $data
    ) {}

    public function envelope(): Envelope
    {
        $subject = ! empty($this->data['subject'])
            ? 'Érdeklődés: '.$this->data['subject']
            : 'Új kapcsolatfelvétel: '.$this->data['name'];

        return new Envelope(subject: $subject);
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.contact',
        );
    }
}
