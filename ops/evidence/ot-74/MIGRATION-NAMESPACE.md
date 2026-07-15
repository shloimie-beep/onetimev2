# OT-74 Migration Namespace

Reserved namespace: `1200-1299`.

Verification at base:

- `Get-ChildItem packages\db\migrations -Filter '12*.sql'`: no files found.
- Existing migrations at the OT-74 base: `0001`, `0002`, `0003`, `0004`, `1000`, `1300`, `1500`, `1600`.

Added migration:

- `packages/db/migrations/1200_ot74_legacy_audience_reconciliation.sql`

The migration is additive. It creates feature-local dry-run batch, row, match-candidate, segment-snapshot, rollback, and audit tables. It does not alter existing contacts, signup leads, outbox, provider, portal, billing, Telegram, or communications tables.
