# OPS-10 Resume

Run ID: `OPS-10-full-staged-production-launch-2026-07-17`

Repository: `webcraft-media/onetimev2`

Worktree: `C:\Users\User\.ops10-20260717-worktrees\20260717T050800Z`

Branch: `release/ops10-full-staged-production-launch-20260717T050800Z`

Initial base: `origin/integration/ops08-overnight-final-20260716T230543Z`
at `4e907992d8c7312a02e75dc879a5b5030f2b5942`.

## Current Phase

`phase_6_candidate_ci_and_predeploy_readiness`

## Completed

- OPS-10 ZIP selected, extracted, and validated by the BNA conductor.
- Raw packet preserved as `RAW-20260717-002`.
- Clean external One Time worktree and release branch created.
- Original prompt copied to `ops/codex-runs/OPS-10/ORIGINAL-PROMPT.md`.
- Initial `STATE.json` and this resume file created.
- Initial scaffold committed and pushed as `04f0a6d2e974c8ac6e8feabd700becad7e4c2099`.
- Remote heads, PR #60/#59 state, production identity, and staging identity captured in `INPUTS.json`.
- Candidate capability readiness captured in `CAPABILITY-MATRIX.json`.
- Conflict and blocker state captured in `CONFLICT-LEDGER.md`.
- PR #60 Prettier failures repaired in the exact three files named by CI.
- OPS-06 load/backpressure cleanup race repaired with guarded rollback, expected shutdown classification, pool error capture, and safe pool shutdown.
- Local gates recorded in `LOCAL-GATES.md`.
- Draft PR #61 opened against `main` to trigger pull-request CI and Postgres gates.
- PR #61 first OPS-06 run failed only `concurrent_signup_idempotency`: 12 participants, 8 fulfilled, 4 rejected, 1 persisted contact.
- Public lead capture now takes a transaction-scoped advisory lock on `(account_key, product_key, idempotency_key)` before checking/storing idempotency state, so concurrent duplicate submissions replay the stored response instead of racing the final insert.
- PR #61 rerun on `a158c555835815d1d16d953624dc1ddb9995aee3` passed OPS-06, OT-37, OT-75, and OT-83; Node 24 verify was still in progress at the time of the OT-114 local merge.
- OT-107 was reviewed against its merge-base delta. The release candidate already contains the student helper implementation, run folder, and newer migration assertions; the remaining branch tail was not applied because it would weaken newer tests.
- OT-114 was merged locally. The only conflict was the domain import list in `apps/web/src/server/app.ts`; the resolution keeps OPS-10 email step-up login helpers and OT-114 CRM/support reply helpers.
- OT-114 semantic merge was committed and pushed as `a058455705a91308ff2311aa1809540c83163abd`.
- PR #61 on `a058455705a91308ff2311aa1809540c83163abd` has passed OPS-06 deterministic, OT-37 PostgreSQL assurance, OT-75 static readiness, and OT-83 learner-seat proof. Node 24 verify is still in progress.
- Railway readback was collected without printing secrets or raw database URLs. Staging web/worker currently use `ot99-pg16`; production web currently uses `Postgres-j9Pi`, proven by short hash comparison only.
- OT-114 migration was renumbered from `2010_ot114_crm_communications_support` to `2016_ot114_crm_communications_support` to remove the OPS-03B `2010_*` namespace collision.
- Focused migration/auth CRM integration tests passed after the renumber.
- OPS-10 draft handoff artifacts now exist for decisions, migration plan, backup/restore, rollback, provider canaries, visual acceptance, performance, mutation ledger, and final report.

## Local Gate Snapshot

- Passed: `npm ci`, targeted Prettier check, `git diff --check`, `npm run typecheck`, `npm run lint`, `npm run secret:scan`, OPS-06 focused vitest, `npm run ops06:alerts`, and `npm run ops06:migrations`.
- After the idempotency repair, also passed focused lead tests, OPS-06 focused tests, lint, typecheck, secret scan, and `npm run build`.
- After the OT-114 merge, passed OT-114 unit/integration tests, OT-107 unit/e2e tests, lint, typecheck, secret scan, brand check, build, targeted Prettier, OT-114 browser e2e, and OT-114 accessibility/performance tests.
- Blocked locally: Postgres 16 load/restore because Docker, `pg_isready`, and `psql` are unavailable on this machine.
- Blocked locally: native production backup/restore because `pg_dump` and `pg_restore` are unavailable, and Railway SSH is unavailable without registering a Railway SSH key.
- Noisy but not authoritative locally: full `npm run format` reports Windows line-ending normalization across hundreds of unchanged files. The known Linux CI offenders were fixed and targeted-clean.

## Live Observation

- Production `https://join.onetimeonetime.com` is still old commit `050170d3ce5e9d0ea8e0db5ca0fa96b369bff0b5` and returns `Cannot GET /login`.
- Staging `https://ot99-web-staging.up.railway.app` is still `ops03a-fb5f5ee` / `fb5f5eebc539afc9e93833e9417ee67524d62c36`.
- Current staging Railway rollback IDs: web deployment `9efd2fc9-75c5-4455-b5bc-0bb16b85d3a2`, worker deployment `0df0b354-6453-457b-b65b-43394601a6c7`, DB service `ot99-pg16`.
- Current production Railway rollback IDs: web deployment `15280d13-3e12-4c72-8460-10e0c6e99b3e`, delivery cron deployment `387e2e49-2055-43c8-86f4-de11f0e60b59`, DB service `Postgres-j9Pi`.
- Production web's current DB service is Railway Postgres 18. OPS-10 requires a PostgreSQL 16-compatible production path before promotion.

## Next Safe Action

Push the current branch head, then continue after PR #61 completes on the new head:

- create/update the required OPS-10 handoff artifacts: `DECISIONS.md`, `MIGRATION-PLAN.md`, `BACKUP-RESTORE.md`, `ROLLBACK.md`, `PROVIDER-CANARIES.json`, `VISUAL-ACCEPTANCE.md`, `PERFORMANCE.json`, `MUTATION-LEDGER.json`, and `FINAL-REPORT.md`;
- use GitHub Actions as authoritative OPS-06 load/restore proof unless disposable local Postgres 16 credentials are provided;
- only after green gates and required backup/restore plus rollback proof, create immutable staging deployment and smoke `/login`, `/forgot-password`, `/activate`, `/reset-password`, owner/admin CRM/dashboard, parent/student portals, content workspace, and lead capture.

## Do Not Do Yet

- Do not deploy staging or production until candidate integration, local gates,
  backup/restore, and rollback proof are complete.
- Do not send activation/reset email until production auth routes pass.
- Do not run DNS changes, broad sends, live Stripe charges, live Buffer
  publication, production imports, public Zoom mutations, destructive DB
  operations, force-pushes, or credential disclosure.
