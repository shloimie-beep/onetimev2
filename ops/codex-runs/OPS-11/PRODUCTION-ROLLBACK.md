# OPS-11 Production Rollback

Status: `pending`

Production rollback preservation is required before production mutation.

## Starting Evidence From OPS-10

- Production project: `one-time-production`
- Production web service: `one-time-web`
- Production web deployment: `15280d13-3e12-4c72-8460-10e0c6e99b3e`
- Production web digest:
  `sha256:3390fcfe443897c8da1a698c98428cc85458f6a5bef789492a53ddf4a0003553`
- Production cron service: `one-time-delivery-cron`
- Production cron deployment: `387e2e49-2055-43c8-86f4-de11f0e60b59`
- Production cron digest:
  `sha256:cca6c9720caf97d780c455e403c9228756c97da56ef722c31f124a4376b1bc31`
- Production database service: `Postgres-j9Pi`
- OPS-10 production app SHA:
  `050170d3ce5e9d0ea8e0db5ca0fa96b369bff0b5`

## Required Before Mutation

- Refetch current production deployment IDs and rollback eligibility.
- Confirm previous web/cron deployments have `canRollback=true` or establish
  blue-green preservation.
- Capture protected variable-name inventory and value fingerprints only.
- Create fresh native PostgreSQL 18 dump and restore-test it.
- Confirm migrations are additive and rollback-compatible with old app reads.
- Write exact web/worker/database rollback steps.

Database restore is last resort. App rollback is preferred.
