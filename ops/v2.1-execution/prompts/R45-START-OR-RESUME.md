# R45 — Final Interactive Certification and Cutover Decision — START OR RESUME

> **SET IN CODEX UI:** SOL / Extra High  
> **MODEL:** `GPT-5.6-SOL`  
> **REASONING:** `XHIGH (Extra High)`  
> **SERVICE TIER:** `PRIORITY`  
> **MODE:** `START_OR_RESUME`  
> **WAVE:** `11`

## Durable task identity

Task packet: `ops/v2.1-execution/tasks/R45.yaml`  
Locked context: `ops/v2.1-execution/contexts/R45-CONTEXT.md`  
Task state: `ops/v2.1-execution/runtime/R45/TASK-STATE.yaml`  
Handoff: `ops/v2.1-execution/runtime/R45/HANDOFF.md`  
Next prompt: `ops/v2.1-execution/runtime/R45/NEXT-PROMPT.md`

## Universal control-ref, claim, and resume preamble

1. Use an isolated clone/worktree, fetch all remote refs, and verify repository
   identity is `shloimie-beep/onetimev2`.
2. Read the exact R45 status/branch from
   `origin/codex/v21-control:ops/v2.1-execution/control/TASK-REGISTRY.yaml`
   and its exact ready/merge entry from that same remote control commit. Never
   use a stale worktree copy.
3. Follow `CLAIM-AND-LEASE-PROTOCOL.md`. On first run, seed TASK-STATE,
   HANDOFF, and NEXT-PROMPT from templates, commit all three with the claim, and
   create the exact remote branch by one normal atomic ref push before any
   implementation, verification, merge, deployment, or provider action. On
   resume, require C00 `resume_ready`, its exact expected
   branch head, and an unexpired new lease.
4. Verify `LOCKED-SHA256SUMS.txt`, task/context/dependency/candidate digests, the
   containing authorizing control commit derived from the remote ref, sibling
   entry payload digest, and the current remote head.
   Mutable control/task/result files use current committed digests, not the
   delivery checksum.
5. Read `EXECUTION-CONTRACT.md`, task packet, locked context, task
   state/handoff/next prompt, then named code/evidence. If digests match, resume
   `next_action`; do not globally re-audit the repository, reread all 14 source
   documents, or repeat valid work.
6. A foreign live lease, wrong expected head, or non-fast-forward push is a hard
   collision stop. Never force-push or overwrite another window.
7. Maintain task state, handoff, and paste-ready next prompt; checkpoint,
   commit, and push before returning. The current metadata commit SHA is derived
   from Git and recorded by C00, not self-embedded in that same commit.

## Mission

Make the final evidence-backed release decision and, only with explicit authority and every gate green, execute production deployment/domain cutover plus post-deploy readback.

## Start gates

Require:

- one immutable candidate identity;
- one fully aggregated candidate evidence branch containing all V37–V43, R44,
  and the P34 post-operator supporting-proof head;
- exactly 264 non-R45 acceptance cases candidate-bound and passed, including
  completed R44, P34 supporting proof, and V43 Phase B; the only remaining
  case must be R45-owned `OTV2-OPS-175-AC01`;
- zero failed/blocked/stale/waived release cases and zero unexpected effects;
  the sole permitted unverified case is `OTV2-OPS-175-AC01`;
- real approved legal-policy artifacts, approver identity, and digests;
- backup/restore proof and executable rollback;
- provider and environment identity readbacks;
- exact Phase A production-operator-canary authority. Broad release,
  deployment, DNS, and provider-mutation authority is required only for Phase B
  and cannot be consumed before canonical 265/265 aggregation.

C00 dispatches ordinary Phase A only when the 264-case precondition is true.
When an earlier product/evidence gate is missing, return it to its exact owner
and continue the correction/new-candidate loop; do not use R45 to waive it.
Missing broad-cutover authority does not block Phase A. Never fabricate or
bypass a gate.

Fetch remote refs and read the exact fully aggregated evidence head plus R45
branch from the remote control registry/ready queue. Create/resume R45 from that
evidence head. Read R45 task state, handoff, checkpoint, and exact next action.
If all package/candidate/result digests match, do not globally re-audit the
repository or repeat valid certification work.

C00 registers the single candidate-specific branch under
`phase_branches.phase_a_certification`, its exact initial/last head under
`phase_heads.phase_a_certification`, and
`active_phase: phase_a_certification`. A fresh window derives these from the
remote registry rather than chat history.

## Phase A — final interactive certification, no broad cutover

1. Verify the result index contains exactly 264 passed non-R45 cases and no
   other missing/failed/blocked/stale/waived case.
2. Execute `OTV2-OPS-175-AC01` from this prompt/context and write its immutable
   candidate-bound attempt at
   `ops/v2.1-execution/results/<candidate-digest>/R45/OTV2-OPS-175-AC01/attempt-<n>.yaml`
   plus `CURRENT.yaml`.
3. Verify the new result plus the canonical 264-case base accounts for 265
   unique cases, without editing the canonical evidence index.
4. Verify all result schemas/digests refer to the same immutable candidate;
   each case's recorded environment is permitted by
   `ACCEPTANCE-ENVIRONMENT-MATRIX.yaml`, and artifact/config/provider identity
   is internally consistent within that environment/deployment instance.
5. Reconcile migrations, queues, provider assets, effects, cleanup, monitoring, and legal artifacts.
6. Inventory every visible control across public, auth, Admin, Parent, and Student routes on supported desktop/tablet/mobile browsers and real operator devices.
7. Drive the required counts to exactly zero:
   - failed visible controls;
   - untested visible controls;
   - placeholder visible controls;
   - fake-data dependencies;
   - unauthorized visible controls.
