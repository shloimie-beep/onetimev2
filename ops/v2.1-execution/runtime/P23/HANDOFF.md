# P23 Atomic Correction-Claim Handoff

## Exact identity

- Branch: `codex/v21-p23-student-notifications`
- Exact rejected final and correction-claim parent:
  `39b050949a0874a1ea397c6c3f3420eb4fa19ccc`
- Prior implementation checkpoint:
  `c1dc94bedac647dab9e1136bd0971cb3d6c57456`
- Containing correction authorization:
  `a96477209a5dc6e32b43460eb775bd99f5cba1fc`
- Sole acquisition parent:
  `78626d9be8f42e3cd4ca1f0c2f8ea3e656122bb1`
- Correction claim: `29e8b1d9-8769-479d-8a7a-df26137f185a`
- Writer: `codex-p23-worker-29e8b1d9`
- STUDENT_NOTIFICATIONS lease:
  `489df25a-c3ed-4b34-8bb8-ddb6e8d88b99`
- Lease issued: `2026-07-29T07:21:29Z`
- Lease expiry: `2026-07-29T08:21:29Z`
- Canonical READY digest:
  `2f57bb42123e7879658d8a063ea6c14b256bbef8c2b26b72e1714e3c9cf7ed97`
- Atomic correction-claim head: derive with `git rev-parse HEAD`; C00 records
  the exact observed remote head.

The recursively key-sorted READY JSON preimage is 2766 UTF-8 bytes and
independently hashes to the recorded digest.

## Rejection record

C00 rejected final `39b050949a0874a1ea397c6c3f3420eb4fa19ccc`
despite its valid ancestry, 18-path mechanical scope, 13 focused tests, and
passing typecheck. Independent source review and direct probes identified:

- generated and accepted routes do not use canonical `/app` prefixes;
- cancellation-first followed by a stale reminder can leave both active;
- concurrent different source versions can both remain active;
- superseded indefinite notices do not reach archive;
- runtime status text is not constrained against private-copy leakage;
- no UI audible-cue consumer exists;
- locked Rabbi Eli copy remains mutable;
- the UI renders raw ISO timestamps;
- mark-one can perform repeat writes;
- accessibility proof is incomplete.

This handoff records the rejection only. It does not implement or authorize a
correction.

## Atomic scope and stop

This checkpoint changes exactly P23 `TASK-STATE.yaml`, `HANDOFF.md`, and
`NEXT-PROMPT.md`. Product, tests, immutable requests, migrations,
registrations, stewards, providers, sends, and external effects remain
byte-identical and untouched.

C00 must reconcile the exact pushed correction-claim head before P23 changes
any other file. Stop after normal push and remote verification.

## External effects

Authority is `none`; attempted `0`, succeeded `0`, reconciled `0`.
