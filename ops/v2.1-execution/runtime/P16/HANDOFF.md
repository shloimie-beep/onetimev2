# P16 Classroom Repository Weekday-Encoding Handoff

## Identity

- Branch: `codex/v21-p16-class-series-occurrences`
- Start SHA: `01cdb992660a1fbc20b204b829d28062fd044679`
- Exact atomic claim head before implementation: `79c745344e71c3b90a9fd7e569920e63a4d865cf`
- Last committed implementation SHA: `f5f3d89fa1a8da29798c0b74a04f02541c4d2d5c`
- Interface metadata SHA: `418ffcc5cbf78643b40b89dbc5da64ea04806f6e`
- Current handoff commit: derive with `git rev-parse HEAD`; C00 records the observed remote head
- Task packet digest: `a2ba86653705892d62ad19fddcf14a5c519ffb3c6f130d3919de0f5a971f427e`
- Context digest: `1df1eaa480ed68aa93538ae2dbd8a52864bbe728248f79b20b54e2de4b5e95a0`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Resume claim: `ebdca6e9-aa5b-411b-88fd-747089e869ce`
- CLASSROOM_CORE lease: `8c250e39-5c4d-4684-93ba-2ff373a1253a`, issued `2026-07-30T01:01:25Z`, released `2026-07-30T01:39:42Z`, and expiring `2026-07-30T02:31:25Z`
- Reconciled control authorization: `c152aaa889694260f085f9441315a5104d4b5a1f`
- Sole control/acquisition parent: `ae24cef068b50576569eb190695feddc79ddecc6`
- Ready payload digest: `bfbe5b37da8dd4e6acb36c5d57ea68a365d81fae50a95c53bb738e7e07c70be5`
- Canonical control-state digest: `c54becb37cc4bb37236c2efa0b2944ea70739a5d0c05ff667cec215d015c29ae`
- Implementation artifact digest: `653d5d123dc78bf5a608947b59d0b4d387d3e8644fb2c5aaca234d99dad66190`
- Interface contract digest: `95c177d54a429dbcba604d9903c0edcb9aa6051f73e168f853d2b8fd4e377d68`
- Interface state/handoff digest: `afd57cbd0cc837caf6b6b007a61269f676f99ee1ea2d7d4edd7f2da65d31714e`
- Steward-request digest: `628fe0cb860057b6dde8b5e214edfe00400ca8f701459993e099e6f923fd34cb`

## Completed behavior

Completed the reconciled bounded correction. The repository preserves the
public/domain weekday convention `0..6`, encodes Sunday `0` as database ISO
weekday `7` while leaving `1..6` unchanged, and decodes database `7` back to
Sunday `0` without reordering. It rejects absent, non-array, empty, non-integer,
out-of-range, and duplicate sets before class-series persistence.

## Remaining work

C00 must review this terminal P16 head and I36 must ancestry-integrate the
accepted correction.

## Exact next action

Validate implementation commit
`f5f3d89fa1a8da29798c0b74a04f02541c4d2d5c`, artifact digest
`653d5d123dc78bf5a608947b59d0b4d387d3e8644fb2c5aaca234d99dad66190`,
the native canonical roundtrip through migration 2239, released lease, and
effects `0/0/0`; then ancestry-integrate the accepted correction.

## Coverage

- Requirements: all seven assigned requirements remain implementation-ready.
- Acceptance cases: all seven assigned cases remain implementation-ready; the repository/schema weekday boundary proof passes.

## Changed files and migrations

The correction changes only
`packages/db/src/classes/core/repository.ts`, its direct test
`tests/unit/classes/classroom-core-repository.test.ts`, and this P16 runtime
triplet. No migration, contract/domain, registration, interface,
steward-request, control, integration, provider, deployment, or send path
changed.

## Verification

Focused repository tests pass 12/12; full typecheck, focused ESLint/Prettier,
secret scan, diff hygiene, artifact digest, and exact five-path scope checks
pass. Native PGlite PostgreSQL executed 70 exact F02 migrations through
`2239_v21_classroom_core.sql`: canonical `[0,1,2,3,4]` stored as
`[7,1,2,3,4]` and read back identically, `[6,0,2]` stored as `[6,7,2]` and
read back identically, and all malformed inputs were rejected with zero
class-series persistence queries.

## External effects

Authority is `none`; attempted 0, succeeded 0, reconciled 0.

## Security, privacy, and data handling

No secret, child data, provider record, enrollment mutation, or live effect was
accessed or attempted.

## Blockers, deviations, and recovery

No task-local blocker. Public/domain weekday semantics and the F02 ISO schema
remain byte-identical; the compatibility translation is confined to the P16
repository boundary.
