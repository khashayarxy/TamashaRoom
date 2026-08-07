<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Broadcasting\Broadcasters\PusherBroadcaster;
use Illuminate\Broadcasting\BroadcastManager;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class PusherUsage extends Command
{
    protected $signature = 'pusher:usage';

    protected $description = 'Log Pusher presence-channel connection counts to monitor usage against the free-tier ceiling';

    public function handle(BroadcastManager $broadcasts): int
    {
        $broadcaster = $broadcasts->connection();

        if (! $broadcaster instanceof PusherBroadcaster) {
            Log::channel('pusher')->info('pusher:usage skipped (BROADCAST_CONNECTION is not pusher)');
            $this->info('Skipped: broadcasting is not using the pusher driver.');

            return self::SUCCESS;
        }

        try {
            $result = $broadcaster->getPusher()->getChannels([
                'filter_by_prefix' => 'presence-room.',
                'info' => 'user_count,subscription_count',
            ]);

            $channels = $result->channels ?? [];

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
        } catch (\Throwable $e) {
            Log::channel('pusher')->error('pusher:usage failed', [
                'error' => $e->getMessage(),
            ]);
            $this->error('Failed to query Pusher: '.$e->getMessage());

            return self::FAILURE;
        }
    }
}
