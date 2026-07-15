# OT-82 Resume

## Current State

Status: `initialized`

Current phase: `baseline_audit`

Repository: `webcraft-media/onetimev2`

Verified source checkout: `C:\Users\User\OneTimeOneTime`

Product worktree: `C:\Users\User\.codex\worktrees\webcraft-media-onetimev2\ot82-brand-system-foundation`

Dependency branch: `codex/ot81-dayone-certification-staging`

Resolved dependency SHA: `ff23c9af0c3e3de18cd991097eb6e66032b11546`

Product branch: `codex/ot82-brand-system-foundation`

Current commit: `ff23c9af0c3e3de18cd991097eb6e66032b11546`

## Completed Action

- Verified packet digests before repository work.
- Verified source checkout origin as `https://github.com/webcraft-media/onetimev2.git`.
- Fetched origin and resolved the exact dependency ref.
- Created external product worktree from the dependency head.
- Copied the complete packet to `ops/codex-runs/OT-82/packet/`.
- Wrote initial run-state files under `ops/codex-runs/OT-82/`.

## Next Action

Commit this initialization with:

```bash
git status --short
git add ops/codex-runs/OT-82
git commit -m "chore(ot82): initialize repository-backed run state"
git push -u origin codex/ot82-brand-system-foundation
```

Then perform the read-before-write audit before any product source edits.

## Required Validation Commands

Run after implementation phases, recording exit codes and evidence:

```bash
npm ci
npm run build
npm run brand:check
npm run lint
npm run typecheck
npm run unit
npm run integration
npm run e2e
npm run accessibility
npm run performance
npm run secret:scan
npm run format -- --check
git diff --check
```

## Safe Resume Procedure

1. Open `C:\Users\User\.codex\worktrees\webcraft-media-onetimev2\ot82-brand-system-foundation`.
2. Run `git fetch origin --prune`.
3. Confirm `origin/codex/ot81-dayone-certification-staging` still resolves.
4. Confirm this worktree is on `codex/ot82-brand-system-foundation`.
5. Inspect `ops/codex-runs/OT-82/STATE.json` and continue from `current_phase`.
6. Do not deploy, mutate Railway/DNS/provider/production data, send real messages, use BNA assets, hard reset, clean unrelated work, or force-push.

