# P35 Handoff

## Identity

- Branch: `codex/v21-p35-domain-transition-archive`
- Start SHA: `eefca0644e57dca48609682cbc3e1b01992d286d`
- Implementation SHA before this handoff metadata commit: `eefca0644e57dca48609682cbc3e1b01992d286d`
- Current handoff commit: derive with `git rev-parse HEAD` after checkout; C00 records the observed remote head in `TASK-REGISTRY.yaml`
- Task packet digest: `533cdac53bcc53fe0abccdd67e1f168b57a6cfbdf63c81d71c611ecb4b29d71f`
- Context digest: `d8d040229639d32c6ec4c94b66ad999d7b0afb1e23abff0aa10ccea9b5d54c06`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Claim: `9ee0d8f8-944d-47f2-b67a-54cb333cc29d`, held by `codex-p35-worker-9ee0d8f8`
- Writer lease: `DOMAIN_TRANSITION` / `32c1691c-190a-4449-89cd-bdc937284104`, expiring `2026-07-28T18:38:47Z`
- Containing control head: `3df0ee05af64db67af02e1e64d37ded4810d2cd9`
- Ready payload digest: `7f53c07831911d21d07ebe7f3067f5cd046087cb89841b19c1a1a37ad901d27f`

## Completed behavior

Verified the exact repository, fetched control authority, missing registered
remote P35 branch, authorized start SHA, claim, unexpired writer lease,
package/source/task/context locks, canonical ready-entry digest, and F01
interface integration ancestry. No product implementation exists at this
claim-only checkpoint.

## Remaining work

Implement all eight assigned requirements inside P35-owned paths: canonical
app/join domain behavior, safe transition and rollback policy, legacy-adult
re-registration with explicit prohibited-state exclusion, and an inactive
Tisha B'Av archive template. Add focused task-owned verification and cutover
runbooks, then publish `ready_for_review`.

## Exact next action

Inspect only the P35-owned paths and named source sections, then implement the
smallest complete domain-transition, legacy re-registration, archive, and
verification surface.

## Coverage

- Requirements: all eight assigned requirements are in progress.
- Acceptance cases: all eight assigned cases await task-owned implementation verification.

## Changed files and migrations

Added only P35 task-local runtime metadata. No migration was created, deleted,
or edited.

## Verification

- Remote control head and ready-entry payload digest matched exactly.
- `LOCKED-SHA256SUMS.txt`: 200/200 Git blobs passed.
- `source-spec/SHA256SUMS.txt`: 15/15 Git blobs passed.
- F01 integration head `80c281b7ae5826ed2c6abe95ba68a033ffa52174`
  is an ancestor of the authorized start.
- The remote P35 branch was absent before claim.

## External effects

Authority is `none`; attempted `0`, succeeded `0`, reconciled `0`.

## Security, privacy, and data handling

No provider call, live effect, secret, customer data, child data, private
question, legacy credential, legacy session, or bearer URL was read or
recorded.

## Blockers, deviations, and recovery

None.
