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

Current exact next action: atomically fast-forward the three-file I36 claim
checkpoint to `origin/codex/v21-integration`, then verify and merge queued F01
interface item `da4bef5a-c064-4fb8-96c4-09a34aa61603` at source
`fa9e5c92231c4b92340d07945cc91d76c85bd444`. Preserve source ancestry, run the
required contract/type checks, update all three I36 runtime files, commit, and
push. Continue until `candidate_frozen`, `evidence_aggregated`, or a permitted
precise blocker.
