# Phase 3 Ledger: Account And Credential Lifecycle

Status: completed

## Scope

- Canonical auth/MFA/session reuse, default-off sink-capable invitations, parent activation, student setup/reset/suspend/restore, password reset, privileged TOTP lifecycle, session-family invalidation, hashed expiring single-use tokens, rate limits, audit, and idempotent delivery intents.

## Evidence

- Migration `packages/db/migrations/1700_ot71_account_lifecycle.sql` adds hashed lifecycle tokens, local delivery intents, idempotency records, audit events, session invalidations, learner identity links, and parent/student role support on canonical account users.
- Contracts in `packages/contracts/src/accounts/index.ts` define owner/admin invitations, parent activation, student setup/reset, password reset, token completion, delivery summaries, lifecycle token types, and lifecycle error codes.
- Domain service in `packages/domain/src/accounts/lifecycle.ts` issues default-off local sink delivery intents, stores token hashes only, replays idempotent requests safely, audits lifecycle transitions, and invalidates session families on security-sensitive changes.
- Existing canonical auth primitives are reused for password hashing, `account_users`, TOTP MFA, sessions, security versions, and durable rate limiting.
- Parent activation links guardians to canonical users without exposing student secrets; student setup links learner profiles to distinct student login identities and supports parent-managed reset, suspend, and restore.
- Tests added in `tests/integration/accounts/account-lifecycle.test.ts`; migration expectations updated in `tests/integration/telegram-db-foundation.test.ts`.
- Verification passed: focused account lifecycle tests, focused migration foundation tests, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run secret:scan`, `git diff --check`, and `npm run test`.

## Notes

- No real users, credential sends, provider identity mutations, deployment, production database writes, or live transports were performed.
- Raw lifecycle tokens are returned only to the immediate local caller for proof-mode tests and are not persisted in lifecycle tokens, delivery intents, idempotency records, or audit metadata.
