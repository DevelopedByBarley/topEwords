<?php

namespace App\Services;

/**
 * A felirat-letöltés átmeneti (újrapróbálható) hibáját jelzi: a YouTube egy
 * kérésre nem OK választ adott, vagy a kapcsolat elakadt. Ilyenkor NEM tudjuk,
 * hogy tényleg nincs-e felirat, ezért az eredményt nem szabad negatívan
 * cache-elni — különben egy átmeneti YouTube-akadás 15 percre minden
 * felhasználónál „nincs felirat"-tá dagadna (C2).
 */
class TransientCaptionException extends \RuntimeException {}
