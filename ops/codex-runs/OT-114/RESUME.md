# OT-114 Resume

Worktree: `C:\Users\User\.overnight-20260717-worktrees\OT-114`

Branch: `codex/ot114-crm-communications-support`

Base: `codex/ops03-staging-readiness-repair` at `fb5f5eebc539afc9e93833e9417ee67524d62c36`

Continue from this worktree only. Do not edit, reset, stage, or switch the main BNA checkout.

Useful verification commands:

```bash
npm run typecheck
npx vitest run --config vitest.unit.config.ts tests/unit/communications/communications-contract.test.ts tests/unit/support/ot89a-contract.test.ts tests/unit/support/ot89a-config.test.ts tests/unit/support/ot89a-attachments.test.ts
npx vitest run --config vitest.integration.config.ts tests/integration/support/ot89a-subscriber-support.test.ts tests/integration/communications/api.test.ts tests/integration/auth-crm.test.ts
npm run build
npx playwright test tests/e2e/support.spec.ts tests/e2e/crm-core.spec.ts tests/e2e/ot-35/app-shell-crm.spec.ts tests/e2e/ot-44/communications-descriptor.spec.ts
npx playwright test tests/accessibility/support-a11y.spec.ts tests/accessibility/ot-44/communications-accessibility.spec.ts tests/performance/ot-44/communications-performance.spec.ts
npm run lint
npm run secret:scan
npm run brand:check
git diff --check
```

Known local blocker:

```bash
npm run db:verify
```

This requires `DATABASE_URL`; no safe local PostgreSQL URL was configured during the run.
