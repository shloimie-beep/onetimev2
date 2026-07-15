# OT-82 Resume

## Current State

Status: `review_ready_with_inherited_format_blocker`

Current phase: `closeout`

Repository: `webcraft-media/onetimev2`

Product worktree: `C:\Users\User\.codex\worktrees\webcraft-media-onetimev2\ot82-brand-system-foundation`

Dependency branch: `codex/ot81-dayone-certification-staging`

Resolved dependency SHA: `ff23c9af0c3e3de18cd991097eb6e66032b11546`

Product branch: `codex/ot82-brand-system-foundation`

## Completed Action

- Verified packet digests before repository work.
- Created isolated external product worktree from the dependency head.
- Committed and pushed initial repository-backed run state.
- Added canonical One Time brand-system package.
- Migrated public/static, CRM, portal, communications, billing, and audience route styling to canonical package sources.
- Removed portal runtime CSS injection.
- Migrated AppShell to canonical React primitives.
- Added brand drift checks, unit tests, focused browser visual tests, and OT82 evidence files.
- Fixed protected app HTML delivery for CRM/owner/parent/student app shells.

## Validation Summary

Passing:

- `npm ci`
- `npm run build`
- `npm run brand:check`
- `npm run lint`
- `npm run typecheck`
- `npm run unit`
- `npm run integration`
- `npm run e2e`
- `npm run accessibility`
- `npm run performance` on final rerun
- `npm run secret:scan`
- scoped changed-file Prettier check
- `git diff --check`
- `npx tsx scripts/check-bundles.ts`

Blocked:

- Full `npm run format` fails inherited non-OT82 base files. Do not mark the run fully certified until that repo-level format debt is resolved or the format contract is narrowed.

## Safe Resume Procedure

1. Open `C:\Users\User\.codex\worktrees\webcraft-media-onetimev2\ot82-brand-system-foundation`.
2. Run `git fetch origin --prune`.
3. Confirm `origin/codex/ot81-dayone-certification-staging` still resolves.
4. Confirm this worktree is on `codex/ot82-brand-system-foundation`.
5. Inspect `ops/codex-runs/OT-82/STATE.json`.
6. If resuming before PR closeout, commit/push the branch and open the stacked draft PR against `codex/ot81-dayone-certification-staging`.
7. Do not deploy, mutate Railway/DNS/provider/production data, send real messages, use BNA assets, hard reset, clean unrelated work, or force-push.
