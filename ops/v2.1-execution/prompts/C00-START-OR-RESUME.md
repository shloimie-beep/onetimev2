# C00 — Execution Control Tower and Authority Bootstrap — START OR RESUME

> **SET IN CODEX UI:** SOL / Extra High  
> **MODEL:** `GPT-5.6-SOL`  
> **REASONING:** `XHIGH (Extra High)`  
> **SERVICE TIER:** `PRIORITY`  
> **MODE:** `START_OR_RESUME`  
> **WAVE:** `0`

## Mission

Create and maintain the durable v2.1 execution control plane. Do not implement product code.

Repository: `shloimie-beep/onetimev2`  
First-run exact base: `73dda293079f602c83929d1bbccb8dd5b9d1a455` on `codex/one-time-launch-convergence-20260727`  
Control branch: `codex/v21-control`  
Integration branch: `codex/v21-integration`

## First invocation — serialized bootstrap

The complete file `ONE-TIME-CODEX-EXECUTION-PACK-v2.1.zip` must be attached or otherwise present as the sole package with that exact basename.

1. Use an isolated clone/worktree and fetch remote refs.
2. Verify repository identity and that `73dda293079f602c83929d1bbccb8dd5b9d1a455` is reachable as the reviewed PR #130 head. Do not use `main` or a synthetic merge ref.
3. Verify the ZIP opens, contains `PACKAGE-LOCK.yaml`, `VALIDATION-REPORT.md`,
   `SHA256SUMS.txt`, `LOCKED-SHA256SUMS.txt`, 46 task packets, 46 contexts, 46
   prompts, and the complete 16-file `source-spec/`.
4. Verify the delivery `SHA256SUMS.txt` before installing anything. After
   bootstrap, control/baseline/runtime/evidence files are intentionally mutable;
   all later package integrity checks use `LOCKED-SHA256SUMS.txt` plus current
   state/branch digests.
5. Create `codex/v21-control` from exact SHA `73dda293079f602c83929d1bbccb8dd5b9d1a455` if it does not
   exist. If it exists, read `CONTROL-STATE.yaml`. When `bootstrap_phase` is not
   `operational`, resume the first incomplete bootstrap phase; do not jump to
   normal control refresh.
6. Install the package contents at `ops/v2.1-execution/` without altering its
   locked source files. Seed
   `runtime/C00/{TASK-STATE.yaml,HANDOFF.md,NEXT-PROMPT.md}` from templates in
   the first control claim commit. Seed/renew `CONTROL-LEASE.yaml` in that same
   commit against the exact fetched parent, then normal-push it. For a new
   control branch, this one atomic branch-creation push arbitrates the claim;
   for an existing branch, it must fast-forward. A live foreign lease or
   non-fast-forward result is a collision stop. Never force. Keep C00 runtime
   files current through every bootstrap phase.
7. Apply `AGENTS-V2.1-REPLACEMENT.md`: replace stale Board/status authority while retaining compatible repository engineering guidance. A fresh agent reading `AGENTS.md` must reach v2.1 first.
8. Mark old Board, old goals/current files, old acceptance IDs, v2.0 drafts, preview/demo/test-lane documents, and historical handoffs as historical evidence. Do not delete evidence or immutable migrations.
9. Record the actual repository command baseline once in
   `KNOWN-BASELINE-FAILURES.yaml`, bound to source head, dependency-lock,
   toolchain/runtime, and verification-environment fingerprints. Regenerate it
   whenever any bound fingerprint changes. Do not fix product code.
10. Validate all 243 requirements, 265 cases, 107 mapped decisions, 46 task packets, dependencies, writer scopes, and prompt/context digests.
11. After each phase (`package_installed`, `agents_updated`,
    `control_push_canary_passed`, `integration_created`,
    `control_initialized`, `operational`), update `CONTROL-STATE.yaml`, commit,
    and push. The first successful normal control-branch push is the permission
    canary; if unavailable, stop before launching workers.
12. Create and push `codex/v21-integration` from the committed bootstrap
    checkpoint using a separate worktree or explicit ref push. Verify it, then
    explicitly return to `codex/v21-control` before changing global control
    state.
13. Initialize migration allocations at 2234+, `TASK-REGISTRY.yaml`,
    `STEWARD-QUEUE.yaml`, writer/provider locks, merge queue, current-candidate
    pointer, and exact ready items for F01 and on-demand I36. Every queue entry
    must name a branch/claim mode, parent control head, exact integration start
    SHA, package/source/task/context/dependency states/digests, claim/lease, and
    locks; its digest lives in the sibling payload-digest map. The containing
    control commit is derived after push and never self-embedded.
14. Commit and push the initialized control state.

No product implementation belongs in this bootstrap.

## Later invocation — resume the controller from any new window

1. Fetch and check out `codex/v21-control`. If bootstrap is not `operational`,
   resume its first incomplete phase above; the normal refresh below is not yet
   allowed.
   Before any other mutation, acquire/renew `CONTROL-LEASE.yaml` against the
   exact fetched head and push it. Release the lease in the final pushed control
   checkpoint.
