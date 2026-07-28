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
integrated at `80c281b7ae5826ed2c6abe95ba68a033ffa52174`. F01 is
`resume_ready` at expected branch head
`ae65db9db8113b7992b466a70f64ffa05b4eb1e3` with ready digest
`913ff78ed729865e7d554e2f407afe7b48f7d8451f09907330c91a42fcf050a2`.
The exact next scheduling action is to resume the existing F01 agent and
dispatch F02 and F07 from the integrated start SHA. Their ready payloads are
`8089425dc63820f5c65755815bf1078a66aa28c0d7f84fa199dc0a9a4c2870f9`
and `d4e47e74d85994342c752c1d89287009ac48a8888cc9882781d89683cc93ce1f`.
Hold P31 and P35 until native capacity opens.
Before every later control mutation, acquire a
fresh serialized C00 lease against the exact fetched remote control head;
release it before waiting for workers.
Update C00 state, handoff, and this prompt at every phase; commit and normal-push
each checkpoint. Never implement product code, grant provider authority, or
force-push.
