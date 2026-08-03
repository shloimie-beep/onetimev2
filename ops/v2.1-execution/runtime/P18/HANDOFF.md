# P18 Attendance Projection Callback Correction Handoff

## Identity

- Branch: `codex/v21-p18-attendance-projection-callback`
- Product-correction terminal and exact metadata parent: `abc2be5b19f5539a4e3bcea55886f5ff12d5de64`
- Product-correction parent: `e61aaeb384201f267b528e01c780f38cfc0c984d`
- Containing control: `4105c365a90ecb27fb930077ecaf02a9125edb38`
- READY state basis/acquisition: `3a94de302ae0f7784dd5b5e47e850df4babde74c`
- Claim: `1904184a-8dbd-4876-b7bd-3715ed4272c0`
- Writer: `codex-p18-evidence-count-1904184a`
- EMBEDDED_CLASSROOM lease: `8700aa39-5041-4aa8-bf35-398cb86ba6f6`
- Lease released: `2026-07-31T12:38:56Z`, before `2026-07-31T14:26:10Z`
- READY digest: `0fe5cd8ae06a590b61a9081efd60d73569ce4a1ee785f7172f0329c57c791feb`
- Exact three-path inventory digest: `a1faaf0d274b87576b567dcd9aa305184598dd8c7bd9d44dd526fc97cd7b76f8`
- Terminal head: derive with `git rev-parse HEAD`; C00 records the observed remote head.

## Correction completed

Every newly inserted attendance event now requires an exact one-row versioned
projection advance. Projection inserts or updates returning zero rows roll the
new event back and invoke no callback, even if all requested projection bytes
already exist. Exact event replay still performs no projection write, commits,
and re-invokes the callback, including an older exact correction after a newer
successor.

Before projection persistence and COMMIT, the repository queries the latest
stored Admin correction for the exact scope, occurrence, and Student. It orders
by `observed_at` then UTF-8 bytes of `attendance_event_id`, validates the
DB-derived immutable correction event, and binds exact correction state,
reason, Admin, audit reference, source digest, and event identity. Older newly
inserted corrections, different metadata, hidden correction state, and
unprovable authority roll back with no callback.

Domain correction and connection ordering now compares raw UTF-8 bytes without
locale state. PostgreSQL uses the identical
`convert_to(attendance_event_id, 'UTF8')` boundary. Tests cover punctuation and
Unicode pairs whose default locale ordering reverses the canonical order.

## Preserved behavior and scope

The mandatory callback port, DB-derived server-owned payload,
COMMIT-before-callback order, callback-failure replay repair, exact replay,
P22-compatible correction metadata, and immutable projection/event scope are
preserved. The embedded-classroom contract remains byte-identical at raw
SHA-256 `005669a0fabc71ad0f52cf48037db783fa88a62fc460e6f64b2d22250563dce5`.
No contract, migration, steward request, composer, config, barrel, integration,
candidate, provider, deployment, DNS, send, charge, or customer state changed.

The source artifact manifest is
`1aec3f57732e639247eb99f450f878991e197d0de866d5bbb3e2c1ac5126d340`.
The terminal delta is exactly the four authorized product/test paths and P18
runtime triplet.

## Verification and evidence-count correction

- Exact relevant focused total: 35 passed, 0 failed: repository 21, domain 10,
  and server callback contract 4.
- This final continuation used metadata-only validation per immediate lean steer:
  YAML, raw/pair/triplet digests, exact three-path scope, ancestry, expected
  head, and local/tracking/live equality. Tests, typecheck, lint, native DB,
  full suite, and secret scan were not rerun.
- All product/test, contract, migration, request, config, composer, barrel,
  integration, candidate, provider, and external-effect bytes are preserved
  from `abc2be5b19f5539a4e3bcea55886f5ff12d5de64`.
- Effects: attempted `0`, succeeded `0`, reconciled `0`.

## Exact next action

C00 independently audits the exact pushed terminal, its sole parent, three-path
scope, corrected count/component evidence, raw-byte composite digests, released
lease, clean remote equality, and effects `0/0/0`. P18 must stop.
