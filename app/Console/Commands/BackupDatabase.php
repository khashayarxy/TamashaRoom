<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;

class BackupDatabase extends Command
{
    protected $signature = 'db:backup';

    protected $description = 'Create a database backup with 7-day retention';

    public function handle(): int
    {
        $filename = 'backup_'.now()->format('Y_m_d_His').'.sql';
        $dir = storage_path('app/backups');
        if (! is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        $path = $dir.'/'.$filename;

        if (config('database.default') === 'sqlite') {
            $dbPath = config('database.connections.sqlite.database');
            if (! $dbPath || ! file_exists($dbPath)) {
                $this->error('SQLite database file not found: '.$dbPath);
                report(new \RuntimeException('Backup failed: SQLite file not found'));

                return self::FAILURE;
            }
            copy($dbPath, $path);
        } else {
            $process = Process::run([
                'mysqldump',
                '-u', config('database.connections.mysql.username'),
                '-p'.config('database.connections.mysql.password'),
                '-h', config('database.connections.mysql.host'),
                config('database.connections.mysql.database'),
            ]);

            if ($process->failed()) {
                report(new \RuntimeException('Backup failed: '.$process->errorOutput()));

                return self::FAILURE;
            }

            file_put_contents($path, $process->output());
        }

        $backups = glob($dir.'/*.sql');
        if ($backups !== false) {
            rsort($backups);
            foreach (array_slice($backups, 7) as $old) {
                @unlink($old);
            }
        }

        Log::info("Database backup created: {$filename}");
        $this->info("Backup created: {$filename}");

        return self::SUCCESS;
    }
}
