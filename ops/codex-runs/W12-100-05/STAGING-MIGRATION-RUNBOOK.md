# W12-100-05 Staging Migration Runbook

Generated: 2026-07-17T15:01:14.404Z

## Preconditions

- Use only an isolated non-production staging database and deployment target.
- Confirm `/version` for the staging app before any migration.
- Confirm the migration inventory hash matches this report.
- Migration inventory hash: `5977eff0fc130c0dc9e262364470df9ad8db2c355595214a63a5d96e25353d71`
- Confirm provider flags remain disabled and worker transport remains `sink`.
- Confirm production mutations and external actions are zero.

## Migration Order

1. `2200_w12_02_communication_history`
2. `2201_w12_01_crm_audience_import`
3. `2202_w12_05_telegram_operations`

## Stop Conditions

- `lock_timeout_or_blocking_risk`: Any rehearsal observes advisory lock acquisition exceeding the configured lock timeout, a pending blocker beyond the timeout, or a relation lock that would block normal web/worker reads. Action: Stop the staging migration, keep the database online, capture sanitized lock counts/timings, and prepare a forward corrective migration or schedule an operator-approved maintenance window.
- `data_incompatibility`: Any existing synthetic row valid at migration 2190 becomes invalid after 2200-2202, or any required W12 capability cannot be inserted after 2202. Action: Stop before staging apply and produce a forward corrective migration with a synthetic fixture proving compatibility.
- `checksum_mismatch`: Any onetime.schema_migrations checksum differs from the repository-normalized SHA-256 for the same migration id. Action: Stop immediately; do not modify checked migrations in place. Investigate ledger provenance and use only an explicit forward correction if needed.
- `non_idempotent_result`: A repeat migration verification applies a new migration unexpectedly, changes a schema hash, changes table counts outside the rehearsal fixture, or reports a different ledger. Action: Stop release rehearsal and fix the migration runner or forward migration until repeat verification is stable.
- `startup_or_rolling_incompatibility`: The web app, sink worker, or rolling pre/post migration process fails against the disposable migrated schema while provider flags remain off. Action: Stop staging apply and repair application compatibility before any deploy lane consumes the migration.

## Staging Procedure

1. Snapshot or clone the isolated staging database.
2. Run `npm run db:verify` against the staging clone and compare ledger checksums to the report inventory hash.
3. Run `npm run db:migrate` exactly once against the isolated staging database.
4. Run `npm run db:verify` again and confirm every migration reports `already_applied`.
5. Start the web process with migrations disabled and smoke `/health`, `/ready`, and `/version`.
6. Run the sink worker once with provider flags disabled and record counts only.
7. During rolling deployment, keep old web/worker instances provider-off until both old and new process compatibility checks pass.
8. If any stop condition appears, stop the rollout and use the forward-only corrective plan.
