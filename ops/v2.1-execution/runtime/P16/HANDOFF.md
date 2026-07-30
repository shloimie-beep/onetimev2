# P16 Classroom Repository Migration-Compatibility Handoff

## Identity

- Branch: `codex/v21-p16-class-series-occurrences`
- Start SHA: `01cdb992660a1fbc20b204b829d28062fd044679`
- Exact resume head before this claim: `72fca16b3a9cd82c666e293f8bfd7d84c30722a1`
- Atomic correction claim head: `be95754a1b331a5e420f9cf755bc190357fe3436`
- Last committed implementation SHA: `07475dd776f046f238061217ebc63ed9320c54c8`
- Interface metadata SHA: `418ffcc5cbf78643b40b89dbc5da64ea04806f6e`
- Current handoff commit: derive with `git rev-parse HEAD`; C00 records the observed remote head
- Task packet digest: `a2ba86653705892d62ad19fddcf14a5c519ffb3c6f130d3919de0f5a971f427e`
- Context digest: `1df1eaa480ed68aa93538ae2dbd8a52864bbe728248f79b20b54e2de4b5e95a0`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Resume claim: `0a4c2e0f-6c3d-4e42-aee8-8bfd27ce5c9d`
- CLASSROOM_CORE lease: `01453191-8f65-4dcd-8559-9045599dae9b`, issued `2026-07-29T23:53:18Z`, released `2026-07-30T00:45:59Z`, and expiring `2026-07-30T01:23:18Z`
- Reconciled control authorization: `5644d38395e86ea114197eb12415106994bbf3ea`
- Sole control/acquisition parent: `fe0d60fa2807b02882390df960f3e75517672d11`
- Ready payload digest: `5a7d1bebc22b55cf415ad4cea51131aee21c880c09792c3c8bd4c064104bf675`
- Implementation artifact digest: `e84eb12e42832288446f756e1933dc887be37839440d738f156373d25ab62b7d`
- Interface contract digest: `95c177d54a429dbcba604d9903c0edcb9aa6051f73e168f853d2b8fd4e377d68`
- Interface state/handoff digest: `afd57cbd0cc837caf6b6b007a61269f676f99ee1ea2d7d4edd7f2da65d31714e`
- Steward-request digest: `628fe0cb860057b6dde8b5e214edfe00400ca8f701459993e099e6f923fd34cb`

## Completed behavior

Completed the reconciled bounded correction. P16 now persists a non-null
`reminder_local_time` 30 minutes before each series local start, including
midnight wrap, and persists `reminder_due_at` 30 minutes before each occurrence
start plus `joinable_until` from the protected join-close boundary. The
occurrence update path refreshes both values, and repository validation rejects
absent, invalid, or internally inconsistent timing before table persistence.

## Remaining work

C00 must review this terminal P16 head and I36 must ancestry-integrate the
accepted correction. C00/F02/I36 must separately disposition the pre-existing
recurrence-weekday numbering mismatch described below.

## Exact next action

Validate implementation commit
`07475dd776f046f238061217ebc63ed9320c54c8`, artifact digest
`e84eb12e42832288446f756e1933dc887be37839440d738f156373d25ab62b7d`,
the native migration-through-2239 evidence, released lease, and effects
`0/0/0`; then ancestry-integrate the accepted correction.

## Coverage

- Requirements: all seven assigned requirements remain implementation-ready.
- Acceptance cases: all seven assigned cases remain implementation-ready; the bounded repository compatibility proof passes.

## Changed files and migrations

The correction changes only
`packages/db/src/classes/core/repository.ts`, its direct test
`tests/unit/classes/classroom-core-repository.test.ts`, and this P16 runtime
triplet. No migration, registration, interface, steward-request, control,
integration, provider, deployment, or send path changed.

## Verification

Focused repository tests pass 4/4; the full unit suite passes 571/571 across 87
files. Typecheck, focused ESLint/Prettier, secret scan, diff hygiene, artifact
digest, and scope checks pass. Native PGlite PostgreSQL executed 70 exact F02
migrations through `2239_v21_classroom_core.sql`; the positive repository write
stored `23:45:00`, `2026-08-02T15:30:00.000Z`, and
`2026-08-02T17:15:00.000Z`. All three columns are `NOT NULL` with no default;
database omission and repository-invalid timing are rejected.

## External effects

Authority is `none`; attempted 0, succeeded 0, reconciled 0.

## Security, privacy, and data handling

No secret, child data, provider record, enrollment mutation, or live effect was
accessed or attempted.

## Blockers, deviations, and recovery

No task-local blocker. The native run also found that migration 2237 accepts
recurrence weekdays only as ISO `1..7`, while the existing P16 contract/domain
uses `0..6` and canonical `[0,1,2,3,4]`. That separate pre-existing mismatch was
not changed under this correction's exact authority; the positive timestamp
proof used a schema-valid `[1,3,5]` series.
