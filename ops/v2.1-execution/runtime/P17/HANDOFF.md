# P17 Corrected Handoff

## Identity

- Branch: `codex/v21-p17-zoom-preparation`
- Authorized start: `49431959f58f284bdc13ca931acf09f980fc483a`
- Pre-correction head: `0e6119a491795737e3d7aa079fc3aefa1b5071c2`
- Correction claim: `a72f1a0ba08110c2eb3d0f3cb23dd4e7d1a80368`
- Correction implementation:
  `3560b053a535b2889ea95e1d05ab58bb82b219cc`
- Claim authorization: `0c911664217efe3dbb89b93b6fe29eb9eda2fec3`
- Continuation authorization:
  `268ab601b89573238befe70de7995908925575cc`
- Ready-state binding: `e54ea923a743caf760ef47638a2c8d8a875faf34`
- Ready digest:
  `81174a93e2467a468e4668e59408837b7eb06e34fc192c8be4f88ae591eafccf`
- Claim ID: `ad77a398-b287-4a51-b7cc-25dd147f33de`
- ZOOM_PREPARATION lease:
  `b7211f31-df73-40fa-8281-5765ca37d3b9`
- Lease expiry: `2026-07-29T01:13:59Z`
- Lease released task-locally: `2026-07-29T00:39:05Z`

## Corrected behavior

The correction binds roster enrollments to the exact Student and household,
binds provisioning to the confirmed occurrence version, and makes meeting and
registrant identities stable across schedule and roster source versions.

Join state, launch grants, live-session acquire/reconnect, and revocation now
fail closed on cross-occurrence, cross-Student, cross-household, cross-account,
cross-product, or non-Admin records. The worker requires an exact unique
operation set, dispatches the meeting first, and never starts registrants after
meeting failure or acceptance-unknown. Readbacks require exact counts,
operation types, aggregates, and protected bindings. Duplicate results are
rejected, while invalid or missing accepted readbacks persist a safe
acceptance-unknown quarantine rather than escaping without durable state.

Disposable-canary cleanup requires reconciled registry evidence, a verified
canonical resource-set digest, and proof that the target is excluded.
Prepare/confirm request hashes are recomputed from canonical command bodies
before receipt or replay handling.

## Evidence

- Canonical 13-product-file digest:
  `6941a60b8cf3565f65642634330177d010bebab8726497f3bb73df44e20b83f0`
- Seven-file correction checkpoint digest:
  `43c8795f9f53557abf5a5c1f7e3d1431eae674b2a48055f2448a03c959272d5d`
- Six-file correction product digest:
  `969e0807db933ecf9a1ec7849b6fd5d95a45164e7bd1ce66cfac0532669febd7`
- Contract artifact:
  `1408feedc82fd0009d996d2699a04289093db191196f4c4a2ae659e3a32d8ae9`
- Schema contract:
  `908048ef2f7ad13277a00f63f452390480bdc9b065163fda3381f17bd645ed3e`
- Steward requests:
  `92b34ce0a0030390ede24518e7d7b6304729a1eff3945542f08ce6b5bfe7f444`
- Acceptance matrix:
  `b3fafe36b3e3aabe9c6a592dcef201629d94847b231d6a9184afa7c861a908a2`

Verification passed: full typecheck; 21 focused tests across the domain,
database, server, and worker suites; focused ESLint and Prettier; secret scan
over 2723 repository text files; and diff hygiene.

## Scope and next action

The correction changed six product/test files and four P17 runtime files. No
contract, database, migration, steward request, shared runtime, provider
configuration, manifest, lockfile, or communication-composer path changed.

C00/I36 should independently review implementation head
`3560b053a535b2889ea95e1d05ab58bb82b219cc`, recompute the refreshed digests,
and disposition the four existing F02/I36/P28 steward requests.

External-effect authority remained `none`; attempted/succeeded/reconciled
effects were `0/0/0`. No provider or live canary operation was performed.

## Canonical ownership/provider-outbox correction atomic claim

P17 atomically claimed only the bounded collision correction from exact parent
`78af71603713b6fc73fe755995bdf56193eb199a` under containing control
`9d343f5b5990e0d5c38b2dc53f660b7377e2d64b`, READY digest
`b141b7501dd1862aab3232f939458e6652a6a8d20d7b003e71f6917bac94ada6`,
claim `f7c01bf5-d289-48fc-bf32-cec1c1c1d6a1`, and ZOOM_PREPARATION lease
`0e53a171-263b-41d9-b957-80588027c194` through
`2026-07-30T07:11:00Z`.

This claim changes only P17 `TASK-STATE.yaml`, `HANDOFF.md`, and
`NEXT-PROMPT.md`. Every product, acceptance, migration, existing request, and
provider byte remains unchanged. P18 remains sole owner of launch grants,
Meeting SDK bootstrap issuance/consumption, live Student sessions, attendance,
and their persistence. P17 receives no provider/effect lock; effects remain
`0/0/0`. Stop for C00 reconciliation before product edits or successor
requests.

## Pre-expiry renewal checkpoint

