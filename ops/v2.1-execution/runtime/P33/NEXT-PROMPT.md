MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: REVIEW_OR_INTEGRATE

Review and integrate the exact pushed P33 follow-up final; do not resume P33
product work without a new C00-issued lease.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p33-runtime-operations
Task state: ops/v2.1-execution/runtime/P33/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P33/HANDOFF.md
Interface: ops/v2.1-execution/runtime/P33/INTERFACE-CHECKPOINT.yaml

Verify the exact pushed branch head and linear ancestry from reconciled atomic
claim 02cc575a60c0b28e17a2202e6b0e64c144c3c499. The implementation is
7765a3758a3e3aa7d311119b5d86da1e943b68d7 and interface metadata commit is
b1a437487c97ee29b11b3c785479d7b46f05650d. Recompute semantic contract 3.0.0
digest a0aa9fd8c8d4108a0f877966f8e8a0614be7e30feb9699ac48e6506df369ee43,
all seven export hashes, all three steward-request hashes, the exact twelve-path
scope, state/handoff binding, and zero external effects.

Reproduce the three bounded corrections:

1. `scanOperationalLeakage({street_address:'private-value'})` fails with
   `pii_field` and redacts the value; related common address-family keys are
   covered without changing safe allowlists.
2. Queue depth `10`, `retry_count` `9`, scheduled `0`, exhausted `0` is Sev1
   inconsistent evidence and non-ready.
3. Active lease age `600000ms` and fencing-token high-watermark `1` emits Sev1
   `queue_active_lease_stale`; the exported expiry threshold is exactly
   `300000ms`.

Confirm the 68 focused tests, relevant typecheck, focused ESLint, secret scan,
formatting, and diff checks. The lease was released at
2026-07-29T03:11:44Z before its 2026-07-29T03:52:01Z expiry. External-effect
authority is none and effects are 0/0/0. I36 must integrate the exact final
before C00 authorizes P34.
