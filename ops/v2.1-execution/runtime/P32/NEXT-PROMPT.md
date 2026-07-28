MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Continue One Time v2.1 task P32 from its pushed interface checkpoint.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p32-privacy-data-rights
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/P32.yaml
Task context: ops/v2.1-execution/contexts/P32-CONTEXT.md
Task state: ops/v2.1-execution/runtime/P32/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P32/HANDOFF.md

Fetch remote refs. Derive the containing control commit from
`origin/codex/v21-control`, read this task's exact registry and ready/resume
entry from that remote ref, verify its expected branch head, canonical entry
payload digest, the `ready` or `resume_ready` lease/claim appropriate to the
registered claim mode, package/task/context/dependency digests, and reject a
live foreign lease or non-fast-forward collision. Then check out the exact task
branch, read task state, interface checkpoint, and handoff before named work,
and resume the recorded `next_action`. Do not change the published interface
artifacts unless a real defect requires a new implementation commit and
checkpoint digest. Re-run the exact final verification suite, update durable
metadata to `ready_for_review`, release the task-local lease in metadata, commit,
and push before returning.
