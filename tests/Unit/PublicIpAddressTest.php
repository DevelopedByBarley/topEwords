<?php

use App\Support\PublicIpAddress;

// Az SSRF-szűrő teljes nem-publikus listája (F6-L1). A 100.64.0.0/10 (CGNAT) a
// filter_var NO_PRIV/NO_RES szűrőjén átment; a többi eset a lista teljességét őrzi.

test('rejects non-public addresses', function (string $ip) {
    expect(PublicIpAddress::isPublic($ip))->toBeFalse();
})->with([
    'CGNAT eleje' => '100.64.0.1',
    'CGNAT vége' => '100.127.255.254',
    'this network' => '0.0.0.1',
    'RFC1918 10/8' => '10.1.2.3',
    'RFC1918 172.16/12' => '172.31.255.1',
    'RFC1918 192.168/16' => '192.168.1.1',
    'loopback' => '127.0.0.1',
    'metadata (link-local)' => '169.254.169.254',
    'IETF protocol assignments' => '192.0.0.8',
    'TEST-NET-1' => '192.0.2.10',
    '6to4 relay' => '192.88.99.1',
    'benchmark' => '198.18.0.1',
    'benchmark vége' => '198.19.255.254',
    'TEST-NET-2' => '198.51.100.7',
    'TEST-NET-3' => '203.0.113.9',
    'multicast' => '224.0.0.1',
    'multicast vége' => '239.255.255.250',
    'reserved' => '240.0.0.1',
    'broadcast' => '255.255.255.255',
    'IPv6 unspecified' => '::',
    'IPv6 loopback' => '::1',
    'IPv4-mapped loopback' => '::ffff:127.0.0.1',
    'IPv4-mapped CGNAT' => '::ffff:100.64.0.1',
    'IPv4-mapped publikus is' => '::ffff:93.184.216.34',
    'IPv4-compatible' => '::127.0.0.1',
    'NAT64 metadata' => '64:ff9b::a9fe:a9fe',
    'NAT64 publikus is' => '64:ff9b::5db8:d822',
    'helyi NAT64' => '64:ff9b:1::1',
    'discard-only' => '100::1',
    'Teredo' => '2001:0:4136:e378::1',
    'IPv6 dokumentációs' => '2001:db8::1',
    '6to4' => '2002:7f00:1::1',
    'unique local' => 'fd00::1',
    'link-local' => 'fe80::1',
    'site-local' => 'fec0::1',
    'IPv6 multicast' => 'ff02::1',
]);

test('rejects invalid input fail-closed', function (string $input) {
    expect(PublicIpAddress::isPublic($input))->toBeFalse();
})->with(['', 'localhost', 'example.com', '[::1]', '256.1.1.1', '100.64.0.1/10']);

test('accepts public addresses', function (string $ip) {
    expect(PublicIpAddress::isPublic($ip))->toBeTrue();
})->with([
    'example.com' => '93.184.216.34',
    'CGNAT alatt' => '100.63.255.255',
    'CGNAT felett' => '100.128.0.1',
    'benchmark alatt' => '198.17.255.255',
    'publikus DNS' => '8.8.8.8',
    'multicast alatt' => '223.255.255.254',
    'publikus IPv6' => '2606:4700:4700::1111',
]);
