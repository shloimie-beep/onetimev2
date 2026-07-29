# P12 Interface-Digest Metadata Correction Claim

## Identity

- Branch: `codex/v21-p12-parent-household`
- Exact prior final: `2faa49871ae34fa39e6387f264580e246244075b`
- Atomic metadata-correction claim commit: derive with `git rev-parse HEAD`;
  C00 records the observed remote head.
- Containing controller:
  `5d2877fa0eb5071572c2c08bbe5f0169e27b12ba`
- Ready-entry parent/acquisition:
  `76c1c2d9363bb20c9abd2e005ca0651fca73ceb8`
- Claim mode: `resume_existing_branch`
- Claim: `86e406be-cec6-493e-a2a8-4d0744168ed9`
- Writer: `codex-p12-worker-86e406be`
- PARENT_HOUSEHOLD_UI lease:
  `79c5cf83-4438-4c68-ba4f-8e18b87de1f4`
- Lease issued: `2026-07-29T04:24:36Z`
- Lease expiry: `2026-07-29T05:24:36Z`
- Phase scope: `interface_digest_separator_metadata_correction_claim_only`
- Ready-entry digest:
  `8bb0d6d8bcc996fe9a50ebafec45046d3a65bad9cf85f193d90c083fc6b1eb30`

## Defect evidence

The published semantic digest
`7ac6f5114de7f0344b2d8fa97891024c6e1304870057815914d0796c26acd373`
is reproducible only when the five documented preimage lines are separated by
the two literal UTF-8 bytes backslash plus `n`. That preimage is 519 bytes.

The documented algorithm requires byte `0x0A` separators and no final newline.
The exact same five lines with four LF separators form a 515-byte preimage and
hash to:

`ec615147fd6b7becf278c97aef35ee28c4bdfd8109d7ee7897701e3e25216e26`

The four export hashes, implementation head
`d0ae3a1a4b1717dc28cdf7f7ebfdbeee990f27a2`, semantic version `1.0.1`,
and registration-request digest
`501ae46b1ad26e933d2e15b4f13760f4c3c8ec93d2672dc7be0d7e372046e733`
remain unchanged.

## Atomic claim scope

This checkpoint changes only P12 `TASK-STATE.yaml`, `HANDOFF.md`, and
`NEXT-PROMPT.md`. It does not change `INTERFACE-CHECKPOINT.yaml`, product,
contract, export, test, steward, migration, shared, or effect files.

## Exact next action

Stop after pushing and remote-verifying this exact three-file claim. C00 must
reconcile it before P12 corrects `INTERFACE-CHECKPOINT.yaml` and its runtime
digest references from invalid `7ac6f511...` to documented-LF
`ec615147...`.

## External effects

Authority is `none`; attempted `0`, succeeded `0`, reconciled `0`.

## Security and recovery

No provider payload, customer or child data, credential, secret, deployment,
mutation, or deletion was accessed or attempted. Recovery base is exact prior
final `2faa49871ae34fa39e6387f264580e246244075b`.
