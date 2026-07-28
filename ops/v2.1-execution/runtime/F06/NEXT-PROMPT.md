MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Continue One Time v2.1 task F06 from its remote checkpoint.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-f06-provider-core
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/F06.yaml
Task context: ops/v2.1-execution/contexts/F06-CONTEXT.md
Task state: ops/v2.1-execution/runtime/F06/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/F06/HANDOFF.md

Fetch remote refs. Derive the containing control commit from
`origin/codex/v21-control`, read this task's exact registry and ready/resume
entry from that remote ref, verify its expected branch head, canonical entry
payload digest, the `ready` or `resume_ready` lease/claim appropriate to the
registered claim mode, package/task/context/dependency digests, and reject a
live foreign lease or non-fast-forward collision. Then check out the exact task
branch, read task state and handoff before named work, and resume the recorded
`next_action`. If digests match, do not restart completed work or globally
re-audit the repository. Continue until `ready_for_review` or a permitted stop
condition. Update state/handoff/this next prompt, checkpoint, commit, and push
before returning.
