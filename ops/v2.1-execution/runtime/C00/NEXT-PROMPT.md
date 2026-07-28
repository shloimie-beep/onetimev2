MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Continue One Time v2.1 task C00 from its remote checkpoint.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-control
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/C00.yaml
Task context: ops/v2.1-execution/contexts/C00-CONTEXT.md
Task state: ops/v2.1-execution/runtime/C00/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/C00/HANDOFF.md

Fetch remote refs and require the exact remote control head. Read
`CONTROL-STATE.yaml` and resume its first incomplete bootstrap phase. Verify
`LOCKED-SHA256SUMS.txt`, the current control/runtime digests, and the active
C00 lease. Reject any live foreign lease or non-fast-forward collision.

Bootstrap is operational and autonomous native-subagent orchestration is
enabled. The root C00 agent alone dispatches workers; child workers never spawn
product writers or edit control state. F01's interface is verified and
integrated at `80c281b7ae5826ed2c6abe95ba68a033ffa52174`. F01 is waiting
after publishing three immutable steward requests: authentication is assigned
to F03 for `F03_ready_for_review`, while cross-cutting client and config
retirement are assigned to I36. F02 and F07 have independently verified
interface checkpoints at `147934114cb267f86943b1fcff1bbcd6b60cdfaf` and
`47a2bb6b76225951e0599683499a95f4dc9881be`; F07 is also
`ready_for_review` at `2c451d7b1f59eece1ae8df505d4eeec19f42e1ef`.
Migration 2234 is approved in the global mirror. P31 is ready from exact
integration head `80c281b7`. Dispatch P31, and resume I36 only to publish
`renewal_requested` before its existing lease expires. Then issue a renewed
I36 lease for both interface integrations and the two assigned steward
requests. F03 remains gated until F02's interface is integrated; hold P35
until the next capacity slot.
Before every later control mutation, acquire a
fresh serialized C00 lease against the exact fetched remote control head;
release it before waiting for workers.
Update C00 state, handoff, and this prompt at every phase; commit and normal-push
each checkpoint. Never implement product code, grant provider authority, or
force-push.
