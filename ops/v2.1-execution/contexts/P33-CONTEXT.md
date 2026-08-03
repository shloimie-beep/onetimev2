# P33 — Runtime Identity, Migrations, Queues, Health, and Leakage Monitoring — Locked Context

**Outcome:** Implement exact runtime identity and deployable health, migration/queue/provider observability, redacted diagnostics, and leakage monitoring.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `OPERATIONS_RUNTIME`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- Apply the exact task packet and execution contract.

## Dependency gates

- Start after: `F05, F06`
- Full merge after: `F05, F06`
- Candidate integration partners (non-ordering): `P17, P19, P20, P21, P24, P25, P26, P27, P28, P29, P30`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `apps/web/src/server/operations/**`
- `apps/worker/src/operations/**`
- `ops/runbooks/v2.1/runtime/**`
- `packages/observability/v21/**`
- `scripts/operations/v21/health/**`
- `scripts/operations/v21/monitoring/**`
- `scripts/operations/v21/runtime/**`

Scope notes below explain intent but do not grant additional path authority:

- apps/web/src/server/operations/** except central app registration
- apps/worker/src/operations/** except central runner registration
- runtime identity/health/redaction/leakage tests
- steward requests for config/dependency/deploy registration

## Deliverables

- runtime/candidate identity endpoints
- migration/queue/provider health
- redacted structured diagnostics
- secret/PII/bearer leakage monitoring and alerts

## Relevant locked decisions (0)

No direct decision mapping; use the execution contract and task outcome.

## Acceptance requirements and exact cases (5 requirements)


### OTV2-OPS-166

Production web and worker use the exact same immutable source.

- Area: `OPS`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `operations`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-DOMAIN-154`
- Source references: `11-ENVIRONMENT-FIXTURE-CANARY-MANIFEST-v2.1.yaml, 12-MIGRATION-CUTOVER-ROLLBACK-v2.1.md, 13-OPERATIONS-SLO-DR-INCIDENT-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-OPS-166-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_read_only
  actors:
  - admin
  fixtures:
  - admin_shloimie
  preconditions:
  - exact candidate, backup, alert destination, and recovery environment are identified
  steps:
  - verify build/runtime/migration identity
  - create and inspect backup
  - restore representative data and verify checksums
  - measure RPO/RTO
  - trigger and acknowledge a bounded alert
  expected_results:
  - Production web and worker use the exact same immutable source.
  forbidden_effects:
  - production overwrite during drill
  - unnotified alert
  - unmatched web/worker
  - unverified restore claim
  evidence_profile: operations_recovery
  cleanup: destroy only the isolated restore target after evidence is retained
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-OPS-167

Forward-only migrations and read-only verification pass.

- Area: `OPS`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `operations`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-DOMAIN-154`
- Source references: `11-ENVIRONMENT-FIXTURE-CANARY-MANIFEST-v2.1.yaml, 12-MIGRATION-CUTOVER-ROLLBACK-v2.1.md, 13-OPERATIONS-SLO-DR-INCIDENT-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-OPS-167-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_read_only
  actors:
  - admin
  fixtures:
  - admin_shloimie
  preconditions:
  - exact candidate, backup, alert destination, and recovery environment are identified
  steps:
  - verify build/runtime/migration identity
  - create and inspect backup
  - restore representative data and verify checksums
  - measure RPO/RTO
  - trigger and acknowledge a bounded alert
  expected_results:
  - Forward-only migrations and read-only verification pass.
  forbidden_effects:
  - production overwrite during drill
  - unnotified alert
  - unmatched web/worker
  - unverified restore claim
  evidence_profile: operations_recovery
  cleanup: destroy only the isolated restore target after evidence is retained
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-OPS-171

Worker heartbeat and queues are healthy.

- Area: `OPS`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `operations`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-DOMAIN-154`
- Source references: `11-ENVIRONMENT-FIXTURE-CANARY-MANIFEST-v2.1.yaml, 12-MIGRATION-CUTOVER-ROLLBACK-v2.1.md, 13-OPERATIONS-SLO-DR-INCIDENT-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-OPS-171-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_read_only
  actors:
  - admin
  fixtures:
  - admin_shloimie
  preconditions:
  - exact candidate, backup, alert destination, and recovery environment are identified
  steps:
  - verify build/runtime/migration identity
  - create and inspect backup
  - restore representative data and verify checksums
  - measure RPO/RTO
  - trigger and acknowledge a bounded alert
  expected_results:
  - Worker heartbeat and queues are healthy.
  forbidden_effects:
  - production overwrite during drill
  - unnotified alert
  - unmatched web/worker
  - unverified restore claim
  evidence_profile: operations_recovery
  cleanup: destroy only the isolated restore target after evidence is retained
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-OPS-172

Resend, GHL, Stripe, Zoom, Vimeo, Drive, and Telegram status are visible to Admin.

- Area: `OPS`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `operations`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-DOMAIN-154`
- Source references: `11-ENVIRONMENT-FIXTURE-CANARY-MANIFEST-v2.1.yaml, 12-MIGRATION-CUTOVER-ROLLBACK-v2.1.md, 13-OPERATIONS-SLO-DR-INCIDENT-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-OPS-172-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_read_only
  actors:
  - admin
  fixtures:
  - admin_shloimie
  preconditions:
  - exact candidate, backup, alert destination, and recovery environment are identified
  steps:
  - verify build/runtime/migration identity
  - create and inspect backup
  - restore representative data and verify checksums
  - measure RPO/RTO
  - trigger and acknowledge a bounded alert
  expected_results:
  - Resend, GHL, Stripe, Zoom, Vimeo, Drive, and Telegram status are visible to Admin.
  forbidden_effects:
  - production overwrite during drill
  - unnotified alert
  - unmatched web/worker
  - unverified restore claim
  evidence_profile: operations_recovery
  cleanup: destroy only the isolated restore target after evidence is retained
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-OPS-173

Secret, PII, and provider-link leakage scans pass.

- Area: `OPS`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `operations`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-DOMAIN-154`
- Source references: `11-ENVIRONMENT-FIXTURE-CANARY-MANIFEST-v2.1.yaml, 12-MIGRATION-CUTOVER-ROLLBACK-v2.1.md, 13-OPERATIONS-SLO-DR-INCIDENT-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-OPS-173-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_read_only
  actors:
  - admin
  fixtures:
  - admin_shloimie
  preconditions:
  - exact candidate, backup, alert destination, and recovery environment are identified
  steps:
  - verify build/runtime/migration identity
  - create and inspect backup
  - restore representative data and verify checksums
  - measure RPO/RTO
  - trigger and acknowledge a bounded alert
  expected_results:
  - Secret, PII, and provider-link leakage scans pass.
  forbidden_effects:
  - production overwrite during drill
  - unnotified alert
  - unmatched web/worker
  - unverified restore claim
  evidence_profile: operations_recovery
  cleanup: destroy only the isolated restore target after evidence is retained
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
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
