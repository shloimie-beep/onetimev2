# OT-47 Real PostgreSQL

Status: `STOP_REAL_POSTGRESQL_UNAVAILABLE`

## Requirement

Phase 12 requires a real non-production PostgreSQL instance for database,
concurrency, migration, and 10,000-row performance proof. `pg-mem` may remain
for fast unit coverage, but it is not a substitute.

## Availability Checks

- Safe environment check: `DATABASE_URL_PRESENT=false`
- Docker CLI: unavailable
- `psql` CLI: unavailable
- `pg_isready` CLI: unavailable
- Local-only `pg` probes to `127.0.0.1:5432`: unavailable
- Baseline `npm run db:verify`: blocked because `DATABASE_URL` is required

## Decision

No implementation was started. OT-47 cannot honestly prove migration checksum
readback, scoped foreign keys, cross-scope failures, event replay/order,
concurrency with `FOR UPDATE SKIP LOCKED`, lease reclaim, transactional
rollback, 10,000-row indexed search, or query plans without a safe real
PostgreSQL instance.

## Unblock

Provide a disposable non-production PostgreSQL database URL approved for OT-47
synthetic data, or install/start a local PostgreSQL instance. The database must
not be production, Railway production, BNA, One Time live, or an unapproved
remote environment.
