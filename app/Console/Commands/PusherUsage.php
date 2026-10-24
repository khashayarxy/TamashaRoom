<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Broadcasting\Broadcasters\PusherBroadcaster;
use Illuminate\Broadcasting\BroadcastManager;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Throwable;

class PusherUsage extends Command
{
    protected $signature = 'pusher:usage';

    protected $description = 'Log Pusher presence-channel connection counts to monitor usage against the free-tier ceiling';

    public function handle(BroadcastManager $broadcasts): int
    {
        $connection = (string) config('broadcasting.default');
        $cacheKey = 'pusher:usage:backoff:'.$connection;
        $state = Cache::get($cacheKey, ['failures' => 0, 'next_attempt_at' => 0]);

        if ($state['next_attempt_at'] > now()->timestamp) {
            $this->info('Skipped: usage monitoring is cooling down after a failed attempt.');

            return self::SUCCESS;
        }

        try {
            $broadcaster = $broadcasts->connection();

            if (! $broadcaster instanceof PusherBroadcaster) {
                Log::channel('pusher')->info('pusher:usage skipped (BROADCAST_CONNECTION is not pusher)');
                $this->info('Skipped: broadcasting is not using the pusher driver.');

                return self::SUCCESS;
            }

            $result = $broadcaster->getPusher()->getChannels([
                'filter_by_prefix' => 'presence-room.',
                'info' => 'user_count,subscription_count',
            ]);

            $channels = (array) ($result->channels ?? []);
            Cache::forget($cacheKey);

            $totalSubscriptions = 0;
            $totalUsers = 0;

            foreach ($channels as $name => $info) {
                $subscriptions = (int) ($info->subscription_count ?? 0);
                $users = (int) ($info->user_count ?? 0);
                $totalSubscriptions += $subscriptions;
                $totalUsers += $users;

                Log::channel('pusher')->info('pusher.channel.usage', [
                    'channel' => $name,
                    'subscription_count' => $subscriptions,
                    'user_count' => $users,
                    'occupied' => (bool) ($info->occupied ?? false),
                ]);
            }

            Log::channel('pusher')->info('pusher.total.usage', [
                'channels' => count($channels),
                'total_subscriptions' => $totalSubscriptions,
                'total_users' => $totalUsers,
                'at' => now()->toIso8601String(),
            ]);

            $this->info(sprintf(
                'Logged %d presence channel(s), %d total subscriptions (%d users).',
                count($channels),
                $totalSubscriptions,
                $totalUsers,
            ));

            return self::SUCCESS;
        } catch (Throwable $exception) {
            $failures = min(5, (int) $state['failures'] + 1);
            $delay = min(3600, 300 * (2 ** ($failures - 1)));
            Cache::put($cacheKey, [
                'failures' => $failures,
                'next_attempt_at' => now()->timestamp + $delay,
            ], now()->addHours(3));

            // SDK exceptions can include signed URLs, app keys and auth signatures.
            Log::channel('pusher')->warning('pusher:usage failed', [
                'exception' => $exception::class,
                'retry_after_seconds' => $delay,
                'consecutive_failures' => $failures,
            ]);
            $this->error('Failed to query usage; monitoring will retry after the cooldown.');

            return self::FAILURE;
        }
    }
}
