MODEL: GPT-5.6-SOL
REASONING: HIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Resume P09 only after C00 reconciles the exact pushed correction atomic-claim
head and issues the next explicit authorization.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p09-school-inquiry
Rejected final / resume base: a81e5e98e21eeb1df8d0ff21dd6b948a33a65d46
Correction control: 9d2b0015dd8fe3420e6391e460fccb78fd8911fa
Sole acquisition parent: b0dc03dc140dd05ab8ae65530cd672c8c10126e5
READY digest: 505e68237f3d2d0401e4727b9a8111a330026f994344ca804d83a6692a09f766
Claim: 555a5878-9a7f-4486-a6e0-a959dc9ab1a1
SCHOOL_INQUIRY lease: 8ca16a74-fa49-4c61-8aa8-b50416b50913
Lease expires: 2026-07-29T12:26:54Z
Phase scope: P09_atomic_claim_concurrency_optional_acknowledgment_correction_only
Effect locks: none

Task state: ops/v2.1-execution/runtime/P09/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P09/HANDOFF.md

After explicit reconciliation, correct only:

- database-bound same-normalized-email concurrency so one durable inquiry and
  one acknowledgment intent win;
- truly optional phone and note persistence with no invented values; and
- acknowledgment generation/delivery bound to the exact approved notification
  template/configuration.

For this atomic claim, do not edit or test product code or structured requests.
Do not apply migration/steward work, inspect or mutate a provider, send a
message, or perform any external effect. Effects remain `0/0/0`.
