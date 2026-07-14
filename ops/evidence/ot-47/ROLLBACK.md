# OT-47 Rollback

Status: blocked before implementation by `STOP_REAL_POSTGRESQL_UNAVAILABLE`.

## Current Rollback

This branch contains only stop evidence under `ops/evidence/ot-47/**`. Reverting
or superseding the evidence removes all tracked branch changes. No application
runtime, database schema, provider state, BNA runtime, production data, or
deployment was changed.

## Future Rollback Seam

If unblocked and implemented, rollback must rely on default-off flags, inert
additive tables, disabled ingest, disabled worker registration, sink provider
mode, no provider mutation, and no BNA runtime dependency. No down migration
should drop content or audit data.
