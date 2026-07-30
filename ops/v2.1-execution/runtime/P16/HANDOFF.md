# P16 Classroom Repository Weekday-Encoding Atomic Claim

## Identity

- Branch: `codex/v21-p16-class-series-occurrences`
- Start SHA: `01cdb992660a1fbc20b204b829d28062fd044679`
- Exact resume head before this claim: `c58ed7d65f46783717901512d249202b2ec46614`
- Last committed implementation SHA: `07475dd776f046f238061217ebc63ed9320c54c8`
- Interface metadata SHA: `418ffcc5cbf78643b40b89dbc5da64ea04806f6e`
- Current handoff commit: derive with `git rev-parse HEAD`; C00 records the observed remote head
- Task packet digest: `a2ba86653705892d62ad19fddcf14a5c519ffb3c6f130d3919de0f5a971f427e`
- Context digest: `1df1eaa480ed68aa93538ae2dbd8a52864bbe728248f79b20b54e2de4b5e95a0`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Resume claim: `ebdca6e9-aa5b-411b-88fd-747089e869ce`
- CLASSROOM_CORE lease: `8c250e39-5c4d-4684-93ba-2ff373a1253a`, issued `2026-07-30T01:01:25Z` and expiring `2026-07-30T02:31:25Z`
- Containing control authorization: `27100588cff40879024c88e11213864a1245741a`
- Sole control/acquisition parent: `a84c647b2926b782b4b9b4289389d8584293ebbe`
- Ready payload digest: `bfbe5b37da8dd4e6acb36c5d57ea68a365d81fae50a95c53bb738e7e07c70be5`
- Canonical control-state digest: `c54becb37cc4bb37236c2efa0b2944ea70739a5d0c05ff667cec215d015c29ae`
- Implementation artifact digest: `e84eb12e42832288446f756e1933dc887be37839440d738f156373d25ab62b7d`
- Interface contract digest: `95c177d54a429dbcba604d9903c0edcb9aa6051f73e168f853d2b8fd4e377d68`
- Interface state/handoff digest: `afd57cbd0cc837caf6b6b007a61269f676f99ee1ea2d7d4edd7f2da65d31714e`
- Steward-request digest: `628fe0cb860057b6dde8b5e214edfe00400ca8f701459993e099e6f923fd34cb`

## Completed behavior

Verified the exact corrected resume authorization, sole acquisition parent,
remote head, canonical READY and control-state digests, fresh claim, sole
CLASSROOM_CORE lease, rejected semantic gates, empty effect locks, and effects
`0/0/0`. This checkpoint changes only the P16 runtime triplet. All product,
test, interface, steward-request, migration, and registration bytes are
preserved.

## Remaining work

C00 must reconcile the exact pushed atomic claim before any bounded correction.
After reconciliation, P16 may change only its owned repository weekday
encode/decode boundary, its direct test, and runtime evidence.

## Exact next action

Stop after publishing this exact triplet-only claim. Await C00 reconciliation;
do not implement the correction from this checkpoint.

## Coverage

- Requirements: prior implementation remains preserved; weekday correction not started.
- Acceptance cases: prior evidence remains preserved; encode/decode proof not started.

## Changed files and migrations

This claim changes only `TASK-STATE.yaml`, `HANDOFF.md`, and `NEXT-PROMPT.md`.
No product, test, migration, registration, interface, steward-request, control,
integration, provider, deployment, or send path changed.

## Verification

Exact control/acquisition, registry/READY, branch, claim/lease, package/task/
context, effect-lock, and effect bindings pass. The canonical READY preimage is
3,006 bytes with digest `bfbe5b37…`; the acquisition-parent control-state
preimage is 1,619 bytes with digest `c54becb3…`. Exact triplet-only scope and
diff hygiene pass.

## External effects

Authority is `none`; attempted 0, succeeded 0, reconciled 0.

## Security, privacy, and data handling

No secret, child data, provider record, enrollment mutation, or live effect was
accessed or attempted.

## Blockers, deviations, and recovery

C00 reconciliation of the exact pushed claim is required before product or test
work resumes. After reconciliation, preserve the public/domain `0..6`
convention, encode Sunday `0` as database `7` on write, decode database `7`
back to Sunday `0` on read without reordering, reject malformed weekday sets,
and prove the canonical Sunday-through-Thursday roundtrip natively through
migration 2239.
