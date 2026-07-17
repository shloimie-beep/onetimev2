# OT-86B Migrations

Packet id: OT-86B<br>
Branch: codex/ot86b-buffer-social<br>
Base SHA: 87a1bb7ffd6a2fa0d016a1831894d430aa2ee065<br>
Current head SHA: pending until final commit/push<br>
Generated UTC: 2026-07-15T17:50:30Z

## Migration

- Added `packages/db/migrations/2100_ot86b_social_publishing.sql`.
- The migration is additive: it creates new `ot86b_*` tables and indexes only.
- Existing OT86A/OT83/OT71/OT51 tables are not altered.

## Validation Commands

- `npx vitest run --config vitest.integration.config.ts tests/integration/telegram-db-foundation.test.ts` - exit 0, 2 tests passed.
- `npx vitest run --config vitest.integration.config.ts tests/integration/social/ot86b-social-publishing.test.ts` - exit 0, 7 tests passed.
- `npm run db:verify` - exit 1, blocked locally because `DATABASE_URL` is not configured.

## Effects

- Empty pg-mem migration application now ends at `2100_ot86b_social_publishing`.
- The foundation test verifies OT86A migration `2000_ot86_content_pipeline` remains present.
- The social integration test applies all migrations and exercises event intake, drafts, approvals, commands, attempts, and audit paths.

## Rollback / Disable Strategy

- Disable the OT86B consumer/scheduler by not running the social event endpoint/scheduler and leaving Buffer config absent.
- OT86A content publication and KB delivery remain available.
- Database rollback, if required before production adoption, is isolated to `ot86b_*` tables because no existing schema was mutated.
