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

Fetch remote refs. Verify the exact F07 registry and resume authorization from the remote control ref, including the expected remote head and a new C00-issued lease, then read state and handoff. F07 is `ready_for_review`; its interface metadata head is `47a2bb6b76225951e0599683499a95f4dc9881be` and implementation head is `a90baae8cf69d6823af6d741161fe0e9e7441321`, with artifact hashes computed from Git blob bytes. Do not create a replacement branch or edit central composition/global control state. Address only review or integration feedback.
