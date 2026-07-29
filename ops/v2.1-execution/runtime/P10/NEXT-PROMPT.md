MODEL: GPT-5.6-SOL
REASONING: HIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Continue One Time v2.1 task P10 from its remote terminal checkpoint.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p10-admin-directory
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/P10.yaml
Task context: ops/v2.1-execution/contexts/P10-CONTEXT.md
Task state: ops/v2.1-execution/runtime/P10/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P10/HANDOFF.md

Fetch remote refs and derive the containing control commit. Verify P10's exact
registry entry, expected branch head, released claim/lease, package/task/context
and dependency digests, implementation artifact digest, steward-request digest,
task state, and handoff before named work.

P10 is `ready_for_review`. Its implementation head is
`3abb4bb96929400838f0270586c5c459c8c6f9ed` and implementation artifact
digest is `600eb180ae6aa873702ef0018353f89a3d647bf2ee1381d54bc78e1a824975a8`.
I36 must review and integrate that exact head, then disposition
`P10-MIGRATION-001` and `P10-REGISTRATION-001` without semantic weakening.
Do not resume P10 implementation without a new exact C00 authorization against
the final remote head.
