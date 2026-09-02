# ADR-001: Use Herd CE for Local Development

## Status
Accepted (2026-08-25)

## Context
Initial setup used Laravel Sail (Docker). Issues encountered:
- Slow startup on Windows (WSL2 overhead)
- Complex networking for `.test` domains
- MySQL container resource-heavy on shared dev machines

## Decision
Migrate to Laravel Herd CE (Native Windows).

## Consequences
- ✅ Fast startup (< 2s)
- ✅ Native SSL via Herd CA
- ✅ Simple hosts management
- ❌ MySQL not available (Herd Pro required) → use SQLite locally
- ❌ Environment differs slightly from production (MySQL) → mitigated by CI testing on MySQL

## Migration Notes
- Local DB: SQLite (`DB_CONNECTION=sqlite`)
- Session/Cache: `file` driver
- Queue: `sync` driver
- Production remains MySQL + database drivers
