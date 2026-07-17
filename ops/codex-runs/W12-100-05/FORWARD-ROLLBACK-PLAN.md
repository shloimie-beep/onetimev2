# W12-100-05 Forward Rollback Plan

Generated: 2026-07-17T15:01:14.404Z

This repository uses forward-only checksummed migrations. Existing checked migrations must not be edited after application. Rollback for this lane means halting rollout, restoring a disposable/staging clone when needed, or shipping a new forward corrective migration.

## Immediate Stop

- Stop before production. This lane does not deploy staging or production.
- Keep provider sends, webhooks, payments, and posts disabled.
- Preserve the failed database state for counts/schema-hash evidence only.

## Forward Correction

1. Create a new migration with the next unused numeric prefix.
2. Keep the correction additive or constraint-replacement-only; do not mutate historical migration files.
3. Add a synthetic fixture that reproduces the stop condition without private data.
4. Re-run clean, upgrade-from-2190, checksum, repeat-idempotence, transaction-failure, lock, startup, rolling, and backup/restore rehearsals.
5. Update this lane report with hashes, counts, statuses, and timings only.

## Stop Condition Actions

- `lock_timeout_or_blocking_risk`: Stop the staging migration, keep the database online, capture sanitized lock counts/timings, and prepare a forward corrective migration or schedule an operator-approved maintenance window.
- `data_incompatibility`: Stop before staging apply and produce a forward corrective migration with a synthetic fixture proving compatibility.
- `checksum_mismatch`: Stop immediately; do not modify checked migrations in place. Investigate ledger provenance and use only an explicit forward correction if needed.
- `non_idempotent_result`: Stop release rehearsal and fix the migration runner or forward migration until repeat verification is stable.
- `startup_or_rolling_incompatibility`: Stop staging apply and repair application compatibility before any deploy lane consumes the migration.
