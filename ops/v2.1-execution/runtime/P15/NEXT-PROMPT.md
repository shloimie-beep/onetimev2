MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Continue One Time v2.1 task P15 from its remote checkpoint.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p15-calendar
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/P15.yaml
Task context: ops/v2.1-execution/contexts/P15-CONTEXT.md
Task state: ops/v2.1-execution/runtime/P15/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P15/HANDOFF.md

Fetch remote refs and derive the containing control commit. Verify P15's exact
registry and ready/resume entry, expected branch head, canonical payload digest,
unexpired lease/claim, package/task/context/dependency digests, and reject a
foreign lease or non-fast-forward collision. Check out the exact branch and
read task state/handoff before named work. If a new resume lease is required,
wait for C00; never self-extend. Resume `next_action` without repeating
completed validation. Continue to `ready_for_review` or a permitted stop
condition, updating and pushing state, handoff, and this prompt before
returning.
