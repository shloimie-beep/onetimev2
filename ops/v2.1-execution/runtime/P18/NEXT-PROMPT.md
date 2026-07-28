MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Continue One Time v2.1 task P18 from its remote checkpoint.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p18-embedded-classroom
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/P18.yaml
Task context: ops/v2.1-execution/contexts/P18-CONTEXT.md
Task state: ops/v2.1-execution/runtime/P18/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P18/HANDOFF.md

Fetch remote refs. Derive the containing control commit from
`origin/codex/v21-control`, read P18's exact registry and ready/resume entry
from that remote ref, verify its expected branch head, canonical entry payload
digest, claim/lease, package/task/context/dependency digests, and reject a live
foreign lease or non-fast-forward collision. Check out the exact P18 branch,
read task state and handoff, and resume `TASK-STATE.yaml:next_action` without
restarting valid work.

First-claim authority is containing control
`e847dd790ae2f99ae526b0edcbd41897474c8f18`, authorized start
`9ba92b070eedfa3756eff4f78fd328de72507a96`, claim
`415e950e-cfbb-4635-9f1a-3ffd6af825ac`, sole EMBEDDED_CLASSROOM lease
`d44e1690-90e5-44b6-b17f-2faa92dfb220` through
`2026-07-28T22:55:38Z`, and ready digest
`5bd82837c0f7aa83ac813092c767f1dec82f2671f7ea6562e53313c4325586f5`.

Current exact next action: report the pushed atomic claim checkpoint to C00,
then inspect only P18-owned paths and named source sections. Implement the
embedded authenticated join authorization, Student-bound 60-second single-use
bootstrap, 30-second heartbeat and 90-second single-device lease with
same-session reconnect/Admin reset, open-occurrence and versioned recording
consent gates, and reconciled attendance truth. Continue through task-owned
verification and terminal `ready_for_review`. Do not edit control/integration
state, another task's runtime, migrations, central registration, or perform
provider/live effects.
