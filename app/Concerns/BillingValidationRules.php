<?php

namespace App\Concerns;

use Illuminate\Validation\Rule;

trait BillingValidationRules
{
    /**
     * @var array<int, string>
     */
    protected array $supportedBillingCountries = ['HU'];

    /**
     * @return array<string, array<int, \Illuminate\Contracts\Validation\Rule|array<mixed>|string>>
     */
    protected function billingRules(bool $required): array
    {
        $presence = $required ? 'required' : 'nullable';

        $noControlChars = 'regex:/^[^\x00-\x1F\x7F]+$/u';

        return [
            'billing_name' => [$presence, 'string', 'max:255', $noControlChars],
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
            'billing_phone' => [$presence, 'string', 'max:30', 'regex:/^\+?[\d\s()-]{6,30}$/'],
            'billing_company_registration_number' => [
                'nullable',
                'required_if:billing_type,company',
                'prohibited_if:billing_type,individual',
                'string',
                'regex:/^\d{2}-\d{2}-\d{6}$/',
            ],
            'billing_type' => [$presence, Rule::in(['individual', 'company'])],
        ];
    }

    /**
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
            'billing_phone.regex' => 'A telefonszám formátuma érvénytelen.',
            'billing_company_registration_number.regex' => 'A cégjegyzékszám formátuma érvénytelen (helyes: 01-09-999999).',
            'billing_company_registration_number.prohibited_if' => 'Magánszemélyként nem adhatsz meg cégjegyzékszámot.',
            'billing_company_registration_number.required_if' => 'Cégként a cégjegyzékszám megadása kötelező.',
        ];
    }
}
