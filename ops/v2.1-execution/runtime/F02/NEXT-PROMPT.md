MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Continue One Time v2.1 task F02 from its remote checkpoint.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-f02-schema-state-migrations
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/F02.yaml
Task context: ops/v2.1-execution/contexts/F02-CONTEXT.md
Task state: ops/v2.1-execution/runtime/F02/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/F02/HANDOFF.md

Fetch remote refs. Derive the containing control commit from
`origin/codex/v21-control`, read this task's exact registry and ready/resume
entry from that remote ref, verify its expected branch head, canonical entry
payload digest, the `ready` or `resume_ready` lease/claim appropriate to the
registered claim mode, package/task/context/dependency digests, and reject a
live foreign lease or non-fast-forward collision. Then check out the exact
task branch, read task state and handoff before named work, and resume the
recorded `next_action`. If digests match, do not restart completed work or
globally re-audit the repository. Continue until `ready_for_review` or a
permitted stop condition. Update state/handoff/this next prompt, checkpoint,
commit, and push before returning.

Exact next action: review and integrate the superseding F02 interface
checkpoint whose implementation head is
`191dac288ea1721bdc0252bd012060ca974d2242` and contract digest is
`84f156979d7a853071c55584bb404672b01b9058de0c97cf304871e54b08b950`.
Refresh the control-plane migration allocation mirror to migration checksum
`d1352c5e46ae56ca549c9939ef739923109b4a0ab04f0d4df00c04dca71ccb22`.
F02 is `ready_for_review`; do not resume implementation without a new exact
C00 resume lease against the final remote head.
