# Resume Protocol — Any New Codex Window

## Promise

You never need to find the previous Codex window. Before a new worker window,
run C00 to verify the prior writer is cleanly gone or its lease is stale and to
publish an exact `resume_ready` lease against the current remote task head.
Then paste the same task prompt into the new window; it resumes from Git.

## Exact recovery sequence

1. Open an isolated clone or worktree of `shloimie-beep/onetimev2`.
2. Fetch remote refs without rebasing or force-updating anything.
3. Read the exact task branch and status from the fetched remote control branch:
   `origin/codex/v21-control:ops/v2.1-execution/control/TASK-REGISTRY.yaml`.
4. If it exists, check it out at its remote head.
5. Read:
   - `ops/v2.1-execution/PACKAGE-LOCK.yaml`;
   - `ops/v2.1-execution/EXECUTION-CONTRACT.md`;
   - `ops/v2.1-execution/tasks/<TASK-ID>.yaml`;
   - `ops/v2.1-execution/contexts/<TASK-ID>-CONTEXT.md`;
   - `ops/v2.1-execution/runtime/<TASK-ID>/TASK-STATE.yaml`;
   - `ops/v2.1-execution/runtime/<TASK-ID>/HANDOFF.md`;
   - the recent commits on only that task branch.
6. Verify `LOCKED-SHA256SUMS.txt`, recorded task/context/dependency digests, the
   current remote control-state commit, and the task branch head. The delivery
   manifest is pre-bootstrap archive evidence, not a checksum for mutable state.
7. If all match, inspect only the diff since `state_based_on_head_sha`, then execute `next_action`.
8. Do not repeat a global repository audit or revisit locked product decisions.
9. If a digest changed, perform targeted drift analysis on the changed contract only. Continue if it cannot affect this task; otherwise checkpoint and report the exact incompatible change.
10. Before returning, update state/handoff/next prompt, commit, and push.

## First-run sequence

When the remote branch does not exist:

1. read `ops/v2.1-execution/control/READY-QUEUE.yaml` from the fetched
   `origin/codex/v21-control` ref, not from the current worktree;
2. require an entry for the exact task with `status: ready`,
   `authorized_start_sha`, package/source/task/context/dependency digests,
   parent control head, sibling-map entry payload digest, and exact unexpired
   writer/effect leases; derive the containing authorizing control commit from
   the fetched remote ref rather than expecting it inside the entry;
3. require that every start dependency’s interface checkpoint is already merged
   into that authorized integration SHA, then create the exact registered branch
   from that SHA;
4. seed runtime files from `templates/`;
5. claim the task by atomically creating the exact remote task branch and
   immediately pushing its seeded claim/state; workers never edit the control
   branch;
6. begin the task context’s first incomplete action.

Never infer a first-run base from `main`, a moving integration branch, a PR merge ref, or the newest remote commit.

## Collision handling

Stop safely when:

- the task is already claimed by a different active writer;
- its remote head advanced unexpectedly;
- push is non-fast-forward;
- the ready queue’s authorized SHA/digests do not match.

Do not force-push, reset another writer, delete their branch, or clean unrelated files.

## What counts as memory

The handoff records behavior and reasoning; task state records machine-readable progress; commits record implementation; results record candidate-bound proof. Conversation history is optional.
