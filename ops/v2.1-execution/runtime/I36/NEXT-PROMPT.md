MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Resume I36 only after C00 has consumed the exact P13/P25/P26 full-wave atomic
claim head and published explicit target-CAS reconciliation.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-integration
Expected pre-claim target: 44fd536381e7af8885f31247d6bf91dd6266b195
Task packet: ops/v2.1-execution/tasks/I36.yaml
Task context: ops/v2.1-execution/contexts/I36-CONTEXT.md
Task state: ops/v2.1-execution/runtime/I36/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/I36/HANDOFF.md

Authority binds control 8f7a425ac5ba883e04d534857363aee3c4c881be,
acquisition d7df4df6954fcb3cdd06704461f86894285b09f6, ready digest
080fac5c73a526228fc7a8b0c957389362942b7e094decedf1454066bff56862,
claim d17f9dc5-0f97-44ea-bb44-600c6c3635a3, and RELEASE_INTEGRATOR
lease 6077f8e5-c498-405e-9cd8-754340775f53 expiring
2026-07-29T06:46:11Z.

Before source admission, fetch remote control/integration refs and verify C00
consumed the exact pushed claim head, local and remote equal it, the lease
remains valid, and no foreign writer or path collision exists. Read the exact
rebound queue authorization before fetching or reading queued source content.

Do not merge P13, P25, or P26, apply a P13 steward request, create or modify a
migration, perform registration/provider work, or cause an external effect
without explicit post-reconciliation authorization. Effects remain `0/0/0`.
