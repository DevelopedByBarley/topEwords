<?php

use App\Models\User;

test('entitlement and billing columns are not mass assignable', function () {
    $user = new User([
        'name' => 'Teszt',
        'email' => 'teszt@example.com',
        'password' => 'secret',
        // None of these may be granted via a request payload:
        'ai_access' => true,
        'lifetime_access' => true,
        'plan_override' => 'premium',
        'trial_ends_at' => now()->addYear(),
        'invite_id' => 999,
        'ai_credit_limit' => 0,
    ]);

    expect($user->name)->toBe('Teszt'); // safe fields still fillable
    expect($user->ai_access)->toBeNull();
    expect($user->lifetime_access)->toBeNull();
    expect($user->plan_override)->toBeNull();
    expect($user->trial_ends_at)->toBeNull();
    expect($user->invite_id)->toBeNull();
    expect($user->ai_credit_limit)->toBeNull();
});

test('the shared auth user prop never leaks billing or entitlement fields', function () {
    $user = User::factory()->create();
    $user->forceFill([
        'stripe_id' => 'cus_test123',
        'pm_type' => 'visa',
        'pm_last_four' => '4242',
        'plan_override' => 'premium',
    ])->save();

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertInertia(fn ($page) => $page
            ->where('auth.user.name', $user->name)
            ->where('auth.user.email', $user->email)
            ->missing('auth.user.stripe_id')
            ->missing('auth.user.pm_type')
            ->missing('auth.user.pm_last_four')
            ->missing('auth.user.plan_override')
            ->missing('auth.user.ai_credits_used')
        );
});
