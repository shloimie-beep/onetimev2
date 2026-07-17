# OPS-10 Resume

Run ID: `OPS-10-full-staged-production-launch-2026-07-17`

Repository: `webcraft-media/onetimev2`

Worktree: `C:\Users\User\.ops10-20260717-worktrees\20260717T050800Z`

Branch: `release/ops10-full-staged-production-launch-20260717T050800Z`

Initial base: `origin/integration/ops08-overnight-final-20260716T230543Z`
at `4e907992d8c7312a02e75dc879a5b5030f2b5942`.

## Current Phase

`phase_0_initial_checkpoint`

## Completed

- OPS-10 ZIP selected, extracted, and validated by the BNA conductor.
- Raw packet preserved as `RAW-20260717-002`.
- Clean external One Time worktree and release branch created.
- Original prompt copied to `ops/codex-runs/OPS-10/ORIGINAL-PROMPT.md`.
- Initial `STATE.json` and this resume file created.

## Next Safe Action

Commit and push this scaffold, then run Phase 1 discovery:

- fetch all remotes and PR metadata;
- verify production/staging `/version`, `/health`, `/ready`;
- discover Railway production/staging deployment identities;
- freeze candidate inputs into `INPUTS.json`;
- write `CAPABILITY-MATRIX.json` and `CONFLICT-LEDGER.md`.

## Do Not Do Yet

- Do not deploy staging or production until candidate integration, local gates,
  backup/restore, and rollback proof are complete.
- Do not send activation/reset email until production auth routes pass.
- Do not run DNS changes, broad sends, live Stripe charges, live Buffer
  publication, production imports, public Zoom mutations, destructive DB
  operations, force-pushes, or credential disclosure.
