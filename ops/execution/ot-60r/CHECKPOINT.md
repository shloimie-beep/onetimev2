# OT-60R Checkpoint

## Current State

- Repository: `webcraft-media/onetimev2`
- Worktree: `C:\Users\User\OneTimeOneTime-ot60r-recovery-convergence`
- Branch: `codex/ot60r-recovery-convergence`
- Base: `4ac288968ba24e30a5c3f8c6924f492eedf4338f`
- Phase: supersession security port
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
- Verified with `npm ci`, `npm run typecheck`, and focused auth/CRM integration tests.

## Last Safe Command

```powershell
npx vitest run --config vitest.integration.config.ts tests/integration/auth-crm.test.ts
```

## Next Safe Command

```powershell
git add .env.example apps/web/src/server/app.ts packages/config/src/index.ts packages/domain/src/auth/service.ts packages/domain/src/index.ts tests/integration/auth-crm.test.ts ops/execution ops/evidence
git commit -m "fix: port OT-60R login CSRF proof"
git push
```

After that commit is pushed, continue PR #5 / OT-35 authenticated shell semantic integration.

Do not deploy, mutate providers, use production databases, send messages, charge payments, modify DNS, create real users, or modify the BNA repository.
