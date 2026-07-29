# P23 Atomic Copy/Dedupe/Persistence Correction-Claim Handoff

## Exact identity

- Branch: `codex/v21-p23-student-notifications`
- Exact rejected final and claim parent:
  `24ec3a4effc622f384915d892cbaad046e1ea5d1`
- Prior implementation remains:
  `dafdd046b7048e67829b2f2a2496c8b830b23fec`
- Containing authorization:
  `fff9a0a79f2db87ffca97451f8295080b9736549`
- Sole acquisition parent:
  `ca8eb4ab9957b6616664cfd5e944a73608596020`
- Claim: `096ffffc-1637-4602-a9a8-3084e03a50e1`
- Writer: `codex-p23-worker-096ffffc`
- STUDENT_NOTIFICATIONS lease:
  `471de353-37c6-4e38-a6da-d2db92c4b207`
- Lease issued: `2026-07-29T09:18:31Z`
- Lease expiry: `2026-07-29T10:18:31Z`
- Canonical READY digest:
  `67ad844e050bc27b56b0f4de8c7388e60ebac33a14e497e482c409e104020d4b`

The recursively key-sorted READY JSON preimage is 2,814 UTF-8 bytes and
independently hashes to the recorded digest. Local, tracking, and fetched remote
P23 heads were clean and exact before this checkpoint. Immutable packet/source
digests and the true F05/F07 integration-interface ancestry match. Effect locks
are empty; authority is none and effects remain `0 / 0 / 0`.

## Rejection record

C00 rejected final `24ec3a4effc622f384915d892cbaad046e1ea5d1`
despite matching scope/digests, 20 prior focused tests, typecheck, and the
correct route/tab/ancestry behavior:

- locked WNC-8 requires visible **Open schedule** copy while the action route
  remains canonical `/app/student/calendar`; the rejected final says
  **Open calendar**;
- the exact dedupe tuple currently contains raw NUL separators and passes that
  string to PostgreSQL text parameters/columns, which cannot persist NUL;
- prior in-memory tests do not exercise that PostgreSQL boundary.

This handoff records the rejection and fresh claim only. It does not implement
or authorize any product, test, request, migration, or registration correction.
No product tests were run or claimed in this phase.

## Atomic scope and stop

This checkpoint changes exactly P23 `TASK-STATE.yaml`, `HANDOFF.md`, and
`NEXT-PROMPT.md`. Product, tests, structured requests, migrations,
registrations, stewards, providers, sends, and external effects remain
byte-identical and untouched.

C00 must reconcile the exact pushed claim head before P23 changes any other
file. Stop after normal push and remote verification.
