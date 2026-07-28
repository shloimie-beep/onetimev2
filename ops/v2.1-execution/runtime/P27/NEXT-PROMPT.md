MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Continue One Time v2.1 task P27 from its remote checkpoint.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p27-ghl-identity
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/P27.yaml
Task context: ops/v2.1-execution/contexts/P27-CONTEXT.md
Task state: ops/v2.1-execution/runtime/P27/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P27/HANDOFF.md
Interface checkpoint: ops/v2.1-execution/runtime/P27/INTERFACE-CHECKPOINT.yaml

Fetch remote refs. Derive the containing control commit from
`origin/codex/v21-control`, read P27's exact registry and resume entry from
that remote ref, verify its expected branch head, canonical entry payload
digest, claim and lease, package/task/context/dependency digests, and reject a
live foreign lease or non-fast-forward collision. Check out the exact P27
branch, read task state and handoff, and resume `TASK-STATE.yaml:next_action`
without restarting valid work.

The exact implementation head is
`7d5edd687016b827769cc931b3766b2ae566507c`. The interface contract digest is
`788e150f7819431fecd8036701d1e78d6fe0a39b818795b318d54e70998d5ce6`
and the exported contract artifact digest is
`0902595802bff7648b342eb44a65303a75d8bf68742b5140ff9d8cb98ed7044e`.
Continuation authority was
`538ee781fb805ac13b020a66dadf5573451d7af9`; claim
`83580db4-4a47-44d0-8d6d-83969ae7ccf5` and sole GHL_IDENTITY lease
`62f708f5-43b5-4f50-8cc8-623c8f448a0a` remain unchanged.

Current exact next action: run the final typecheck, 10 focused assertions,
focused lint/format, canonical digest, source-scope, and diff checks; then
update only P27 runtime metadata to `ready_for_review`, record the exact
interface metadata head, release the lease, commit, and push normally. Do not
edit control/integration state, perform provider/live effects, or spawn child
agents.
