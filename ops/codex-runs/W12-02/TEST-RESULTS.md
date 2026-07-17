# W12-02 Test Results

Base SHA: `c7d46066517d7a458d189f2c782cc06200f7861c`.

Passed:

- `npm ci`
- `npm run typecheck`
- `npx vitest run --config vitest.unit.config.ts tests/unit/communications/communications-contract.test.ts`
- `npx vitest run --config vitest.integration.config.ts tests/integration/communications/api.test.ts tests/integration/communications/repository.test.ts`
- `npx tsx -e "import { createMemoryPool, runMigrations } from './packages/db/src/index.ts'; (async () => { const pool = createMemoryPool(); const result = await runMigrations(pool); console.log(JSON.stringify({ applied: result.length, last: result.at(-1) }, null, 2)); await pool.end(); })();"`
- `npm run brand:check`
- `npm run lint`
- `npm run secret:scan`
- `npx prettier --check --ignore-unknown ...`
- `npx playwright test tests/accessibility/ot-44/communications-accessibility.spec.ts`
- `npx playwright test tests/performance/ot-44/communications-performance.spec.ts`
- `npx playwright test tests/e2e/ot-44/communications-descriptor.spec.ts`
- `npm run build`
- `git diff --check`
- `npx tsx scripts/w12-02-communication-backfill-dry-run.ts --provider resend`
- `npx tsx scripts/w12-02-communication-backfill-dry-run.ts`

Notes:

- A first parallel Playwright attempt for accessibility failed with `EADDRINUSE`
  because the performance spec was using the same configured port. The
  accessibility spec passed when rerun alone.
- `git diff --check` passed with line-ending warnings only.
- The migration runner applied `2200_w12_02_communication_history` in pg-mem with
  checksum `67749db9cfd9eababed913852303a0b4572cec4475a96b07681aad7274a776c6`.
