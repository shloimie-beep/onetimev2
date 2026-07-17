# W12-08 Test Results

## Passed

- `npm ci`
  - Installed isolated worktree dependencies.
  - Audit result: 0 vulnerabilities.
- `npm run typecheck`
  - Passed.
- `npx vitest run --config vitest.integration.config.ts tests/integration/dashboard/owner-dashboard.test.ts tests/integration/classes/class-fulfillment.test.ts`
  - Passed.
  - 2 test files, 9 tests.
- `npm run brand:check`
  - Passed.
  - Note: dist public bundle was not present, so build budgets were skipped by the checker.
- `npm run secret:scan`
  - Passed across repo text files.
- `npm run lint`
  - Passed.
- `npm run unit`
  - Passed.
  - 37 test files, 189 tests.
- `npx prettier --check <touched W12-08 files>`
  - Passed.

## Known Verification Caveat

- `npm run format` remains failing repository-wide on 830 inherited files that were already outside the W12-08 change set. The touched W12-08 files passed targeted Prettier checking.

## Not Run

- Deployment: not run.
- Provider canaries/sends/imports: not run.
- Production data mutation: not run.
