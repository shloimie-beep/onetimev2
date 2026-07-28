MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Continue One Time v2.1 task C00 from its remote checkpoint.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-control
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/C00.yaml
Task context: ops/v2.1-execution/contexts/C00-CONTEXT.md
Task state: ops/v2.1-execution/runtime/C00/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/C00/HANDOFF.md

Fetch remote refs and require the exact remote control head. Read
`CONTROL-STATE.yaml` and resume its first incomplete bootstrap phase. Verify
`LOCKED-SHA256SUMS.txt`, the current control/runtime digests, and the active
C00 lease. Reject any live foreign lease or non-fast-forward collision.

The exact next action is to validate that a fresh agent reading `AGENTS.md`
reaches the v2.1 authority first, then checkpoint `agents_updated`. Continue
through baseline measurement, package/control validation, the control push
canary, integration-branch creation, control initialization, and `operational`.
Update C00 state, handoff, and this prompt at every phase; commit and normal-push
each checkpoint. Never implement product code, grant provider authority, or
force-push.
