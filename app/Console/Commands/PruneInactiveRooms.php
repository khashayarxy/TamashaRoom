<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Actions\DeleteRoomAction;
use App\Models\Room;
use Illuminate\Console\Command;

class PruneInactiveRooms extends Command
{
    protected $signature = 'rooms:prune-inactive {--days=7 : Room inactivity threshold in days}';

    protected $description = 'Delete rooms with no activity for the specified number of days, including associated data';

    public function handle(DeleteRoomAction $deleteRoom): int
    {
        $days = (int) $this->option('days');
        $cutoff = now()->subDays($days);

        $count = 0;

        Room::with('subtitleTracks')
            ->where('last_activity_at', '<', $cutoff)
            ->chunkById(50, function ($rooms) use ($deleteRoom, &$count): void {
                foreach ($rooms as $room) {
                    $deleteRoom->execute($room);
                    $count++;
                }
            });

        $this->info("Pruned {$count} inactive room(s) older than {$days} days.");

        return self::SUCCESS;
    }
}
