# F07 Handoff

## Identity

- Branch: `codex/v21-f07-design-system-shells`
- Start SHA: `80c281b7ae5826ed2c6abe95ba68a033ffa52174`
- Implementation SHA before this handoff metadata commit: `80c281b7ae5826ed2c6abe95ba68a033ffa52174`
- Current handoff commit: derive with `git rev-parse HEAD` after checkout; C00 records the observed remote head in `TASK-REGISTRY.yaml`.
- Task packet digest: `49f22b90f9dad8292f306513e6b1f009d3dfa489091efdc83672109018fa943b`
- Context digest: `db8e35e981fa83a06a032d425761e4cf96d5ba287f271bc922472a2b9fef6408`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Claim: `fde01134-98bf-440f-9f0b-194e8f3712ca`, held by `codex-f07-worker-fde01134`.
- Lease expiry: `2026-07-28T16:56:52Z`
- Containing control head: `af76c4e990f954794de72db639576b3c9dc73ff4`
- Ready payload digest: `d4e47e74d85994342c752c1d89287009ac48a8888cc9882781d89683cc93ce1f`

## Completed behavior

Created the isolated F07 branch from the exact F01-integrated authorization SHA. Verified the exact remote repository, control authorization, absent task branch, ready entry, claim, DESIGN_SYSTEM lease, and F01 interface checkpoint required to begin.

## Remaining work

Verify immutable package/task/context/source digests from Git blobs; inspect F07-owned design-system paths and the F01 client-router seam; then implement and verify the versioned design system, responsive shells, navigation, and interaction-state primitives.

## Exact next action

Verify immutable package/task/context/source digests from Git blob bytes, then record the F07 gap map against owned paths.

## Coverage

- Requirements: all nine assigned requirements are not started.
- Acceptance cases: all nine assigned cases are not started.

## Changed files and migrations

Seeded F07 runtime state, handoff, and next prompt only. No migration was created, deleted, or edited.

## Verification

- Repository identity, fetched control head, registry/queue identity, F01 dependency, absent F07 remote branch, claim, and lease: passed.
- Immutable checksum verification: pending Git-blob check because the local checkout has line-ending conversion.

## External effects

Authority is `none`; attempted `0`, succeeded `0`, reconciled `0`.

## Security, privacy, and data handling

No provider call, live effect, secret, customer data, child data, private question, or bearer URL was read or recorded.

## Blockers, deviations, and recovery

None.