8. Confirm zero Student GHL contacts and zero raw Zoom/Vimeo bearers.
9. Confirm no retired preview/demo/test/Class Helper/Buffer/WhatsApp-assistant/active-Tisha surface.
10. Confirm rollback triggers and current backup/restore proof.

If `OTV2-OPS-175-AC01` passes, checkpoint state as
`certification_evidence_ready`, commit, and push the R45 Phase A result. Stop
before broad production mutation. C00 queues that exact evidence-only head; I36
merges it with ancestry preserved and rebuilds the canonical result index.

If the case fails or is precisely blocked, diagnose every in-scope release
mechanic and complete every safe independent check. A product-code correction
requires a new candidate. If a permitted blocker remains, write the immutable
failed/blocked result plus
`ops/v2.1-execution/merge/FINAL-RELEASE-DECISION.yaml` from the locked template
with `status: release_blocked`, the exact current 264-case index digest, R45
result digest, counts, and blocker. Push `release_decision_recorded` with no
broad mutation. C00 queues this head directly for final I36 aggregation; this
path does not require 265 passed.

## Phase B — control-authorized cutover resume

C00 may resume this same R45 task only after it independently validates the
I36 evidence head and canonical index at exactly 265/265 passed. The
`resume_ready` entry must name:

- expected existing R45 Phase A head;
- exact evidence head containing R45's result and canonical index;
- `claim_mode: resume_existing`;
- new unexpired R45 lease/claim;
- exactly one active phase:
  - `phase_b_cutover`, with exact production deployment/DNS/provider authority,
    effect locks, and fencing tokens; or
  - `phase_b_blocked_decision`, with the exact missing/denied/expired gate,
    decision/runtime paths only, and no effect lock.

C00 records the selected active phase, the same registered R45 branch, the
Phase A head, and the authorized descendant evidence head under R45's
`phase_branches`/`phase_heads`. It records externally granted authority
digests; it does not grant production authority. Broad authority is not
required to issue the read-only blocked-decision resume.

Fetch both heads and require the evidence head to descend from the Phase A
head. Fast-forward the R45 branch to it with `--ff-only`; never rebase, force,
or manufacture an index. A mismatch is a collision stop.

## Read-only blocked-decision mode

When `active_phase` is `phase_b_blocked_decision`, validate the exact gate
against current evidence, write
`ops/v2.1-execution/merge/FINAL-RELEASE-DECISION.yaml` from its locked schema
with `status: release_blocked`, 265/265 case counts if Phase A passed, the
unsatisfied authority/gate, no release or production-ready claim, and no new
effect. Push `release_decision_recorded` and stop. Do not enter Authorized
cutover.

## Authorized cutover

Only when `active_phase` is `phase_b_cutover`, the Phase B resume gate passes,
and explicit authority is recorded:

1. Before every deployment, migration, DNS, or provider mutation, append and
   fetch `origin/codex/v21-control`; require the current authority-status index,
   status-entry digest, latest revocation digest, provider-lock lease, and
   fencing token to match the ready entry and remain active/unexpired. Bind
   those exact digests, candidate/deployment identity, idempotency key,
   operation, and remaining budget in an immutable `reserved` effect-ledger
   event and push it before the operation.
2. After that push, fetch the control ref once more immediately before the
   operation. On any authority/revocation/lock/fencing drift, append
   `cancelled` then `closed` and do not perform it. Otherwise perform the one
   reserved effect, then append/push its next lifecycle event
   after provider/runtime readback. A lost window or
   `attempted_unknown` state requires readback before any retry.
3. Deploy the exact candidate artifacts and apply only the merged forward-only
   migration set under their exclusive locks.
4. Perform canonical application and transition-domain changes in the approved
   order under separately reserved effects.
5. Read back source/artifact/configuration/migration/runtime/provider/domain
   identity and bind one production deployment-instance digest.
6. Run bounded post-deploy smoke and role checks.
7. Create and push `OBSERVATION-RECORD.yaml` before the observation clock,
   then observe critical production metrics continuously for at least 60 minutes
   while the prior artifact remains deployable, and monitor every defined stop
   condition and error budget. Checkpoint source timestamps, latest sample,
   continuity, exact deployment digest, rollback readiness, and
   nonessential-second-deployment count throughout.
8. If candidate/deployment identity changes, a monitoring gap prevents
   continuous proof, or a nonessential second deployment occurs, invalidate the
   interval and restart the 60-minute clock after restoring a valid baseline.
9. Roll back immediately when a defined stop condition fires, using the same
   write-ahead/readback lifecycle.

## Persistence and finish

Do not stop at the first ordinary certification or deployment check failure; diagnose and correct in-scope release mechanics while preserving the immutable candidate. Any code change requires a new candidate and invalidates evidence.

Write the final decision from
`templates/FINAL-RELEASE-DECISION.yaml`. Commit and push the final observation,
effect reconciliation, and decision,
then notify C00 to queue that exact evidence-only head for I36's final
canonical aggregation. Report either:

- `released`, with exact candidate/deployment/domain/provider/effect/rollback evidence; or
- `release_blocked`, with the exact unsatisfied gate and no claim of production readiness.

R45 Phase A ends at `certification_evidence_ready` on the passing path or
`release_decision_recorded` on its precise blocked path. Either Phase B mode
ends at `release_decision_recorded`. R45 never writes global execution state.
C00 independently verifies remote result/evidence digests and records `done`
only for a verified `released` decision; otherwise it records
`release_blocked`.
