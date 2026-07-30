MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Continue One Time v2.1 task F04 from its remote checkpoint.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-f04-household-identity
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/F04.yaml
Task context: ops/v2.1-execution/contexts/F04-CONTEXT.md
Task state: ops/v2.1-execution/runtime/F04/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/F04/HANDOFF.md

Current durable status is `ready_for_review`. The stable interface metadata
head is `4cc95c29c6012174595ba1821e0554aca8572e08`, the final implementation
head is `8ba3f6c83ed3d7239ae672e938829ec9c572cd6b`, and the interface contract
digest is `a57837379bfc8210188887ff31937ed7882befe10b80941499dc7ba305e7984d`.
Do not continue implementation unless C00 issues an exact `resume_ready`
authorization against the observed final remote head.

Fetch remote refs. Derive the containing control commit from
`origin/codex/v21-control`, read F04's exact registry and ready/resume entry
from that remote ref, verify its expected branch head, canonical entry payload
digest, the `ready` or `resume_ready` lease/claim appropriate to the registered
claim mode, package/task/context/dependency digests, and reject a live foreign
lease or non-fast-forward collision. Then check out the exact task branch, read
task state and handoff before named work, and resume the recorded `next_action`.
If digests match, do not restart completed work or globally re-audit the
repository. Continue until `ready_for_review` or a permitted stop condition.
Update state, handoff, and this next prompt; checkpoint, commit, and push before
returning.
