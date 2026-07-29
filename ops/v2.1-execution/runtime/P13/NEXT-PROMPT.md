MODEL: GPT-5.6-SOL
REASONING: HIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Resume P13 only after C00 has consumed the exact pushed atomic-claim head and
issued an explicit post-reconciliation continuation.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p13-parent-summary
Authorized start: 44fd536381e7af8885f31247d6bf91dd6266b195
Task packet: ops/v2.1-execution/tasks/P13.yaml
Task context: ops/v2.1-execution/contexts/P13-CONTEXT.md
Task state: ops/v2.1-execution/runtime/P13/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P13/HANDOFF.md

Authority binds released control
86c4e9a640dbcff2f2de1ef85eb42ee433f22ae8, state-based acquisition
f98ee8e79018e5875e9c2be3d5961954b3c5ce04, ready digest
3bcc2c707a0d6fdd26bc8f3a3bc42c0b7cacb6bd91c2e3f7b8de0106542ff709,
claim 183a8dcb-d283-4e3e-b49b-790ca35e5f70, and PARENT_SUMMARY_UI
lease cef8335b-8c6f-4111-9bc7-1f877c9cae15 expiring
2026-07-29T06:11:30Z.

Before implementation, fetch remote control and task refs; verify C00 consumed
the exact atomic-claim head, the local and remote branch equal that head, the
lease remains valid, and no foreign writer or path collision exists. Read the
exact rebound authorization before inspecting named implementation files.

Do not perform product/source, steward, migration, provider, deployment,
registration, or external-effect work without explicit post-reconciliation
authorization. External effects remain `0/0/0`.
