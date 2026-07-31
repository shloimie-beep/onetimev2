# P12 Distinct-Name Migration Request Complete

## Identity

- Branch: `codex/v21-p12-parent-household`
- Exact request checkpoint input:
  `8f6eacf8bc471009747225ecb1aa9c117955578b`
- Completion commit: derive with `git rev-parse HEAD`; C00 records the exact
  observed remote head.
- Containing controller:
  `cc90f922663405d883a798db8d4278ef803bb7cb`
- Sole control parent and state basis:
  `fdcba89094f6b8f9460db3d41f3602be2d476990`
- Authorized integration start:
  `d89a0f38dfe695c323f56a28e7c2b0bd890d4ef9`
- Claim mode: `resume_existing`
- Claim: `dc54e616-260b-4a71-a8e9-f114832ef58f`
- Writer: `codex-p12-name-request-dc54e616`
- PARENT_HOUSEHOLD_UI lease:
  `a0982333-1f59-4949-be55-1ded851cc663`
- Lease issued: `2026-07-31T03:48:00Z`
- Lease expiry: `2026-07-31T05:48:00Z`
- Lease released: `2026-07-31T04:52:40Z`
- Phase scope:
  `P12_distinct_actual_name_display_name_migration_request_complete`
- The live control READY queue was empty; authority came from the reconciled
  P12 successor dispatch in control state.

## Exact readback

- Source state-plus-handoff raw-byte digest:
  `9bbd2384e49b61ad5e1e345693de7ff08ddc29ceca87afa866e6db899bc4b0bb`
- Source runtime-triplet raw-byte digest:
  `6895f018cd9865307f70fba2fff9f352e9f106eac05a149426f430244dbf6bea`
- Root `package-lock.json` raw digest:
  `fc85161d1af76b48f66ffcda334c4e5c56d36f5bfd4b94af11345979f6a7dac2`
- Source package digest:
  `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Task/context digests:
  `37a367f92ac2af2a1e9ef17ae97ec2caed3d80ea608d7bcbbeeb6ecc64a0c2bd`
  and
  `1b1bc9f0a0624836ba69e7c35acb2d70ea43f71347cb434be9796b307e418b73`
- I36 terminal state-plus-handoff/runtime-triplet digests:
  `8c1a2e892f3fb1b7e1e26af0449ea5a355476590b9bbd8077fdb13082af9ac70`
  and
  `163295a655e22421e633e2dbf371f5b04dae4cc821ea03b81beec9a540bc3acd`
- Migration 2235 raw/blob:
  `442231550a3aed2360772a9fbc4aebe96edf0510ee175e0b8c7d1097d94f7c1e`
  /
  `70047dd5c2aabed9bbdb12730c2a25d49d51fef3`
- Parent household contract raw/blob:
  `bf96c9d7e9ff331cac1babe179a67f2ac26a63a556198186a5ccf9569d57be8d`
  /
  `d98bbdb6cd4a7902c7c953164617fcdbc566531d`

The source head is an ancestor of the authorized integration start. The I36
lease was released at `2026-07-31T03:31:32Z`. Effect locks are empty and both
I36 and P12 external-effect counts are `0/0/0`.

## Immutable request binding

- Path:
  `ops/v2.1-execution/runtime/P12/steward-requests/P12-migration-001.yaml`
- Request ID/kind: `P12-migration-001` / `migration`
- Raw SHA-256:
  `6f76b024f756b89ef430a21c0744b4dd43114c5d5e9213bd76582e2534d3bc17`
- Git blob: `92c1765089dc227f44e852857a404ab11a0e7fe2`
- Byte count: `4387`

The request asks F02/C00 to allocate the next safe ordinal strictly after 2254.
P12 allocates no ordinal and authors no SQL. It requests a forward-only change
to `onetime.v21_student_profiles`: required Unicode-nonblank `actual_name`,
exact-copy backfill from the existing `display_name`, and nullable
`display_name` that remains Unicode-nonblank when present.

It explicitly preserves `relationship IN ('self', 'dependent')` and exactly
`(relationship = 'self' AND self_adult_id IS NOT NULL) OR (relationship =
'dependent' AND self_adult_id IS NULL)`, plus the household-owner guard and
all existing keys, references, scopes, indexes, lifecycle, version, and history
fields. It forbids adding date of birth, age, age band, grade, a
Hebrew-specific name field, Student email, provider/GHL identity, or any
credential/plaintext field.

This checkpoint changes exactly the immutable request plus P12
`TASK-STATE.yaml`, `HANDOFF.md`, and `NEXT-PROMPT.md`. It changes no product,
contract, interface, test, registration request, shared-control, migration,
provider, candidate, or effect artifact.

## Exact next action

Push and remote-verify this exact four-path checkpoint, then stop. C00 should
record the immutable request digest in `STEWARD-QUEUE.yaml` and assign F02 at
an exact migration checkpoint. P12 performs no further work without a fresh
exact authorization and does not allocate an ordinal, write/apply/acknowledge
SQL, edit product/contract/shared files, integrate, freeze a candidate, or
perform an external effect.

## Verification

- Exact input local, remote-tracking, and live heads matched
  `8f6eacf8bc471009747225ecb1aa9c117955578b` with a clean worktree.
- Control `cc90f922663405d883a798db8d4278ef803bb7cb`, sole parent/state basis
  `fdcba89094f6b8f9460db3d41f3602be2d476990`, empty READY, atomic-claim
  bindings, active lease, and effects `0/0/0` passed readback.
- The request passed strict YAML, canonical steward-request JSON-schema,
  Prettier, exact scope, invariant, and forbidden-field validation.
- The PARENT_HOUSEHOLD_UI lease was released at
  `2026-07-31T04:52:40Z`.

## External effects

Authority is `none`; attempted `0`, succeeded `0`, reconciled `0`.

## Security and recovery

No provider payload, customer or child data, credential, secret, deployment,
mutation, or deletion was accessed or attempted. Recovery base is exact
request-checkpoint input `8f6eacf8bc471009747225ecb1aa9c117955578b`.
