MODEL: GPT-5.6-SOL
REASONING: HIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Resume P30 only after C00 has consumed the atomic correction claim.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p30-campaign-workflows
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/P30.yaml
Task context: ops/v2.1-execution/contexts/P30-CONTEXT.md
Task state: ops/v2.1-execution/runtime/P30/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P30/HANDOFF.md

The correction authorization uses controller
`89ac83c2e816e9726f1ae2d2193e34e3269fb36c`, ready parent
`32c9ef6a0738f0a4fa038f1212ff7019e19992f1`, ready digest
`f7d3413b150bcf942e2a27354bc340c4296ce48b1543df287a6def3b034a611b`,
claim `cea57710-2506-4983-a821-4e23733d0766`, and GHL_CAMPAIGNS
lease `0bc6fecd-2a7c-4c34-8c11-598c03634ab1` expiring at
`2026-07-29T00:51:24Z`.

Before changing product code, verify C00 has consumed the pushed atomic claim
head and that local/remote P30 equal that exact head. Then correct only:

1. OT-15 must fail closed unless all three sequence steps have canonical
   copy/content approval. If shared P31 catalog authority is required, publish a
   P30-local structured steward request rather than editing shared catalog
   paths.
2. OT-16 must reject every caller-supplied operation ID that is not exactly
   equal to the deterministic `ot16OperationId` result for adult, expiry, and
   checkpoint.

Remain inside P30-owned roots plus P30-local runtime/steward requests. Perform
no external effect, provider mutation, migration, central registry/composer
edit, package change, or interface checkpoint. Rerun all six assigned cases and
focused regression verification, then release the lease and return
`ready_for_review`.
