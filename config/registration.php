<?php

return [
    /*
    | Ha igaz, a regisztrációhoz érvényes meghívókód kell (REGISTRATION_ENABLED
    | mellett). A próbaidőszak regisztrációkor automatikusan indul.
    */
    'invite_only' => (bool) env('REGISTRATION_INVITE_ONLY', false),

    /*
    | A regisztrációkor automatikusan induló próbaidőszak hossza napokban.
    | 0 esetén nincs próbaidő (a felhasználó rögtön az ingyenes szinten van).
    */
    'trial_days' => (int) env('TRIAL_DAYS', 5),
];
