MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Resume P33 only after C00 has consumed the exact atomic claim head.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p33-runtime-operations
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/P33.yaml
Task context: ops/v2.1-execution/contexts/P33-CONTEXT.md
Task state: ops/v2.1-execution/runtime/P33/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P33/HANDOFF.md

The first-run authorization uses containing controller
`eb3b0e1deecbffe05177a07df0d8e52d648d109c`, sole parent
`de271a6cab5fc74e8c77b5defc302094fe9a22fc`, authorized start
`49431959f58f284bdc13ca931acf09f980fc483a`, ready digest
`05f3889c9a8341075e3fb49d25093149c2dfaf14f9470900ab69dda1fd70fc4e`,
claim `e0ba9363-1e4e-41eb-b8fb-35043bd09881`, and OPERATIONS_RUNTIME
lease `c32b860e-8054-469c-a9cc-8ece0c5fe584` expiring at
`2026-07-29T01:38:10Z`.

Before any product work, verify C00 consumed the exact pushed claim head and
that local and remote P33 equal that head. Then read the task state and handoff,
preserve the verified F05/F06 dependency bindings, and implement only the
assigned runtime identity, migration/queue/provider health, redacted
diagnostics, and leakage-monitoring behavior inside P33-owned roots.

The task requires an interface checkpoint for P34. Central app/worker
registration, config, dependency, deployment, package, migration, and other
shared changes require structured task-local steward requests; do not edit
those hotspots. Perform no external effect without a separately reconciled
effect-lock authority.
