# P12 Correction Claim Handoff

## Identity

- Branch: `codex/v21-p12-parent-household`
- Exact prior final: `7c06fe62e8555aeafa917e855e34f9cc07e3ce3b`
- Atomic correction claim commit: derive with `git rev-parse HEAD`; C00 records
  the observed remote head.
- Containing correction controller:
  `71df400bd85cdca40b4eb0e01fc749f362e3d0e8`
- Ready-entry parent/acquisition:
  `36451ec88e05bb64be0b27b8bc148166b6fe9837`
- Claim mode: `resume_existing_branch`
- Correction claim: `eedf369a-f247-481b-bca6-7e48abdf1f26`
- Writer: `codex-p12-worker-776c6b8b`
- PARENT_HOUSEHOLD_UI lease:
  `3f2cd863-1f04-40fa-875b-87c14469a454`
- Lease issued: `2026-07-29T04:00:52Z`
- Lease expiry: `2026-07-29T05:00:52Z`
- Phase scope: `hard_three_seat_and_lifecycle_idempotency_correction_claim_only`
- Ready-entry digest:
  `a9df3b69b8177c1e0e589109de5aff4260bdb99471f12ff7de0a915166824e8b`
- Task packet digest:
  `37a367f92ac2af2a1e9ef17ae97ec2caed3d80ea608d7bcbbeeb6ecc64a0c2bd`
- Context digest:
  `1b1bc9f0a0624836ba69e7c35acb2d70ea43f71347cb434be9796b307e418b73`

## Atomic claim scope

This checkpoint consumes the fresh correction authorization in exactly
`TASK-STATE.yaml`, `HANDOFF.md`, and `NEXT-PROMPT.md`. It preserves the prior
implementation head `4299c6b828a23fdf79bdc976ab5630df3591ed00`, interface
checkpoint `f265d163d6007e91fb2a332ebff6f173da81700e`, semantic digest
`6ba2fd50d2cbc20d8b4b9e403f66ca40586786d8ea8621c7d43933537165dbe7`,
and registration-request digest
`501ae46b1ad26e933d2e15b4f13760f4c3c8ec93d2672dc7be0d7e372046e733`
without modification.

No product, contract, interface, test, steward-request, migration, shared file,
or external-effect work was performed.

## Exact next action

Stop after pushing and remote-verifying this exact three-file claim. C00 must
reconcile the atomic correction claim before P12 changes any product,
contract, interface, or test file.

After reconciliation, the bounded correction must hard-cap active Student
seats at three regardless of a larger record allowance and must prevent any
duplicate persistence or audit emission when archive is resubmitted for an
already archived Student or restore is resubmitted for an already active
Student. Direct negative regression tests must prove both boundaries before
the implementation/interface/final digests are refreshed.

## External effects

Authority is `none`; attempted `0`, succeeded `0`, reconciled `0`.

## Security, privacy, and data handling

No provider payload, live account, customer or child record, secret,
credential, message, deployment, enrollment mutation, or deletion was accessed
or attempted.

## Blockers and recovery

Product work is blocked only on C00 reconciliation of this atomic claim.
Recovery base is exact prior final
`7c06fe62e8555aeafa917e855e34f9cc07e3ce3b`.
