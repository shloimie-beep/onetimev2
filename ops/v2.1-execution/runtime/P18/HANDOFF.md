# P18 Handoff

## Atomic claim identity

- Branch: `codex/v21-p18-embedded-classroom`
- Claim checkpoint parent: `0a384577dec2ea58cbeaf22a247f7c05f6333c27`
- Claim checkpoint head: derive with `git rev-parse HEAD`; C00 records the observed remote head.
- Remote control authorization: `9215514029009674d47f327475d6a53e8dd476ef`
- Sole acquisition parent: `0d3da54f911d446f86601b21700e26d1cfc57da5`
- Canonical READY digest: `80b85a7bf27c621d6fe57ebca391d0cee372ee0ab1af4520822eead5504c04e3`
- Claim ID: `61b4324b-03b7-4d7a-a658-6c3a3091fb80`
- EMBEDDED_CLASSROOM lease: `65bbf2a3-564f-407d-aa21-ba572f5fd1fe`
- Lease interval: `2026-07-29T16:32:13Z` through `2026-07-29T17:47:13Z`

## Checkpoint state

This checkpoint claims only the P18 runtime triplet for the authorized
`launch_grant_table_collision_correction`. It does not implement the
correction. No repository, schema-contract, test, migration, or steward-request
artifact changed, and `P18-migration-002` was not created.

The control evidence was re-verified before claiming: exact remote refs and
sole-parent authority, recursively canonical READY payload, entry-bound package
and task digests, the protected applied-migration collision, the rejected
request digest, the current repository/schema use of
`onetime.classroom_launch_grants`, and the absence of the required
`onetime.classroom_launch_grants_v21` table binding.

## Protected evidence

- `packages/db/migrations/2002_ot88_zoom_learner_classroom.sql`
  - Git blob: `7ee99d1174e557eb0978e4258fc511da1b4ab445`
  - raw SHA-256: `a74bb923746d6d0a6e7deaeb23e80d60a3fb3fa5107864e5536befc4d97ba72f`
- `ops/v2.1-execution/runtime/P18/steward-requests/P18-migration-001.yaml`
  - raw SHA-256: `acb6ed1d81e05e338875ada7309629d418dafa4b06ee555037e40988b7b7ff1a`
  - canonical queue digest: `de071ac6050df478768e588a6d6986dc2fec4cf0dd06377ab3b17dc92990de0e`

Both protected artifacts remain byte-for-byte unchanged.

## Exact next action

Stop at this claim checkpoint. C00 must reconcile the exact remote claim head.
P18 must receive an explicit resume before editing the three authorized
repository/schema/test files or creating `P18-migration-002`. The protected
legacy migration and rejected `P18-migration-001` must never be edited.

## External effects

Authority `none`; attempted `0`, succeeded `0`, reconciled `0`. All
provider/effect locks were unclaimed, and no provider or live effect occurred.
