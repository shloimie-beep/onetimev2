# P12 Replay and Concealment Correction Terminal

## Authority

- Branch: `codex/v21-p12-parent-household-concrete`
- Authorized live control: `f8d9059b53d0e62cefa0bdb3bced312f3d2e3dd5`
- READY state basis: `321fd3482d5ee54bbad19d97205b54845d0d0aac`
- READY entry digest: `538a416e944278120e5e490b3e3e102134ae01c205478e177047a509fc8aabe0`
- Resumed start: `153c52e97123bb8723c8671873bf96d01444584c`
- Claim: `c2fee1f8-2f7f-4cc7-bec9-cc0695ec3cb4`
- Writer: `codex-p12-replay-concealment-c2fee1f8`
- PARENT_HOUSEHOLD_UI lease: `1d841d45-043c-4e33-8f3d-0c635faa68d0`, released at
  `2026-07-31T16:11:11Z` before its `2026-07-31T17:38:16Z` expiry
- Authorized path count: 10; inventory digest:
  `c816e5a6cc91f4326ee8552142e747b196b4ec3c454a4cee424c4ad16bc1dcee`

The existing ordered merge parents remain:

1. `ae3ced8a9daa11044d4278968c14cb6baa12a480`
2. `9ada912c3238421e661f89e590c07c042dd6424b`

History was neither rewritten nor squashed. Derive the new terminal commit and
tree from the pushed remote. Effect locks remained empty and external effects
are `0/0/0`.

## Correction completed

The repository contract now receives `password_hash_factory`, a lazy async
factory, instead of an eager hash. The PostgreSQL repository invokes it exactly
once only after:

- the transaction and household/idempotency advisory lock;
- authenticated adult/session/role/owned-household resolution;
- production-read-only and inactive-access denial;
- a locked exact-receipt miss;
- mutation shape, revision, seat, lifecycle, target, and unchanged-row checks;
- normalized runtime-scoped username availability.

An exact or racing replay returns before the factory. Native same-key create and
reset races each produced one hash, one committed credential handoff, one
null-handoff replay, and one canonical Student/receipt state. Sequential and
later-state replay performed no additional hash or write.

Create and reset now compare `new_password` and `password_confirmation` before
any receipt lookup. A mismatch fails before household load, hash, Student-ID
allocation, persistence, or credential response, even when a matching receipt
already exists.

Update now constructs and validates the owned target mutation before global
username availability. The lookup receives only the normalized username and
Student ID from that validated target. Focused service and concrete-repository
tests prove a wrong-household Student receives the same concealed
`parent_student_missing` result whether its proposed username is globally taken
or available; no availability query or mutation follows the failed ownership
proof.

## Interface and immutable requests

Semantic interface `1.2.0` is ready for correction review. Its canonical
UTF-8/LF/no-final-newline digest is
`f9c323080c32925864f780fb05981850644ba3a91a2303fa3f282bc7461378d9`.

Normalized export hashes are:

- client index: `4aa586c1c19baf635e59c5043a834f8acb60c844b8354aac885dd05fcfbdbf19`
- server index: `05bde767efa55936e77d0efc73a73f884bb2310b532e7c5277e1917dc7ff99b9`
- contract index: `f33bbfa6d46b933540493c8895b08e86aad7eeef2a50deaa3e68ed523dd8d7ed`
- domain index: `51c640862c1ca76639bdb528bc04cbd84ec9e2689ab41018414ddfef59f85962`

Immutable `P12-server-registration-002` and `P12-client-route-002` remain valid
and byte-identical. Immutable `P12-barrel-export-002` also remains byte-identical
but is now stale and must never be applied. The only new successor is:

- `P12-barrel-export-003` — raw SHA-256
  `d3a72cb8cd794e548d06e1602582370f1aeda2889431dd7104e02d7adc5e40b6`

It retains all seven requirement IDs and seven AC01 IDs, binds the barrel to
interface 1.2.0, and solely supersedes `P12-barrel-export-002`. No other
successor was created. `P12-registration-001` remains immutable superseded
evidence, and `P12-migration-001` remains immutable fulfilled evidence.

## Verification

- Focused five-file suite: 31 tests passed; 3 declared native-only cases skipped.
- Fresh disposable PostgreSQL 18.4, UTF-8, through migration 2255: all 8
  repository tests passed, including final-seat serialization, same-key create
  and reset serialization, and injected rollback.
- Focused ESLint and Prettier: passed.
- Interface preimage/export hashes, new request schema and traceability,
  immutable `-002` bytes, exact ten-path scope, diff hygiene, and secret checks:
  passed.
- The first native harness attempt used the Windows default database encoding
  and was discarded before semantic tests; the explicit UTF-8 rerun above is
  the authoritative proof. The exact disposable database cluster was removed.

## Next action

C00 should perform exactly one independent review of this pushed correction
terminal. On PASS, it should dispatch the single ordered P12-then-P09 I36 source
microbatch. I36 applies `P12-server-registration-002`,
`P12-client-route-002`, and `P12-barrel-export-003`, while rejecting and
withholding `P12-barrel-export-002`. It must not revive
`P12-registration-001` or edit any immutable request.
