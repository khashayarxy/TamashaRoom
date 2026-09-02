# Queue Strategy

## Current State (Shared Hosting)
- Driver: `sync` (config/queue.php)
- Behavior: Jobs run immediately in request cycle
- Limitation: Slow requests if job takes > 1s

## Future State (VPS/Redis/Database)
- Driver: `database` or `redis`
- Worker: `php artisan queue:work --daemon`

## Jobs to Queue (Priority Order)
| Job Class | Trigger | Priority | Why Async |
|-----------|---------|----------|-----------|
| `SendEmailVerification` | Registration | High | SMTP latency (2-5s) |
| `ProcessSubtitleUpload` | Subtitle upload | Medium | File parsing (1-3s) |
| `BroadcastRoomEvent` | Any room action | Low | Pusher API call (200-500ms) |
| `GenerateThumbnail` | Video set | Low | FFmpeg processing (5-30s) |
| `CleanupOldBackups` | Daily schedule | Low | File I/O |

## Migration Steps
1. Create `jobs` table: `php artisan queue:table && php artisan migrate`
2. Change `.env`: `QUEUE_CONNECTION=database`
3. Setup supervisor/cron for worker: `* * * * * php artisan queue:work --stop-when-empty`

## Retry Policy
- Max attempts: 3
- Backoff: [10, 30, 60] seconds
- Timeout: 60s per job
