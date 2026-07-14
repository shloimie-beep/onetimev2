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

## CONFLICT-OT60R-003 - PR #7 Privacy/Performance Against Live POST Search

Type: cherry-pick merge conflict / superseded assumption.

Affected files:

- `apps/web/src/client/app/crm-api.ts`
- `apps/web/src/client/app/crm-entry.tsx`
- `tests/e2e/ot-35/app-shell-crm.spec.ts`
- `tests/e2e/ot-39/crm-privacy-usability.spec.ts`
- `tests/performance/ot-35/crm-performance.spec.ts`
- `tests/performance/ot-39/crm-performance.spec.ts`
- `tests/accessibility/ot-39/crm-a11y.spec.ts`
- `tests/performance/public-performance.spec.ts`

Resolution:

- Accepted PR #7's API helper extraction, list-cache return behavior, post-paint usability marks, OT-39 privacy/accessibility/performance proof, and OT-35 supersession sentinels.
- Replaced PR #7's disabled-search waiting state with canonical authenticated POST-body `/api/v1/crm/contacts/search`.
- Preserved no-GET-search privacy checks by asserting search never appears in query strings, history, storage, resource URLs, or console output.
- Adapted manual and synthetic create flows from `Idempotency-Key` headers to the current body `idempotency_key` contract.
- Preserved existing assignee dropdown behavior from the integrated PR #2/PR #5 surface.

Verification:

- `npm run build`: PASS.
- `npx vitest run --config vitest.integration.config.ts tests/integration/auth-crm.test.ts`: PASS, 10 tests.
- `npx playwright test tests/e2e/ot-39/crm-privacy-usability.spec.ts tests/accessibility/ot-39/crm-a11y.spec.ts tests/performance/ot-39/crm-performance.spec.ts tests/performance/public-performance.spec.ts --reporter=line`: PASS, 12 tests.
- `npx playwright test tests/performance/ot-39/crm-performance.spec.ts --reporter=line`: PASS, 1 test.

## INTEGRATION-OT60R-004 - PR #11 OT-42 Abstract CRM Module Mounting

Type: semantic integration decision / no merge conflict.

Affected files:

- `apps/web/src/server/crm/register.ts`
- `packages/contracts/src/crm/capabilities.ts`
- `packages/contracts/src/crm/schemas.ts`
- `packages/domain/src/crm/ot42-capabilities.ts`
- `packages/domain/src/crm/ot42-protocol.ts`
- `packages/db/migrations/1000_ot42_crm_module_v1.sql`
- `tests/integration/ot42-router.test.ts`

Resolution:

- Cherry-picked PR #11 without textual conflicts.
- Kept the OT-42 module surface additive: contracts, schemas, capabilities, protocol helpers, migration, injectable router/register hooks, protected client cache, lazy tab loader, and tests.
- Did not mount the OT-42 router into the live `/api/v1/crm/*` app because the PR supplies abstract repository/guard hooks rather than concrete production repository implementations.
- Preserved the existing canonical PR #2/#5/#7 live CRM routes.

Verification:

- `npx vitest run tests/unit/ot42-cache.test.ts tests/unit/ot42-capabilities.test.ts tests/integration/ot42-router.test.ts`: PASS, 11 tests.
- `npm run typecheck`: PASS.
- `npm run build`: PASS.
- `npx vitest run --config vitest.integration.config.ts tests/integration/auth-crm.test.ts`: PASS, 10 tests.

## INTEGRATION-OT60R-005 - PR #14 Communications Shared App Wiring

Type: semantic integration decision / no textual merge conflict.

Affected files:

- `apps/web/src/server/app.ts`
- `apps/web/src/server/communications/register.ts`
- `apps/web/src/client/app/crm-entry.tsx`
- `apps/web/src/client/app/communications/route-descriptor.ts`
- `apps/web/src/client/app/communications/CommunicationsFeature.tsx`

Resolution:

- Mounted OT-44 server routes in the shared app after the canonical CRM routes and before static/404 handling.
- Bound `ReadOnlySessionScopePort` to a local read-only session query that mirrors session validity checks without updating `last_seen_at`.
- Used `config.authCsrfSecret` as the local cursor-signing secret for the integrated route registration.
- Wired a lazy global Communications route and contact Communications view into the accepted CRM shell.
- Preserved the OT-44 invariant that default CRM overview does not import, prefetch, hidden-mount, or call Communications.

Verification:

- `npm run typecheck`: PASS.
- `npm run build`: PASS.
- `npx vitest run tests/unit/delivery/config.test.ts tests/unit/delivery/eligibility.test.ts tests/unit/delivery/loop.test.ts tests/unit/delivery/retry.test.ts tests/unit/delivery/worker.test.ts tests/unit/communications/communications-contract.test.ts tests/integration/communications/api.test.ts tests/integration/delivery/outbox-pipeline.test.ts tests/integration/delivery/web-app-independence.test.ts tests/integration/lead-capture.test.ts`: PASS, 74 tests.
- `npx playwright test tests/e2e/ot-44/communications-descriptor.spec.ts tests/accessibility/ot-44/communications-accessibility.spec.ts tests/performance/ot-44/communications-performance.spec.ts --reporter=line`: PASS, 4 tests.
- `npx vitest run --config vitest.integration.config.ts tests/integration/auth-crm.test.ts`: PASS, 10 tests.
- `npx playwright test tests/e2e/ot-39/crm-privacy-usability.spec.ts tests/accessibility/ot-39/crm-a11y.spec.ts tests/performance/ot-39/crm-performance.spec.ts tests/performance/public-performance.spec.ts --reporter=line`: PASS, 12 tests.
