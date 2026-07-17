# OT-86A Migrations

Packet id: OT-86A  
Branch: codex/ot86a-vimeo-content-kb  
Base SHA: a02d1d254ae0d17804fb657079a7871567260ea2  
Head SHA: pending until commit/push  
Generated UTC: 2026-07-15T17:15:21.808Z

## Migration

- `packages/db/migrations/2000_ot86_content_pipeline.sql`
- Additive only: creates new OT-86A tables, constraints, indexes, and queues.
- No existing table/column/index is dropped, renamed, or rewritten.
- No provider calls, network calls, or content-byte rewrites occur in SQL.

## Validation

| Command                                                                                                                                                          | Exit | Result                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx vitest run --config vitest.integration.config.ts tests/integration/content/ot86-content-pipeline.test.ts tests/integration/content/content-library.test.ts` |    0 | New migration applied through pg-mem test setup; OT-86A and adjacent content tests passed, 11 tests.                                                                         |
| `npx vitest run --config vitest.integration.config.ts tests/integration/telegram-db-foundation.test.ts`                                                          |    0 | Migration-chain proof passed; OT-86A is expected as newest migration and rerun limitation remains documented.                                                                |
| `npm run db:verify`                                                                                                                                              |    1 | Blocked locally because `DATABASE_URL` is required by `scripts/migrate.ts` and no Postgres target is configured.                                                             |
| `npx tsx tests/ot-83/real-postgres-concurrency.ts`                                                                                                               |    0 | Script wrote its own blocked report when `OT83_ALLOW_POSTGRES_WRITE` was absent; no production DB mutation occurred. Side-effect evidence file is not part of OT-86A commit. |

## Empty And Upgrade Coverage

The focused pg-mem integration tests create a fresh in-memory database and run all migrations including `2000_ot86_content_pipeline`. The migration foundation test verifies the upgraded chain includes OT-86A after prior migrations. A real PostgreSQL replay remains blocked until an explicit safe `DATABASE_URL`/write gate is provided.

## Rollback/Disable Strategy

Runtime rollback is feature-level: remove/disable the internal publish route secrets and stop consuming OT-86A manifests. The migration is forward-only; data can remain dormant. A destructive SQL rollback is intentionally not included.
