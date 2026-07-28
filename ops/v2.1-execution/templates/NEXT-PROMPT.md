MODEL: ${MODEL}
REASONING: ${REASONING}
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Continue One Time v2.1 task ${TASK_ID} from its remote checkpoint.

Repository: shloimie-beep/onetimev2
Branch: ${TASK_BRANCH}
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/${TASK_ID}.yaml
Task context: ops/v2.1-execution/contexts/${TASK_ID}-CONTEXT.md
Task state: ops/v2.1-execution/runtime/${TASK_ID}/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/${TASK_ID}/HANDOFF.md

Fetch remote refs. Derive the containing control commit from
`origin/codex/v21-control`, read this task's exact registry and ready/resume
entry from that remote ref, verify its expected branch head, canonical entry
payload digest, the `ready` or `resume_ready` lease/claim appropriate to the
registered claim mode, package/task/context/dependency and candidate digests,
and reject a live foreign lease or non-fast-forward collision. Then check out
the exact task branch, read task state and handoff
before named work, and resume the recorded `next_action`. If digests match, do
not restart completed work or globally re-audit the repository. Continue until
`${TERMINAL_STATE}` or a permitted stop condition. Update state/handoff/this
next prompt, checkpoint, commit, and push before returning. C00 follows its
serialized `CONTROL-LEASE.yaml` path; I36 follows the explicit bootstrap-branch
adoption rule on its first invocation.
