MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Audit the terminal P18 launch-grant table-collision correction.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p18-embedded-classroom
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/P18.yaml
Task context: ops/v2.1-execution/contexts/P18-CONTEXT.md
Task state: ops/v2.1-execution/runtime/P18/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P18/HANDOFF.md

Fetch remote refs and verify that the final P18 branch head is a sole-parent
child of correction claim checkpoint
`d315c47ff9e616ef7909c6edce85a226c5e4fbec` and changes exactly:

- `packages/db/src/classroom/attendance/repository.ts`
- `packages/db/src/classroom/attendance/repository.test.ts`
- `packages/db/src/classroom/attendance/schema-contract.ts`
- `ops/v2.1-execution/runtime/P18/steward-requests/P18-migration-002.yaml`
- `ops/v2.1-execution/runtime/P18/TASK-STATE.yaml`
- `ops/v2.1-execution/runtime/P18/HANDOFF.md`
- `ops/v2.1-execution/runtime/P18/NEXT-PROMPT.md`

Confirm `ready_for_review`, released lease, claim reconciliation
`8241e5527b7cfbdf12cdeb0c3916fb259a6a7054`, and exact-request
reauthorization `01e2b7c694563caa29826f8dc0bbb76ee0b4a9cc`.

Verify correction manifest
`533b480bb3f7f71c2798a765d63abb3cd1d2200b4be6c5f4b85687ca72b88d51`,
repository raw digest `fff7c15f…`, schema raw digest `f2437b95…` with version
`1.0.1`, and `P18-migration-002` raw/canonical digests
`d1151073…` / `e1423a8a…`. Confirm the repository regression exercises insert,
load, bootstrap-consume, and reset against only
`onetime.classroom_launch_grants_v21`.

Confirm the protected legacy migration remains blob `7ee99d11…`, rejected
`P18-migration-001` remains blob `5975b103…`, and effects remain `0/0/0`.
P18 is complete and its lease is released. C00 audits and integrates this exact
head; F02 independently adjudicates `P18-migration-002`. Do not allocate or
write migration SQL, edit control/integration state, or perform provider/live
effects.
