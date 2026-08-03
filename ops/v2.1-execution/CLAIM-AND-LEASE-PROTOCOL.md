# Task Claim and Lease Protocol

The control branch is single-writer: only C00 edits the global queue, task
registry, and provider-lock ledger. Workers claim work through an exact
pre-issued lease plus normal fast-forward Git ref creation; they never edit the
control branch.

## Ready entry

C00 publishes for one task:

- exact task ID and branch;
- exact claim mode and parent control head;
- exact authorized integration start SHA;
- package/source/task/context/dependency digests;
- canonical ready-entry payload digest in the queue's sibling digest map;
- writer slots and provider locks;
- opaque `claim_id`;
- `lease_issued_at`, `lease_expires_at`, and heartbeat interval;
- status `ready` or `resume_ready`;
- expected existing task-branch head for a resume.

## First branch claim

1. Fetch `origin/codex/v21-control` and confirm the lease is current.
2. Confirm the registered remote task branch does not exist.
3. Create the local branch from `authorized_start_sha`.
4. Seed and commit task state with `claim_id`, writer ID, controller
   authorization SHA derived from the fetched remote ref, ready-entry payload
   digest, lease/heartbeat times, start SHA, and next action.
5. Use one normal non-force push to create the exact remote branch at that
   seeded claim commit. Remote ref creation is the atomic winner: if another
   writer created it first, stop and fetch; do not overwrite it.
6. C00 observes that branch/state and updates the registry on its next run.

## Bootstrap integration-branch adoption — I36 only

C00 precreates `codex/v21-integration` during serialized bootstrap. Therefore
I36 never uses the nonexistent-branch rule for its first claim.

1. C00 publishes `claim_mode: adopt_bootstrap_integration`, the exact expected
   bootstrap branch head, an opaque claim, and an unexpired I36 lease.
2. I36 fetches and checks out that exact existing head, verifies no active
   foreign I36 claim, and seeds TASK-STATE, HANDOFF, and NEXT-PROMPT in one
   commit.
3. One normal fast-forward push of that seeded claim commit is the atomic
   adoption winner.
4. A head mismatch, live foreign lease, or non-fast-forward push is a collision
   stop. I36 never deletes or recreates the integration branch.

## Resume claim

1. C00 publishes `resume_ready`, a new claim ID/lease, and the exact expected
   remote task head.
2. The new window fetches and checks that head.
3. It updates only its task state with the new lease, commits, and performs a
   normal fast-forward push.
4. A non-fast-forward result proves another active writer; stop without force.

A cleanly ending worker releases its lease in the final checkpoint. If a window
disappears, C00 may issue a takeover only after the heartbeat is stale or the
operator explicitly confirms the prior writer is gone. It records the old/new
claim IDs and expected branch head.

## Heartbeat and expiry

- Default task lease: 60 minutes.
- Checkpoint heartbeat: no more than 30 minutes while actively writing.
- Provider/live-effect locks may use shorter task-specific expiry.
- Lease expiry does not authorize overwriting a branch; C00 must issue a new
  resume lease against the exact current head.

## Long-running task renewal

Before a lease expires, the active worker finishes its current atomic action,
pushes a checkpoint with `phase: renewal_requested`, exact current head, writer
and claim IDs, and a safe `next_action`, then pauses. C00 verifies that head and
the same writer, publishes `resume_ready` with a new claim/lease against that
exact head, and pushes control state. The same or a new window may then resume
using the normal resume claim. No worker self-extends a lease, and no work
continues past expiry.

## Provider locks

Every provider lock records status, holder task/claim, exact non-secret provider
identity, claimed/expiry times, authority-record digest, effect budget, and
cleanup state. C00 allocates/releases it. A worker only consumes a lock named in
its current ready entry.
