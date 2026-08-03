# V40 — Learning, Notifications, Consent, and Privacy Verification — START OR RESUME

> **SET IN CODEX UI:** SOL / Extra High  
> **MODEL:** `GPT-5.6-SOL`  
> **REASONING:** `XHIGH (Extra High)`  
> **SERVICE TIER:** `PRIORITY`  
> **MODE:** `START_OR_RESUME`  
> **WAVE:** `9`

## Durable task identity

Task packet: `ops/v2.1-execution/tasks/V40.yaml`  
Locked context: `ops/v2.1-execution/contexts/V40-CONTEXT.md`  
Task state: `ops/v2.1-execution/runtime/V40/TASK-STATE.yaml`  
Handoff: `ops/v2.1-execution/runtime/V40/HANDOFF.md`  
Next prompt: `ops/v2.1-execution/runtime/V40/NEXT-PROMPT.md`

## Universal control-ref, claim, and resume preamble

1. Use an isolated clone/worktree, fetch all remote refs, and verify repository
   identity is `shloimie-beep/onetimev2`.
2. Read the exact V40 status/branch from
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

Verify questions, recognition, notifications, consent, child-data boundaries, data rights, retention, redaction, and purge evidence against the immutable candidate.

Verification source tasks: `P22, P23, P32`  
Assigned requirements: `18`  
Assigned acceptance cases: `23`  
Evidence path:
`ops/v2.1-execution/results/<candidate-digest>/V40/<case-id>/attempt-<n>.yaml`

## Start or resume

1. Fetch remote refs and read the control-authorized immutable candidate manifest. Refuse a moving or ambiguous candidate.
2. Read V40's exact branch/status and evidence target from the fetched
   remote control registry/ready queue. Create/resume
   `codex/v21-verify-<candidate-short-sha>-v40` from the exact
   frozen source candidate and target
   `codex/v21-evidence-<candidate-short-sha>`.
3. Verify package, context, candidate, environment, fixture, provider-registry, and prior result digests.
4. Read this lane context, source-task handoffs,
   `runtime/V40/TASK-STATE.yaml`, `HANDOFF.md`, relevant named code, and
   existing lane results.
5. If digests match, resume the first incomplete case. Do not perform a global repo audit or rerun already-valid cases.
6. If candidate/environment/provider identity changed, mark affected evidence stale and rerun it; never carry evidence forward silently.

## Verification loop

For every exact case in the context:

1. Select an allowed environment and approved fixture.
2. Reproduce all preconditions.
3. Execute every step and denial/recovery/concurrency branch.
4. Record observed persistent state, browser/runtime behavior, and provider readback required by the evidence profile.
5. Confirm forbidden effects are absent.
6. Write one schema-valid immutable attempt at the exact case-specific path.
   Never overwrite another case or attempt. Update the case `CURRENT.yaml`
   pointer; a retry/supersession links the prior result digest.
7. On failure, create a minimal redacted reproduction, assign it to the exact implementation owner, and continue every independent case.
8. On an ordinary harness/environment issue within lane scope, diagnose and
   fix only lane-owned verification harness material under
   `ops/v2.1-execution/verification-harness/V40/` on the separately
   registered sibling branch
   `codex/v21-harness-<candidate-short-sha>-v40`; that path is
   excluded from deployable candidate artifacts. Never merge a harness commit
   into the canonical evidence-lane branch. Never edit product code,
   migrations, or deployable artifacts on either verifier branch. Route a
   product defect to its exact implementation owner and require a new frozen
   candidate. Record any harness head digest in the result evidence. C00 queues
   only the canonical result/state/handoff branch whose entire delta is
   admissible; I36 merges that whole head with ancestry preserved.

Provider access is none by default. Candidate/local inspection needs no provider
authority, but exact scoped provider read-only access requires C00
authorization. A provider effect additionally requires the exact authority
grant, a freshly fetched active authority-status entry and revocation head,
exclusive lock/fencing token, approved fixture, effect budget, stop condition,
and cleanup. Bind the grant/status/revocation digests in the write-ahead effect
event. Never guess provider identity or exceed the budget.

## Finish

Continue until all 23 assigned cases have candidate-bound `passed`, `failed`, or precise `blocked` records and every independent case has been attempted. Release requires all to pass; this lane must not convert a failure/blocker into a waiver.

Checkpoint result files, lane task state, handoff, and next prompt regularly.
Commit and push before returning. Notify C00 to queue the exact evidence head
for I36 aggregation. Report candidate SHA, counts, failed/blocked case IDs,
unexpected-effect count, cleanup state, and exact owning tasks for defects. Use
terminal lane phase `ready_for_evidence_merge`; V43 uses `phase_a_complete`
until its required Phase B resume and then `ready_for_evidence_merge`. Verifier
lanes never mark the global execution done.
