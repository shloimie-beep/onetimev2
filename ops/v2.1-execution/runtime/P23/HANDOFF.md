# P23 Atomic Residual-Correction Claim Handoff

## Exact identity

- Branch: `codex/v21-p23-student-notifications`
- Exact rejected final and claim parent:
  `87da1f244ea8e19838c2695678089d1bcbe9687a`
- Corrected implementation remains:
  `8fdeaddb84a6c8e71271711fbd6b095046b6df21`
- Containing authorization:
  `a95a1406200b139b4acd501c7b96821e6f74070a`
- Sole acquisition parent:
  `6b3bb0619f3af04cb5a20a4f8650cc8ec6b042d4`
- Claim: `f7e3fb0e-a8d4-416b-8c79-786a696e2dc4`
- Writer: `codex-p23-worker-f7e3fb0e`
- STUDENT_NOTIFICATIONS lease:
  `f7b63d5e-489c-40aa-a793-9a7210f91bca`
- Lease expiry: `2026-07-29T09:37:54Z`
- Canonical READY digest:
  `976b5c80e4bc3f437301603982168f3b4c7d3247fc8a26831006933d70432204`

The recursively key-sorted READY JSON preimage is 2,806 UTF-8 bytes and
independently hashes to the recorded digest. Local, tracking, and fetched remote
P23 heads were clean and exact before this checkpoint. Effect locks are empty;
authority is none and effects remain `0 / 0 / 0`.

## Residual rejection record

C00 rejected final `87da1f244ea8e19838c2695678089d1bcbe9687a`.
The prior concurrency, retention, privacy, sound, timezone, and idempotency
corrections plus 18 focused tests and typecheck remain accepted, but four
residual defects require correction:

- class-change and cancellation actions use nonexistent
  `/app/student/schedule` instead of canonical `/app/student/calendar`;
- route admission accepts arbitrary `/app/student/*` rather than the closed
  canonical Student route set;
- inactive Read/All tabs use `tabIndex=-1` without Arrow/Home/End handling;
- dependency metadata incorrectly described F05/F07 task heads as ancestors;
  only their integration/interface heads are ancestors, while task heads are
  exact control identity bindings.

This handoff records the rejection and fresh claim only. It does not implement
or authorize any residual product, test, or request correction.

## Atomic scope and stop

This checkpoint changes exactly P23 `TASK-STATE.yaml`, `HANDOFF.md`, and
`NEXT-PROMPT.md`. Product, tests, structured requests, migrations,
registrations, stewards, providers, sends, and external effects remain
byte-identical and untouched.

C00 must reconcile the exact pushed residual-claim head before P23 changes any
other file. Stop after normal push and remote verification.
