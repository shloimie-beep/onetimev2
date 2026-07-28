# F05 — Typed API, Outbox, Sagas, Retry, and Quarantine — Locked Context

**Outcome:** Create typed API and job infrastructure with durable outbox, idempotency, retry, compensation, quarantine, and operable job state.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `API_JOB_FOUNDATION`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- Apply the exact task packet and execution contract.

## Dependency gates

- Start after: `F02`
- Full merge after: `F02`
- Candidate integration partners (non-ordering): `F03`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `apps/web/src/server/features/jobs/**`
- `apps/worker/src/runners/foundation/**`
- `packages/contracts/src/api/**`
- `packages/contracts/src/jobs/**`
- `packages/db/src/jobs/**`
- `packages/domain/src/jobs/**`

Scope notes below explain intent but do not grant additional path authority:

- packages/db/src/jobs/** except migrations and central index
- job/idempotency/quarantine tests
- steward requests for worker/server registration and migrations

## Deliverables

- typed command/query/error contracts
- transactional outbox and idempotency primitives
- retry/quarantine/compensation state
- worker runner interfaces

## Relevant locked decisions (1)

| Decision | Status | Exact decision |
|---|---|---|
| DEC-055 | INFERRED | Local account creation commits first with a durable outbox. Resend and unambiguous GHL effects retry asynchronously. GHL ambiguity is a visible CRM-link quarantine; provider failure must not create duplicate accounts, silently broaden access, or lose the local signup. |

## Acceptance requirements and exact cases (3 requirements)


### OTV2-API-217

Every production route has a typed request/response/error contract, server-derived scope, idempotency/concurrency behavior, and no PII or bearer credential in URLs.

- Area: `API`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `api`
- Semantic acceptance dependencies: `OTV2-AUTH-020, OTV2-FOUNDATION-001`
- Source references: `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-API-217-AC01
  kind: negative
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
  - Every production route has a typed request/response/error contract, server-derived scope, idempotency/concurrency
    behavior, and no PII or bearer credential in URLs.
  forbidden_effects:
  - duplicate external effect
  - unfenced worker completion
  - blind retry with new key
  - PII or bearer in URL
  evidence_profile: api_job_saga
  cleanup: reconcile every effect and clear only disposable operator-owned work
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-JOBS-210

Prepare Class and other external-effect operations use durable versioned sagas with idempotent retry and partial-failure visibility.

- Area: `JOBS`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `worker`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-OPS-171`
- Source references: `06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-JOBS-210-AC01
  kind: positive
  environment:
  - ci
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
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
  - Prepare Class and other external-effect operations use durable versioned sagas with idempotent retry and partial-failure
    visibility.
  forbidden_effects:
  - duplicate external effect
  - unfenced worker completion
  - blind retry with new key
  - PII or bearer in URL
  evidence_profile: api_job_saga
  cleanup: reconcile every effect and clear only disposable operator-owned work
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-JOBS-211

Provider timeouts after dispatch enter acceptance-unknown quarantine and are reconciled before retry.

- Area: `JOBS`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `worker`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-OPS-171`
- Source references: `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-JOBS-211-AC01
  kind: positive
  environment:
  - ci
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
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
  - Provider timeouts after dispatch enter acceptance-unknown quarantine and are reconciled before retry.
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
