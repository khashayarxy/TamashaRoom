<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Log;

class UrlSecurityService
{
    private const BLOCKED_HOSTS = [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        '[::1]',
        '::1',
        '127.1',
        '0177.0.0.1',
        '2130706433',
    ];

    private const BLOCKED_HOST_SUFFIXES = [
        '.local',
        '.localhost',
        '.internal',
    ];

    public function validateVideoUrl(string $url): ?string
    {
        if (! filter_var($url, FILTER_VALIDATE_URL)) {
            return 'Invalid video URL format.';
        }

        $scheme = parse_url($url, PHP_URL_SCHEME);

        if (! in_array($scheme, ['http', 'https'], true)) {
            return 'Only HTTP and HTTPS URLs are allowed.';
        }

        $host = parse_url($url, PHP_URL_HOST);

        if ($host === null || $host === '') {
            return 'Video URL must have a valid host.';
        }

        $hostLower = strtolower($host);

        if ($this->isHostnameBlocked($hostLower)) {
            return 'This video source is not allowed.';
        }

        $resolvedIps = $this->resolveToIps($hostLower);

        if (empty($resolvedIps)) {
            return 'Could not resolve video source host.';
        }

        foreach ($resolvedIps as $ip) {
            if ($this->isPrivateIp($ip)) {
                Log::warning("SSRF blocked: {$host} resolved to private IP {$ip}");

                return 'This video source is not allowed.';
            }
        }

        return null;
    }

    private function isHostnameBlocked(string $host): bool
    {
        $host = strtolower($host);

        $stripPort = explode(':', $host)[0];

        if (in_array($stripPort, self::BLOCKED_HOSTS, true)) {
            return true;
        }

        foreach (self::BLOCKED_HOST_SUFFIXES as $suffix) {
            if (str_ends_with($stripPort, $suffix)) {
                return true;
            }
        }

        if (filter_var($stripPort, FILTER_VALIDATE_IP)) {
            return $this->isPrivateIp($stripPort);
        }

        return false;
    }

    private function resolveToIps(string $host): array
    {
        $host = explode(':', $host)[0];

        $records = @dns_get_record($host, DNS_A | DNS_AAAA);

        if ($records === false || $records === []) {
            $ip = @gethostbyname($host);
            if ($ip !== $host && filter_var($ip, FILTER_VALIDATE_IP)) {
                return [$ip];
            }

            return [];
        }

        $ips = [];

        foreach ($records as $record) {
            if (isset($record['type']) && $record['type'] === 'A' && isset($record['ip'])) {
                $ips[] = $record['ip'];
            } elseif (isset($record['type']) && $record['type'] === 'AAAA' && isset($record['ipv6'])) {
                $ips[] = $record['ipv6'];
            }
        }

        return array_unique($ips);
    }

    private function isPrivateIp(string $ip): bool
    {
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
            return $this->isPrivateIpv6($ip);
        }

        if (! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
            return false;
        }

        $parts = explode('.', $ip);

        if (! isset($parts[0])) {
            return false;
        }

        $first = (int) $parts[0];

        if ($first === 10) {
            return true;
        }

        if ($first === 127) {
            return true;
        }

        if ($first === 169 && (int) ($parts[1] ?? 0) === 254) {
            return true;
        }

        if ($first === 172 && (int) ($parts[1] ?? 0) >= 16 && (int) ($parts[1] ?? 0) <= 31) {
            return true;
        }

        if ($first === 192 && (int) ($parts[1] ?? 0) === 168) {
            return true;
        }

        if ($first === 0) {
            return true;
        }

        if ($first === 100 && (int) ($parts[1] ?? 0) >= 64 && (int) ($parts[1] ?? 0) <= 127) {
            return true;
        }

        return false;
    }

    private function isPrivateIpv6(string $ip): bool
    {
        $expanded = inet_pton($ip);

        if ($expanded === false) {
            return false;
        }

        $hex = bin2hex($expanded);

        // IPv4-mapped IPv6 (::ffff:a.b.c.d) — evaluate the embedded IPv4 address
        // using the existing IPv4 private/loopback/link-local checks so a mapped
        // private address (e.g. ::ffff:127.0.0.1) cannot bypass them.
        if (str_starts_with($hex, '00000000000000000000ffff')) {
            $embeddedV4 = unpack('N', hex2bin(substr($hex, -8)))[1];

            return $this->isPrivateIp(long2ip($embeddedV4));
        }

        if (str_starts_with($hex, 'fe80')) {
            return true;
        }

        if (str_starts_with($hex, 'fc') || str_starts_with($hex, 'fd')) {
            return true;
        }

        if ($hex === '00000000000000000000000000000001') {
            return true;
        }

        if ($hex === '00000000000000000000000000000000') {
            return true;
        }

        return false;
    }
}
