# W12-100-12 Resume

Branch: `codex/w12-100-12-supply-chain-audit`

Worktree:
`C:\Users\User\.w12-100-20260717-worktrees\W12-100-12`

Base commit:
`0d8d7168f066668f035176d777bdaaa4dcc5accd`

## What Changed

- Added `scripts/w12-100/supply-chain/inventory.ts`, a read-only deterministic
  inventory generator for npm lockfile state, workflows, Docker/Railway files,
  env-name drift, license exposure, binary evidence growth, vulnerability report
  summaries, and supply-chain findings.
- Added `tests/unit/w12-100-supply-chain-inventory.test.ts`.
- Added W12-100-12 evidence and closeout files under
  `ops/codex-runs/W12-100-12/`.

## Current Findings To Carry Forward

- Pin GitHub Actions to full-length reviewed SHAs in a workflow-hardening
  branch.
- Pin Docker/Railway base images to reviewed sha256 digests in a Docker
  reproducibility branch.
- Decide how to produce SBOMs: npm currently fails with `EINVALIDPURLTYPE` for
  versionless workspace package entries.
- Verify GitHub branch protection settings outside repo-local files.
- Review runtime dependency minimization: `tsx` is required by runtime start
  paths but is a devDependency; `@vitejs/plugin-react` appears in runtime
  dependencies.
- Review `.env.example` drift before launch.

## Safety State

No deploys, provider sends, provider mutations, external helper requests,
production database reads, or production database writes were performed.

External actions: 0. Production mutations: 0.
