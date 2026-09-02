# Caching Strategy

## Current State (Shared Hosting)
- Driver: `file` (config/cache.php)
- Limitation: No atomic operations, slow for high concurrency

## Future State (VPS/Redis)
- Driver: `redis`
- Migration: Change `CACHE_STORE=redis` in .env

## What to Cache
| Key Pattern | TTL | Invalidation | Purpose |
|-------------|-----|--------------|---------|
| `room:{id}:state` | 30s | On playback update | Reduce DB reads for polling |
| `room:{id}:members` | 60s | On join/leave | Presence list caching |
| `user:{id}:profile` | 1h | On profile update | Avatar/name caching |
| `subtitle:{id}:parsed` | 24h | Never (immutable) | Parsed SRT/VTT content |

## Invalidation Rules
- Always use Cache Tags if Redis available: `Cache::tags(['room:'.$id])->flush()`
- For file driver: Manual key deletion only

## Implementation Notes
- Use `Cache::remember()` for read-heavy endpoints
- Use `Cache::put()` with explicit TTL for write-through
- Never cache sensitive user data (passwords, tokens)
