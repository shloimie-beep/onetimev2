# P12 Distinct-Name Migration Request Atomic Claim

## Identity

- Branch: `codex/v21-p12-parent-household`
- Exact source/recovery head:
  `4bc6f15c8beffb28dc845d976a62b9c4915a11dc`
- Atomic claim commit: derive with `git rev-parse HEAD`; C00 records the exact
  observed remote head.
- Containing controller:
  `fdcba89094f6b8f9460db3d41f3602be2d476990`
- Sole control parent and READY state basis:
  `ce71f41af1c70f689db9b3346ae5dfc643a1344f`
- Authorized integration start:
  `d89a0f38dfe695c323f56a28e7c2b0bd890d4ef9`
- Claim mode: `resume_existing`
- Claim: `dc54e616-260b-4a71-a8e9-f114832ef58f`
- Writer: `codex-p12-name-request-dc54e616`
- PARENT_HOUSEHOLD_UI lease:
  `a0982333-1f59-4949-be55-1ded851cc663`
- Lease issued: `2026-07-31T03:48:00Z`
- Lease expiry: `2026-07-31T05:48:00Z`
- Phase scope:
  `P12_distinct_actual_name_display_name_migration_request_atomic_claim_only`
- Ready-entry digest:
  `86d690e8c86c758daef88ce47ac315a753372ab36d83aa7b5cad2c7017ee561b`

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

## Atomic scope and mandatory stop

This checkpoint changes exactly P12 `TASK-STATE.yaml`, `HANDOFF.md`, and
`NEXT-PROMPT.md`. It does not create `P12-migration-001` and changes no
product, contract, interface, test, registration request, shared-control,
provider, or effect artifact.

Stop after pushing and remote-verifying this exact three-file claim. This
READY grants no latent request authority. C00 must reconcile the claim and
publish a separate exact authorization before `P12-migration-001` may exist.

On later exact authority, the immutable request must add required Unicode
nonblank `actual_name`, backfill it from existing `display_name`, and make
`display_name` nullable but nonblank when present. It must preserve
relationship `self`/`dependent` and must not add date of birth, age, age band,
grade, Hebrew-specific name, Student email, provider/GHL identity, or any
credential/plaintext field.

## Exact next action

Push and remote-verify this exact three-file claim, then stop for C00
reconciliation. Do not allocate an ordinal, write SQL, create the request,
edit product/contract/shared files, integrate, freeze a candidate, or perform
an external effect.

## Verification

- Canonical READY digest was independently reproduced from recursively
  key-sorted JSON.
- Source pair/triplet digests were independently reproduced from exact raw Git
  bytes concatenated in TASK/HANDOFF(/NEXT) order with no separator.
- Live branch/control/integration refs, ancestry, package/task/context, schema
  baselines, active lease, and zero locks/effects passed readback.

## External effects

Authority is `none`; attempted `0`, succeeded `0`, reconciled `0`.

## Security and recovery

No provider payload, customer or child data, credential, secret, deployment,
mutation, or deletion was accessed or attempted. Recovery base is exact atomic
claim input `4bc6f15c8beffb28dc845d976a62b9c4915a11dc`.
