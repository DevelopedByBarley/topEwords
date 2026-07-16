<?php

namespace App\Concerns;

use Illuminate\Validation\Rule;

trait BillingValidationRules
{
    /**
     * Supported billing countries (ISO 3166-1 alpha-2). Currently only Hungary —
     * extend this list when the app starts billing customers in other countries.
     *
     * @var array<int, string>
     */
    protected array $supportedBillingCountries = ['HU'];

    /**
     * Billing field validation rules, shared between registration (optional) and the
     * billing settings form (required).
     *
     * IMPORTANT: when $required is true, the enforced fields (name, country, zip, city,
     * address, type — plus tax number for companies) must match the fields
     * User::hasBillingDetails() checks — otherwise a user could save incomplete billing
     * data that the checkout gatekeeper keeps rejecting (redirect loop).
     *
     * @return array<string, array<int, \Illuminate\Contracts\Validation\Rule|array<mixed>|string>>
     */
    protected function billingRules(bool $required): array
    {
        $presence = $required ? 'required' : 'nullable';

        // A név/város/cím/irsz. szó szerint a Billingo NAV-számlára kerül, ezért
        // tiltjuk az újsort és a vezérlőkaraktereket (\x00–\x1F, \x7F). Így nem
        // csúszhat a jogi számlára tördelést/megjelenítést törő adat.
        $noControlChars = 'regex:/^[^\x00-\x1F\x7F]+$/u';

        return [
            'billing_name' => [$presence, 'string', 'max:255', $noControlChars],
            // Cégnél az adószám kötelező (belföldi cégszámlán jogszabály szerint kell),
            // magánszemélynél viszont tilos (különben ellentmondó DB-állapot ragadhat a
            // fiókon a regisztrációs úton — a settings-út amúgy is nullázza). Formátum:
            // magyar adószám 12345678-1-01 (8 számjegy - 1 áfakód - 2 megyekód).
            'billing_tax_number' => [
                'nullable',
                'required_if:billing_type,company',
                'prohibited_if:billing_type,individual',
                'string',
                'regex:/^\d{8}-\d-\d{2}$/',
            ],
            'billing_country' => [$presence, Rule::in($this->supportedBillingCountries)],
            'billing_zip' => [$presence, 'string', 'regex:/^\d{4,10}$/'],
            'billing_city' => [$presence, 'string', 'max:255', $noControlChars],
            'billing_address' => [$presence, 'string', 'max:255', $noControlChars],
            'billing_type' => [$presence, Rule::in(['individual', 'company'])],
        ];
    }

    /**
     * Magyar hibaüzenetek a billing-mezők formátum-szabályaihoz, hogy a
     * regex/prohibited elutasítás érthető legyen a felhasználónak.
     *
     * @return array<string, string>
     */
    protected function billingMessages(): array
    {
        return [
            'billing_tax_number.regex' => 'Az adószám formátuma érvénytelen (helyes: 12345678-1-01).',
            'billing_tax_number.prohibited_if' => 'Magánszemélyként nem adhatsz meg adószámot.',
            'billing_tax_number.required_if' => 'Cégként az adószám megadása kötelező.',
            'billing_zip.regex' => 'Az irányítószám csak számjegyekből állhat.',
            'billing_name.regex' => 'A számlázási név nem tartalmazhat sortörést vagy vezérlőkaraktert.',
            'billing_city.regex' => 'A város nem tartalmazhat sortörést vagy vezérlőkaraktert.',
            'billing_address.regex' => 'A cím nem tartalmazhat sortörést vagy vezérlőkaraktert.',
        ];
    }
}
