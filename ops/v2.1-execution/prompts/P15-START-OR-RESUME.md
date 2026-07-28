# P15 — Calendar, Recurrence, Timezone, and DST — START OR RESUME

> **SET IN CODEX UI:** SOL / High  
> **MODEL:** `GPT-5.6-SOL`  
> **REASONING:** `HIGH`  
> **SERVICE TIER:** `PRIORITY`  
> **MODE:** `START_OR_RESUME`  
> **WAVE:** `3`

## Mission

Implement canonical class recurrence, role-specific calendars, restrictions, Gregorian display, timezone-safe rendering, DST handling, and responsive calendar interactions.

Repository: `shloimie-beep/onetimev2`  
Task packet: `ops/v2.1-execution/tasks/P15.yaml`  
Locked context: `ops/v2.1-execution/contexts/P15-CONTEXT.md`  
Runtime state: `ops/v2.1-execution/runtime/P15/TASK-STATE.yaml`  
Handoff: `ops/v2.1-execution/runtime/P15/HANDOFF.md`

## Non-negotiable start-or-resume protocol

1. Use an isolated clone/worktree. Fetch remote refs.
2. Verify the repository is `shloimie-beep/onetimev2`.
3. Read the exact branch/status for P15 from fetched
   `origin/codex/v21-control:ops/v2.1-execution/control/TASK-REGISTRY.yaml`.
   Do not trust a possibly stale control file in the current worktree.
4. If the registered remote branch exists, check out that exact branch and resume it.
5. If it does not exist, read `READY-QUEUE.yaml` from the fetched remote control
   branch. Start only when P15 is `ready`, its locks are unclaimed, and the
   queue provides the exact branch, `authorized_start_sha`, dependency
   heads/digests, and proof that every required interface contract is integrated.
   Create the registered branch from that exact SHA.
6. Follow `CLAIM-AND-LEASE-PROTOCOL.md`: consume the exact unexpired claim,
   create a new remote branch by normal atomic ref creation, or resume only from
   the exact expected head under a C00-issued resume lease. On first run,
   commit the seeded claim state before the one atomic branch-creation push.
   Never overwrite another claim.
7. Never branch from `main`, never use a synthetic PR merge SHA, never infer a base from a moving branch, and never force-push.
8. Verify `PACKAGE-LOCK.yaml`, `LOCKED-SHA256SUMS.txt`, this task packet,
   context, dependency contracts, and source package digests; verify mutable
   control/task state by their current committed branch digests, not the
   delivery manifest.
9. Read, in order: `EXECUTION-CONTRACT.md`, this task packet, this context,
   existing task state/handoff, dependency handoffs named by the packet, then
   only named implementation/evidence files. Use embedded normative sections
   first; if the context is insufficient for an assigned case, read only the
   packet's exact `required_source_documents`/sections, not the whole source
   package.
10. If all digests match, do not perform a broad repository audit, reread all 14 source documents, reconsider settled v2.1 decisions, or repeat completed work. Inspect only the diff since the last checkpoint and resume `next_action`.
11. If a digest changed, perform targeted drift analysis only. Continue when the change cannot affect this task; otherwise finish safe independent work, checkpoint, and report the exact incompatibility.
12. On first run, seed task state/handoff/next prompt from `templates/` and record the exact branch, start SHA, dependency heads, claim/lease, and writer identity.

## Scope

Primary requirements (14): `OTV2-CALENDAR-051, OTV2-CALENDAR-052, OTV2-CALENDAR-053, OTV2-CALENDAR-054, OTV2-CALENDAR-055, OTV2-CALENDAR-056, OTV2-CALENDAR-057, OTV2-CALENDAR-058, OTV2-CALENDAR-059, OTV2-CALENDAR-060, OTV2-CALENDAR-061, OTV2-CALENDAR-062, OTV2-CALENDAR-063, OTV2-CALENDAR-064`  
Primary acceptance cases (14): `OTV2-CALENDAR-051-AC01, OTV2-CALENDAR-052-AC01, OTV2-CALENDAR-053-AC01, OTV2-CALENDAR-054-AC01, OTV2-CALENDAR-055-AC01, OTV2-CALENDAR-056-AC01, OTV2-CALENDAR-057-AC01, OTV2-CALENDAR-058-AC01, OTV2-CALENDAR-059-AC01, OTV2-CALENDAR-060-AC01, OTV2-CALENDAR-061-AC01, OTV2-CALENDAR-062-AC01, OTV2-CALENDAR-063-AC01, OTV2-CALENDAR-064-AC01`  
Writer slots: `CALENDAR`  
Start after: `F02, F07`  
Full merge after: `F02, F07`  
Candidate integration partners (non-ordering): `F03`  
Acceptance after: `None`