2. Verify `LOCKED-SHA256SUMS.txt`, then the current control/registry/queue
   digests separately. Read `CONTROL-STATE-TRANSITIONS.yaml` and reject any
   status, phase, start gate, or terminal state not present in its authoritative
   catalog. Do not expect the delivery manifest to match mutable runtime state.
3. Read C00's own runtime state/handoff/next prompt, then remote task branches
   and each task's committed state/handoff. Do not depend on chat history.
4. Detect stale claims, branch drift, non-fast-forward collisions, scope
   overlap, missing checkpoints, blockers, and merge-ready heads. Reconcile
   externally evidenced authority grants/revocations/expiry into
   `AUTHORITY-STATUS.yaml`; invalidate affected provider locks and ready effect
   leases before dispatch. C00 records authority status but never grants it.
5. Recalculate the critical path and ready set using `start_after`, integrated
   contract checkpoints, acyclic `merge_after`,
   non-ordering `candidate_integration_partners`, `acceptance_after`, writer
   scopes, provider locks, and a maximum of eight active implementation writers.
6. Queue I36 whenever an `interface_ready`, full implementation, verifier
   result, R44 result/effect, P34 non-result post-operator supporting proof,
   R45 Phase A result, or final R45 effect/observation/decision head needs
   sole-writer integration. Admit only the exact allowed paths for that phase.
   A downstream task is not ready until all required interfaces are present in
   one pushed integration SHA.
7. Prioritize the longest ready critical-path task, then fill free slots with disjoint tasks.
8. For each ready task, record exact `authorized_start_sha`, dependency heads/digests, available locks, model/reasoning, prompt path, exact branch name, and expiry/claim rule in the remote control queue/registry.
9. Publish paste-ready prompts through the ready queue. Do not rewrite their product scope.
10. Admit interface/full/evidence heads to the correct merge queue only after
    scope, state, checks, migration, authority, and effect-budget validation.
    Record separate exact source head, source delta base/required merge base,
    and current target CAS head. Scope-check the source-base-to-source delta;
    never use the moving target as the delta base for a parallel sibling.
11. Assign exact blockers to exact owners.
12. Reconcile immutable steward requests into `STEWARD-QUEUE.yaml`, assign the
    canonical steward/checkpoint, record applied or rejected result digests, and
    require requester acknowledgment.
13. When R45 reports `certification_evidence_ready`, queue its exact Phase A
    result head for I36, require the canonical index to become 265/265, verify
    its candidate/environment-matrix/deployment digests, then choose exactly
    one Phase B resume:
    - `active_phase: phase_b_cutover` only when externally approved
      cutover-authority records, effect locks, and fencing tokens are valid; or
    - `active_phase: phase_b_blocked_decision` when authority is
      missing/denied/expired or another final gate cannot be satisfied. This
      read-only resume grants only R45 decision/runtime paths, contains no
      effect locks, and exists solely to record a schema-valid blocked decision.
    C00 records and validates authority; it never grants provider or production
    authority. Do not dispatch broad mutation earlier.
    If R45 Phase A instead reports `release_decision_recorded` because case 265
    failed or was precisely blocked, skip the 265/265/Phase B path and queue
    that exact result/decision head directly for final I36 aggregation.
14. After R45 reports `release_decision_recorded`, queue its exact
    result/decision head for ancestry-preserving I36 aggregation and
    independently verify all candidate/result/evidence/release digests.
    Branch on the decision:
    - `released` requires the canonical index at 265/265 passed plus every
      release invariant, authority, effect, observation, and readback gate; only
      then advance global execution state to `done`;
    - `release_blocked` requires a schema-valid exact blocker, case counts that
      match the newly aggregated current index (which may be 264 passed plus a
      failed/blocked R45 case or 265 passed), no released/production-ready
      claim, and all attempted effects reconciled; advance global execution
      state to `release_blocked`, never `done`.
15. Update C00 TASK-STATE/HANDOFF/NEXT-PROMPT, commit, and push updated control
    state before returning.

## Controller invariants

- Only one C00 writer at a time.
- C00 never writes product code and never authorizes provider effects.
- Only F02 writes migrations.
- Only I36 writes the integration branch and final shared registration/lockfiles.
- Only I36 writes the candidate evidence aggregation branch.
- Old status artifacts never become current again.
- A task is not done because code exists.
- Branch evidence never substitutes for candidate-bound acceptance.
- Every release-blocking case must pass against one immutable candidate.

## Keep-working and stop behavior

Continue until the bootstrap or control refresh is fully committed and pushed. Correct ordinary validation, checksum, YAML, and queue-generation failures. Stop only for missing/corrupt execution ZIP, wrong/unreachable reviewed head, push permission failure, another active C00 writer/non-fast-forward collision, normative contradiction, or a protected invariant/authority boundary that cannot be preserved.

Before stopping, persist every safe state update and report one exact blocker plus the next paste-ready action.
