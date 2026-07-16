# OPS-06 Final Report

Status: ready for review.

Worktree: `C:/Users/User/.overnight-20260717-worktrees/OPS-06`

Branch: `codex/ops06-reliability-observability`

Base: `codex/ops03-staging-readiness-repair` at `fb5f5eebc539afc9e93833e9417ee67524d62c36`

Draft PR: <https://github.com/webcraft-media/onetimev2/pull/58>

## Implemented

- Added OPS-06 operational contracts for metrics, queue health, worker heartbeat, health snapshots, and alerts.
- Added additive migration `2010_ops06_reliability_observability.sql` for worker heartbeats, synthetic probe summaries, restore drills, and retention job records.
- Added durable worker heartbeat, draining, and stopped markers to the delivery outbox worker.
- Added `/ready` dependency readiness plus protected diagnostics and Prometheus-style metrics routes.
- Added deterministic alert evaluation, migration safety, synthetic probe, load/backpressure, and backup/restore scripts.
- Added a read-only CI workflow with PostgreSQL 16 service for the OPS-06 reliability path.

## Verification

- `npm ci`: passed.
- `npm run typecheck`: passed.
- `npx vitest run tests/unit/ops06/ops-observability.test.ts tests/integration/ops06/ops-diagnostics-routes.test.ts`: passed, 2 files / 4 tests.
- `npm run unit`: passed, 30 files / 160 tests.
- `npm run integration`: passed, 28 files / 137 tests.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run secret:scan`: passed across 934 repo text files.
- `git diff --check`: passed; Git emitted only CRLF normalization warnings.
- Targeted `npx prettier --check` over OPS-06-owned files: passed. Full `npm run format` remains blocked by preexisting repo-wide formatting debt outside this lane.

## Evidence

- `ops/codex-runs/OPS-06/evidence/alert-eval.json`: passed; deterministic local sink only, `external_notifications_sent=false`.
- `ops/codex-runs/OPS-06/evidence/migration-safety.json`: passed; no local duplicate IDs or ordering failures. Cross-branch checksum collisions are reported for existing divergent branch history.
- `ops/codex-runs/OPS-06/evidence/synthetic-probes.json`: blocked because `OPS06_BASE_URL` was not configured for a local or staging target.
- `ops/codex-runs/OPS-06/evidence/load-backpressure.json`: blocked because disposable local PostgreSQL was unavailable: `connect ECONNREFUSED 127.0.0.1:5432`; `psql` and Docker were not installed.
- `ops/codex-runs/OPS-06/evidence/backup-restore.json`: blocked for the same disposable PostgreSQL limitation.

## Guardrails

- No deployment, production database, provider call, send, charge, publish, DNS, or BNA mutation was performed.
- Diagnostics sanitize secret-like keys and require either `OPERATIONS_PROBE_TOKEN` or owner/admin session access.
- Optional provider-disabled states are reported as optional dependencies and do not fail core readiness.
- Load and restore scripts require `OPS06_ALLOW_PG_ASSURANCE=true` before attempting disposable PostgreSQL work.
