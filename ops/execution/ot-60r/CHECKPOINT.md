# OT-60R Checkpoint

## Current State

- Repository: `webcraft-media/onetimev2`
- Worktree: `C:\Users\User\OneTimeOneTime-ot60r-recovery-convergence`
- Branch: `codex/ot60r-recovery-convergence`
- Base: `4ac288968ba24e30a5c3f8c6924f492eedf4338f`
- Phase: PR #7 / OT-39 CRM privacy/performance integrated
- Status: building

## Completed

- Located a clean standalone One Time clone.
- Verified the origin URL exactly matches `https://github.com/webcraft-media/onetimev2.git`.
- Fetched `origin`.
- Verified `origin/codex/crm-core-v1` points to the requested base SHA.
- Verified required ancestor relationships.
- Created a fresh worktree and branch from the immutable base.
- Preserved the full received prompt in `ORIGINAL-PROMPT.md`.
- Committed and pushed initial protocol checkpoint at `5a3071cd8cb061ef4e58a59ed11760dec87a4203`.
- Saved sanitized PR metadata under `ops/evidence/ot-60r/remote-pr-json/`.
- Recorded remote state, migration checksums, overlap matrix, and supersession matrix.
- Ported only PR #9's missing HMAC-derived login-CSRF proof into the canonical PR #2 base.
- Committed and pushed the supersession security port checkpoint at `49272a7de7d774db665f85f804da7d07bcec45ee`.
- Cherry-picked PR #5 / OT-35 and resolved the CRM shell merge against canonical PR #2 authenticated CRM behavior.
- Preserved private POST-body CRM search while adapting the shell UI to omit blank filters from submitted commands.
- Adapted OT-35 browser fixtures to the current idempotent contact-create contract.
- Raised Playwright-only login budgets to keep E2E evidence from self-throttling; production defaults remain unchanged.
- Verified with `npm run build`, focused auth/CRM integration tests, and OT-35 E2E/accessibility/performance browser specs.
- Committed the PR #5 / OT-35 authenticated shell checkpoint at `a36ebc98fc9e82ceba9a8e2806cb9da2ba6dcbdb`.
- Cherry-picked PR #7 / OT-39 and resolved conflicts in `crm-entry.tsx`, OT-35 E2E, and OT-35 performance specs.
- Preserved the canonical private POST-body CRM search endpoint while applying PR #7 privacy/performance structure.
- Preserved assignee dropdown behavior and current body `idempotency_key` create contract.
- Verified with `npm run build`, focused auth/CRM integration tests, OT-39 browser suite, and regenerated OT-39 30-sample performance evidence.

## Last Safe Command

```powershell
npx vitest run --config vitest.integration.config.ts tests/integration/auth-crm.test.ts
```

## Next Safe Command

```powershell
git cherry-pick --no-commit b2c159a060d8aa50ec6feb69f1cae003fd633bf3
```

Continue PR #11 / OT-42 CRM module integration. Resolve semantically against the current canonical auth/search/session model.

Do not deploy, mutate providers, use production databases, send messages, charge payments, modify DNS, create real users, or modify the BNA repository.
