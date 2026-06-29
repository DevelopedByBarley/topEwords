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
     * IMPORTANT: when $required is true, the enforced fields (name, zip, city, address)
     * must match the fields User::hasBillingDetails() checks — otherwise a user could save
     * incomplete billing data that the checkout gatekeeper keeps rejecting (redirect loop).
     *
     * @return array<string, array<int, \Illuminate\Contracts\Validation\Rule|array<mixed>|string>>
     */
    protected function billingRules(bool $required): array
    {
        $presence = $required ? 'required' : 'nullable';

        return [
            'billing_name' => [$presence, 'string', 'max:255'],
            // Cégnél az adószám kötelező (belföldi cégszámlán jogszabály szerint kell).
            'billing_tax_number' => ['nullable', 'required_if:billing_type,company', 'string', 'max:50'],
            'billing_country' => [$presence, Rule::in($this->supportedBillingCountries)],
            'billing_zip' => [$presence, 'string', 'max:10'],
            'billing_city' => [$presence, 'string', 'max:255'],
            'billing_address' => [$presence, 'string', 'max:255'],
            'billing_type' => [$presence, Rule::in(['individual', 'company'])],
        ];
    }
}
