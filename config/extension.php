<?php

return [
    /*
    | A Chrome bővítmény publikus Chrome Web Store-linkje. Amíg üres, a
    | felhasználói felületek (dashboard-banner, sidebar) „hamarosan" állapotot
    | mutatnak store-link helyett — a fejlesztői .zip letöltése ettől
    | függetlenül végig elérhető marad adminként a Letöltések oldalon.
    |
    | A store-listing publikálása után elég ezt az egy env-kulcsot beállítani:
    | CHROME_WEB_STORE_URL=https://chromewebstore.google.com/detail/<id>
    */
    'store_url' => env('CHROME_WEB_STORE_URL'),
];
