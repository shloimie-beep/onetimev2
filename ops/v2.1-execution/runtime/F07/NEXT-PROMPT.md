MODEL: GPT-5.6-TERRA
REASONING: HIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Continue One Time v2.1 task F07 from its remote checkpoint.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-f07-design-system-shells
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/F07.yaml
Task context: ops/v2.1-execution/contexts/F07-CONTEXT.md
Task state: ops/v2.1-execution/runtime/F07/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/F07/HANDOFF.md

Fetch remote refs. Verify the exact F07 registry and ready/resume authorization from the remote control ref, exact branch head, claim/lease, package/task/context/dependency digests, then read state and handoff and resume the recorded next action. Do not restart completed work. Verify immutable digests through Git blobs because the local checkout may have line-ending conversion. Inspect only F07-owned paths and the F01 client-router interface. Implement versioned design-system exports, accessible responsive shell/navigation primitives, publish the required interface checkpoint, then finish at ready_for_review with committed and pushed runtime records.
