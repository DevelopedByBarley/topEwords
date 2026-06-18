<?php

namespace App\Actions\Fortify;

use App\Concerns\PasswordValidationRules;
use App\Concerns\ProfileValidationRules;
use App\Models\Invite;
use App\Models\User;
use Illuminate\Support\Facades\Validator;
use Laravel\Fortify\Contracts\CreatesNewUsers;

class CreateNewUser implements CreatesNewUsers
{
    use PasswordValidationRules, ProfileValidationRules;

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
        ];

        if ($inviteOnly) {
            $rules['invite'] = ['required', 'string', function ($attribute, $value, $fail) {
                $invite = Invite::where('code', $value)->first();

                if (! $invite || ! $invite->isUsable()) {
                    $fail('Érvénytelen vagy lejárt meghívókód.');
                }
            }];
        }

        Validator::make($input, $rules)->validate();

        $invite = $inviteOnly
            ? Invite::where('code', $input['invite'])->first()
            : null;

        $trialDays = (int) config('registration.trial_days');

        $user = User::create([
            'name' => $input['name'],
            'email' => $input['email'],
            'password' => $input['password'],
            'trial_ends_at' => $trialDays > 0 ? now()->addDays($trialDays) : null,
            'invite_id' => $invite?->id,
        ]);

        $invite?->increment('uses');

        return $user;
    }
}
