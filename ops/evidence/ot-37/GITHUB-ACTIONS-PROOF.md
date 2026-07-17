# OT-37 GitHub Actions Proof

Date: 2026-07-15.

## Failed Integration Run

- Run: `29377569058`.
- Trigger: push to `codex/ot60r-recovery-convergence`.
- Result: failed in `Run OT-37 PostgreSQL assurance`.
- Cause: the original OT-37 synthetic scale seed inserted post-migration contacts
  without canonical `public_contact_id` values, violating the accepted PR #2
  `NOT NULL` invariant.

## Passing Integration Run

- Run: `29377668001`.
- Trigger: push to `codex/ot60r-recovery-convergence`.
- Job: `PostgreSQL 16 assurance harness`.
- Result: passed in 53 seconds.
- PostgreSQL: 16.14.
- Node: 24.18.0.
- Sanitized artifacts:
  - `ci-run-29377668001/latest-postgres-assurance-report.json`
  - `ci-run-29377668001/latest-postgres-assurance-report.md`

## Evidence Highlights

- Migration files discovered: 8.
- Ledger matches checksums: `true`.
- Applied migrations: `0001`, `0002`, `0003`, `0004`, `1000`, `1300`, `1500`,
  `1600`.
- Idempotent verification: all 8 migrations reported `already_applied`.
- Synthetic scale: 10,600 contacts, 500 signups, 500 outbox rows.
- Reserved-domain synthetic evidence scan: passed.
- Concurrency: idempotency insert race, duplicate contact race, and
  SKIP LOCKED worker claims passed; durable throttling remains skipped for the
  current base gap.
- External mutations: production database `false`, Railway `false`, providers
  `false`, sends `false`.
