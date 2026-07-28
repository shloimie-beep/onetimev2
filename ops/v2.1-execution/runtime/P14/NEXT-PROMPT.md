MODEL: GPT-5.6-SOL
REASONING: HIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Continue One Time v2.1 task P14 from its remote checkpoint.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p14-student-app
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/P14.yaml
Task context: ops/v2.1-execution/contexts/P14-CONTEXT.md
Task state: ops/v2.1-execution/runtime/P14/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P14/HANDOFF.md

Fetch remote refs and derive the containing control commit. Verify the exact
P14 registry/ready entry, branch head, claim, lease, package/task/context and
dependency digests, then read task state plus handoff before named work.
Resume the recorded next action. Continue through the required interface,
implementation, verification, and ready_for_review checkpoints without editing
global control or shared steward paths and without live effects.
