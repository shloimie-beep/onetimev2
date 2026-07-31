# P18 Attendance Projection Callback Correction Handoff

## Identity

- Branch: `codex/v21-p18-attendance-projection-callback`
- Exact correction parent: `e61aaeb384201f267b528e01c780f38cfc0c984d`
- Live control verified: `864298e32e693599a804a5b152739de4ae17ee2b`
- Final live control revalidation: `70b12ea370e8430bc80c0943231af98a3f5e6265`; P18 READY remained unchanged.
- READY state basis: `52cb53061527b1df9b95029bcf211fe258609368`
- Claim: `2ed4aaa7-37d2-4862-b9cb-6a85365088fa`
- Writer: `codex-p18-callback-correction-2ed4aaa7`
- EMBEDDED_CLASSROOM lease: `89692d9a-5b1f-47b3-8b41-c96286936deb`
- Lease released: `2026-07-31T12:09:35Z`, before `2026-07-31T13:28:40Z`
- READY digest: `862362d871eec64d5ad47b3399dad9672649cef2fe3cf70ed24432028322e1e7`
- Exact seven-path inventory digest: `e2f0e38565e290e50f801cebe9e05d3a98af98af313bd9c35908538aa304925b`
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

## Verification

- Focused repository/domain/contract tests: 38 passed, 0 failed.
- Workspace typecheck: passed.
- Focused ESLint and Prettier: passed.
- YAML, diff hygiene, exact-scope, forbidden-delta, and secret gates: passed.
- Locked execution manifest: 200/200; source package manifest: 15/15.
- Migration tree remains `040376c25e645b048afeb8e08d230a3084ab8566`.
- Effects: attempted `0`, succeeded `0`, reconciled `0`.

## Exact next action

C00 independently audits the exact pushed terminal, its sole parent, seven-path
scope, artifact digests, correction semantics, released lease, clean remote
equality, and effects `0/0/0`. P18 must stop.
