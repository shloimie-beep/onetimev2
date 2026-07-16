# OPS-06 - Worker reliability, observability, load assurance, and recovery

## Mission

Add the operational foundation that makes One Time diagnosable and recoverable: worker heartbeat, queue/outbox/dead-letter health, provider-neutral metrics, alerts, load/backpressure proof, backup freshness, restore drills, migration safety, and incident/rollback runbooks. Keep this lane independent of feature providers and shared UI.

## Source

- Repository: `webcraft-media/onetimev2`
- Exact base: `codex/ops03-staging-readiness-repair` at `fb5f5eebc539afc9e93833e9417ee67524d62c36`
- Branch: `codex/ops06-reliability-observability`
- Draft PR base: `codex/ops03-staging-readiness-repair`

## Required operational behavior

### Worker and queue health

- Durable worker heartbeat/lease per worker type/instance with started, last-seen, draining, version/SHA, and non-secret readiness.
- Queue/outbox metrics: ready count, oldest age, leased count/oldest lease, retry count, dead-letter count/oldest, throughput, failure class, and provider-disabled count, all account/product safe.
- Detect stuck/expired leases and bounded retry storms without double-processing.
- Graceful SIGTERM/SIGINT drain with no new claims, bounded wait, lease-safe recovery, and evidence.
- Protected diagnostics/API for owner operations and machine probes; never public PII or secret-bearing metrics.

### Metrics and alerts

- Structured metric/event schema for HTTP latency/errors, DB pool/query health, signup/login/activation, webhooks, worker lag, delivery, class reminders, content processing, support bridge, and provider state.
- Define actionable staging/production thresholds and alert routing adapters with deterministic sink. No alert spam and no real notification in this branch.
- Synthetic probes for public landing/signup, auth lifecycle, private session/role denial, worker heartbeat, and DB/readiness.
- `/health` remains liveness; `/ready` must include essential dependencies and exact non-secret blocker reasons. Optional provider failure must not take down the core app.

### Load, soak, and backpressure

Use disposable PostgreSQL 16 to exercise concurrent signup/idempotency, login/rate limits, activation, support events, provider webhooks, multi-worker claims, slow provider, retry/dead-letter, and graceful shutdown. Seed 10k-50k synthetic contacts/events without real PII. Record query plans and p50/p75/p95/p99 plus bounded memory/request/queue growth. Fail gates on unbounded fanout or duplicate side effects.

### Backup and migration safety

- Migration uniqueness/order/checksum/collision scan across every fetched input branch format.
- Forward-only migration rehearsal on empty and representative synthetic DB, repeat no-op proof, and compatibility with prior candidate.
- Native `pg_dump -Fc` plus disposable restore and functional smoke; record RPO/RTO targets and measured staging proof.
- Backup/PITR freshness check and recurring restore-drill runbook. Do not claim Railway plan features that are not evidenced.
- Pre-migration backup and exact web/worker/DB rollback checklist for the final conductor.

### Security/operations evidence

- Secret/PII log scanning, security headers, dependency vulnerability/license/SBOM reporting using repository-compatible tooling, audit-event coverage, and retention/cleanup job contracts.
- Avoid adding noisy workflows that cannot run with current GitHub permissions. Keep CI deterministic and scoped.

## Ownership/collision rules

Own new operational domain/contracts/scripts/tests/workflows/evidence and additive migrations only where necessary. Avoid provider implementations, `app.ts`, route UI, product copy, auth policy, Content/portal/CRM logic, and BNA. Expose narrow registration hooks and an integration delta for the final conductor.

## Persistence

Persist `ops/codex-runs/OPS-06/{ORIGINAL-PROMPT.md,STATE.json,DECISIONS.md,SLO.md,ALERTS.md,RECOVERY.md,INTEGRATION-DELTA.md,RESUME.md,FINAL-REPORT.md}`. Commit/push/open a draft PR. Run full local CI and real disposable PG16 assurance. No deployment, production DB, provider call, send, charge, publish, DNS, or BNA mutation is authorized.
