# OPS-06 Recovery And Rollback Runbook

## Before Migration

1. Confirm target environment and database are staging or approved production.
2. Run migration safety: `npm run ops06:migrations`.
3. Take a native backup: `pg_dump -Fc` to a protected, timestamped location.
4. Record source commit, migration list, backup path/fingerprint, operator, and target service.
5. Do not proceed if backup creation or restore spot-check is blocked.

## Restore Drill

1. Use disposable PostgreSQL 16.
2. Apply migrations to the source disposable DB.
3. Run `pg_dump -Fc`.
4. Restore with `pg_restore --no-owner` to a second disposable DB.
5. Smoke the restored schema migration ledger and `onetime.worker_heartbeats`.
6. Record RPO/RTO targets and measured RTO in `ops/codex-runs/OPS-06/evidence/backup-restore.*`.

## Incident Response

1. Check `/health` for process liveness.
2. Check `/ready` for essential dependency blockers.
3. Use protected `/api/internal/ops/diagnostics` with `x-ops-probe-token`.
4. If worker heartbeat is stale, stop/restart the worker after confirming no active process owns the instance.
5. Expired leases are safe to reclaim because claims use transactional `SKIP LOCKED` and completion checks the current unexpired lease.
6. Dead-letter rows require operator review before requeue.

## Rollback

1. Roll web and worker to the prior image/commit.
2. Stop workers before DB rollback if a destructive restore is approved.
3. Restore from the pre-migration backup only with explicit conductor/operator approval.
4. After restore, run `/ready`, protected diagnostics, synthetic probes, and focused queue tests.
5. Do not claim Railway PITR availability unless separately evidenced for the active plan.
