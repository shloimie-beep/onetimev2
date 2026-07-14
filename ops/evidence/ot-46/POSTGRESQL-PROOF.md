# OT-46 PostgreSQL Proof

## pg-mem Supplemental Proof

The focused integration suite applies all base migrations plus `1300_ot46_billing_foundation.sql` through the repository migration harness and exercises:

- migration application
- test-mode rejection
- checkout idempotency
- public signup isolation
- verified event duplicate handling
- same event ID / different digest rejection
- stale-event protection
- wrong-scope rejection
- minimized invoice/subscription projection paths
- reconciliation idempotency path

Command:

`npx vitest run --config vitest.integration.config.ts tests/integration/ot46-billing-services.test.ts`

Current focused result: 9/9 passing.

## Real PostgreSQL 16 Status

Real disposable PostgreSQL proof is pending. `psql` is not available on this machine, and no safe disposable PostgreSQL 16 database was found. Production database use is forbidden, so no real-PostgreSQL proof was faked. pg-mem is supplemental and is not claimed as concurrency proof.

Pending real-PostgreSQL items:

- clean apply of all base migrations plus 1300
- rerun no-op through the real migration table
- checksum drift rejection
- duplicate event concurrency
- checkout serialization under concurrency
- immutable ledger update rejection/hardening review
- stale-event protection under concurrent processing
- reconciliation idempotency under concurrent requests
- bounded indexed reads with `EXPLAIN`
