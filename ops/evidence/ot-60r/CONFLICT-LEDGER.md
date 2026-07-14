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

## CONFLICT-OT60R-002 - PR #5 Shell Against Canonical PR #2 CRM API

Type: cherry-pick merge conflict / contract drift.

Affected files:

- `apps/web/src/client/app/crm-entry.tsx`
- `playwright.config.ts`
- `tests/e2e/ot-35/app-shell-crm.spec.ts`
- `tests/performance/ot-35/crm-performance.spec.ts`

Resolution:

- Resolved the `crm-entry.tsx` conflict by keeping PR #5 authenticated shell behavior while preserving canonical PR #2 session handling, assignee loading, POST-body CRM search, and private search semantics.
- Omitted blank UI filters from submitted search commands so the client matches `contactSearchCommandSchema`.
- Preserved idempotent CRM contact creation by adding fixture idempotency keys to OT-35 browser helpers.
- Kept production login rate-limit defaults and raised only Playwright web-server login budgets to prevent the local evidence suite from self-throttling.

Verification:

- `npm run build`: PASS.
- `npx playwright test tests/e2e/ot-35/app-shell-crm.spec.ts tests/accessibility/ot-35/app-shell-a11y.spec.ts tests/performance/ot-35/crm-performance.spec.ts --reporter=line`: PASS, 8 tests.
- `npx vitest run --config vitest.integration.config.ts tests/integration/auth-crm.test.ts`: PASS, 10 tests.
