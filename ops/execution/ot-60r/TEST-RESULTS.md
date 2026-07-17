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

## OT-52 Parent/Student Portals

- `npx vitest run tests/ot-52/portal-router.test.ts tests/ot-52/portal-services.test.ts tests/ot-52/portal-ui.test.ts`: PASS, 15 tests.
- `npm run typecheck`: PASS.
- `npm run build`: PASS. Portals remain isolated/unmounted and did not add a public/app bundle chunk.
- `npm run format`: FAILED as a full-repo baseline check because existing non-OT-52 files remain Prettier-noisy. Scoped OT-52 formatting/check below passed after excluding SQL, which this repo's Prettier config cannot parse.
- `npx prettier --check <OT-52 touched supported files>`: PASS.
- `git diff --check --cached`: PASS.
- `node -e "JSON.parse(...)"`: PASS for OT-52 `BROWSER-HARNESS.json` and `REAL-POSTGRES-CONCURRENCY.json`.
- `npm run secret:scan`: PASS across 265 repo text files.

Real PostgreSQL concurrency proof remains pending for a safe disposable database target; `db:verify` remains blocked without `DATABASE_URL`.

## OT-51 Telegram Mock Foundation

- `npx vitest run tests/unit/telegram/telegram-foundation.test.ts tests/integration/telegram-db-foundation.test.ts`: PASS, 11 tests.
- `npm run typecheck`: PASS.
- `npm run build`: PASS. Telegram bot remains isolated from public/app bundles and central runtime wiring.
- `npx prettier --check <OT-51 touched supported files>`: initial check failed on 11 new TypeScript files; PASS after scoped `npx prettier --write <OT-51 touched supported files>`. SQL migration excluded because this repo's Prettier config cannot parse SQL.
- `git diff --check --cached`: PASS.
- `npm run secret:scan`: PASS across 291 repo text files.

Real PostgreSQL 16 proof, bot token, webhook secret, service startup, mappings, staging canary, deploy, and rollback drill remain out of scope.

## OT-37 PostgreSQL Assurance Harness

- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npx prettier --check .github/workflows/ot37-postgres-assurance.yml ops/evidence/ot-37/LOCAL-ENVIRONMENT-BLOCKER.md ops/evidence/ot-37/README.md scripts/postgres-assurance/README.md scripts/postgres-assurance/run.ts tests/postgres-assurance/current-base-scenarios.ts`: PASS.
- `npm run build`: PASS.
- `npm run secret:scan`: PASS across 297 repo text files.
- `git diff --check`: PASS.
- `npx tsx scripts/postgres-assurance/run.ts`: BLOCKED locally by `connect ECONNREFUSED 127.0.0.1:5432`; `docker` and `psql` are not installed, no `postgresql*` service was found, and PG/DATABASE_URL environment variables are absent.
- GitHub Actions run `29377569058`: FAIL. PostgreSQL 16 harness reached the real database and found the OT-37 synthetic scale seed needed canonical `public_contact_id` values.
- GitHub Actions run `29377668001`: PASS. PostgreSQL 16 harness, secret scan, scoped format, lint, typecheck, and sanitized artifact upload completed.
- `gh run download 29377668001 -n ot37-postgres-assurance-29377668001-1 -D ops/evidence/ot-37/ci-run-29377668001`: PASS.

Passing report summary: PostgreSQL 16.14, 8 migrations discovered/applied/idempotently verified, ledger checksum match `true`, 10,600 synthetic contacts, 500 signups, 500 outbox rows, reserved-domain scan passed, external mutations all false.

## OT-47 Evidence-Only Blocker

- `npx prettier --check ops/evidence/ot-47/FINAL-REPORT.md`: PASS.
- `git diff --check --cached`: PASS.

No OT-47 product test was run because PR #10 contains evidence only and no content/library implementation is claimed.

## Final Verification

- `npm run test`: PASS, 87 unit tests and 56 integration tests.
- `npm run lint`: PASS.
- `npm run build`: PASS.
- `node -e "JSON.parse(...)"`: PASS for OT-60R state, canonical candidate control, and OT-37 PostgreSQL report.
- `git diff --check`: PASS.
- `npm run secret:scan`: PASS across 301 repo text files.
- `npm run e2e`: initial FAIL due stale pre-OT39 `crm-core.spec.ts` expectations; fixed by aligning the test with enabled private search and specific mobile focus target.
- `npm run e2e`: PASS, 16 tests.
- `npm run accessibility`: PASS, 5 tests.
- `npm run performance`: PASS, 5 tests; bundle check reported `public_js_bytes=6316`, `public_css_bytes=10626`, `crm_js_bytes=223677`.

## Supersession Security Port

- `npm ci`: PASS; 348 packages installed from lockfile and npm reported 0 vulnerabilities.
- `npm run typecheck`: PASS.
- `npx prettier --check <touched supported files>`: PASS. `.env.example` is excluded because Prettier cannot infer a parser for that extension.
- `npm run secret:scan`: PASS across 131 repo text files.
- `npx vitest run --config vitest.integration.config.ts tests/integration/auth-crm.test.ts`: PASS, 10 tests.

Full unit, full integration, full-repo E2E, and PostgreSQL assurance remain pending for later integration checkpoints.
