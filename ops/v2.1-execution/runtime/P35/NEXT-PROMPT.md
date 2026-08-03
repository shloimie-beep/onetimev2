MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Continue One Time v2.1 task P35 from its remote checkpoint.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p35-domain-transition-archive
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/P35.yaml
Task context: ops/v2.1-execution/contexts/P35-CONTEXT.md
Task state: ops/v2.1-execution/runtime/P35/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P35/HANDOFF.md

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

This branch is `ready_for_review`. Exact next action: C00/I36 should review and
integrate implementation head `6b92adbf893c45f4a767b8036ec41b52744cce4e`,
then route `P35-route-registration-001`, `P35-config-deploy-001`, and
`P35-reregistration-integration-001` to their named central/P08/P27 owners. On
a future C00-issued resume lease, address only a reproduced P35-scoped finding.
