# F01 Handoff

## Identity

- Branch: `codex/v21-f01-foundation-seams`
- Start SHA: `ae02b193f67bf9ef04887a7b0aebb449d3fb8bc0`
- Implementation SHA before this handoff metadata commit: `ae02b193f67bf9ef04887a7b0aebb449d3fb8bc0`
- Current handoff commit: derive with `git rev-parse HEAD` after checkout; C00 records the observed remote head in `TASK-REGISTRY.yaml`
- Task packet digest: `1b857371d8d55752dca73bf129870058095306a5e50d5539d7e37d0a74124bda`
- Context digest: `5145b39c8f6ce31519ce9c23f188387a0abdfee141132deb4e4713974a1c3372`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Claim: `c18310c8-3975-4816-badd-1fa9079edc33`, held by `codex-f01-worker-4aafff01`
- Lease expiry: `2026-07-28T16:09:35Z`
- Containing control head: `e7bd7e0ab5062f8fccd78db2a4b38de03e3080ce`
- Ready payload digest: `02778740dc1c287edf20b08699ab1d83d4b1dd131026737c4a75759d90c30af2`

## Completed behavior

Verified the exact repository, fetched control authority, missing registered
remote branch, authorized start SHA, claim, unexpired leases, package and source
locks, F01 task/context digests, canonical ready-entry digest, and C00
operational dependency. Read the execution contract, F01 packet and locked
context, the current remote C00 handoff, and required runtime templates.

## Remaining work

Record the assigned-path gap map; implement stable server/client/worker and
steward-request seams; publish `interface_ready`; close explicitly retired
runtime surfaces while preserving historical migrations; complete focused
verification and publish `ready_for_review`.

## Exact next action

Inspect only the F01-owned implementation paths and named tests, record the
assigned requirement gap map, then implement the stable interface seams.

## Coverage

- Requirements: all eight assigned requirements are in progress.
- Acceptance cases: five absence/runtime cases await implementation; three
  deployment/runtime cases require later candidate-bound verification.

## Changed files and migrations

Only the three F01 runtime-memory files are changed for the atomic claim.
No migration was created, deleted, or edited.

## Verification

- Remote identity and exact control head matched.
- The remote F01 branch was absent before claim.
- `LOCKED-SHA256SUMS.txt`: 200/200 Git blobs passed.
- Canonical ready-entry digest matched.
- C00 operational control-state digest and task/context digests matched.

## External effects

Authority is `none`; attempted `0`, succeeded `0`, reconciled `0`.

## Security, privacy, and data handling

No provider call, live effect, secret, customer data, child data, private
question, or bearer URL was read or recorded.

## Blockers, deviations, and recovery

None.
