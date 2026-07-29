MODEL: GPT-5.6-SOL
REASONING: HIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

P30 is ready for review. Do not resume implementation without a new exact C00
authorization.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p30-campaign-workflows
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/P30.yaml
Task context: ops/v2.1-execution/contexts/P30-CONTEXT.md
Task state: ops/v2.1-execution/runtime/P30/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P30/HANDOFF.md

Implementation `f6d074e964cebefe032042b9627d7c7b47304bdd` is adopted below
corrected-binding claim
`8e9583a9b47b486930e79e3586c36bf882dba375`. C00 consumed that exact
claim at reconciled control head
`268ab601b89573238befe70de7995908925575cc`, whose sole parent is
`5b0356cc30baf4062e50664f9749ebcf97f9d7f4`.

The correction is complete:

1. OT-15 resolves and validates all three exact canonical messages and
   per-step approvals. Because P31 currently provides only step 1, launch and
   delivery fail closed. `P30-copy-registration-001` supplies exact IDs and
   subjects but no invented bodies.
2. OT-16 rejects every adult, expiry, or checkpoint operation-ID mismatch.
3. The worker refreshes paid, explicit-decline, and custom-School eligibility
   after reservation and immediately before send, with zero-send transition
   tests.

Focused tests are 12/12; typecheck, full lint, focused formatting, YAML drift,
secret scan, scope, topology, and digest checks pass. The full unit suite is
566/567 with only the inherited P28 registry-projection count mismatch covered
by `P28-registry-projection-001`. Repository-wide formatting has 2235 inherited
non-P30 files; every material P30 path passes.

The GHL_CAMPAIGNS lease was released at `2026-07-29T00:32:24Z`. External effects
are zero. C00/I36 should verify the exact final head, review the recorded
artifact and steward-request digests, and integrate with ancestry preserved.
OT-15 must remain fail closed until copy registration and exact approvals land.
