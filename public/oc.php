<?php

// IDEIGLENES diagnosztika — használat után TÖRÖLD.
header('Content-Type: text/plain; charset=utf-8');

if (! function_exists('opcache_get_status')) {
    echo "OPcache NINCS betoltve ezen a PHP-n.\n";
    exit;
}

echo 'opcache.enable           = '.ini_get('opcache.enable')."\n";
echo 'validate_timestamps      = '.ini_get('opcache.validate_timestamps')."\n";
echo 'revalidate_freq          = '.ini_get('opcache.revalidate_freq')."\n";

$status = opcache_get_status(false);
echo 'cached_scripts           = '.($status['opcache_statistics']['num_cached_scripts'] ?? 'n/a')."\n";

if (isset($_GET['reset'])) {
    $ok = opcache_reset();
    echo "\n>>> opcache_reset() = ".($ok ? 'OK (urites megtortent)' : 'SIKERTELEN')."\n";
}
