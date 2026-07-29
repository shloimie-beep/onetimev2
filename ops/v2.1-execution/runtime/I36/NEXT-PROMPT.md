MODEL: GPT-5.6-SOL
REASONING: HIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Resume I36 only after C00 has consumed the exact P12/P22/P34 full-wave atomic
claim head.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-integration
Expected pre-claim head: d075dc1839660205845e7da039a182bbe44778d2
Task packet: ops/v2.1-execution/tasks/I36.yaml
Task context: ops/v2.1-execution/contexts/I36-CONTEXT.md
Task state: ops/v2.1-execution/runtime/I36/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/I36/HANDOFF.md

Authority binds containing control
c9e0551de2dc6dab48eef5eafd8c2173b7d9a345, acquisition
9d34bfde201251ac87766ae5d182421517bb1e73, ready digest
f7c20f2301d048a0674eb7af6eac965ce759a195e3d1309b40b1fa9242d754ec,
claim 2fd3ab04-0ab1-4fa5-a4bb-1dc9dfa7bcfa, and RELEASE_INTEGRATOR lease
08ea5a46-06b1-466e-a6f2-b1947f4ed402 expiring 2026-07-29T05:43:32Z.

Before any admission work, fetch remote control/integration refs and verify C00
consumed the exact pushed claim head, local and remote equal it, the lease
remains valid, and no foreign writer or path collision exists. Then read the
exact rebound authorization before fetching or reading queued source content.

Do not merge P12, P22, or P34, adjudicate/apply a steward request, create or
modify a migration, perform provider/deployment/registration/legal-approval
work, or cause an external effect without the explicit post-reconciliation
authorization. External-effect authority is none.
