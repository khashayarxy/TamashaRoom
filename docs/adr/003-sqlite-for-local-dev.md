# ADR-003: SQLite for Local Development

## Status
Accepted (2026-08-25)

## Context
Herd CE does not include MySQL (Pro-only feature).

## Decision
Use SQLite for local development, MySQL for production.

## Consequences
- ✅ Zero-dependency local setup
- ✅ Fast test execution (in-memory SQLite)
- ✅ Matches CI environment (GitHub Actions uses SQLite)
- ❌ SQL dialect differences → mitigated by using Eloquent ORM exclusively
- ❌ Some MySQL-specific features unavailable locally → tested in CI on MySQL

## Compatibility Rules
- Never use raw SQL (`DB::raw`) — always use Eloquent/Query Builder
- Avoid MySQL-specific column types (use standard types)
- Test migrations on both SQLite (local) and MySQL (CI)
