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
`a7bc348b98e79f57618c911c440d3d8713a63d5f`. The current resume claim is
`f5bc9b67-9a49-432f-9ce4-6ebd99d856d9` under containing control head
`af76c4e990f954794de72db639576b3c9dc73ff4`. Resume by requiring C00's
schema-valid recorded assignments and exact applied result heads for
`F01-retired-auth-001`, `F01-retired-client-002`, and
`F01-config-retirement-003`. Verify and acknowledge those results, rerun the
exact inventory/direct-access checks, and publish `ready_for_review`. Do not
cross F01 owned-path authority.
