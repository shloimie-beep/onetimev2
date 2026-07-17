# OPS-10 Rollback Plan

Generated: 2026-07-17T08:50:00+03:00

## Current Rollback Identities

### Staging

- Project: `one-time-ot99-staging-96b42905`
- Environment: `staging`
- Web service: `ot99-web`
- Current web deployment: `9efd2fc9-75c5-4455-b5bc-0bb16b85d3a2`
- Worker service: `ot99-worker`
- Current worker deployment: `0df0b354-6453-457b-b65b-43394601a6c7`
- Database service: `ot99-pg16`
- Database volume: `ot99-pg16-volume`

### Production

- Project: `one-time-production`
- Environment: `production`
- Web service: `one-time-web`
- Current web deployment: `15280d13-3e12-4c72-8460-10e0c6e99b3e`
- Delivery cron service: `one-time-delivery-cron`
- Current cron deployment: `387e2e49-2055-43c8-86f4-de11f0e60b59`
- Current app DB binding: `Postgres-j9Pi`
- Current app DB volume: `postgres-volume-YYfM`

## Staging Rollback Rehearsal

`not_run_yet`

Staging rollback rehearsal is required after an immutable OPS-10 staging
deployment exists. Rehearsal must verify source SHA readback, health, readiness,
and app/worker recovery after rollback to the recorded prior deployment IDs.

## Production Rollback Procedure

1. Stop promotion if source SHA, image digest, health, readiness, auth, role
   isolation, or worker acceptance fails.
2. Preserve redacted evidence before any rollback.
3. Roll web/worker or cron services back to the recorded prior deployment IDs.
4. Re-read `/version`, `/health`, `/ready`, and worker status.
5. Prefer app rollback because migrations are additive and forward-compatible.
6. Do not restore the database unless corruption is proven and a verified native
   backup/restore artifact exists.

## Current Status

`blocked_preproduction`: Rollback IDs are captured, but staging rollback rehearsal
and production backup/restore proof are not complete.
