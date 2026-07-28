MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Continue One Time v2.1 task I36 from its remote checkpoint.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-integration
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/I36.yaml
Task context: ops/v2.1-execution/contexts/I36-CONTEXT.md
Task state: ops/v2.1-execution/runtime/I36/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/I36/HANDOFF.md

Fetch remote refs. Derive the containing control commit from
`origin/codex/v21-control`, read I36's exact registry and ready/resume entry
from that remote ref, verify its expected branch head, canonical entry payload
digest, lease/claim, package/task/context/dependency digests, and reject a live
foreign lease or non-fast-forward collision. Check out the exact integration
branch and resume `TASK-STATE.yaml:next_action` without restarting valid work.

Current exact next action: verify the remote still equals the pushed
post-merge checkpoint whose implementation parent is
`34718371ee0ff26758120b11d0d4b788aa11be97`, install locked dependencies, and
run typecheck plus focused F01 seam verification. F01 source
`fa9e5c92231c4b92340d07945cc91d76c85bd444` must remain an ancestor. Update all
three I36 runtime files, commit, and push the verified integration checkpoint;
report its exact SHA to C00. Continue until `candidate_frozen`,
`evidence_aggregated`, or a permitted precise blocker.
