# R44 — Real Operator Admin, Parent, and Three-Student Journey — START OR RESUME

> **SET IN CODEX UI:** SOL / Extra High  
> **MODEL:** `GPT-5.6-SOL`  
> **REASONING:** `XHIGH (Extra High)`  
> **SERVICE TIER:** `PRIORITY`  
> **MODE:** `START_OR_RESUME`  
> **WAVE:** `10`

## Durable task identity

Task packet: `ops/v2.1-execution/tasks/R44.yaml`  
Locked context: `ops/v2.1-execution/contexts/R44-CONTEXT.md`  
Task state: `ops/v2.1-execution/runtime/R44/TASK-STATE.yaml`  
Handoff: `ops/v2.1-execution/runtime/R44/HANDOFF.md`  
Next prompt: `ops/v2.1-execution/runtime/R44/NEXT-PROMPT.md`

## Universal control-ref, claim, and resume preamble

1. Use an isolated clone/worktree, fetch all remote refs, and verify repository
   identity is `shloimie-beep/onetimev2`.
2. Read the exact R44 status/branch from
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

Execute the real production-operator acceptance journey for `OTV2-OPS-174, OTV2-OPS-222` against the exact immutable candidate. Use no fictional/demo customer and no unrelated production customer data.

## Required gates

Start only when:

- V37–V43 have candidate-bound pass results for every case not explicitly dependent on the operator journey, and I36 has aggregated all seven heads into the candidate evidence branch;
- the candidate/environment/provider identities are unchanged;
- P34 confirms backup/rollback/canary mechanisms are ready;
- explicit bounded `production:deployment` and `production_operator_canary`
  authority/leases exist;
- every required provider lock and approved fixture/device is recorded;
- the source manifest effect budget and cleanup plan are loaded.

## Start or resume

Fetch remote refs and read the exact R44 branch plus aggregated evidence head
from the remote control registry/ready queue. Create/resume the
candidate-specific R44 branch from that exact evidence head and target the same
evidence branch. Read R44 task state, handoff, and next prompt. Verify all
digests and effect ledgers. If they match, continue from the exact next
incomplete operator step; do not replay completed effects or re-audit the
repository.

## Phase 0 — bounded candidate deployment

Before the operator journey, deploy the exact frozen artifacts to the approved
production-operator-canary runtime under the deployment lease, with broad
effects/campaigns/cutover disabled. Apply only the merged migration set, verify
runtime/artifact/migration identity, confirm backup and executable rollback,
and run zero-effect health/readback checks. This is not broad cutover; R45 may
enable broad release only after all 265 cases pass.

## Journey

Execute the exact steps in `contexts/R44-CONTEXT.md`, including:

- real Admin sign-in and operation;
- real Family Parent signup/account/household behavior;
- creation and credential setup of three Student seats;
- separate real-device Student sign-ins and isolation;
- canonical class calendar and embedded join;
- Admin upload/Drive ingest through processing, approval, protected library playback, and resume;
- question/review/recognition/notification/support paths;
- billing/access and communication readbacks within approved effects;
- persistent database and provider reconciliation.

Before every live effect, create a candidate-bound effect-ledger reservation
at the canonical append-only path in `EXTERNAL-EFFECT-PROTOCOL.md`, with the
authority digest, lock/fencing token, exact provider identity, idempotency key,
and remaining budget. Immediately before writing it, fetch
`origin/codex/v21-control` and require the current authority-status index,
status-entry digest, latest revocation digest, provider-lock lease, and fencing
token to match the ready entry and remain active/unexpired. Bind those digests
in the event; commit and push its `reserved` event before executing the effect.
After that push and immediately before the provider call, fetch the control ref
again; on any authority/revocation/lock/fencing drift append `cancelled` then
`closed` and do not call. Otherwise append provider-readback/reconciliation
lifecycle events and checkpoint.
Never retry a `reserved` or `attempted_unknown` effect without readback proving
the original outcome and a fresh authority-status check.

Stop immediately on a wrong-provider, over-budget, unauthorized, destructive,
acceptance-unknown, privacy-leaking, cross-household, raw-bearer,
Student-GHL-contact, or uncleanable effect.

## Evidence and finish

Write immutable candidate-bound attempts at
`ops/v2.1-execution/results/<candidate-digest>/R44/<case-id>/attempt-<n>.yaml`
plus each case's `CURRENT.yaml`, and write a complete effect/cleanup ledger.
Continue every safe independent step after an ordinary product failure,
recording exact reproduction/owner. Do not fabricate success or switch to demo
data.

When complete, update task state/handoff/next prompt, checkpoint, commit, and
push. Notify C00 to queue the R44 evidence head for I36 aggregation. Only after
that aggregation may P34 Phase B close the post-operator
legal/canary/recovery evidence. R44 is not the final release decision. Its
terminal task state is `operator_evidence_ready`; only C00 may advance the
global execution state.
