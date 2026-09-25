<?php

namespace App\Support;

use Symfony\Component\HttpFoundation\IpUtils;

/**
 * Az SSRF-szűrő teljes, nem-publikus címtartomány-listája (F6-L1).
 *
 * A `filter_var(..., FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)`
 * önmagában hiányos: többek közt a `100.64.0.0/10` (RFC 6598 CGNAT) címeket
 * publikusnak tekinti, holott VPS-szolgáltatók és konténer-hálózatok belső
 * címzésre használják. Ez az osztály explicit denylisttel zár minden olyan
 * tartományt, ahová egy felhasználói URL-lel indított kimenő kérés sosem
 * mehet. A `filter_var`-szűrő mellett, második rétegként használandó.
 *
 * Az IPv4-et beágyazó IPv6-tartományokat (IPv4-mapped, IPv4-compatible,
 * NAT64, 6to4, Teredo) teljes egészükben tiltjuk: webes forrás ezeken nem
 * él, a beágyazott cím visszafejtése pedig csak újabb kerülőutat nyitna.
 */
class PublicIpAddress
{
    /**
     * Nem-publikus tartományok (RFC 6890 special-purpose registry alapján).
     *
     * @var list<string>
     */
    public const NON_PUBLIC_RANGES = [
        // IPv4
        '0.0.0.0/8',          // „ez a hálózat”
        '10.0.0.0/8',         // RFC 1918
        '100.64.0.0/10',      // RFC 6598 CGNAT (shared address space)
        '127.0.0.0/8',        // loopback
        '169.254.0.0/16',     // link-local (felhő-metadata)
        '172.16.0.0/12',      // RFC 1918
        '192.0.0.0/24',       // IETF protocol assignments
        '192.0.2.0/24',       // TEST-NET-1
        '192.88.99.0/24',     // 6to4 relay anycast
        '192.168.0.0/16',     // RFC 1918
        '198.18.0.0/15',      // benchmark
        '198.51.100.0/24',    // TEST-NET-2
        '203.0.113.0/24',     // TEST-NET-3
        '224.0.0.0/3',        // multicast (224/4) + reserved (240/4) + broadcast
        // IPv6
        '::/96',              // unspecified (::), loopback (::1), IPv4-compatible
        '::ffff:0:0/96',      // IPv4-mapped
        '64:ff9b::/96',       // NAT64 (RFC 6052)
        '64:ff9b:1::/48',     // helyi NAT64 (RFC 8215)
        '100::/64',           // discard-only
        '2001::/23',          // IETF protocol assignments (benne a Teredo 2001::/32)
        '2001:db8::/32',      // dokumentációs
        '2002::/16',          // 6to4
        'fc00::/7',           // unique local
        'fe80::/10',          // link-local
        'fec0::/10',          // site-local (elavult)
        'ff00::/8',           // multicast
    ];

    /**
     * Érvényes, publikusan routolható IP-cím-e. Érvénytelen bemenetre false
     * (fail-closed).
     */
    public static function isPublic(string $ip): bool
    {
        if (! filter_var($ip, FILTER_VALIDATE_IP)) {
            return false;
        }

        if (! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            return false;
        }

        return ! IpUtils::checkIp($ip, self::NON_PUBLIC_RANGES);
    }
}
