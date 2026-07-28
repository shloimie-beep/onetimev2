MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Continue One Time v2.1 task P20 from its remote atomic-claim checkpoint.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p20-media-processing
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/P20.yaml
Task context: ops/v2.1-execution/contexts/P20-CONTEXT.md
Task state: ops/v2.1-execution/runtime/P20/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P20/HANDOFF.md

Fetch remote refs and resume the exact branch head. The first-run atomic claim
uses containing control `4f82565865c615ecf91828b0cae41c1cf7b63dfe`,
ready-entry parent `c9c3d288fa6cdb3aca756de8cc03d35471abe464`,
start `ebf88c8e422a6ad40202fc2b0249810d312edc30`, claim
`1cd7bf99-21a7-4231-8418-b9cdfaf958c4`, ready digest
`c509304015a470c8c6c2ca7fa71ffcc13f8341f47b7414ddab093e8127d7e7d7`,
and CONTENT_PROCESSING lease `447a28a6-1675-4fbb-b52f-a77f75f8d356`.
The lease was issued at `2026-07-28T22:50:05Z` and expires at
`2026-07-28T23:50:05Z`; no effect lock or external authority exists.

All 200 locked blobs, all 15 source-package blobs, the package/task/context
digests, canonical ready payload, exact F05/P19 dependency bindings, and absent
branch were verified before the atomic claim. Resume
`TASK-STATE.yaml:next_action` without repeating a broad audit.

Implement only:

- `apps/worker/src/runners/content-processing/**`
- `packages/contracts/src/content/processing/**`
- `packages/db/src/content/processing/**`
- `packages/domain/src/content/processing/**`
- `scripts/media/v21/**`

Do not edit control files, another task runtime, migrations, central
barrels/composers, package manifests, lockfiles, provider registries, or other
steward-owned paths. Create structured P20 steward requests inside P20 runtime
when a required migration, config/dependency, route, worker registration, or
shared export change is needed. Perform no provider or external effect.

Exact next action after C00 reconciles the claim: inspect only the F05/P19
exported artifacts and P20-owned paths, build a concise assigned-case gap map,
then implement the smallest coherent bounded-memory media-processing vertical.
Checkpoint every meaningful milestone and finish only at `ready_for_review` or
a permitted stop condition.
