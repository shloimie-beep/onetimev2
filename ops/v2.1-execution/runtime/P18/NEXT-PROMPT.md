MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Reconcile the atomic P18 launch-grant table-collision claim checkpoint.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p18-embedded-classroom
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/P18.yaml
Task context: ops/v2.1-execution/contexts/P18-CONTEXT.md
Task state: ops/v2.1-execution/runtime/P18/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P18/HANDOFF.md

Fetch remote refs and verify that the P18 branch is a sole-parent child of
`0a384577dec2ea58cbeaf22a247f7c05f6333c27` and changes exactly:

- `ops/v2.1-execution/runtime/P18/TASK-STATE.yaml`
- `ops/v2.1-execution/runtime/P18/HANDOFF.md`
- `ops/v2.1-execution/runtime/P18/NEXT-PROMPT.md`

Confirm control authorization
`9215514029009674d47f327475d6a53e8dd476ef`, acquisition parent
`0d3da54f911d446f86601b21700e26d1cfc57da5`, READY digest
`80b85a7bf27c621d6fe57ebca391d0cee372ee0ab1af4520822eead5504c04e3`,
claim `61b4324b-03b7-4d7a-a658-6c3a3091fb80`, and lease
`65bbf2a3-564f-407d-aa21-ba572f5fd1fe`.

This is an atomic-claim-only checkpoint. Stop before editing repository,
schema-contract, test, migration, or steward-request artifacts. Do not create
`P18-migration-002`; do not edit the protected legacy migration or rejected
`P18-migration-001`; do not perform provider/live effects. C00 must reconcile
the exact claim head and issue an explicit resume before correction
implementation begins.
