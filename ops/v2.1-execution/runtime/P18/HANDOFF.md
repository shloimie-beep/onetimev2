# P18 Collision-Correction Handoff

## Identity

- Branch: `codex/v21-p18-embedded-classroom`
- Correction parent: `d315c47ff9e616ef7909c6edce85a226c5e4fbec`
- Final correction head: derive with `git rev-parse HEAD`; C00 records the observed remote head.
- Claim: `61b4324b-03b7-4d7a-a658-6c3a3091fb80`
- EMBEDDED_CLASSROOM lease: `65bbf2a3-564f-407d-aa21-ba572f5fd1fe`
- Lease released: `2026-07-29T16:56:37Z`
- Claim reconciliation: `8241e5527b7cfbdf12cdeb0c3916fb259a6a7054`
- Exact-request reauthorization: `01e2b7c694563caa29826f8dc0bbb76ee0b4a9cc`
- Reauthorization sole parent: `2c8b4872938d6f0db50ef7f1dba89a0d660a4975`
- Correction manifest: `533b480bb3f7f71c2798a765d63abb3cd1d2200b4be6c5f4b85687ca72b88d51`

## Corrected behavior

Every launch-grant repository statement now uses only
`onetime.classroom_launch_grants_v21`: insert, exact-scope load,
bootstrap-consume, and Admin-reset revocation. The focused database regression
invokes all four operations, requires the `_v21` table in each SQL statement,
and rejects the unversioned legacy-table spelling.

The schema contract is version `1.0.1` and binds `launch_grants` to the same
collision-free table. No other runtime persistence contract changed.

## Immutable replacement request

`P18-migration-002` requests a forward-only, F02-owned migration for the
collision-free v2.1 launch-grant table and the previously requested session and
attendance structures. It does not allocate a migration ordinal, contain SQL,
or claim any migration was written, applied, or executed.

- Raw SHA-256: `d1151073dc979a91ab7697b12b711a468795016bfe9b83e8d77203bc6a19a5ed`
- Canonical queue SHA-256: `e1423a8acc4c53835f3b8ce0414deb0f21bad7d2f66ad8f3277c51f0ac5df54d`
- Exact bytes: `4616`, UTF-8 LF with trailing LF

C00 independently inspected and reauthorized this exact preimage. The earlier
unreproducible `3f8df8d4…` / `435d1d7a…` pair is superseded and is not claimed.

## Correction artifact digests

- Repository: `fff7c15fe9144c00da6a8515b5f319ba88df241f4558de2a89239b990676135b`
- Repository regression: `b2bcc9fd7e8106b0c0450efd47bc6d6cc3427c3ae3bc5d8e6b66ba7746119ef3`
- Schema contract: `f2437b9533afc0d8b7453fb4ac8e8c02ff3eee91aff910c768e5ec10ada5de71`

The correction manifest is SHA-256 of recursively key-sorted compact JSON
mapping the four non-runtime correction paths to these exact raw digests.

## Protected evidence

- Applied migration `packages/db/migrations/2002_ot88_zoom_learner_classroom.sql`
  remains Git blob `7ee99d1174e557eb0978e4258fc511da1b4ab445`.
- Rejected `P18-migration-001.yaml` remains Git blob
  `5975b103568459c48771330f0f287b25e7b5199b`.

Neither protected artifact was edited, and the correction performs no create,
alter, rename, backfill, read, or write against the legacy table.

## Verification

- Focused Vitest: four files, 18 assertions, passed.
- Full TypeScript typecheck: passed.
- Focused ESLint and Prettier: passed.
- Repository secret scan: 2,669 text files, passed.
- Exact seven-path inventory, raw/canonical digests, YAML parsing,
  protected-blob checks, and `git diff --check`: passed.

## Exact next action

C00 audits and integrates this exact remote `ready_for_review` head. F02 then
independently adjudicates `P18-migration-002`; P18 must not allocate an ordinal
or write migration SQL.

## External effects

Authority `none`; attempted `0`, succeeded `0`, reconciled `0`. No provider,
deployment, send, or live effect occurred.

## P17-disjoint ownership successor-request correction atomic claim

Containing control `3757ee49b83027d69208f25b0f709d309d5c6c1a` with
state-basis control `f295f2f55d9fda6208ef1c8dfb9c97ea2ca475a0`
authorizes only a runtime-triplet claim from exact P18 head
`b9ad947405de53c138561fd47b9d5c65a25f6b8b`.

READY
`ba3d425b483be5fa9ad663b5cbf192e1bdc1fb8f44ac2cbc4b285a3533d1a811`
and state-basis control-state digest
`7dfb873efe7246f60aa267e2b0c92858bc72edff5a2d2aab742b4e34b7449ade`
were independently recomputed. Claim
`baeb91ef-3ce9-460c-8a6f-4c8eb40b8ff4` is held under sole
EMBEDDED_CLASSROOM lease `b84e8273-7109-435f-93a6-6d35b41678de` through
`2026-07-30T10:46:00Z`.

The prior P18 state/handoff pair is
`442e4126fbeaf9e38a397414945844e2ca07b022aed67d1e9719600ced520669`;
its runtime triplet is
`d899d9c249b07c8aed4bd023447f1202d8569b4dcae46015bf2def1d7c75d793`.
Integrated release `99fd8c33ea023e838d8ee9c993b5de52f4763e7f`
contains exact P17 `7f8a41bc09c81c53a276a32bbb667aeb1f0ee69c`.
P18 remains sole owner of its four embedded-classroom tables; P17 owns five
disjoint preparation tables and reuses only canonical `job_outbox` and
`provider_operation_binding`.

This checkpoint changes only P18 TASK-STATE, HANDOFF, and NEXT-PROMPT. It does
not create `P18-migration-003` or edit any product, test, existing request,
migration, control, provider, deployment, send, or effect byte. Effects remain
`0/0/0`.

C00 must independently audit and reconcile the exact pushed atomic claim before
P18 creates the immutable successor request or edits any source. P18 must stop.
