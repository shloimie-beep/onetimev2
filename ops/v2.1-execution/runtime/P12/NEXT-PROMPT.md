MODEL: GPT-5.6-SOL
REASONING: HIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Continue One Time v2.1 task P12 from its remote checkpoint.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p12-parent-household
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/P12.yaml
Task context: ops/v2.1-execution/contexts/P12-CONTEXT.md
Task state: ops/v2.1-execution/runtime/P12/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P12/HANDOFF.md

Fetch remote refs and resume only the exact branch head registered by C00. The
first-run atomic claim uses containing control
`ab393d7eb3b7f55b910ba110949c05c40b7383e6`, ready-entry parent
`3c4130ae4d015471ce21e7d70a39d98dde113318`, start
`f1cecb5343cd1461ecd5c866ce7a9ad4a78c7635`, claim
`776c6b8b-8729-49ea-a9ca-f505fbaf320c`, ready digest
`9c85fefc71f18383c5bf674a35bce3c6026ebf6f844ed472376f77a866951c86`,
and PARENT_HOUSEHOLD_UI lease `992f62c1-faba-4709-bae6-6c201cc776b2`
issued at `2026-07-29T03:20:30Z` and expiring at
`2026-07-29T04:20:30Z`. No effect lock or external authority exists.

All 200 locked blobs, all 15 source-package blobs, package/task/context
digests, the canonical ready payload, exact F03/F04/F07 dependency bindings,
and the absent branch were verified before the atomic claim. The atomic claim
changed only the three P12 runtime-memory files. Product and contract
implementation have not started.

Resume `TASK-STATE.yaml:next_action` only after C00 records the exact pushed
claim head and issues the applicable continuation or resume authorization. Do
not repeat a broad audit. Work only in:

- `apps/web/src/client/app/parent/household/**`
- `apps/web/src/server/features/portals/parent-household/**`
- `packages/contracts/src/portals/parent-household/**`
- `packages/domain/src/portals/parent-household/**`
- P12-local runtime metadata and structured steward requests

Do not edit control files, another task runtime, migrations, central
barrels/composers, package manifests, lockfiles, global styles, or any other
steward-owned path. Perform no external effect. Preserve Parent-only household
isolation, the three-active-Student limit, archived history, disabled archived
authentication, and non-display of existing passwords.

Exact next action: after C00 records the claim, inspect only the F03/F04/F07
dependency artifacts and P12-owned paths, implement the smallest coherent
Parent household and Student-seat contract, publish the required interface
checkpoint, pass focused verification, and finish `ready_for_review` with a
clean normally pushed branch.
