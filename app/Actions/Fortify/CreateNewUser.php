<?php

namespace App\Actions\Fortify;

use App\Concerns\BillingValidationRules;
use App\Concerns\PasswordValidationRules;
use App\Concerns\ProfileValidationRules;
use App\Models\Invite;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Contracts\CreatesNewUsers;

class CreateNewUser implements CreatesNewUsers
{
    use BillingValidationRules, PasswordValidationRules, ProfileValidationRules;

    /**
     * Validate and create a newly registered user.
     *
     * @param  array<string, string>  $input
     */
    public function create(array $input): User
    {
        $inviteOnly = (bool) config('registration.invite_only');

        $rules = [
            ...$this->profileRules(),
            'password' => $this->passwordRules(),
            'terms' => ['accepted'],
            ...$this->billingRules(required: false),
        ];


        if ($inviteOnly) {
            $rules['invite'] = ['required', 'string', function ($attribute, $value, $fail) {
                $invite = Invite::where('code', $value)->first();

                if (! $invite || ! $invite->isUsable()) {
                    $fail('Érvénytelen vagy lejárt meghívókód.');
                }
            }];
        }

        Validator::make($input, $rules, [
            'terms.accepted' => 'Az ÁSZF és az adatkezelési tájékoztató elfogadása kötelező.',
            ...$this->billingMessages(),
        ])->validate();

        return DB::transaction(function () use ($input, $inviteOnly): User {
            $invite = null;

            if ($inviteOnly) {
                $invite = Invite::where('code', $input['invite'])->lockForUpdate()->first();

                if (! $invite || ! $invite->isUsable()) {
                    throw ValidationException::withMessages([
                        'invite' => 'Érvénytelen vagy lejárt meghívókód.',
                    ]);
                }
            }

            $billingFields = array_filter([
                'billing_name' => $input['billing_name'] ?? null,
                'billing_tax_number' => $input['billing_tax_number'] ?? null,
                'billing_type' => $input['billing_type'] ?? null,
                'billing_country' => $input['billing_country'] ?? null,
                'billing_zip' => $input['billing_zip'] ?? null,
                'billing_city' => $input['billing_city'] ?? null,
                'billing_address' => $input['billing_address'] ?? null,
                'billing_phone' => $input['billing_phone'] ?? null,
                'billing_company_registration_number' => $input['billing_company_registration_number'] ?? null,
            ], fn ($v) => filled($v));

            $user = User::create([
                'name' => $input['name'],
                'email' => $input['email'],
                'password' => $input['password'],
                ...$billingFields,
            ]);

            if ($invite !== null) {
                $user->forceFill(['invite_id' => $invite->id])->save(); 
                $invite->increment('uses');
            }

            return $user;
        });
    }
}
