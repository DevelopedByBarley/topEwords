<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Http;
use Laravel\Fortify\Features;

abstract class TestCase extends BaseTestCase
{
    /**
     * T-7 / F2-L1: egyetlen teszt se hívhasson valódi külső szolgáltatást (Billingo,
     * Gemini, Stripe-on kívüli HTTP). A nem fake-elt HTTP-kérés hangosan elbukik.
     */
    protected function setUp(): void
    {
        parent::setUp();

        Http::preventStrayRequests();
    }

    protected function skipUnlessFortifyFeature(string $feature, ?string $message = null): void
    {
        if (! Features::enabled($feature)) {
            $this->markTestSkipped($message ?? "Fortify feature [{$feature}] is not enabled.");
        }
    }
}
