MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Continue One Time v2.1 task F05 from its remote checkpoint.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-f05-api-jobs-foundation
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/F05.yaml
Task context: ops/v2.1-execution/contexts/F05-CONTEXT.md
Task state: ops/v2.1-execution/runtime/F05/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/F05/HANDOFF.md

Fetch remote refs. Derive the containing control commit from
`origin/codex/v21-control`, read F05's exact registry and ready/resume entry from
that remote ref, verify its expected branch head, canonical entry payload
digest, unexpired lease/claim, package/task/context/dependency digests, and
reject a live foreign lease or non-fast-forward collision. Check out the exact
task branch and read state/handoff before named work. If a new resume lease is
required, wait for C00 to issue it; never self-extend. Resume `next_action`
without repeating completed validation. Current next action: independently
recompute interface/artifact digests at implementation head `1ade14c5`, validate
exact scope and remote ancestry, then publish final `ready_for_review` metadata
and release the task-local writer lease. Update and push state, handoff, and this
prompt before returning.
