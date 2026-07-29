# P12 Corrected Interface-Digest Handoff

## Identity

- Branch: `codex/v21-p12-parent-household`
- Atomic metadata-correction claim:
  `b8d43694b93b5f932c35d065e633c887761f67a1`
- Product implementation head:
  `d0ae3a1a4b1717dc28cdf7f7ebfdbeee990f27a2`
- Corrected interface metadata checkpoint: derive with `git rev-parse HEAD`;
  C00 records the observed remote head.
- Containing controller:
  `5d2877fa0eb5071572c2c08bbe5f0169e27b12ba`
- Ready-entry parent/acquisition:
  `76c1c2d9363bb20c9abd2e005ca0651fca73ceb8`
- Reconciled control:
  `c8957e599763556d8eb6140e499783d52818d49f`
- Claim: `86e406be-cec6-493e-a2a8-4d0744168ed9`
- Writer: `codex-p12-worker-86e406be`
- PARENT_HOUSEHOLD_UI lease:
  `79c5cf83-4438-4c68-ba4f-8e18b87de1f4`
- Lease issued: `2026-07-29T04:24:36Z`
- Lease expiry: `2026-07-29T05:24:36Z`
- Ready-entry digest:
  `8bb0d6d8bcc996fe9a50ebafec45046d3a65bad9cf85f193d90c083fc6b1eb30`

## Corrected semantic digest

The exact documented preimage contains semantic version `1.0.1` followed by
the four lexicographically sorted `path=sha256` export lines, separated by four
LF bytes and with no final newline. It is exactly 515 UTF-8 bytes and hashes to:

`ec615147fd6b7becf278c97aef35ee28c4bdfd8109d7ee7897701e3e25216e26`

The prior `7ac6f511...` value is superseded because it used literal
backslash-plus-`n` bytes contrary to the documented algorithm.

## Byte-identical artifacts

- Client export:
  `79eeee2c26b66f548e9592ac398db4495d69df0714a581bfea36eddec134ed39`
- Server export:
  `084e4d6c800a1063437193672da83909accd62353d1ae49366f66f0310e51bc1`
- Contract export:
  `bf96c9d7e9ff331cac1babe179a67f2ac26a63a556198186a5ccf9569d57be8d`
- Domain export:
  `51c640862c1ca76639bdb528bc04cbd84ec9e2689ab41018414ddfef59f85962`
- Steward request:
  `501ae46b1ad26e933d2e15b4f13760f4c3c8ec93d2672dc7be0d7e372046e733`

Product, contract, test, export, steward, migration, shared, and effect
artifacts remain byte-identical to the exact atomic claim input. Only
`INTERFACE-CHECKPOINT.yaml` and P12 runtime metadata references change.

## Exact next action

Push and remote-verify this corrected interface metadata checkpoint, complete
final YAML/scope/diff/digest/clean-remote verification, release the fresh
lease, and publish ready_for_review. I36 must integrate only the exact corrected
interface after final admission.

## External effects

Authority is `none`; attempted `0`, succeeded `0`, reconciled `0`.

## Security and recovery

No provider payload, customer or child data, credential, secret, deployment,
mutation, or deletion was accessed or attempted. Recovery base is exact atomic
metadata-correction claim
`b8d43694b93b5f932c35d065e633c887761f67a1`.
