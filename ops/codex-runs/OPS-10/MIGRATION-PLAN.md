# OPS-10 Migration Plan

Generated: 2026-07-17T08:50:00+03:00

## Current Candidate

- Migration runner: `scripts/migrate.ts` via `runMigrations`.
- Ledger table: `onetime.schema_migrations`.
- Ordering: lexicographic SQL filename order.
- Checksum: SHA-256 of SQL content as applied by the runner.

## Namespace Decision

OPS-03B remains `2010_ops03b_email_step_up_login`. OT-114 was renumbered from
`2010_ot114_crm_communications_support` to
`2016_ot114_crm_communications_support` before any OPS-10 staging or production
application.

## Additive Candidate Migrations

The OPS-10 candidate contains additive account lifecycle, CRM, portal, provider,
Content, worker/reliability, and OT-114 CRM reply-draft migrations. The OT-114
migration updates support category constraints and adds `onetime.crm_reply_drafts`
for provider-off single-recipient reply confirmations.

## Required Gates Before Staging/Production Mutation

- PR #61 CI must be green on the post-renumber commit.
- `npm run ops06:migrations` or equivalent CI migration safety must pass.
- Disposable PostgreSQL proof must pass. Locally, Docker, `pg_isready`, `psql`,
  `pg_dump`, and `pg_restore` are unavailable.
- Production DB path must be selected:
  - If the existing DB is canonical and compatible, migrate only after native
    backup and restore verification.
  - If legacy, ambiguous, incompatible, or not PostgreSQL 16, provision a clean
    isolated PostgreSQL 16 production DB and apply verified schema only. Do not
    import contacts/users without separate authorization.

## Rollback Compatibility

OPS-10 migrations are intended as additive/expand-first. Do not perform
destructive cleanup in this launch. App rollback is preferred over database
restore unless corruption is proven.

## Current Status

`pending_predeploy`: Source-level migration namespace is repaired and focused
tests passed. Native production backup/restore and production PostgreSQL 16 path
are not yet satisfied.
