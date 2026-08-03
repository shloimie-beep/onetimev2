# F02 — Canonical Schema, State Machines, and Migration Stewardship — Locked Context

**Outcome:** Implement canonical production schema constraints and state-machine enforcement while allocating all new forward-only migrations from 2234 upward.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `MIGRATION_AUTHORITY, SCHEMA_CONTRACT`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- Never allocate or backfill migration ordinal 2231.
- Feature tasks submit migration requests; only F02 writes new migration files.
- Use a disposable database for branch migration proof; never apply parallel branch migrations to one persistent shared database.

## Dependency gates

- Start after: `F01`
- Full merge after: `F01`
- Candidate integration partners (non-ordering): `None`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `ops/v2.1-execution/runtime/F02/MIGRATION-ALLOCATIONS-PROPOSAL.yaml`
- `packages/contracts/src/state/**`
- `packages/db/migrations/2234+*.sql`
- `packages/domain/src/state/**`

Scope notes below explain intent but do not grant additional path authority:

- packages/db/src migration compatibility and migration index
- tests dedicated to schema invariants and state transitions

## Deliverables

- canonical entity and invariant schema
- forward-only migration allocation manifest
- state transition guards and concurrency constraints
- schema/interface_ready checkpoint for downstream tasks

## Relevant locked decisions (7)

| Decision | Status | Exact decision |
|---|---|---|
| DEC-120 | INFERRED | Human account lifecycle is `invited`, `active`, `disabled`, `archived`. “Archived” is retained history and cannot log in; “disabled” is reversible access suspension. |
| DEC-121 | INFERRED | Student lifecycle is `active` or `archived`. Archived Students retain history, cannot authenticate, and do not consume an active seat. |
| DEC-122 | INFERRED | Product access lifecycle is `free`, `active`, `grace`, `inactive`. In `inactive`, the exact restricted Parent route allowlist in DEC-047 remains available; Student access does not. |
| DEC-123 | INFERRED | Class occurrence lifecycle is `scheduled`, `preparing`, `ready`, `live`, `completed`, or `canceled`. Draft recurrence edits exist at the series level, not as visible fake occurrences. |
| DEC-124 | INFERRED | Content lifecycle is `received`, `validating`, `processing`, `needs_review`, `approved`, `publishing`, `published`, `failed`, or `archived`. |
| DEC-125 | INFERRED | Question lifecycle is `submitted`, `answered_private`, `approved_for_class`, `published`, `closed`, or `declined`. |
| DEC-126 | INFERRED | Support lifecycle is `open`, `in_progress`, `waiting_on_requester`, `resolved`, or `closed`. |

## Acceptance requirements and exact cases (1 requirements)


### OTV2-STATE-202

Account, Student, access, occurrence, content, question, support, and billing transitions enforce the canonical state tables.

- Area: `STATE`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `domain`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-AUTH-019`
- Source references: `06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-STATE-202-AC01
  kind: positive
  environment:
  - ci
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
  - parent
  - student
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - student_operator_canary_1
  preconditions:
  - typed route/job contract and stable idempotency key are defined
  steps:
  - submit the authorized operation
  - double-submit and send a stale version
  - inject timeout/acceptance-unknown
  - reconcile or safely reprocess through governed controls
  expected_results:
  - Account, Student, access, occurrence, content, question, support, and billing transitions enforce the canonical
    state tables.
  forbidden_effects:
  - duplicate external effect
  - unfenced worker completion
  - blind retry with new key
  - PII or bearer in URL
  evidence_profile: api_job_saga
  cleanup: reconcile every effect and clear only disposable operator-owned work
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

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
