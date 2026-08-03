# I36 — Merge Captain, Shared Registration, and Immutable Candidate — START OR RESUME

> **SET IN CODEX UI:** SOL / Extra High  
> **MODEL:** `GPT-5.6-SOL`  
> **REASONING:** `XHIGH (Extra High)`  
> **SERVICE TIER:** `PRIORITY`  
> **MODE:** `START_OR_RESUME`  
> **WAVE:** `1`

## Durable task identity

Task packet: `ops/v2.1-execution/tasks/I36.yaml`  
Locked context: `ops/v2.1-execution/contexts/I36-CONTEXT.md`  
Task state: `ops/v2.1-execution/runtime/I36/TASK-STATE.yaml`  
Handoff: `ops/v2.1-execution/runtime/I36/HANDOFF.md`  
Next prompt: `ops/v2.1-execution/runtime/I36/NEXT-PROMPT.md`

## Universal control-ref, claim, and resume preamble

1. Use an isolated clone/worktree, fetch all remote refs, and verify repository
   identity is `shloimie-beep/onetimev2`.
2. Read the exact I36 status/branch from
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


### I36 bootstrap-branch adoption exception

C00 deliberately creates `codex/v21-integration` during bootstrap. On I36's
first invocation, require `claim_mode: adopt_bootstrap_integration`, exact
expected bootstrap head, no active I36 claim, and an unexpired lease. Check out
that existing branch, seed/commit I36 claim state, and let one normal
fast-forward push arbitrate adoption. Do not require the branch to be absent and
do not recreate it. A head mismatch or non-fast-forward push is a collision
stop.

## Mission

Be the sole merge captain for `codex/v21-integration` and the candidate-specific
evidence aggregation branch. Integrate early interface checkpoints, then all 35
implementations, apply approved central steward requests once, and freeze one
immutable verification candidate. Do not redesign feature semantics.

## Start or resume

1. Use an isolated worktree and fetch remote refs.
2. Check out the existing `codex/v21-integration` branch at the exact
   control-authorized expected head. C00 creates it during bootstrap; I36 never
   substitutes another base or recreates a missing branch.
3. Verify package/control/task/handoff digests and the integration branch head.
4. Read `MERGE-PROTOCOL.md`, `EVIDENCE-PROTOCOL.md`,
   `WRITER-SCOPES.yaml`, the merge queue from the fetched remote control branch,
   candidate manifest, and only the queued task handoffs/diffs.
5. If digests match, resume the recorded merge item. Do not re-audit the repository or reread all 14 source documents.
6. Never force-push or accept an unqueued task head.

## Admission and merge loop

For an early `interface_ready` item:

- verify C00 queued the exact checkpoint commit/digest;
- verify the diff contains only the declared stable interface, its focused
  checks, and task-state metadata;
- merge that exact commit ancestry into the integration branch;
- run contract/type checks, push the integration checkpoint, and report its
  exact SHA to C00;
- do not mark the producing task implementation-complete.

For each full implementation item:

- verify dependency heads and merge order;
- verify its remote head, scope, state/handoff, requirement/case ownership, checks, migration requests, central steward requests, and external-effect counts;
- reject semantic conflicts, out-of-scope edits, stale authority, retired-surface resurrection, fake fallbacks, Student GHL contacts, direct Stripe mutation, or bearer leakage;
- merge no more than three disjoint heads per micro-batch;
- apply root server/client/worker registration, config, dependencies, lockfiles, barrels, route branding, generated inventories, and GHL registry mechanics from explicit requests;
- resolve only mechanical conflicts; return semantic conflicts to the owner;
- validate migrations from 2234 upward and never create 2231 or edit applied history;
- run contract/type/build and changed-area checks after each risky merge and micro-batch;
- update and push the candidate manifest/checkpoint.

Keep working through ordinary merge, type, build, and task-owned failures. Do not stop after the first conflict or failed command.

## Candidate freeze

When every F01–F07 and P08–P35 task is implementation-ready and all integration dependencies are satisfied:

1. run the full merged verification baseline;
2. generate the complete canonical route/action/provider/workflow/interactive-surface inventory;
3. follow `CANDIDATE-IDENTITY-PROTOCOL.md`; bind every exact candidate-core
   field, compute its canonical digest from the defined preimage, and keep
   per-environment deployment instances/times outside candidate identity;
4. write the canonical manifest at
   `ops/v2.1-execution/merge/candidates/<canonical-candidate-digest>/CANDIDATE.yaml`,
   then commit and push the immutable candidate;
5. publish the manifest and notify C00; C00 updates the remote control plane so
   V37–V43 all start from that exact candidate;
6. create and push `codex/v21-evidence-<candidate-short-sha>` from the exact
   frozen candidate;
7. prohibit further implementation changes to that candidate.

Any candidate change invalidates all prior candidate-bound evidence and requires a new freeze.

## Evidence aggregation

After freeze, C00 may queue V37–V43, R44, P34 post-operator, and final R45
result/decision evidence heads.
Switch to the exact candidate evidence branch. For each exact queue item,
require the independently populated `source_delta_base_head_sha`, verify it is an ancestor of
the source and equals
`git merge-base expected_target_head_sha source_head_sha`, and scope-check only
`source_delta_base_head_sha..source_head_sha`. The expected target is only the
optimistic-concurrency/CAS head; its value may equal the verified source base,
especially for a first or fast-forward lane. Never use its two-dot diff to
scope a parallel sibling lane. Permit only assigned result/state/handoff paths plus explicitly
queued P34 supporting proof and R44/R45
authority/effect/observation/release-decision paths. Then merge that whole
admissible source head with source ancestry preserved and verify it is an
ancestor of the pushed evidence head. Never squash, cherry-pick, or synthesize
a replacement path-only commit. Validate schemas, candidate binding, case
ownership, effect counts, authority, cleanup, and redaction. Verifier harness
paths are never admitted. Reject any product code/artifact/migration change.
Push after each evidence micro-batch. R44 and R45 start or resume only from the
required aggregated evidence head.

## Persistence and finish

Checkpoint and push after every micro-batch, risky merge, and before the window
ends. Update I36 task state/handoff/next prompt. After source freeze, use
terminal phase `candidate_frozen`; after a queued evidence batch, use
`evidence_aggregated`. I36 never marks the global execution done. Normal finish
is a pushed immutable candidate and seven exact verifier start records, a
pushed evidence aggregation head, or one precise blocker after every safe
independent merge is complete.
