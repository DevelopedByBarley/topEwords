<?php

namespace App\Http\Requests\Settings;

use App\Concerns\BillingValidationRules;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class BillingUpdateRequest extends FormRequest
{
    use BillingValidationRules;

    /**
     * Normalize the country code before validation so e.g. "hu" passes the HU whitelist
     * and is stored consistently uppercased.
     */
    protected function prepareForValidation(): void
    {
        if (filled($this->billing_country)) {
            $this->merge([
                'billing_country' => strtoupper(trim($this->billing_country)),
            ]);
        }
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * All billing fields are required here so the saved data satisfies
     * User::hasBillingDetails() — see BillingValidationRules for why this matters.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return $this->billingRules(required: true);
    }
}
