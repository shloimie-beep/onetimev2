# F02 Handoff

## Identity

- Branch: `codex/v21-f02-schema-state-migrations`
- Start SHA: `80c281b7ae5826ed2c6abe95ba68a033ffa52174`
- Implementation SHA before this handoff metadata commit: `0e1f9a18677e13556222241cd21b1f24383668b6`
- Current handoff commit: derive with `git rev-parse HEAD` after checkout; C00 records the observed remote head in `TASK-REGISTRY.yaml`
- Task packet digest: `7f76d84250d7c117eb78f1bbe70419d9395f46d2ef496527332d5140ad049bce`
- Context digest: `0d581af766419d9c448774279a5b4bd9f7883378f91e2dcb2666ac057ff369fc`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Claim: `ff826962-97c5-4032-8de8-5b5f4b1dc12c`, held by `codex-f02-worker-ff826962`
- Writer lease: `956f99dc-83c3-4b18-b3cd-98c971d3956f` for `MIGRATION_AUTHORITY` and `SCHEMA_CONTRACT`
- Lease expiry: `2026-07-28T16:56:52Z`
- Containing control head: `af76c4e990f954794de72db639576b3c9dc73ff4`
- Ready-entry parent control head: `586f1216c27b02915bdca606645d7e1ee335a669`
- Ready payload digest: `8089425dc63820f5c65755815bf1078a66aa28c0d7f84fa199dc0a9a4c2870f9`
- F01 interface checkpoint: `fa9e5c92231c4b92340d07945cc91d76c85bd444`
- F01 implementation/digest: `bb7664c44444bf1704d9f63e5c19a15381f2f0b0` / `2cce2c949811016c8e59b315830a454398d6b73d43380944fa2a76eb79bb8713`

## Completed behavior

Verified the exact repository, authorization, claim, leases, package digests,
and integrated F01 dependency. Implemented semantic contract `1.0.0` for every
assigned lifecycle plus fail-closed authorization, isolation, version,
idempotency, retry, recovery, and billing-operation fencing guards. Allocated
forward-only migration 2234, added canonical current-state and append-only
transition tables with PostgreSQL trigger enforcement, and published interface
contract `bcbb098b674de3f6b8bacb7c04052664dcecf72d597af6876e13c7eb6ca4943e`.

## Remaining work

Notify C00/I36 so I36 can integrate the interface checkpoint. Run the
PostgreSQL-only trigger and real concurrent stale-version proof in a disposable
PostgreSQL database when one is available, complete final task-owned
verification, and finish at `ready_for_review`.

## Exact next action

Push the `interface_ready` checkpoint and notify C00/I36; then run
PostgreSQL-only trigger and concurrent stale-version proof in a disposable
PostgreSQL database if available.

## Coverage

- Requirements: `OTV2-STATE-202` is implementation-ready.
- Acceptance cases: `OTV2-STATE-202-AC01` awaits PostgreSQL-only concurrency proof and later candidate-bound verification.

## Changed files and migrations

Added the F02 runtime records, state contract/domain guard roots, allocation
proposal, interface checkpoint, and migration
`2234_canonical_state_machines.sql`. No applied migration was modified and
ordinal 2231 remains unallocated.

## Verification

- Remote identity and exact control head matched.
- Remote F02 branch was absent before claim.
- `LOCKED-SHA256SUMS.txt`: 200/200 passed.
- Canonical ready-entry digest matched.
- F01 integrated checkpoint, implementation head, and contract digest matched.
- Lockfile-pinned dependencies installed with lifecycle scripts disabled.
- `npm run typecheck`: passed.
- Focused transition smoke: passed positive, authorization, isolation, stale-version, replay/conflict, content retry, billing recovery, and fencing branches.
- All 65 migrations applied in disposable pg-mem; 2234 applied last.
- Exact TypeScript/YAML interface artifacts passed Prettier and `git diff --check`.
- Native PostgreSQL proof was not run: Docker, `psql`, and a disposable database URL are unavailable in this environment.

## External effects

Authority is `none`; attempted `0`, succeeded `0`, reconciled `0`.

## Security, privacy, and data handling

No provider call, live effect, secret, customer data, child data, private
question, or bearer URL was read or recorded.

## Blockers, deviations, and recovery

No normative or scope blocker. Native PostgreSQL verification remains pending
until a disposable PostgreSQL target is available; all provider-independent
implementation and in-memory migration work is complete.
