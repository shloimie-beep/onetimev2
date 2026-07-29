MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Continue One Time v2.1 task P34 only after C00 reconciles the atomic
branch-creation claim.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p34-operations-recovery
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/P34.yaml
Task context: ops/v2.1-execution/contexts/P34-CONTEXT.md
Task state: ops/v2.1-execution/runtime/P34/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P34/HANDOFF.md

Fetch remote refs. Require C00 to have reconciled claim
`d1959518-2cbc-49a8-9d39-ddd38a06564e` and to publish `resume_ready` against
this pushed claim head with an exact unexpired OPERATIONS_RECOVERY lease.
Recompute the canonical READY payload digest and reject any head, claim, lease,
or writer collision.

Only after that reconciliation, read the locked execution contract, P34 task
packet and context, current task state and handoff, named dependency handoffs,
and only the named implementation/evidence scope. Until then, do not inspect or
edit product, runbook, or script scope and do not perform any external effect.
