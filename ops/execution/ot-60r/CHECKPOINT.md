# OT-60R Checkpoint

## Current State

- Repository: `webcraft-media/onetimev2`
- Worktree: `C:\Users\User\OneTimeOneTime-ot60r-recovery-convergence`
- Branch: `codex/ot60r-recovery-convergence`
- Base: `4ac288968ba24e30a5c3f8c6924f492eedf4338f`
- Phase: PR #5 / OT-35 authenticated shell integrated
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

## Last Safe Command

```powershell
npx vitest run --config vitest.integration.config.ts tests/integration/auth-crm.test.ts
```

## Next Safe Command

```powershell
git cherry-pick --no-commit c1584577780d7b5125bce4fb81d2a454c9e84096
```

Continue PR #7 / OT-39 CRM privacy/performance integration. Resolve semantically against the current canonical auth/search/session model.

Do not deploy, mutate providers, use production databases, send messages, charge payments, modify DNS, create real users, or modify the BNA repository.
