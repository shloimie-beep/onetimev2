# P16 Classroom Repository Migration-Compatibility Atomic Claim

## Identity

- Branch: `codex/v21-p16-class-series-occurrences`
- Start SHA: `01cdb992660a1fbc20b204b829d28062fd044679`
- Exact resume head before this claim: `72fca16b3a9cd82c666e293f8bfd7d84c30722a1`
- Last committed implementation SHA: `46b5c39aceb6006376903750cfc268b35bbaccdd`
- Interface metadata SHA: `418ffcc5cbf78643b40b89dbc5da64ea04806f6e`
- Current handoff commit: derive with `git rev-parse HEAD`; C00 records the observed remote head
- Task packet digest: `a2ba86653705892d62ad19fddcf14a5c519ffb3c6f130d3919de0f5a971f427e`
- Context digest: `1df1eaa480ed68aa93538ae2dbd8a52864bbe728248f79b20b54e2de4b5e95a0`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Resume claim: `0a4c2e0f-6c3d-4e42-aee8-8bfd27ce5c9d`
- CLASSROOM_CORE lease: `01453191-8f65-4dcd-8559-9045599dae9b`, issued `2026-07-29T23:53:18Z` and expiring `2026-07-30T01:23:18Z`
- Containing control authorization: `9d53cf1c581dcb67e30b2beb62d048a1839f23e2`
- Sole acquisition parent: `a6bc58cc4a35173fd1606124c0fa651dda2dac64`
- Ready payload digest: `5a7d1bebc22b55cf415ad4cea51131aee21c880c09792c3c8bd4c064104bf675`
- Implementation artifact digest: `1fb4658cf45b75fb99b009dad04e5d127d35ffd5c9816bf41a544dd0514e58b4`
- Interface contract digest: `95c177d54a429dbcba604d9903c0edcb9aa6051f73e168f853d2b8fd4e377d68`
- Interface state/handoff digest: `afd57cbd0cc837caf6b6b007a61269f676f99ee1ea2d7d4edd7f2da65d31714e`
- Steward-request digest: `628fe0cb860057b6dde8b5e214edfe00400ca8f701459993e099e6f923fd34cb`

## Completed behavior

Verified the exact resume authorization, remote head, canonical READY payload,
fresh claim, sole CLASSROOM_CORE lease, rejected semantic gates, empty effect
locks, and effects `0/0/0`. This checkpoint changes only the P16 runtime
triplet. All product, test, interface, and steward-request bytes are preserved.

## Remaining work

C00 must reconcile the exact pushed atomic claim before any bounded correction.
After reconciliation, P16 must persist authoritative non-null reminder timing
for every series and occurrence insert and prove those repository paths
natively after migrations through 2239.

## Exact next action

Stop after publishing this exact triplet-only claim. Await C00 reconciliation;
do not implement the correction from this checkpoint.

## Coverage

- Requirements: prior implementation remains preserved; compatibility correction not started.
- Acceptance cases: prior evidence remains preserved; native correction proof not started.

## Changed files and migrations

This claim changes only `TASK-STATE.yaml`, `HANDOFF.md`, and `NEXT-PROMPT.md`.
No product, test, migration, registration, control, integration, provider,
deployment, or send path changed.

## Verification

Exact control/acquisition, registry/READY, branch, canonical READY digest,
claim/lease, package/task/context, prior triplet, effect-lock, and effect
bindings passed.

## External effects

Authority is `none`; attempted 0, succeeded 0, reconciled 0.

## Security, privacy, and data handling

No secret, child data, provider record, enrollment mutation, or live effect was
accessed or attempted.

## Blockers, deviations, and recovery

C00 reconciliation of the exact pushed claim is required before product or test
work resumes.
