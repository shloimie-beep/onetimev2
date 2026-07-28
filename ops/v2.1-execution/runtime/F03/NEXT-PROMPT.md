MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Continue One Time v2.1 task F03 from its remote checkpoint.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-f03-adult-student-auth
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/F03.yaml
Task context: ops/v2.1-execution/contexts/F03-CONTEXT.md
Task state: ops/v2.1-execution/runtime/F03/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/F03/HANDOFF.md

F03 is at `ready_for_review`. Its implementation head is `56fa990c5d4a6cb7b602b5f68fe0d2402a0ee71e`, interface contract digest is `66464e9a769c717dfdfda082bb8a26030da1681d601d6752fb04b10d812db111`, and applied `F01-retired-auth-001` steward-result payload digest is `f557eacfce20aace5ea74ec926e09c949f7d80e660ac44021b445476d5f53f6e`.

Fetch remote refs. Derive the containing control commit from `origin/codex/v21-control`, read F03's exact registry and any `resume_ready` entry from that remote ref, verify its expected branch head, canonical payload digest, new lease/claim, package/task/context/dependency digests, and reject a live foreign lease or non-fast-forward collision. If no new C00 authorization exists, do not write: C00/I36 should validate and integrate the published interface checkpoint, record the applied F01 steward result, notify F01 for acknowledgment, and authorize downstream tasks from the resulting integration head. Under a new exact lease, read task state and handoff first and address only named review or integration feedback. Update state, handoff, and this prompt; commit and push before returning.
