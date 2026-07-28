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
product writers or edit control state. F01 is actively claimed on
`codex/v21-f01-foundation-seams` and has published verified `interface_ready`
head `fa9e5c92231c4b92340d07945cc91d76c85bd444`. The exact next scheduling
action is to resume the already-claimed I36 worker for merge
`da4bef5a-c064-4fb8-96c4-09a34aa61603` against the rebound integration CAS
head `3277915caf862bdaa79776794862e6bdbc5762d5`, then verify its pushed result.
The merge payload digest is
`1db016597e3e76f5213fb775f2fce031401f6f530dc6f7e89716fbf2c65c4bf5`;
the independently verified source delta base and merge base remain
`ae02b193f67bf9ef04887a7b0aebb449d3fb8bc0`.
Before every later control mutation, acquire a
fresh serialized C00 lease against the exact fetched remote control head;
release it before waiting for workers.
Update C00 state, handoff, and this prompt at every phase; commit and normal-push
each checkpoint. Never implement product code, grant provider authority, or
force-push.
