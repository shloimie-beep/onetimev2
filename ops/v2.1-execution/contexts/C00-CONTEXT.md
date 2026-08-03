# C00 — Execution Control Tower and Authority Bootstrap — Locked Context

**Outcome:** Install the locked v2.1 specification and execution pack into the repository, replace stale status authority, establish durable control/integration branches, validate the plan, and continuously publish the next collision-free ready batch.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `AUTHORITY, CONTROL_PLANE`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- This task never implements product code.
- The first invocation is serialized and starts from the exact reviewed head.
- Later invocations read remote task state and recalculate the critical path without a global re-audit.

## Dependency gates

- Start after: `None`
- Full merge after: `None`
- Candidate integration partners (non-ordering): `None`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `ops/v2.1-execution/**`

Scope notes below explain intent but do not grant additional path authority:

- AGENTS.md authority/status sections
- control branch metadata only

## Deliverables

- committed v2.1 source package and execution pack
- v2.1 authority hierarchy in AGENTS.md
- codex/v21-control and codex/v21-integration remote branches
- validated task packets, ready queue, writer locks, blocker queue, and merge queue
- branch-push permission canary

## Relevant locked decisions (0)

No direct decision mapping; use the execution contract and task outcome.

## Acceptance requirements and exact cases (0 requirements)

C00 owns execution integrity rather than product requirements. It must validate that all 243 requirements and 265 cases have exact owners.

## Cross-cutting invariants

- Exact assignable roles are `admin`, `parent`, and `student`.
- Students have username/password credentials and no required email; no Student is a GHL contact.
- A Parent never becomes a learner session; an adult learner uses a separate Student seat.
- One adult identity may own multiple independently billed households; authorization remains household-scoped.
- No preview/demo/test product lane, fictional customer, Class Helper, Buffer/social publisher, public WhatsApp assistant, or active Tisha funnel route.
- GHL is adult CRM/campaign/operator billing workflow; Stripe is financial truth; One Time stores a minimum verified access projection and never mutates financial objects.
- Email must complete launch workflows even while WhatsApp is dormant.
- Zoom and Vimeo bearers/URLs never appear in UI URLs, email, GHL, logs, handoffs, or evidence.
- Production evidence must bind one immutable candidate; each case uses only an environment allowed by its acceptance contract and records exact environment/runtime/deployment/provider identity. The 265 cases are not required to share one environment.
- Automated production-safety verification is required even though demo/test product surfaces are prohibited.
