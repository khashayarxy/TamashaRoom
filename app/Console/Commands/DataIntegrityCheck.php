<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\ChatMessage;
use App\Models\RoomMember;
use Illuminate\Console\Command;

class DataIntegrityCheck extends Command
{
    protected $signature = 'integrity:check {--fix : Fix issues automatically}';

    protected $description = 'Detect orphan records and stale presence states';

    public function handle(): int
    {
        $issues = [];

        $orphans = ChatMessage::whereDoesntHave('room')->count();
        if ($orphans > 0) {
            $issues[] = "Orphan messages: {$orphans}";
            if ($this->option('fix')) {
                ChatMessage::whereDoesntHave('room')->delete();
                $this->info("Fixed {$orphans} orphan messages.");
            }
        }

        $orphanMembers = RoomMember::whereDoesntHave('room')->count();
        if ($orphanMembers > 0) {
            $issues[] = "Orphan members: {$orphanMembers}";
            if ($this->option('fix')) {
                RoomMember::whereDoesntHave('room')->delete();
                $this->info("Fixed {$orphanMembers} orphan members.");
            }
        }

        $stale = RoomMember::where('presence_status', 'online')
            ->where('last_seen_at', '<', now()->subHour())
            ->count();
        if ($stale > 0) {
            $issues[] = "Stale presence: {$stale}";
            if ($this->option('fix')) {
                RoomMember::where('presence_status', 'online')
                    ->where('last_seen_at', '<', now()->subHour())
                    ->update(['presence_status' => 'offline']);
                $this->info("Fixed {$stale} stale presence records.");
            }
        }

        if (empty($issues)) {
            $this->info('✅ No integrity issues found.');

            return self::SUCCESS;
        }

        foreach ($issues as $issue) {
            $this->warn("⚠️ {$issue}");
        }

        if (! $this->option('fix')) {
            $this->info('Run with --fix to resolve issues.');
        }

        report(new \RuntimeException('Data integrity issues: '.implode(', ', $issues)));

        return self::FAILURE;
    }
}
