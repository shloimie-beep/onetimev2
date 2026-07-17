# W12-00 Base Selection

Selected base:
`c7d46066517d7a458d189f2c782cc06200f7861c`

Selected branch:
`origin/release/ops10-full-staged-production-launch-20260717T050800Z`

## Why This Base

W12-00 needed the newest remotely pushed commit that contains the exact deployed
application source plus the latest non-product release evidence.

The deployed runtime source is:

`1197673fa409bfc4c649c2683f782e86775caa5e`

Evidence:

- `ops/codex-runs/OPS-11/FINAL-REPORT.md` says production `/version` is
  `ops11-1197673`.
- `ops/codex-runs/OPS-11/STATE.json` records the same runtime source and live
  production route readbacks.
- W12-00 read `https://join.onetimeonetime.com/version` and received
  `ops11-1197673` with commit
  `1197673fa409bfc4c649c2683f782e86775caa5e`.

The release branch head is newer:

`c7d46066517d7a458d189f2c782cc06200f7861c`

The diff from runtime source to selected head contains only OPS-11 evidence and
helper scripts plus one integration test timing pin:

- `16221ba` - `chore: close OPS-11 production gate evidence`
- `c7d4606` - `test: pin OT111 canary queue time`

No newer app runtime source was selected. The selected base therefore preserves
the deployed application source while also including the latest remote release
evidence needed by a future director or fresh chat.

## PR And Checks

PR #61:
`https://github.com/webcraft-media/onetimev2/pull/61`

At W12-00 inspection time, PR #61 was an open draft against `main`, with head
`c7d46066517d7a458d189f2c782cc06200f7861c`, and these checks were successful:

- Node 24 verify
- OPS-06 deterministic checks
- PostgreSQL 18 assurance and restore clone
- PostgreSQL 16 assurance harness
- Static release readiness gates
- PostgreSQL 16 learner-seat proof

## Worktree

W12-00 used an isolated worktree:

`C:\Users\User\.w12-20260717-worktrees\W12-00`

Branch:

`codex/w12-00-canonical-director-handoff`
