# OPS-06 Integration Delta

## New Contracts

- `packages/contracts/src/ops/index.ts`: metric, queue health, worker heartbeat, health snapshot, and alert schemas.

## New Runtime Hooks

- `packages/observability/src/ops.ts`: durable heartbeat helpers, readiness/health collection, queue aggregation, alert evaluation, deterministic alert sink.
- `packages/observability/src/index.ts`: emits structured HTTP latency/error metrics from the existing trace middleware.
- `apps/web/src/server/ops-routes.ts`: protected diagnostics and Prometheus-style text metrics.
- `apps/web/src/server/app.ts`: `/ready` now reports essential dependencies and non-secret blockers.
- `apps/worker/src/main/index.ts`: worker heartbeat, drain, and stopped markers.

## New Migration

- `packages/db/migrations/2015_ops06_reliability_observability.sql`.

## New Scripts

- `npm run ops06:alerts`
- `npm run ops06:probes`
- `npm run ops06:migrations`
- `npm run ops06:load`
- `npm run ops06:backup-restore`
- `npm run ops06:verify`

## Final Conductor Notes

- Set `OPERATIONS_PROBE_TOKEN` only in protected runtime config.
- Add staging probe jobs only after staging base URL exists.
- Keep optional provider disabled states out of core readiness failure.
- Run disposable PG16 load and restore drills before staging acceptance.
