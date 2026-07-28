# One Time v2.1 Codex Execution Contract

**Execution ID:** `OT-V21-PRODUCTION`  
**Repository:** `shloimie-beep/onetimev2`  
**Reviewed baseline:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Mode for every prompt:** `START_OR_RESUME`

## 1. Outcome

This package converts the locked v2.1 product specification into 46 bounded Codex tasks. It is an execution control plane, not a replacement product specification. The source specification in `source-spec/` remains normative.

The durable memory of a task is its pushed remote branch plus:

- `ops/v2.1-execution/runtime/<TASK-ID>/TASK-STATE.yaml`;
- `ops/v2.1-execution/runtime/<TASK-ID>/HANDOFF.md`;
- `ops/v2.1-execution/runtime/<TASK-ID>/NEXT-PROMPT.md`.

A chat window is disposable. A pushed checkpoint is not.

## 2. Authority order

1. Decision Register.
2. Remaining v2.1 source package, with the Acceptance Contract defining proof.
3. This execution contract and package lock.
4. Assigned task packet and checksum-bound context.
5. Candidate-bound result records for transient status.

Old Boards, old goals, old acceptance IDs, v2.0 drafts, PR descriptions, deployed-version notes, and historical handoffs are evidence only. They never override v2.1.

`SHA256SUMS.txt` verifies the delivered archive before bootstrap.
`LOCKED-SHA256SUMS.txt` verifies immutable execution/spec/task/context/prompt
files after bootstrap. Mutable control, baseline, runtime, merge, and result
files use their current committed branch digests and are intentionally excluded
from the locked manifest.

## 3. Branch and base rules

- C00 first starts from exact commit `73dda293079f602c83929d1bbccb8dd5b9d1a455`.
- Never branch from `main`.
- Never use a synthetic PR merge SHA.
- The current queue and task registry live on remote branch `origin/codex/v21-control`; workers read them with a read-only Git operation such as `git show`, not from a possibly stale copy in their worktree.
- A first-time worker creates its task branch only from the exact `authorized_start_sha` published for it on that remote control branch.
- A resumed worker fetches and resumes the existing remote branch; it does not create a replacement branch.
- Each active writer uses an isolated clone/worktree.
- No two windows write the same task branch.
- No force pushes.
- A non-fast-forward push is a concurrent-writer collision and a permitted stop.
- Workers never push directly to `main`.
- Implementation task PRs target `codex/v21-integration`.
- I36 is the only writer to `codex/v21-integration`.
- Only one final accepted candidate may advance to production/main.

## 4. Dependency meanings

| Gate | Meaning |
|---|---|
| `hard_before_start` / `start_after` | Dependency must publish the state required by the ready queue before this task creates its branch. |
| `contract_before_start` | A checksum-bound interface checkpoint is enough; upstream implementation may continue. |
| `before_merge` / `merge_after` | Acyclic full-implementation merge order derived from the start DAG. |
| `candidate_integration_partners` | Non-ordering cross-feature seams that I36 must reconcile before candidate freeze; these may be mutual and never form a readiness gate. |
| `before_acceptance` / `acceptance_after` | Code may be complete; candidate-bound proof waits for this gate. |
| `external_release_gate` | Does not block safe provider-independent code, but blocks the named live effect or release. |

Acceptance `depends_on` fields are semantic proof dependencies. They are not blindly converted into task start dependencies.

## 5. Task lifecycle

```text
planned -> ready | resume_ready -> claimed -> ready_for_review
        -> implementation_ready -> Git-ancestry integration proof

claimed -> interface_ready -> interface_ready_integrated

candidate_frozen -> lane phase states -> operator/proof phase states
                 -> certification_evidence_ready
                 -> certification_passed_and_aggregated
                 -> release_decision_recorded -> done | release_blocked
```

