MODEL: GPT-5.6-SOL
REASONING: HIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Continue One Time v2.1 task P30 from its remote checkpoint.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p30-campaign-workflows
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/P30.yaml
Task context: ops/v2.1-execution/contexts/P30-CONTEXT.md
Task state: ops/v2.1-execution/runtime/P30/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P30/HANDOFF.md

Fetch remote refs and resume the exact registered branch head. The first-run
atomic claim uses containing control
`62db0bf0de280932b07cf86dd8e03501ca708229`, ready-entry parent
`f0f7ea05f7c50f3ea64782ff107fbfd1c4486c24`, start
`49431959f58f284bdc13ca931acf09f980fc483a`, claim
`9c4e04b6-485c-4d91-aed4-40e2b8be9aab`, ready digest
`2b0b3f114514f1661b3b07c18145826615770148e0d69ab8314c9f19e2d51f42`,
and GHL_CAMPAIGNS lease `e55a881a-4f1c-4667-9edb-1f5be1d9b492`
expiring at `2026-07-29T00:09:14Z`. No effect lock or external authority
exists.

All 200 locked blobs, all 15 source-package blobs, the package/task/context
digests, canonical ready payload, exact P28/P31 dependency bindings, artifact
hashes, and absent branch were verified before the atomic claim. Resume
`TASK-STATE.yaml:next_action` without repeating a broad audit.

Implement only:

- `apps/worker/src/runners/ghl-workflows/campaigns/**`
- `integrations/highlevel/v21/workflow-fragments/P30-campaigns.yaml`
- `packages/domain/src/communications/workflows/campaigns/**`
- P30-local runtime metadata and structured steward requests

Do not edit control files, another task runtime, the canonical GHL registry,
generated projections, a migration, central barrel/composer, package manifest,
lockfile, or any other steward-owned path. Perform no provider or external
effect. Preserve adult-only delivery, exact P31 copy/approval contracts, P28
suppression and dormant-WhatsApp behavior, send-time suppression, and School
exclusion.

Exact next action: inspect only the P28/P31 dependency artifacts and P30-owned
paths, implement the smallest coherent newsletter/reactivation/OT-16 workflow
contract, pass focused verification, submit any required canonical-registry
registration as a P30-local steward request, and finish `ready_for_review` with
a clean normally pushed branch.
