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

Fetch remote refs. Verify the exact F07 registry and ready/resume authorization from the remote control ref, exact branch head, claim/lease, package/task/context/dependency digests, then read state and handoff and resume the recorded next action. The F07 v2.1 interface contract is published at implementation head `9faca9c1ad04e3bda269dfabfeb62bcef61808c3`; notify C00/I36 and wait for I36 integration before downstream consumers begin. Continue focused F07-owned responsive/accessibility verification, then persist ready_for_review. Do not edit central composition or global control state.
