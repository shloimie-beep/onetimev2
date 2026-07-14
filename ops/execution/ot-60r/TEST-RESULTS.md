# OT-60R Test Results

## Preflight

- `git fetch origin --prune`: PASS.
- `git cat-file -t 4ac288968ba24e30a5c3f8c6924f492eedf4338f`: PASS, object type `commit`.
- `git merge-base --is-ancestor 3465bd7d4c6b6829a6be6e4b4f8a003d608f3680 4ac288968ba24e30a5c3f8c6924f492eedf4338f`: PASS.
- `git merge-base --is-ancestor a73458d1884b8fcb4843c4852425009577f59ef7 4ac288968ba24e30a5c3f8c6924f492eedf4338f`: PASS.
- `git rev-parse origin/codex/crm-core-v1`: PASS, returned `4ac288968ba24e30a5c3f8c6924f492eedf4338f`.

## Product Tests

- `npm run build`: PASS. Cleaned `dist`, rebuilt public/app Vite bundles and static pages, then ran typecheck.
- `npx playwright test tests/e2e/ot-35/app-shell-crm.spec.ts tests/accessibility/ot-35/app-shell-a11y.spec.ts tests/performance/ot-35/crm-performance.spec.ts --reporter=line`: PASS, 8 tests.
- `npx playwright test tests/e2e/ot-39/crm-privacy-usability.spec.ts tests/accessibility/ot-39/crm-a11y.spec.ts tests/performance/ot-39/crm-performance.spec.ts tests/performance/public-performance.spec.ts --reporter=line`: PASS, 12 tests.
- `npx playwright test tests/performance/ot-39/crm-performance.spec.ts --reporter=line`: PASS, 1 test; regenerated corrected 30-sample OT-39 performance evidence.
- `npx vitest run --config vitest.integration.config.ts tests/integration/auth-crm.test.ts`: PASS, 10 tests.
- `npx prettier --check apps/web/src/client/app/crm-entry.tsx apps/web/src/client/app/crm.css apps/web/src/client/app/shell/AppShell.tsx playwright.config.ts tests/accessibility/ot-35/app-shell-a11y.spec.ts tests/e2e/ot-35/app-shell-crm.spec.ts tests/performance/ot-35/crm-performance.spec.ts`: PASS.
- `git diff --check`: PASS.

## OT-42 CRM Module

- `npx vitest run tests/unit/ot42-cache.test.ts tests/unit/ot42-capabilities.test.ts tests/integration/ot42-router.test.ts`: PASS, 11 tests.
- `npm run typecheck`: PASS.
- `npm run build`: PASS.
- `npx vitest run --config vitest.integration.config.ts tests/integration/auth-crm.test.ts`: PASS, 10 tests.
- `node -e "JSON.parse(...)"`: PASS for `STATE.json` and `CANONICAL-CANDIDATE.json`.
- `npx prettier --check <OT-42 and OT-60R touched files>`: PASS.
- `git diff --check`: PASS.
- `npm run secret:scan`: PASS across 145 repo text files.

Note: OT-42 was integrated as an additive, unmounted module surface. The focused router tests exercise injected repositories/guards; live `/api/v1/crm/*` routes remain the canonical PR #2/#5/#7 routes until a later lane wires concrete repository implementations safely.

## OT-36 / OT-40 Delivery And OT-44 Communications

- `npm run typecheck`: PASS.
- `npx vitest run tests/unit/delivery/config.test.ts tests/unit/delivery/eligibility.test.ts tests/unit/delivery/loop.test.ts tests/unit/delivery/retry.test.ts tests/unit/delivery/worker.test.ts tests/unit/communications/communications-contract.test.ts tests/integration/communications/api.test.ts tests/integration/delivery/outbox-pipeline.test.ts tests/integration/delivery/web-app-independence.test.ts tests/integration/lead-capture.test.ts`: PASS, 74 tests across 10 files.
- `npm run build`: PASS. Communications emitted as lazy `app-CommunicationsFeature` JS/CSS chunks; typecheck completed.
- `npx playwright test tests/e2e/ot-44/communications-descriptor.spec.ts tests/accessibility/ot-44/communications-accessibility.spec.ts tests/performance/ot-44/communications-performance.spec.ts --reporter=line`: PASS, 4 tests.
- `npx vitest run --config vitest.integration.config.ts tests/integration/auth-crm.test.ts`: PASS, 10 tests.
- `npx playwright test tests/e2e/ot-39/crm-privacy-usability.spec.ts tests/accessibility/ot-39/crm-a11y.spec.ts tests/performance/ot-39/crm-performance.spec.ts tests/performance/public-performance.spec.ts --reporter=line`: PASS, 12 tests.
- `npx vitest run tests/integration/delivery/postgres-repository.test.ts`: PASS, 3 tests.
- `node -e "JSON.parse(...)"`: PASS for `STATE.json`, `CANONICAL-CANDIDATE.json`, and `ops/evidence/ot-44/INTEGRATION-MANIFEST.json`.
- `npx prettier --check <delivery/communications and OT-60R touched files>`: PASS.
- `git diff --check`: PASS.
- `npm run secret:scan`: PASS across 206 repo text files.

Real disposable PostgreSQL plan proof remains pending for the later PR #6 assurance lane.

## OT-46 Fixture-Only Billing

- `npx vitest run tests/unit/ot46-billing-config-policy.test.ts tests/integration/ot46-billing-services.test.ts`: PASS, 26 tests across 2 files.
- `npm run typecheck`: PASS.
- `npm run build`: PASS. Billing remains isolated/unmounted and did not add a public/app bundle chunk.
- `node -e "JSON.parse(...)"`: PASS for `STATE.json` and `CANONICAL-CANDIDATE.json`.
- `npx prettier --check <OT-46 and OT-60R touched files>`: PASS.
- `git diff --check`: PASS.
- `npm run secret:scan`: PASS across 234 repo text files.

Real PostgreSQL 16 proof remains pending; production database use and live Stripe calls remain forbidden.

## Supersession Security Port

- `npm ci`: PASS; 348 packages installed from lockfile and npm reported 0 vulnerabilities.
- `npm run typecheck`: PASS.
- `npx prettier --check <touched supported files>`: PASS. `.env.example` is excluded because Prettier cannot infer a parser for that extension.
- `npm run secret:scan`: PASS across 131 repo text files.
- `npx vitest run --config vitest.integration.config.ts tests/integration/auth-crm.test.ts`: PASS, 10 tests.

Full unit, full integration, full-repo E2E, and PostgreSQL assurance remain pending for later integration checkpoints.