C00 reconciled claim checkpoint
`7e05a1e38f605a9be3cb29d5d2e768e5d2dc348f` at control
`a5851edf70f3c60cc25ece3faf124bedf1629f21`. That authority reached this
worktree at `2026-07-30T06:59:20Z`, leaving insufficient time to implement and
fully gate eleven paths before the mandatory `2026-07-30T07:05:00Z`
checkpoint.

P17 therefore requests renewal before lease expiry. This bounded checkpoint
changes only `TASK-STATE.yaml`, `HANDOFF.md`, and `NEXT-PROMPT.md`; every
product, acceptance, migration, existing request, and successor-request byte
remains unchanged. Correction work was not started. The last heartbeat is
`2026-07-30T07:00:00Z`, effects remain `0/0/0`, and P17 stops pending a renewed
claim and ZOOM_PREPARATION lease.

## Renewed lease atomic claim

P17 atomically claimed the renewed correction lease from exact parent
`7596a0f1701fb135a4f8d133d1381d0e5ad00af8` under containing control
`fbc944ab1ec5aa4ca768cff7db76c1da03bac516`, READY state basis
`a5851edf70f3c60cc25ece3faf124bedf1629f21`, and recomputed READY digest
`4574e539ff97699ce610efd5f1062f79d359f3ee297db4ee40e1740c89d859eb`.

Fresh claim `e85735a2-4a41-476b-bca2-d1dde009e69d` holds ZOOM_PREPARATION lease
`0d08dc64-fb12-4aa5-bf5d-10a3267e18f4`, issued
`2026-07-30T07:01:44Z`, expiring `2026-07-30T08:31:44Z`, with heartbeat
`2026-07-30T07:09:00Z`.

This push changes only `TASK-STATE.yaml`, `HANDOFF.md`, and `NEXT-PROMPT.md`.
Prior state/handoff and runtime-triplet digests are `f87946bc4dfb2cd86d416aefbeb0b45c9c9ffab62abd0f96ca3b79ac26a18a0c`
and `9d82cfccdbf896c247025c3c4183ce8dacb88afe578e6013655965fdbed9c76e`.
Every product, acceptance, existing request, successor-request, and
partial-work byte remains unchanged. Effects remain `0/0/0`. Stop for C00
reconciliation before implementation.

## Canonical ownership/provider-outbox correction complete

C00 reconciled the renewed claim at control
`6fec4000f1e31d608f8fc41488a9befab903aae8`. P17 then published exact
implementation head `178af0c35012828016f395611e3d2f8cb3f88ff8` as the sole
child of renewal claim `b9e7b49a2fa8c0ad1281dc262babd457d4f532ac`.

The implementation removes all P17 launch-grant, Meeting SDK bootstrap,
live-session, device, Admin reset, attendance, unit-of-work, persistence, test,
and schema ownership. P18 remains the sole owner of those responsibilities.
P17 retains only preparation saga, roster snapshot, classroom resource,
Student registrant, preparation command, join-state availability, retry,
quarantine, and provider lifecycle behavior.

Provider intent now persists atomically to canonical `onetime.job_outbox` plus
`onetime.provider_operation_binding` with F05 idempotency equality and exact
F06 registry/account/effect fields. Mismatched existing jobs or bindings fail
closed and roll back. The corrected schema contract is
`P17-ZOOM-PREPARATION-SCHEMA-002` and names exactly five P17 tables.

### Immutable evidence

- 11-path implementation checkpoint:
  `c3afe953e44a0fd5b86aa9e7522d066c4c048eca4472372c5c7f50349160603a`
- Canonical 13-product digest:
  `c35cf10d10031cf4227faf31c6442bcef9aa41c9a55e6ec24320a7f8c4b4d731`
- Contract artifact:
  `4e99730e9ac01b0f84474009152f7e8b2dd4ba1f8d2022cc5f0e5a69728b5916`
- Five-table schema artifact:
  `60156982482173fc84a2e42c17e6a79106f970997e3212715c2999a309180eac`
- Acceptance matrix:
  `0573200dc876dc6cbac4892bd3dce027c3d6413a6861dd2d1653efc9616487aa`
- Existing request container, unchanged:
  `92b34ce0a0030390ede24518e7d7b6304729a1eff3945542f08ce6b5bfe7f444`
- `P17-MIGRATION-002` raw/canonical:
  `fa9868d91b12a30808f80a5233219011126ea9cde5571380c25058a53b2818c8` /
  `e4aed5ae31c5143deb230aa3a9e76f6bca0fd6857d22a4bec7e815f3b78624ca`
- `P17-SERVER-WORKER-REGISTRATION-002` raw/canonical:
  `375142acb5e58ac91c11c83721930f43f5b5bc4e9bc90a027669a80dd933d53a` /
  `e90e471bb23f71b85ad321e188e64144d323461805838baff33f46ed4cd4f1b8`

Verification passed: 23 focused tests, workspace typecheck, focused ESLint and
Prettier, successor YAML parsing, secret scan across 2725 files, exact scope,
forbidden-ownership scan, existing-request byte preservation, and diff hygiene.

The renewed ZOOM_PREPARATION lease
`0d08dc64-fb12-4aa5-bf5d-10a3267e18f4` was released task-locally at
`2026-07-30T07:27:44Z`. External-effect authority remained `none`; effects
were `0/0/0`. No provider inspection or operation occurred.
