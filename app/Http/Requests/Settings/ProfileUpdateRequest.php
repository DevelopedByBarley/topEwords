<?php

namespace App\Http\Requests\Settings;

use App\Concerns\PasswordValidationRules;
use App\Concerns\ProfileValidationRules;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class ProfileUpdateRequest extends FormRequest
{
    use PasswordValidationRules;
    use ProfileValidationRules;

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $rules = $this->profileRules($this->user()->id);

        // Az e-mail-csere fiókátvétel első lépése lehet (eltérített session),
        // ezért a jelszóváltás és a fióktörlés mintájára jelszóhoz kötjük;
        // a sima név-módosítás jelszó nélkül marad.
        if ($this->string('email')->value() !== $this->user()->email) {
            $rules['current_password'] = $this->currentPasswordRules();
        }

        return $rules;
    }
}
