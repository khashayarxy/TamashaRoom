# ADR-002: Use Pusher for Real-time Features

## Status
Accepted (2026-07-20)

## Context
Shared cPanel hosting cannot run persistent daemons (Reverb, Soketi).

## Decision
Use Pusher Channels (cloud-hosted WebSocket service).

## Consequences
- ✅ Works on shared hosting
- ✅ Auto-scaling handled by Pusher
- ✅ Free tier sufficient for MVP (< 200 concurrent)
- ❌ Vendor lock-in → mitigated by transport-agnostic broadcast design
- ❌ Cost at scale → plan to migrate to self-hosted Reverb on VPS post-MVP

## Future Migration Path
When scaling beyond 500 concurrent users:
1. Provision VPS with Reverb
2. Change `BROADCAST_CONNECTION=reverb`
3. Update CSP headers for new WebSocket origin
4. No frontend code changes needed (Echo abstraction)
