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
`ebdca6e9-aa5b-411b-88fd-747089e869ce` under CLASSROOM_CORE lease
`8c250e39-5c4d-4684-93ba-2ff373a1253a`, expiring
`2026-07-30T02:31:25Z`. It binds containing control
`27100588cff40879024c88e11213864a1245741a`, sole acquisition parent
`a84c647b2926b782b4b9b4289389d8584293ebbe`, canonical READY digest
`bfbe5b37da8dd4e6acb36c5d57ea68a365d81fae50a95c53bb738e7e07c70be5`,
and canonical control-state digest
`c54becb37cc4bb37236c2efa0b2944ea70739a5d0c05ff667cec215d015c29ae`.

After explicit reconciliation, resume only the bounded P16 repository
weekday-encoding compatibility correction. Preserve the public/domain `0..6`
convention; encode Sunday `0` as database `7` and weekdays `1..6` unchanged on
write, decode database `7` back to Sunday `0` on read without changing order,
prove canonical `[0,1,2,3,4]` to `[7,1,2,3,4]` and back, and reject absent,
non-integer, out-of-range, or duplicate weekday sets before persistence.
Rerun native PostgreSQL through exact migration 2239 plus focused tests,
typecheck, lint, format, secret, diff, scope, released-lease, and zero-effect
gates.

Do not implement before reconciliation. Do not edit migrations, contracts,
domain weekday semantics, interfaces, steward requests, control or integration;
do not register, inspect providers, deploy, send, or perform external effects.
Effects remain `0/0/0`.
