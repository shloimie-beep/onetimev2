MODEL: GPT-5.6-SOL
REASONING: HIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Resume P22 correction only after C00 has consumed the exact atomic resume claim
head.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p22-learning-engagement
Expected pre-claim head: cad7259304253eff531307fecfc9de298fac1a34
Task packet: ops/v2.1-execution/tasks/P22.yaml
Task context: ops/v2.1-execution/contexts/P22-CONTEXT.md
Task state: ops/v2.1-execution/runtime/P22/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P22/HANDOFF.md

Correction authority binds containing controller
71df400bd85cdca40b4eb0e01fc749f362e3d0e8, acquisition
36451ec88e05bb64be0b27b8bc148166b6fe9837, ready digest
40bb6fd8a17894f529f881d087427047427db54f573bc1cd5cfe36dc6000a2a0,
claim e2ac53ae-128f-4d0c-b9a2-e74d05858f29, and LEARNING_ENGAGEMENT lease
9fd6a3b7-decc-454a-9a2e-953aaaebfe63 expiring 2026-07-29T05:00:52Z.

Before product work, fetch remote refs and verify C00 consumed the exact pushed
resume-claim head, local and remote equal it, the lease remains valid, and no
foreign writer or path collision exists. Read the exact READY correction phase
scope and controller direction before changing product.

Continue only within the P22 owned globs and structured steward-request
allowance. Do not edit migrations, central indexes/composers, root barrels,
manifests, locks, provider registries, control files, or another task's
runtime/evidence. External-effect authority is none.
