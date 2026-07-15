# OT-75 Disposable PostgreSQL Assurance Runbook

OT-75 prepares the database assurance gate. It does not connect to production
or execute database mutations.

## Required Proof Before Deployment

- Fresh disposable database migration from empty database.
- Upgrade disposable database migration from the OT-60R accepted stack.
- Idempotent migration verification.
- Migration ledger checksum comparison.
- Rollback drill or documented forward-fix rollback procedure.
- Duplicate-data audit report with counts only.
- Database reference drift check proving staging and production references are
  present and distinct without printing either value.

## Existing Harness

Use the existing OT-37 PostgreSQL assurance harness as the base:

```powershell
npx tsx scripts/postgres-assurance/run.ts
```

The harness must run against a disposable PostgreSQL instance. It must never use
production `DATABASE_URL`.

## Evidence Rules

- Evidence can include migration IDs, checksums, counts, timings, and pass/fail
  status.
- Evidence must not include raw rows, database URLs, passwords, contact data,
  message bodies, or provider identifiers.
