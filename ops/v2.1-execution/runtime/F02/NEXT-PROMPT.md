MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Reconcile the atomic F02 Migration Lease A claim checkpoint.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-f02-schema-state-migrations
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/F02.yaml
Task context: ops/v2.1-execution/contexts/F02-CONTEXT.md
Task state: ops/v2.1-execution/runtime/F02/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/F02/HANDOFF.md

Fetch remote refs and verify the F02 branch is a sole-parent child of
`e4673ff1c2e621e26ac93034be245b280c4da4fa` changing exactly:

- `ops/v2.1-execution/runtime/F02/TASK-STATE.yaml`
- `ops/v2.1-execution/runtime/F02/HANDOFF.md`
- `ops/v2.1-execution/runtime/F02/NEXT-PROMPT.md`

Confirm containing control `7f6f3508e188dfa1334b39e3ff00904feab47a0b`,
sole acquisition parent `296b7002922504b10aa88f5bf6e8c9163ed10ec7`,
authorized integration `26cbebdf828ba9ff485961adb4f90c460c2dbaf9`,
READY digest `c470a17f3ddd334bb5c4ffa66f51a2e67d773bf937a95d09c9b267476b18f501`,
claim `dc6ba41d-f01a-43f5-b8d7-e43c6b8a7e54`, and shared lease
`59450be9-031a-4db8-aec1-9a584ba04f2f`.

This is an atomic-claim-only checkpoint. Confirm `next_available_ordinal: 2235`,
zero `2235-2238` filename collisions, four exact opaque plan bindings, and
effects `0/0/0`. Stop before reading requester content, editing
`MIGRATION-ALLOCATIONS-PROPOSAL.yaml`, or authoring SQL. C00 must reconcile the
exact claim head before any Lease A implementation begins.
