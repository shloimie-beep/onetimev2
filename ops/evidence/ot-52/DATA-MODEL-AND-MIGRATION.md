# OT-52P Data Model And Migration

## Migration

- File: `packages/db/migrations/1500_ot52_portal_households_learners.sql`.
- SHA-256: `8C9B7C7A73A5759EA6FC9A866A1F3F8B1C5D47298910C4644B7540654968AE83`.
- Namespace preflight: no existing `15*.sql` files were present.

## Tables

- `portal_households`
- `portal_guardian_relationships`
- `portal_learners`
- `portal_student_access_state`
- `portal_guardian_consents`
- `portal_student_access_operations`
- `portal_reward_events`
- `portal_administrative_updates`
- `portal_update_read_state`
- `portal_audit_actions`
- `portal_mutation_idempotency_records`

## Safeguards

- All scoped records include `account_key` and `product_key`.
- Learners are tied to households by composite foreign keys.
- Active student access has unique learner and unique active student identity indexes.
- Reward events are append-only; corrections use a new event referencing the corrected event.
- Mutation idempotency records store operation scope, actor, request hash, and response JSON.
- Credential lifecycle records store adapter operation digests, not raw credential operation references.

## Verification

- `runMigrations(createMemoryPool())`: exercised by `tests/ot-52/portal-services.test.ts`.
- `npm run db:verify`: blocked locally because `DATABASE_URL` is not configured for PostgreSQL-backed runtime.
- Real Postgres concurrency proof: guarded and blocked without `OT52_POSTGRES_URL` plus `OT52_ALLOW_POSTGRES_WRITE=true`; see `REAL-POSTGRES-CONCURRENCY.json`.
