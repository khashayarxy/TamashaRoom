<?php

use App\Console\Commands\PruneInactiveRooms;
use Illuminate\Support\Facades\Schedule;

Schedule::command(PruneInactiveRooms::class, ['--days=7'])
    ->daily()
    ->description('Remove rooms inactive for 7+ days');

Schedule::command('queue:work --stop-when-empty --max-time=30')
    ->everyMinute()
    ->withoutOverlapping()
    ->description('Process queued jobs one batch at a time');

Schedule::command('presence:timeout')
    ->everyMinute()
    ->withoutOverlapping()
    ->description('Mark stale members as offline');

Schedule::command('pusher:usage')
    ->everyFiveMinutes()
    ->withoutOverlapping()
    ->description('Log Pusher presence-channel connection counts');
