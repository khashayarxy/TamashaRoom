<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\PresenceService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class MarkStaleMembersOffline extends Command
{
    protected $signature = 'presence:timeout';

    protected $description = 'Mark members whose heartbeat has timed out as offline';

    public function handle(PresenceService $presence): int
    {
        try {
            $count = $presence->markStaleAsOffline();
        } catch (\Throwable $e) {
            report($e);
            Log::error('Presence sweep failed', ['error' => $e->getMessage()]);

            return self::FAILURE;
        }

        if ($count > 0) {
            $this->info("Marked {$count} stale member(s) as offline.");
        }

        return self::SUCCESS;
    }
}
