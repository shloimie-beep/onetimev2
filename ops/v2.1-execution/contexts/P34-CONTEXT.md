# P34 — Backup, Restore, Rollback, Canary Budgets, and Legal Gate — Locked Context

**Outcome:** Implement backup/restore proof, rollback controls, bounded canary accounting, and a non-fabricatable legal-policy artifact gate; close the post-operator legal/canary evidence after R44.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `OPERATIONS_RECOVERY`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- Do not fabricate legal documents, approver identity, approvals, provider effects, backup proof, or restore proof.
- The implementation can become implementation_ready before R44; final candidate acceptance waits for the recorded post-operator evidence.

## Dependency gates

- Start after: `P33`
- Full merge after: `P33`
- Candidate integration partners (non-ordering): `P35`
- Candidate acceptance after: `R44`

## Machine-enforced owned globs

- `ops/runbooks/v2.1/backup-restore/**`
- `ops/runbooks/v2.1/canary/**`
- `ops/runbooks/v2.1/rollback/**`
- `ops/v2.1-execution/proofs/<candidate-digest>/P34/**`
- `scripts/operations/v21/backup-restore/**`
- `scripts/operations/v21/canary-budget/**`

Scope notes below explain intent but do not grant additional path authority:

- legal artifact gate validation modules
- backup/restore/rollback/effect-budget tests
- candidate-bound P34 non-result supporting proof after R44
- steward requests for config/deploy changes

## Deliverables

- backup and restore mechanism plus evidence schema
- rollback decision/runbook/automation
- external-effect budget accounting and reconciliation
- legal artifact approval/digest gate
- post-R44 gate closure checkpoint

## Relevant locked decisions (2)

| Decision | Status | Exact decision |
|---|---|---|
| DEC-007 | INFERRED | Automated unit, integration, browser, accessibility, concurrency, security, migration, provider-sandbox, and bounded production-canary verification remain required. “No tests” means no fictional/demo/test product surfaces and no test-only operating lane, not removal of production-safety verification. |
| DEC-152 | INFERRED | Manual acceptance supplements, but does not replace, automated safety and regression evidence tied to the exact release candidate. |

## Acceptance requirements and exact cases (6 requirements)


### OTV2-OPS-168

Pre-deploy backup is complete.

- Area: `OPS`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `operations`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-DOMAIN-154`
- Source references: `11-ENVIRONMENT-FIXTURE-CANARY-MANIFEST-v2.1.yaml, 12-MIGRATION-CUTOVER-ROLLBACK-v2.1.md, 13-OPERATIONS-SLO-DR-INCIDENT-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-OPS-168-AC01
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
  - Pre-deploy backup is complete.
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

### OTV2-OPS-169

Restore drill is proven.

- Area: `OPS`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `operations`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-DOMAIN-154`
- Source references: `11-ENVIRONMENT-FIXTURE-CANARY-MANIFEST-v2.1.yaml, 12-MIGRATION-CUTOVER-ROLLBACK-v2.1.md, 13-OPERATIONS-SLO-DR-INCIDENT-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-OPS-169-AC01
  kind: recovery
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
  - Restore drill is proven.
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

### OTV2-OPS-170

Rollback target and commands are recorded.

- Area: `OPS`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `operations`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-DOMAIN-154`
- Source references: `11-ENVIRONMENT-FIXTURE-CANARY-MANIFEST-v2.1.yaml, 12-MIGRATION-CUTOVER-ROLLBACK-v2.1.md, 13-OPERATIONS-SLO-DR-INCIDENT-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-OPS-170-AC01
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
  - Rollback target and commands are recorded.
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

### OTV2-OPS-218

Approved RPO is 15 minutes and approved RTO is 30 minutes, proven by representative restore drills.

- Area: `OPS`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `operations`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-DOMAIN-154`
- Source references: `13-OPERATIONS-SLO-DR-INCIDENT-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-OPS-218-AC01
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
  - Approved RPO is 15 minutes and approved RTO is 30 minutes, proven by representative restore drills.
  forbidden_effects:
  - production overwrite during drill
  - unnotified alert
  - unmatched web/worker
  - unverified restore claim
  evidence_profile: operations_recovery
  cleanup: destroy only the isolated restore target after evidence is retained
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-OPS-219

Provider canaries obey the exact external-effect budgets and stop conditions in the environment manifest.

- Area: `OPS`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `operations`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-DOMAIN-154`
- Source references: `11-ENVIRONMENT-FIXTURE-CANARY-MANIFEST-v2.1.yaml`

Exact acceptance case data:

```yaml
- case_id: OTV2-OPS-219-AC01
  kind: positive
  environment:
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - admin_rabbi_eli
  - parent_operator_canary
  - student_operator_canary_1
  - student_operator_canary_2
  - student_operator_canary_3
  preconditions:
  - exact production candidate is active
  - operator authority and effect budget are recorded
  - all lower gates passed
  steps:
  - complete the named real journey on real devices
  - record persistent and provider readback
  - inventory every visible control
  - reconcile and sign off
  expected_results:
  - Provider canaries obey the exact external-effect budgets and stop conditions in the environment manifest.
  forbidden_effects:
  - fictional fixture
  - placeholder control
  - unexpected external effect
  - unreconciled canary resource
  evidence_profile: manual_real_journey
  cleanup: complete manifest reconciliation and preserve candidate-bound evidence
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-OPS-241

Verification environment ID is separate from runtime tier, isolated and production credential mappings are exact, and production broad remains blocked until concrete approved legal artifacts match production renders.

- Area: `OPS`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `operations`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-DOMAIN-154, OTV2-OPS-218, OTV2-OPS-219, OTV2-OPS-222`
- Source references: `11-ENVIRONMENT-FIXTURE-CANARY-MANIFEST-v2.1.yaml, 13-OPERATIONS-SLO-DR-INCIDENT-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-OPS-241-ENVIRONMENT-MAPPING
  kind: configuration_matrix
  environment: &id001
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
  - resolve each verification_environment_id and runtime_tier from the exact candidate
  - read back credentials/accounts for ci, provider_sandbox, persistent_staging, production_read_only, production_operator_canary,
    and production_broad
  - attempt every mismatched isolated/live pairing
  expected_results:
  - ci/provider_sandbox/persistent_staging map only to isolated_staging and all production verification modes map
    only to production
  - results record both fields and every mismatch fails closed before provider or data access
  forbidden_effects:
  - field conflation
  - live credential in isolated mode
  - isolated credential in production mode
  - fallback credential
  evidence_profile: operations_recovery
  cleanup: destroy only the isolated restore target after evidence is retained
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
- case_id: OTV2-OPS-241-LEGAL-ARTIFACT-GATE
  kind: release_gate
  environment: *id001
  actors:
  - admin
  fixtures:
  - admin_shloimie
  preconditions:
  - exact candidate, backup, alert destination, and recovery environment are identified
  steps:
  - attempt production_broad with each required legal artifact record missing, unapproved, stale, or digest-mismatched
  - record concrete stable external ID, immutable digest, effective version, approver/timestamp, and production
    render readback for the five exact Terms, Privacy, Student-data/recording-consent, cancellation, and refund
    files plus the binding legal-policy manifest
  - re-run the gate and mutate one production render after approval
  expected_results:
  - production_broad remains blocked until all five concrete policy artifacts and the binding approval manifest
    are present and match their production renders
  - all matching approved artifacts close the gate; later drift reopens it immediately
  forbidden_effects:
  - invented legal approval
  - approval without digest
  - stale render
  - broad release while gate open
  evidence_profile: operations_recovery
  cleanup: destroy only the isolated restore target after evidence is retained
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
