# Fastest Safe Launch Batches

The package contains 46 prompts. Do **not** open all 46 at once. Dependencies and shared-file locks make that slower, not faster.

The default budget is **eight total active Codex windows**. C00 is episodic:
run it, let it push the remote queue, then close it before dispatching workers.
I36 consumes one active slot while it is running, so the feature-writer capacity
at that moment is seven. When neither C00 nor I36 is active, all eight slots may
be disjoint implementation writers. Even if your account supports more total
windows, never exceed eight simultaneous implementation writers.

## Start

1. Run `prompts/C00-START-OR-RESUME.md` alone and attach this complete ZIP.
2. Run `prompts/F01-START-OR-RESUME.md` from the exact ready-queue SHA.
3. As soon as F01 publishes `interface_ready`, run I36 once to merge that exact
   contract checkpoint. C00 then issues the Wave 2 integration start SHA.
4. Resume I36 on demand after every queued interface/full/evidence merge batch.
   It is the one integration writer and consumes one of the eight default
   active-window slots while running.
5. After that, use the ready queue on remote `codex/v21-control` as the source
   of truth. The runtime launch steps below are the optimized default; the
   remote queue is the runtime answer.

## Default runtime launch steps

The task `wave` numbers in `PROMPT-INDEX.md`, `ROADMAP.yaml`, and individual
task packets describe each task's dependency-graph group. The numbered steps
below describe the actual operator sequence and therefore continue through 13
because P34, V43, R45, I36, and C00 resume in later phases. These are two
different fields; do not rewrite task wave metadata to match runtime step
numbers.

| Runtime step | Run concurrently when the ready queue authorizes them | Max writers |
|---:|---|---:|
| 0 | C00 | 1 |
| 1 | F01; I36 on demand after F01’s interface checkpoint | 1 feature + 1 integration writer |
| 2 | F02, F07, P31, P35 | 4 |
| 3 | F03, F04, F05, P15 | 4 |
| 4 | F06, P10, P11, P12, P14, P22, P23, P24, P32 | 8 at once; queue the ninth |
| 5 | P08, P13, P16, P21, P25, P26, P27, P33 | 8 |
| 6 | P09, P17, P18, P19, P28, P34 | 6 |
| 7 | P20, P29, P30 | 3 |
| 8 | I36 completes full integration/registration and freezes the source candidate; earlier contract/full micro-batches have already been merged on demand | 1 integration writer |
| 9 | V37, V38, V39, V40, V41, V42, V43 against one immutable candidate; then I36 aggregates their evidence | 7 read-mostly lanes + 1 later aggregator |
| 10 | R44; I36 aggregates it; then P34 Phase B writes non-result post-operator supporting proof and I36 aggregates that | 1 live operator/evidence lane at a time |
| 11 | C00 authorizes V43 Phase B; V43 executes the three deferred cases; I36 aggregates and C00 verifies the 264-case pre-R45 index | 1 at a time |
| 12 | R45 Phase A certifies case 265. Pass path: I36 aggregates to canonical 265/265, then C00 dispatches either authorized cutover or read-only blocked-decision Phase B. Failed/blocked case path goes directly to a blocked decision. | 1 at a time |
| 13 | I36 ancestry-merges the final R45 result/effect/observation/decision head; C00 independently records `done` only for released, otherwise `release_blocked` | 1 at a time |

## Slot-filling rule

Prioritize the longest ready critical-path task, then fill remaining slots with ready tasks whose writer slots, owned paths, provider locks, and start SHA do not overlap.

If a task in the current runtime step publishes an interface or finishes early,
rerun C00 in a new window with the same controller prompt, then I36 when the
merge queue is nonempty. C00 publishes the next exact prompts; you do not need
either previous chat.

## Why this is faster

- F01 removes the monolithic-file merge trap once.
- F02/F03/F04/F05/F06/F07 publish contracts early.
- Feature lanes add isolated modules and submit tiny steward requests.
- I36 performs root wiring once.
- Seven verifier lanes run concurrently against the same frozen candidate.
- Every task can resume from a new window without re-auditing the repository.
