MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Continue One Time v2.1 task P16 from its remote checkpoint.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p16-class-series-occurrences
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/P16.yaml
Task context: ops/v2.1-execution/contexts/P16-CONTEXT.md
Task state: ops/v2.1-execution/runtime/P16/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P16/HANDOFF.md

Stop at this atomic claim checkpoint until C00 reconciles its exact pushed head
and sole parent. The claim is
`0a4c2e0f-6c3d-4e42-aee8-8bfd27ce5c9d` under CLASSROOM_CORE lease
`01453191-8f65-4dcd-8559-9045599dae9b`, expiring
`2026-07-30T01:23:18Z`.

After explicit reconciliation, resume only the bounded classroom repository
migration-compatibility correction: persist non-null `reminder_local_time` for
every class-series insert, persist non-null `reminder_due_at` and
`joinable_until` for every occurrence insert, and prove the exact repository
paths against native PostgreSQL after migrations through 2239.

Do not implement before reconciliation. Do not edit control or integration,
apply steward requests, register, inspect providers, deploy, send, or perform
external effects. Effects remain `0/0/0`.
