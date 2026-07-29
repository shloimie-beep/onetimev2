# P12 Corrected Final Handoff

## Identity

- Branch: `codex/v21-p12-parent-household`
- Prior rejected final: `7c06fe62e8555aeafa917e855e34f9cc07e3ce3b`
- Atomic correction claim: `e1cfcd590e8e359c6616cac523337c183f2bc43f`
- Corrected implementation head:
  `d0ae3a1a4b1717dc28cdf7f7ebfdbeee990f27a2`
- Corrected interface checkpoint:
  `2062ed2a6cf0f8dbd44cc81bfe3078d9187f5907`
- Final handoff commit: derive with `git rev-parse HEAD`; C00 records the
  observed remote head.
- Containing correction controller:
  `71df400bd85cdca40b4eb0e01fc749f362e3d0e8`
- Ready-entry parent/acquisition:
  `36451ec88e05bb64be0b27b8bc148166b6fe9837`
- Reconciled control head:
  `ddef233830979fd2a0e2d3a146bdd389b23a9c84`
- Correction claim: `eedf369a-f247-481b-bca6-7e48abdf1f26`
- Writer: `codex-p12-worker-eedf369a`
- PARENT_HOUSEHOLD_UI lease:
  `3f2cd863-1f04-40fa-875b-87c14469a454`
- Lease issued: `2026-07-29T04:00:52Z`
- Lease expiry: `2026-07-29T05:00:52Z`
- Lease released: `2026-07-29T04:19:12Z`
- Ready-entry digest:
  `a9df3b69b8177c1e0e589109de5aff4260bdb99471f12ff7de0a915166824e8b`

## Corrected interface

- Semantic contract: `1.0.1`
- Canonical semantic digest:
  `7ac6f5114de7f0344b2d8fa97891024c6e1304870057815914d0796c26acd373`
- Contract export digest:
  `bf96c9d7e9ff331cac1babe179a67f2ac26a63a556198186a5ccf9569d57be8d`
- Client export digest:
  `79eeee2c26b66f548e9592ac398db4495d69df0714a581bfea36eddec134ed39`
- Server export digest:
  `084e4d6c800a1063437193672da83909accd62353d1ae49366f66f0310e51bc1`
- Domain export digest:
  `51c640862c1ca76639bdb528bc04cbd84ec9e2689ab41018414ddfef59f85962`
- Registration request digest:
  `501ae46b1ad26e933d2e15b4f13760f4c3c8ec93d2672dc7be0d7e372046e733`

## Corrected behavior

The effective Standard Family Student allowance is clamped to the public hard
maximum of three. Inflated repository data cannot create or restore a fourth
active Student, and the Parent snapshot never reports capacity above three.

Same-state archive and restore resubmits intentionally fail closed rather than
returning a successful no-op. After scope, access, revision, and Student
validation, the domain throws `parent_student_lifecycle_unchanged` before
Student replacement, household revision increment, audit construction,
enrollment/session effects, or repository commit. Direct service tests prove
that `commitMutation` is never called for either same-state request.

All original Parent-only scope, credential, enrollment, archive-history,
one-time credential-handoff, and central-registration boundaries remain.

## Exact next action

I36 should independently review and integrate corrected implementation
`d0ae3a1a4b1717dc28cdf7f7ebfdbeee990f27a2` and interface checkpoint
`2062ed2a6cf0f8dbd44cc81bfe3078d9187f5907`, reproduce semantic digest
`7ac6f5114de7f0344b2d8fa97891024c6e1304870057815914d0796c26acd373`,
and disposition registration request digest
`501ae46b1ad26e933d2e15b4f13760f4c3c8ec93d2672dc7be0d7e372046e733`.
C00 may authorize P13 only after exact corrected interface integration.

## Scope and verification

- Exact start-to-final delta: 16 authorized P12 paths.
- Focused domain/server/client suite: 3 files and 14 tests passed.
- Direct hard-cap and same-state no-commit regressions: passed.
- Workspace typecheck: passed.
- All P12-focused ESLint and Prettier: passed.
- Diff hygiene and repository secret scan across 2750 text files: passed.
- Export, semantic, and steward digests reproduced from committed Git objects.
- Migrations: none.

## External effects

Authority is `none`; attempted `0`, succeeded `0`, reconciled `0`.

## Security, privacy, and data handling

No provider payload, live account, customer or child record, secret,
credential, message, deployment, enrollment mutation, or deletion was accessed
or attempted.

## Blockers and recovery

None. Recovery base is exact atomic correction claim
`e1cfcd590e8e359c6616cac523337c183f2bc43f`.