Machine-enforced owned globs:
- `apps/web/src/client/features/calendar/**`
- `apps/web/src/server/features/calendar/**`
- `packages/contracts/src/calendar/**`
- `packages/db/src/calendar/**`
- `packages/domain/src/calendar/**`

Scope notes (do not grant additional path authority):

- packages/db/src/calendar/** except migrations and central index
- calendar/timezone/DST focused tests
- steward requests for route/migration/registration changes

Deliverables:

- rolling recurrence and calendar query contract
- Admin/Parent/Student role calendar views
- timezone and DST-safe occurrence rendering
- responsive accessible calendar UI

Feature work stays in isolated modules. If you need a migration, root route, app shell, worker registration, config key, dependency, lockfile, barrel export, global style, deployment manifest, or another steward-owned hotspot, create the structured steward request; do not edit the hotspot.

## Work loop

1. Record a concise gap map only for assigned requirements/cases and named paths.
2. Implement the smallest coherent vertical behavior that satisfies the locked context.
3. Exercise its positive, negative, authorization, isolation, concurrency, retry, and recovery branches required by the assigned cases.
4. Diagnose and correct ordinary in-scope failures. Do not return after the first failed command or first draft.
5. Update requirement/case progress and exact next action continuously.
6. When the task packet lists downstream `unlocks`, publish an
   `INTERFACE-CHECKPOINT.yaml` plus exact commit as soon as that contract is
   stable. Notify C00/I36; downstream work starts only after I36 merges that
   checkpoint and C00 issues a resulting integration start SHA.
7. Continue until every assigned behavior is implementation-ready and task-owned verification passes, or a permitted stop condition remains after all safe independent work.

## Checkpoint and persistence

Checkpoint every meaningful milestone, approximately every 30–45 minutes, and always after an interface/migration/invariant, before a long command or authorized external effect, at a real blocker, and before the window ends.

Each checkpoint must:

1. preserve working code;
2. update `TASK-STATE.yaml`;
3. update `HANDOFF.md`;
4. regenerate paste-ready `NEXT-PROMPT.md`;
5. create a normal commit;
6. push the task branch;
7. report the pushed SHA for C00’s registry. Do not amend the same commit merely
   to embed its own SHA; state records the parent/implementation head and Git
   supplies the metadata commit identity.

The remote branch is the durable memory. A new Codex window must be able to paste this same prompt and continue without the old conversation.

## Keep-working instruction

Keep working until the complete task definition of done is met. Do not stop at “mostly complete,” after merely producing code, because the previous window is unavailable, or because a provider is not yet authorized when provider-independent work remains.

Permitted stops are only the exact stop conditions in the task packet: authority/credential/provider identity missing for a live effect; writer/lock collision; non-fast-forward push; normative contradiction; incompatible missing upstream contract; immutable migration conflict; protected invariant would be weakened; destructive target/authority missing; or a reproduced out-of-scope blocker after all safe independent work is complete.

When blocked, push a recoverable checkpoint and report one precise blocker, its owner, the safe work completed, and the exact action that unblocks it.

## Safety and authority

No live send, charge, publish, enrollment, workflow activation, provider mutation, DNS change, delete, or deployment is authorized by this prompt alone. Obey `EXTERNAL-AUTHORITY-MATRIX.yaml`. Never put secrets, tokens, child data, private questions, unredacted provider payloads, raw Zoom bearers, or raw Vimeo URLs in code, logs, commits, handoffs, screenshots, or evidence.

## Normal finish

Normal worker completion is `ready_for_review`, not `done`. Before returning, ensure task state/handoff/next prompt are current, all changes are committed and pushed, and report the branch, pushed SHA, requirement/case status, verification, external-effect counts, and any exact blocker.
