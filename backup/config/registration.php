<?php

return [
    /*
    | Ha igaz, a regisztrációhoz érvényes meghívókód kell (REGISTRATION_ENABLED
    | mellett). A próbaidőszak regisztrációkor automatikusan indul.
    */
    'invite_only' => (bool) env('REGISTRATION_INVITE_ONLY', false),

    /*
    | Az ELŐFIZETÉSKOR induló Stripe-próbaidő hossza napokban. A regisztráció
    | önmagában nem ad próbaidőt — minden új fiók a free csomagon indul, és
    | csak az előfizetés (kártyamegadás) indít próbaidőt. 0 esetén nincs trial.
    */
    'subscription_trial_days' => (int) env('SUBSCRIPTION_TRIAL_DAYS', 30),
];
