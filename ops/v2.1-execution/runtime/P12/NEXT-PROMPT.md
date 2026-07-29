MODEL: GPT-5.6-SOL
REASONING: HIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Resume One Time v2.1 task P12 only after C00 reconciles its exact atomic
correction claim.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p12-parent-household
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/P12.yaml
Task context: ops/v2.1-execution/contexts/P12-CONTEXT.md
Task state: ops/v2.1-execution/runtime/P12/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P12/HANDOFF.md
Interface checkpoint: ops/v2.1-execution/runtime/P12/INTERFACE-CHECKPOINT.yaml

The fresh correction entry is contained by control
`71df400bd85cdca40b4eb0e01fc749f362e3d0e8` with sole
parent/acquisition `36451ec88e05bb64be0b27b8bc148166b6fe9837`,
expected existing head `7c06fe62e8555aeafa917e855e34f9cc07e3ce3b`,
claim `eedf369a-f247-481b-bca6-7e48abdf1f26`, and
PARENT_HOUSEHOLD_UI lease `3f2cd863-1f04-40fa-875b-87c14469a454`
issued at `2026-07-29T04:00:52Z` and expiring at
`2026-07-29T05:00:52Z`. The canonical ready-entry digest is
`a9df3b69b8177c1e0e589109de5aff4260bdb99471f12ff7de0a915166824e8b`.
No effect lock or external authority exists.

This atomic checkpoint changes only the three P12 runtime-memory files and must
be reconciled by C00 before correction work begins. The bounded correction is:

- Hard-cap active Student capacity at three even when repository data carries a
  larger `student_allowance`.
- Prevent duplicate persistence, household revision increment, enrollment
  effect, session-revocation effect, or audit emission when archive is
  resubmitted for an already archived Student or restore is resubmitted for an
  already active Student.
- Add direct domain and service negative regression tests for those exact
  boundaries.

After exact C00 reconciliation, work only in the existing P12-owned paths and
P12 runtime/interface metadata. Refresh the corrected implementation and
interface digests, rerun focused tests/typecheck/lint/format/scope/secret
verification, release the fresh lease, and publish `ready_for_review`.
External effects must remain attempted `0`, succeeded `0`, reconciled `0`.
