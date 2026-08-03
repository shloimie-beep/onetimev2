# One Time v2.1 — Codex Production Execution Pack

This is the complete prompt package for turning the locked One Time v2.1 specification into one production-ready release candidate.

## Fastest correct way to use it

1. Open a new Codex task with **GPT-5.6-SOL / Extra High / Priority**.
2. Attach this entire ZIP and paste [`prompts/C00-START-OR-RESUME.md`](prompts/C00-START-OR-RESUME.md).
3. C00 installs the locked package into the repo, fixes stale `AGENTS.md` authority, creates the durable control/integration branches, validates all coverage, and issues F01.
4. Run F01 alone. It extracts the shared architecture seams that make later parallel work safe.
5. Then follow [`LAUNCH-BATCHES.md`](LAUNCH-BATCHES.md) and C00’s committed
   ready queue. Default to eight total active windows: C00 runs episodically;
   I36 consumes one slot while active; otherwise use up to eight disjoint
   implementation windows.
6. Use the exact model/reasoning at the top of each prompt.
7. When a worker window closes or gets lost, run C00 once to verify the old
   writer is gone (or its lease is stale) and publish an exact `resume_ready`
   lease; then paste the **same worker prompt** into any new Codex window. It
   resumes the pushed branch's `next_action`; you never need the old
   conversation or window.
8. I36 integrates. V37–V43 verify concurrently. R44 performs the real operator
   journey. P34 publishes its non-result post-operator supporting proof; C00
   then reauthorizes V43 Phase B and I36 aggregates its three final cases.
   R45 Phase A certifies case 265, I36 builds the canonical 265/265 index, and
   only then may C00 dispatch authorized cutover—or a read-only blocked
   decision when the final authority/gate is unavailable. Finally resume I36 to
   aggregate R45's effect/observation/decision head, then C00 verifies and
   records `done` only for a verified release; a withheld release is recorded
   as `release_blocked`.

## The crucial speed rule

Do not launch all 46 prompts simultaneously. The fastest schedule is maximum
**safe** concurrency within eight default active windows: an episodic
controller, disjoint writers, an on-demand merge captain, then seven
verification lanes. Starting tasks before their contract/write-lock gates
causes duplicate architecture work and merge conflicts.

## What prevents Codex confusion

- exact reviewed base `73dda293079f602c83929d1bbccb8dd5b9d1a455`; never stale `main`;
- complete v2.1 spec copied into every repo bootstrap;
- 243 requirements and 265 cases assigned exactly once;
- task-specific contexts with full acceptance data and mapped decisions;
- explicit start/integration/acceptance dependencies;
- sole writers for migrations, app/server/worker composers, design system, config/lockfiles, GHL registry, and integration;
- checkpointed remote branch state, handoff, and next prompt;
- precise stop conditions and a “keep working” contract;
- candidate-bound evidence with no branch-level false completion;
- external provider/DNS/deployment locks and budgets.

## Navigation

- [`PROMPT-INDEX.md`](PROMPT-INDEX.md) — all 46 prompts and settings.
- [`DEPENDENCY-GRAPH.md`](DEPENDENCY-GRAPH.md) — complete graph and gates.
- [`ROADMAP.yaml`](ROADMAP.yaml) — machine-readable task catalog.
- [`ACCEPTANCE-OWNERSHIP.yaml`](ACCEPTANCE-OWNERSHIP.yaml) — every requirement/case owner.
- [`ACCEPTANCE-ENVIRONMENT-MATRIX.yaml`](ACCEPTANCE-ENVIRONMENT-MATRIX.yaml) — allowed environment(s) for every case.
- [`CONTROL-STATE-TRANSITIONS.yaml`](CONTROL-STATE-TRANSITIONS.yaml) — authoritative task/global state machine and proof gates.
- [`WRITER-SCOPES.yaml`](WRITER-SCOPES.yaml) — collision prevention.
- [`RESUME-PROTOCOL.md`](RESUME-PROTOCOL.md) — fresh-window recovery.
- [`MERGE-PROTOCOL.md`](MERGE-PROTOCOL.md) — sole integration flow.
- [`CANDIDATE-IDENTITY-PROTOCOL.md`](CANDIDATE-IDENTITY-PROTOCOL.md) — canonical candidate versus deployment identity.
- [`EXTERNAL-EFFECT-PROTOCOL.md`](EXTERNAL-EFFECT-PROTOCOL.md) — write-ahead live-effect and recovery rules.
- [`EXTERNAL-AUTHORITY-MATRIX.yaml`](EXTERNAL-AUTHORITY-MATRIX.yaml) — provider/live-effect locks.
- [`FINAL-CANDIDATE-PROTOCOL.md`](FINAL-CANDIDATE-PROTOCOL.md) — verification, operator, and release gates.
- [`VALIDATION-REPORT.md`](VALIDATION-REPORT.md) — package integrity proof.

## Package scope

This package creates plans, prompts, task packets, contexts, and control protocols. It does not itself modify application code, live providers, billing, DNS, deployment, or production data.
