# P09 Correction Atomic Claim Handoff

## Exact identity

- Branch: `codex/v21-p09-school-inquiry`
- Rejected final / resume base:
  `a81e5e98e21eeb1df8d0ff21dd6b948a33a65d46`
- Correction control:
  `9d2b0015dd8fe3420e6391e460fccb78fd8911fa`
- Sole acquisition parent:
  `b0dc03dc140dd05ab8ae65530cd672c8c10126e5`
- Claim: `555a5878-9a7f-4486-a6e0-a959dc9ab1a1`
- SCHOOL_INQUIRY lease:
  `8ca16a74-fa49-4c61-8aa8-b50416b50913`
- Lease window: `2026-07-29T11:11:54Z` through
  `2026-07-29T12:26:54Z`
- Phase scope:
  `P09_atomic_claim_concurrency_optional_acknowledgment_correction_only`
- READY digest:
  `505e68237f3d2d0401e4727b9a8111a330026f994344ca804d83a6692a09f766`
- Atomic claim head: derive with `git rev-parse HEAD`; C00 records the observed
  pushed remote head.
- Effect locks: none.

## Authorized correction scope after reconciliation

The rejected final requires a bounded correction for:

1. database-bound serialization of concurrent submissions sharing the same
   normalized email, with one durable inquiry and one acknowledgment intent;
2. truly optional phone and note fields, including persistence without invented
   placeholder values; and
3. acknowledgment creation/delivery bound to the exact approved notification
   template and configuration instead of locally invented copy.

This checkpoint does not authorize implementing those changes. C00 must first
reconcile the exact pushed atomic claim head.

## Completed in this checkpoint

Verified the exact control/parent chain, resume base locally and remotely,
canonical READY digest, claim, sole correction-scoped lease, and zero effect
locks. Updated only P09 `TASK-STATE.yaml`, `HANDOFF.md`, and `NEXT-PROMPT.md`.

No product, test, request, migration, steward, provider, or external-effect
work was performed.

## Exact next action

Commit and push this exact three-runtime-file claim, remote-verify it, report
the claim head to C00, and stop for reconciliation.

## Changed files

- `ops/v2.1-execution/runtime/P09/TASK-STATE.yaml`
- `ops/v2.1-execution/runtime/P09/HANDOFF.md`
- `ops/v2.1-execution/runtime/P09/NEXT-PROMPT.md`

Migrations: none. Steward requests: none.

## External effects

Authority `none`; attempted `0`, succeeded `0`, reconciled `0`. No provider
inspection/mutation, send, enrollment, registration, migration, or steward
application occurred.
