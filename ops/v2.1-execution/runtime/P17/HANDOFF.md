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