`CONTROL-STATE-TRANSITIONS.yaml` is the authoritative state/phase enum and
proof table. Workers/I36 publish proposals on their branches; only C00 writes
authoritative registry transitions after validating the named head, candidate,
interface/evidence head, result index, counts, and transition proof. Not every
task uses every intermediate state. A normal implementation worker stops at
`ready_for_review`; specialized terminal phases are declared in its task
packet. Only C00 marks global `done`.

## 6. Universal start-or-resume behavior

1. Fetch remote refs.
2. Verify repository identity.
3. Read the task’s exact branch/status from `origin/codex/v21-control:ops/v2.1-execution/control/TASK-REGISTRY.yaml`.
4. If that assigned remote branch exists, check it out and resume it.
5. Otherwise read `READY-QUEUE.yaml` from the fetched remote control branch and create the exact assigned branch from its exact authorized SHA.
6. Verify package, task packet, task context, dependency contract, and branch-state digests.
7. Confirm an isolated worktree with no unrelated user changes.
8. Read this contract, the task packet, the task context, and existing task state/handoff.
9. If digests match, do not globally re-audit the repository or reread all 14 normative documents.
10. Inspect only named implementation files, the task diff, relevant dependency handoffs, and evidence invalidated since the last checkpoint.
11. Resume the recorded `next_action`.
12. Continue through implementation, targeted verification, correction, and evidence preparation.
13. Checkpoint, commit, and push before returning.

## 7. Persistence requirement

Keep working until the task definition of done is met. Diagnose and correct ordinary implementation, type, lint, build, task-owned verification, and integration failures. Do not stop because the first approach or command failed, because the previous chat is unavailable, or because code is “mostly complete.”

Checkpoint approximately every 30–45 minutes and always:

- after publishing an interface contract;
- after a migration or state invariant;
- before a long-running command;
- before any authorized external effect;
- at a real blocker;
- before a window ends.

Each checkpoint updates task state, handoff, and next prompt; creates a normal commit; and pushes the remote branch.

## 8. Permitted stop conditions

- explicit authority is required for a live/external effect;
- a required credential or exact provider asset identity is unavailable;
- another active writer owns an overlapping file or lock;
- a non-fast-forward push proves concurrent branch activity;
- a normative contradiction requires an operator decision;
- an upstream contract is absent or incompatibly changed;
- an applied migration would need modification;
- continuing would weaken authentication, authorization, privacy, child-data, billing, retention, migration, or provider-safety invariants;
- a destructive action lacks exact target and authority;
- a reproduced out-of-scope failure blocks progress and is assigned to the exact owner.

Before stopping, finish every safe independent part, push a recoverable checkpoint, and record one precise blocker.

## 9. Forbidden task behavior

- no silent scope expansion;
- no broad rewriting of another task’s files;
- no editing central hotspots except by their current steward;
- no competing migration ordinals;
- no edits to applied migration files;
- no live send, charge, publish, enroll, provider mutation, DNS change, delete, or deployment without explicit authority and lock;
- no fictional/demo/test customer or product lane;
- no fake success when a provider is unconfigured;
- no secrets, tokens, child data, private questions, raw provider payloads, Zoom bearers, or Vimeo URLs in commits/logs/handoffs/evidence;
- no status edits to the normative acceptance YAML;
- no carrying branch-level evidence forward after candidate drift without revalidation.

## 10. Verification and release

“No tests” means no fictional/demo/test product surface. Production-safety verification remains mandatory.

Branch checks are implementation evidence only. Final case results bind:

- immutable candidate SHA/artifact digests;
- environment and runtime tier;
- actor/fixture identities;
- provider registry and asset identities;
- exact steps/results;
- external-effect counts and cleanup;
- redacted evidence digests.

Final release requires every release-blocking case to pass against the same
candidate, in an environment allowed for that individual case, and every
release invariant to be zero. Exact artifact/config/provider/environment
identity is recorded per result; no cross-environment evidence is silently
reused.
