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
            // Regisztrációkor a számlázás opcionális (a checkout előtt úgyis kötelező lesz),
            // ezért required: false. A szabályok a BillingUpdateRequest-tel közös trait-ből jönnek.
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

        Validator::make($input, $rules, $this->billingMessages())->validate();

        return DB::transaction(function () use ($input, $inviteOnly): User {
            $invite = null;

            if ($inviteOnly) {
                // Lock the invite row and re-check usability inside the transaction.
                // The validation closure above is only a UX pre-check; without this
                // lock two concurrent registrations could both pass it before either
                // records its use, exceeding max_uses (TOCTOU).
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
                'billing_zip' => $input['billing_zip'] ?? null,
                'billing_city' => $input['billing_city'] ?? null,
                'billing_address' => $input['billing_address'] ?? null,
            ], fn ($v) => filled($v));

            $user = User::create([
                'name' => $input['name'],
                'email' => $input['email'],
                'password' => $input['password'],
                ...$billingFields,
            ]);

            // New accounts start on the free plan — no automatic trial. A trial is
            // granted only on subscribe (Stripe trial; see PricingController::checkout).
            if ($invite !== null) {
                $user->forceFill(['invite_id' => $invite->id])->save(); // not mass-assignable
                $invite->increment('uses');
            }

            return $user;
        });
    }
}
