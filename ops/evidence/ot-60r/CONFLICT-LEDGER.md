# OT-60R Conflict Ledger

## CONFLICT-OT60R-001 - PR #3/#9 Security Train Supersession

Type: supersession / dependency collision.

Affected files:

- `apps/web/src/server/app.ts`
- `packages/config/src/index.ts`
- `packages/contracts/src/index.ts`
- `packages/db/migrations/0003_first_slice_hardening.sql`
- `packages/db/migrations/0005_privileged_mfa_security_completion.sql`
- `packages/domain/src/auth/service.ts`
- `packages/domain/src/crm/service.ts`
- `packages/domain/src/index.ts`
- `packages/domain/src/lead/service.ts`
- `tests/integration/auth-crm.test.ts`

Resolution:

- Excluded PR #3/#9 alternate migrations and auth/CRM model.
- Ported only the missing HMAC-derived login-CSRF proof from PR #9.
- Added regression coverage for cookie replay and tampered proof rejection.

Verification:

- `npm run typecheck`: PASS.
- `npx vitest run --config vitest.integration.config.ts tests/integration/auth-crm.test.ts`: PASS, 10 tests.
