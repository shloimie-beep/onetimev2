# F02 Handoff

## Identity

- Branch: `codex/v21-f02-schema-state-migrations`
- Start SHA: `80c281b7ae5826ed2c6abe95ba68a033ffa52174`
- Implementation SHA before this handoff metadata commit: `191dac288ea1721bdc0252bd012060ca974d2242`
- Current handoff commit: derive with `git rev-parse HEAD` after checkout; C00 records the observed remote head in `TASK-REGISTRY.yaml`
- Task packet digest: `7f76d84250d7c117eb78f1bbe70419d9395f46d2ef496527332d5140ad049bce`
- Context digest: `0d581af766419d9c448774279a5b4bd9f7883378f91e2dcb2666ac057ff369fc`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Resume claim: `2608f241-6a2c-4d1d-a316-d2b1b704cfc0`, held by `codex-f02-worker-2608f241`
- Writer lease: `1e14a6d2-eec5-4616-9e96-cb889428c944` for `MIGRATION_AUTHORITY` and `SCHEMA_CONTRACT`
- Lease expiry: `2026-07-28T18:03:02Z`
- Resume lease released in this final checkpoint at `2026-07-28T17:23:00Z`
- Containing authorizing control head: `95a2a52e096357738cda2bd7c16bc9a0e24ccd70`
- Ready-entry parent control head: `193df1fbd101ebb5dd7f0f66adf2c1a78283aab0`
- Ready payload digest: `b7671c575e870760f2e7880dd34263c25341597521228a584aaf59ba987fff11`
- F01 interface checkpoint: `fa9e5c92231c4b92340d07945cc91d76c85bd444`
- F01 implementation/digest: `bb7664c44444bf1704d9f63e5c19a15381f2f0b0` / `2cce2c949811016c8e59b315830a454398d6b73d43380944fa2a76eb79bb8713`

## Completed behavior

Verified the exact repository, authorization, claim, leases, package digests,
and integrated F01 dependency. Implemented semantic contract `1.0.0` for every
assigned lifecycle plus fail-closed authorization, isolation, version,
idempotency, retry, recovery, and billing-operation fencing guards. Allocated
forward-only migration 2234, added canonical current-state and append-only
transition tables with PostgreSQL trigger enforcement, and published interface
contract `84f156979d7a853071c55584bb404672b01b9058de0c97cf304871e54b08b950`.
The database derives billing lease generation from committed event history,
enforces exact counter/generation movement, and requires conclusive
reconciliation to clear unknown-effect quarantine.

## Remaining work

C00/I36 must review and integrate the superseding interface checkpoint, then
refresh the control-plane migration allocation mirror to the exact interface
digest and migration checksum. F02 implementation and task-owned verification
are complete at `ready_for_review`.

## Exact next action

Review and integrate the superseding F02 interface checkpoint. Mirror migration
2234 checksum
`d1352c5e46ae56ca549c9939ef739923109b4a0ab04f0d4df00c04dca71ccb22`
and interface digest
`84f156979d7a853071c55584bb404672b01b9058de0c97cf304871e54b08b950`
without semantic change.

## Coverage

- Requirements: `OTV2-STATE-202` is implementation-ready.
- Acceptance cases: `OTV2-STATE-202-AC01` is implementation-ready after disposable PostgreSQL concurrency and invariant proof.

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
- Disposable PGlite PostgreSQL: migration 2234 passed real trigger execution, concurrent stale-version exclusion, replay/conflict, content recovery, acceptance-unknown reconciliation, dishonest-current-generation rejection, exact attempt counters, and append-only audit.
- Focused domain guard proof: conclusive reconciliation clears `unknown_effect`; unresolved dead-letter work retains quarantine.
- Exact TypeScript/YAML interface artifacts passed Prettier and `git diff --check`.

## External effects

Authority is `none`; attempted `0`, succeeded `0`, reconciled `0`.

## Security, privacy, and data handling

No provider call, live effect, secret, customer data, child data, private
question, or bearer URL was read or recorded.

## Blockers, deviations, and recovery

No normative, scope, implementation, or task-owned verification blocker. The
earlier interface checkpoint was superseded before final review after native
PostgreSQL proof prompted committed-history fencing hardening; C00's allocation
mirror must use the new digest/checksum above.
