<?php

return [
    'invite_only' => (bool) env('REGISTRATION_INVITE_ONLY', false),

    'subscription_trial_days' => (int) env('SUBSCRIPTION_TRIAL_DAYS', 0),
];
