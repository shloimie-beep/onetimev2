# OT-47 Schema And Migration

Status: blocked before implementation by `STOP_REAL_POSTGRESQL_UNAVAILABLE`.

## Reserved Migration

- Intended migration: `packages/db/migrations/1400_ot47_content_library.sql`
- Migration checksum: not created
- Existing migrations at base: `0001_onetime_lead_slice.sql`,
  `0002_crm_auth_core.sql`
- Namespace collision: none found for `1400`

## Reason Not Created

The prompt requires real non-production PostgreSQL proof for migration,
concurrency, rollback, and 10,000-row performance behavior. Because no safe real
PostgreSQL instance is available, creating schema without being able to prove it
would violate Phase 12.

## Future Schema Direction

If unblocked, use additive `onetime.*` tables for content items, media
references, artifact references, inbound events, processing attempts, and
audit-event reuse or a scoped OT-47 audit table only if the existing audit table
cannot safely represent the required actions.
