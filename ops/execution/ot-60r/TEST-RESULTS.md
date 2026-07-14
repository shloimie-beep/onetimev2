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
- `npx vitest run --config vitest.integration.config.ts tests/integration/auth-crm.test.ts`: PASS, 10 tests.
- `npx prettier --check apps/web/src/client/app/crm-entry.tsx apps/web/src/client/app/crm.css apps/web/src/client/app/shell/AppShell.tsx playwright.config.ts tests/accessibility/ot-35/app-shell-a11y.spec.ts tests/e2e/ot-35/app-shell-crm.spec.ts tests/performance/ot-35/crm-performance.spec.ts`: PASS.
- `git diff --check`: PASS.

## Supersession Security Port

- `npm ci`: PASS; 348 packages installed from lockfile and npm reported 0 vulnerabilities.
- `npm run typecheck`: PASS.
- `npx prettier --check <touched supported files>`: PASS. `.env.example` is excluded because Prettier cannot infer a parser for that extension.
- `npm run secret:scan`: PASS across 124 repo text files.
- `npx vitest run --config vitest.integration.config.ts tests/integration/auth-crm.test.ts`: PASS, 10 tests.

Full unit, full integration, full-repo E2E, and PostgreSQL assurance remain pending for later integration checkpoints.
