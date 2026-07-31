MODEL: GPT-5.6-SOL
REASONING: HIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Resume One Time v2.1 task P12 only after C00 records the exact immutable
`P12-migration-001` digest, assigns the request to F02, and publishes a fresh
exact P12 authorization.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p12-parent-household
Authoritative control ref: origin/codex/v21-control
Task state: ops/v2.1-execution/runtime/P12/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P12/HANDOFF.md

The request authorization is control
`cc90f922663405d883a798db8d4278ef803bb7cb`, whose sole parent and state
basis is `fdcba89094f6b8f9460db3d41f3602be2d476990`. Authorized integration
start: `d89a0f38dfe695c323f56a28e7c2b0bd890d4ef9`. Exact request-checkpoint
input: `8f6eacf8bc471009747225ecb1aa9c117955578b`.

Claim: `dc54e616-260b-4a71-a8e9-f114832ef58f`. Writer:
`codex-p12-name-request-dc54e616`. PARENT_HOUSEHOLD_UI lease:
`a0982333-1f59-4949-be55-1ded851cc663`, issued
`2026-07-31T03:48:00Z`, released `2026-07-31T04:52:40Z` before its
`2026-07-31T05:48:00Z` expiry. Effect locks are empty; external effects are
`0/0/0`.

Immutable request:
`ops/v2.1-execution/runtime/P12/steward-requests/P12-migration-001.yaml`.
Raw SHA-256:
`6f76b024f756b89ef430a21c0744b4dd43114c5d5e9213bd76582e2534d3bc17`.
Git blob: `92c1765089dc227f44e852857a404ab11a0e7fe2`. Byte count: `4387`.

The request asks F02/C00 to allocate the next safe migration ordinal strictly
after 2254; P12 allocates no ordinal and writes no SQL. It adds required
Unicode-nonblank `actual_name` to `onetime.v21_student_profiles`, fails closed
on legacy Unicode-whitespace-only `display_name`, exact-copies `display_name`
to `actual_name` without trimming or fabrication, and makes `display_name`
nullable but Unicode-nonblank when present.

Preserve `relationship IN ('self', 'dependent')` and exactly `(relationship =
'self' AND self_adult_id IS NOT NULL) OR (relationship = 'dependent' AND
self_adult_id IS NULL)`, the owner guard, and all other existing columns,
keys, references, scopes, indexes, triggers, lifecycle, version, and history
fields. Do not add date of birth, age, age band, grade, a Hebrew-specific name
field, Student email, provider/GHL identity, or any credential/plaintext
field.

This completed checkpoint changed only the immutable request plus P12
`TASK-STATE.yaml`, `HANDOFF.md`, and `NEXT-PROMPT.md`. Stop. Do not allocate an
ordinal, write/apply/acknowledge SQL, edit product/contract/shared control,
integrate, freeze a candidate, access a provider, or perform an external
effect. Concrete PostgreSQL repository persistence and central route
composition remain separate gated work.
