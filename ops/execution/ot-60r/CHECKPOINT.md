# OT-60R Checkpoint

## Current State

- Repository: `webcraft-media/onetimev2`
- Worktree: `C:\Users\User\OneTimeOneTime-ot60r-recovery-convergence`
- Branch: `codex/ot60r-recovery-convergence`
- Base: `4ac288968ba24e30a5c3f8c6924f492eedf4338f`
- Phase: PR #6 / OT-37 PostgreSQL assurance harness verified
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
- Committed the PR #7 / OT-39 CRM privacy/performance checkpoint at `46d5c6819c232ad1845c437752e9e2622feeefee`.
- Cherry-picked PR #11 / OT-42 without merge conflicts.
- Kept OT-42 additive and unmounted from live CRM routes because it provides abstract router/register hooks and tests, not concrete production repository implementations.
- Verified with OT-42 focused unit/integration tests, `npm run typecheck`, `npm run build`, the focused auth/CRM regression suite, formatting check, JSON parse check, `git diff --check`, and `npm run secret:scan`.
- Committed the PR #11 / OT-42 CRM module checkpoint at `8520fa15f30c889cafbf8d5ff4c0c21de37bd371`.
- Applied PR #4 / OT-36 delivery foundation range in commit order, then PR #8 / OT-40 delivery correction.
- Applied PR #14 / OT-44 communications read model after the delivery lineage.
- Bound OT-44 into the shared app with a read-only session scope resolver, mounted `/app/communications`, `/api/v1/communications`, and `/api/v1/crm/contacts/:contactId/communications`, and added lazy Communications navigation/contact view wiring to the CRM shell.
- Verified with focused delivery/communications Vitest suites, `npm run build`, focused auth/CRM regression, OT-44 browser checks, OT-39 browser regression, delivery repository contract tests, formatting check, JSON parse check, `git diff --check`, and `npm run secret:scan`.
- Committed the PR #4/#8/#14 delivery and communications checkpoint at `3a9772439b5fbd1a1fd0969406d2d2033bef90a0`.
- Applied PR #12 / OT-46 fixture-only billing foundation as an isolated, unmounted module.
- Preserved default-off billing flags, fixture-only provider adapter, no Stripe SDK/network calls, no provider mutations, and no entitlement/access grants.
- Verified with OT-46 focused unit/integration tests, `npm run typecheck`, `npm run build`, formatting check, JSON parse check, `git diff --check`, and `npm run secret:scan`.
- Committed the PR #12 / OT-46 fixture-only billing checkpoint at `e004161af0f7ef1873fe4b7b3e5a4b109d79b54a`.
- Applied PR #15 / OT-52 parent/student portals as an isolated, unmounted module.
- Preserved household-authorized parent scope, actor-derived student scope, three-active-learner limit, append-only rewards, digest-only credentials, default-unavailable helper behavior, no-send support preview, and protected-action provider URL rejection.
- Verified with OT-52 focused router/service/UI tests, `npm run typecheck`, `npm run build`, touched-file formatting check, JSON parse check, `git diff --check --cached`, and `npm run secret:scan`.
- Committed the PR #15 / OT-52 portal checkpoint at `30df628f4eca6be2674dcdd0d59fd2e769af89da`.
- Applied PR #13 / OT-51 Telegram mock/default-off foundation as an isolated module.
- Preserved mock-only transport, default-deny identity, injected application adapter boundary, no central runtime wiring, no webhook registration, no polling activation, and zero Telegram network/provider mutations.
- Verified with OT-51 focused unit/integration tests, `npm run typecheck`, `npm run build`, touched-file formatting check, `git diff --check --cached`, and `npm run secret:scan`.
- Committed the PR #13 / OT-51 Telegram mock foundation checkpoint at `f880c6abfacea6fa00cefa3383515ae31b914006`.
- Applied PR #6 / OT-37 PostgreSQL assurance harness and adapted it for the OT-60R integrated migration stack.
- Added `codex/ot60r-recovery-convergence` to the PostgreSQL 16 workflow trigger, scoped the workflow format step to OT-37 files, updated harness task metadata to the OT-60R base, and recorded the local desktop PostgreSQL blocker.
- Verified with `npm run typecheck`, `npm run lint`, `npm run build`, scoped OT-37 formatting check, `git diff --check`, and `npm run secret:scan`.
- Local `npx tsx scripts/postgres-assurance/run.ts` is blocked by absent local PostgreSQL/Docker/psql/service/env; disposable PostgreSQL proof is expected from GitHub Actions after push.
- Committed the PR #6 / OT-37 PostgreSQL assurance checkpoint at `e97f6de55b050605a96d64eac07c58b753ea2976`.
- Fixed the OT-37 synthetic scale seed to include canonical `public_contact_id` values after the accepted PR #2 migration made the column required.
- GitHub Actions run `29377668001` passed the OT-37 PostgreSQL 16 assurance workflow, including the harness, secret scan, scoped format, lint, typecheck, and sanitized artifact upload.
- Downloaded sanitized reports to `ops/evidence/ot-37/ci-run-29377668001/`.

## Last Safe Command

```powershell
npm run secret:scan
```

## Next Safe Command

```powershell
git show --stat --oneline --decorate --no-renames 9444176dbc55e0c5af048ec1df2ea75ffa8dde33
```

Continue PR #10 / OT-47 evidence-only handling. Do not claim content/library implementation unless a real implementation exists in this branch.

Do not deploy, mutate providers, use production databases, send messages, charge payments, modify DNS, create real users, or modify the BNA repository.
