MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Continue One Time v2.1 task F01 from its remote checkpoint.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-f01-foundation-seams
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/F01.yaml
Task context: ops/v2.1-execution/contexts/F01-CONTEXT.md
Task state: ops/v2.1-execution/runtime/F01/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/F01/HANDOFF.md

Fetch remote refs. Derive the containing control commit from
`origin/codex/v21-control`, read F01's exact registry and ready/resume entry
from that remote ref, verify its expected branch head, canonical entry payload
digest, the `ready` or `resume_ready` lease/claim appropriate to the registered
claim mode, package/task/context/dependency digests, and reject a live foreign
lease or non-fast-forward collision. Then check out the exact task branch, read
task state and handoff before named work, and resume the recorded `next_action`.
If digests match, do not restart completed work or globally re-audit the
repository. Continue until `ready_for_review` or a permitted stop condition.
Update state, handoff, and this next prompt; checkpoint, commit, and push before
returning.

The stable interface implementation head is
`bb7664c44444bf1704d9f63e5c19a15381f2f0b0`; verify
`INTERFACE-CHECKPOINT.yaml`. The retirement implementation checkpoint is
`a7bc348b98e79f57618c911c440d3d8713a63d5f`. F01 has acknowledged the exact
I36 rejected results for `F01-retired-client-002` and
`F01-config-retirement-003` from result-record head
`1976033cfdae1beb249642f0e28f6824b0fcbb8b`. Resume only after F03 publishes
the exact `F01-retired-auth-001` result at `F03_ready_for_review` and C00 issues
an exact F01 acknowledgment claim against this branch head. Verify and
acknowledge that result, then publish `ready_for_review`. Do not cross F01
owned-path authority.
