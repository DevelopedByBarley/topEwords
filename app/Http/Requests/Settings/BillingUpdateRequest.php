<?php

namespace App\Http\Requests\Settings;

use App\Concerns\BillingValidationRules;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class BillingUpdateRequest extends FormRequest
{
    use BillingValidationRules;

    protected function prepareForValidation(): void
    {
        if (filled($this->billing_country)) {
            $this->merge([
                'billing_country' => strtoupper(trim($this->billing_country)),
            ]);
        }
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return $this->billingRules(required: true);
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return $this->billingMessages();
    }
}
