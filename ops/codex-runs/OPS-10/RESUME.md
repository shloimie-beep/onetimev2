# OPS-10 Resume

Run ID: `OPS-10-full-staged-production-launch-2026-07-17`

Repository: `webcraft-media/onetimev2`

Worktree: `C:\Users\User\.ops10-20260717-worktrees\20260717T050800Z`

Branch: `release/ops10-full-staged-production-launch-20260717T050800Z`

Initial base: `origin/integration/ops08-overnight-final-20260716T230543Z`
at `4e907992d8c7312a02e75dc879a5b5030f2b5942`.

## Current Phase

`phase_1_release_graph_and_known_ci_repairs`

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

## Local Gate Snapshot

- Passed: `npm ci`, targeted Prettier check, `git diff --check`, `npm run typecheck`, `npm run lint`, `npm run secret:scan`, OPS-06 focused vitest, `npm run ops06:alerts`, and `npm run ops06:migrations`.
- Blocked locally: Postgres 16 load/restore because Docker, `pg_isready`, and `psql` are unavailable on this machine.
- Noisy but not authoritative locally: full `npm run format` reports Windows line-ending normalization across hundreds of unchanged files. The known Linux CI offenders were fixed and targeted-clean.

## Live Observation

- Production `https://join.onetimeonetime.com` is still old commit `050170d3ce5e9d0ea8e0db5ca0fa96b369bff0b5` and returns `Cannot GET /login`.
- Staging `https://ot99-web-staging.up.railway.app` is still `ops03a-fb5f5ee` / `fb5f5eebc539afc9e93833e9417ee67524d62c36`.

## Next Safe Action

Commit and push the Phase 1 repair/discovery checkpoint, then continue semantic convergence:

- inspect OT-107 student helper delta against the frozen candidate;
- inspect and integrate or explicitly block OT-114 CRM communications/support;
- run build/unit/integration/e2e/a11y/performance gates as feasible;
- use GitHub Actions as authoritative OPS-06 load/restore proof unless disposable local Postgres 16 credentials are provided;
- only after green gates, create immutable staging deployment and smoke `/login`, `/forgot-password`, `/activate`, `/reset-password`, owner/admin CRM/dashboard, parent/student portals, content workspace, and lead capture.

## Do Not Do Yet

- Do not deploy staging or production until candidate integration, local gates,
  backup/restore, and rollback proof are complete.
- Do not send activation/reset email until production auth routes pass.
- Do not run DNS changes, broad sends, live Stripe charges, live Buffer
  publication, production imports, public Zoom mutations, destructive DB
  operations, force-pushes, or credential disclosure.
