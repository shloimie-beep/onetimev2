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
retirement are assigned to I36. F07 has an independently verified interface at
`47a2bb6b76225951e0599683499a95f4dc9881be` and is `ready_for_review`
at `2c451d7b1f59eece1ae8df505d4eeec19f42e1ef`. F02 superseded its first
interface before integration to harden database fencing; ordinal 2234 remains
reserved with status `superseded_pending_replacement`. Do not integrate the
old `14793411` checkpoint. P31 is rebound with ready digest
`e6623d77ff1fb4db02ec7df38595fa011aa0446b720c4a8f80c5ebaca8493b74`.
I36 has exact takeover resume digest
`2baec3cd42b79c9156c2202e23792d0072cc2009185b9dc5fbc4be5e4d6918b0`
against integration head `80c281b7`. Dispatch P31 and I36. I36 merges only
F07 and applies its two assigned F01 requests; admit F02 only after its new
replacement checkpoint. F03 stays gated and P35 waits for the next slot.
Before every later control mutation, acquire a
fresh serialized C00 lease against the exact fetched remote control head;
release it before waiting for workers.
Update C00 state, handoff, and this prompt at every phase; commit and normal-push
each checkpoint. Never implement product code, grant provider authority, or
force-push.
