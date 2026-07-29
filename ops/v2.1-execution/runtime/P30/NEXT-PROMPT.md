MODEL: GPT-5.6-SOL
REASONING: HIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Resume P30 only after C00 has consumed the corrected-binding atomic claim.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p30-campaign-workflows
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/P30.yaml
Task context: ops/v2.1-execution/contexts/P30-CONTEXT.md
Task state: ops/v2.1-execution/runtime/P30/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P30/HANDOFF.md

The corrected-binding authorization uses repaired containing controller
`0c911664217efe3dbb89b93b6fe29eb9eda2fec3`, its sole parent
`e54ea923a743caf760ef47638a2c8d8a875faf34`, ready digest
`380e1f3ddfa39b986befe6aa58506783f7e295c4aa5e421a6b69821226a51553`,
claim `87608f7e-3d2b-448b-8376-da025b05d1b7`, and GHL_CAMPAIGNS
lease `a77f21df-1741-46ea-a8c7-f13f6aa9e5f0` expiring at
`2026-07-29T01:13:59Z`.

The controller adopts observed repair implementation head
`f6d074e964cebefe032042b9627d7c7b47304bdd`. Before any product or finalization
work, verify C00 has consumed the pushed corrected-binding atomic claim head and
that local/remote P30 equal that exact claim head.

Do not change product code, rerun product work, release the lease, or return to
`ready_for_review` until that explicit reconciliation and resume occurs. Remain
inside P30-owned roots, perform no external effect, provider mutation,
migration, central registry/composer edit, package change, or interface
checkpoint.
