<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\PresenceService;
use Illuminate\Console\Command;

class MarkStaleMembersOffline extends Command
{
    protected $signature = 'presence:timeout';

    protected $description = 'Mark members whose heartbeat has timed out as offline';

    public function handle(PresenceService $presence): int
    {
        $count = $presence->markStaleAsOffline();

        if ($count > 0) {
            $this->info("Marked {$count} stale member(s) as offline.");
        }

        return self::SUCCESS;
    }
}
