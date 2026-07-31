MODEL: GPT-5.6-SOL
REASONING: HIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Resume One Time v2.1 task P12 only after C00 reconciles its exact distinct-name
migration-request atomic claim and publishes a separate exact request
authorization.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p12-parent-household
Authoritative control ref: origin/codex/v21-control
Task state: ops/v2.1-execution/runtime/P12/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P12/HANDOFF.md

The atomic claim READY is contained by control
`fdcba89094f6b8f9460db3d41f3602be2d476990`, whose sole parent and READY
state basis is `ce71f41af1c70f689db9b3346ae5dfc643a1344f`. Authorized integration
start: `d89a0f38dfe695c323f56a28e7c2b0bd890d4ef9`. Exact source head:
`4bc6f15c8beffb28dc845d976a62b9c4915a11dc`.

Canonical READY digest:
`86d690e8c86c758daef88ce47ac315a753372ab36d83aa7b5cad2c7017ee561b`.
Claim: `dc54e616-260b-4a71-a8e9-f114832ef58f`. Writer:
`codex-p12-name-request-dc54e616`. PARENT_HOUSEHOLD_UI lease:
`a0982333-1f59-4949-be55-1ded851cc663`, issued
`2026-07-31T03:48:00Z`, expiring `2026-07-31T05:48:00Z`, scope
`P12_distinct_actual_name_display_name_migration_request_atomic_claim_only`.
Effect locks are empty; external effects are `0/0/0`.

Source state-plus-handoff/runtime-triplet raw-byte digests are
`9bbd2384e49b61ad5e1e345693de7ff08ddc29ceca87afa866e6db899bc4b0bb`
and
`6895f018cd9865307f70fba2fff9f352e9f106eac05a149426f430244dbf6bea`.

This first checkpoint changed only the three P12 runtime-memory files.
`P12-migration-001` does not exist. Stop and wait: this READY grants no latent
post-reconciliation request authority.

Only after a separate exact C00 authorization may P12 create the immutable
request plus the runtime triplet. The request must add required Unicode
nonblank `actual_name`, backfill it from existing `display_name`, and make
`display_name` nullable but nonblank when present. Preserve relationship
`self`/`dependent`; do not add DOB, age, age band, grade, Hebrew-specific name,
Student email, provider/GHL identity, or credential/plaintext fields. Do not
allocate an ordinal, write SQL, edit product/contract/shared control, apply or
integrate the request, freeze a candidate, or perform an external effect.
