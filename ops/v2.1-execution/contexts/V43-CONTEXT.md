# V43 — Operations, Domain, Migration, Recovery, and Retired-Surface Verification — Locked Context

**Outcome:** Verify runtime identity, migrations, queues, monitoring, backup/restore/rollback mechanisms, canary/legal gates, domains, migration bridge, archival behavior, and retired-surface absence.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `VERIFY_OPERATIONS`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- Apply the exact task packet and execution contract.

## Dependency gates

- Start after: `I36`
- Full merge after: `None`
- Candidate integration partners (non-ordering): `None`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `ops/v2.1-execution/results/<candidate-digest>/V43/**`
- `ops/v2.1-execution/verification-harness/V43/**`

Scope notes below explain intent but do not grant additional path authority:

- verification-only branch codex/v21-verify-<candidate-short-sha>-v43

## Deliverables

- one schema-valid candidate-bound result record per assigned acceptance case
- lane summary with exact pass/fail/blocked counts
- zero unrecorded external effects
- reproduction packet for every failure

## Relevant locked decisions (6)

| Decision | Status | Exact decision |
|---|---|---|
| DEC-005 | LOCKED | `https://app.onetimeonetime.com` is the production application. `https://join.onetimeonetime.com` is the public/transition funnel until cutover is complete. |
| DEC-007 | INFERRED | Automated unit, integration, browser, accessibility, concurrency, security, migration, provider-sandbox, and bounded production-canary verification remain required. “No tests” means no fictional/demo/test product surfaces and no test-only operating lane, not removal of production-safety verification. |
| DEC-140 | LOCKED | Existing users from the old application are not migrated with passwords, Parent/Student accounts, sessions, child profiles, inferred consent, or inferred access. They sign up again through the new flow. |
| DEC-141 | LOCKED | Existing adult GHL leads/contacts are deduplicated and updated when they sign up again. |
| DEC-142 | LOCKED | Tisha B’Av campaign/funnel artifacts are archived as a reusable historical funnel template. They are not active launch product routes or workflows. |
| DEC-152 | INFERRED | Manual acceptance supplements, but does not replace, automated safety and regression evidence tied to the exact release candidate. |

## Acceptance requirements and exact cases (19 requirements)


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

### OTV2-FOUNDATION-002

join.onetimeonetime.com remains a transition bridge until migration cutover.

- Area: `FOUNDATION`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `platform`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 03-DECISION-REGISTER-v2.1.md, 04-SUPERSESSION-AND-SYSTEM-DISPOSITION-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-FOUNDATION-002-AC01
  kind: positive
  environment:
  - persistent_staging
  - production_read_only
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  preconditions:
  - immutable candidate is deployed
  - DNS/TLS and version endpoints are observable
  steps:
  - resolve the production origin
  - open the canonical route in a real browser
  - read back candidate and runtime identity
  - verify wrong/legacy origins cannot share sessions
  expected_results:
  - join.onetimeonetime.com remains a transition bridge until migration cutover.
  forbidden_effects:
  - wrong application or preview content
  - web/worker identity mismatch
  - legacy/BNA cookie reuse
  evidence_profile: deployment_runtime
  cleanup: none; preserve redacted readback
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-DOMAIN-153

Marketing/public site and app domain architecture is configured.

- Area: `DOMAIN`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `platform`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 12-MIGRATION-CUTOVER-ROLLBACK-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-DOMAIN-153-AC01
  kind: positive
  environment:
  - persistent_staging
  - production_read_only
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  preconditions:
  - redirect and cookie matrix is approved
  - rollback target is healthy
  steps:
  - resolve DNS/TLS
  - follow every canonical legacy link
  - verify host-only session behavior
  - exercise rollback route without customer mutation
  expected_results:
  - Marketing/public site and app domain architecture is configured.
  forbidden_effects:
  - redirect loop
  - legacy session reuse
  - wrong origin
  - old app disconnect before acceptance
  evidence_profile: domain_cutover
  cleanup: none
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-DOMAIN-154

app.onetimeonetime.com has HTTPS and correct cookies/origin.

- Area: `DOMAIN`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `platform`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 12-MIGRATION-CUTOVER-ROLLBACK-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-DOMAIN-154-AC01
  kind: positive
  environment:
  - persistent_staging
  - production_read_only
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  preconditions:
  - redirect and cookie matrix is approved
  - rollback target is healthy
  steps:
  - resolve DNS/TLS
  - follow every canonical legacy link
  - verify host-only session behavior
  - exercise rollback route without customer mutation
  expected_results:
  - app.onetimeonetime.com has HTTPS and correct cookies/origin.
  forbidden_effects:
  - redirect loop
  - legacy session reuse
  - wrong origin
  - old app disconnect before acceptance
  evidence_profile: domain_cutover
  cleanup: none
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-DOMAIN-155

Join legacy links remain functional during transition.

- Area: `DOMAIN`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `platform`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 12-MIGRATION-CUTOVER-ROLLBACK-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-DOMAIN-155-AC01
  kind: positive
  environment:
  - persistent_staging
  - production_read_only
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  preconditions:
  - redirect and cookie matrix is approved
  - rollback target is healthy
  steps:
  - resolve DNS/TLS
  - follow every canonical legacy link
  - verify host-only session behavior
  - exercise rollback route without customer mutation
  expected_results:
  - Join legacy links remain functional during transition.
  forbidden_effects:
  - redirect loop
  - legacy session reuse
  - wrong origin
  - old app disconnect before acceptance
  evidence_profile: domain_cutover
  cleanup: none
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-DOMAIN-156

Old app is not disconnected before production acceptance.

- Area: `DOMAIN`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `platform`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 12-MIGRATION-CUTOVER-ROLLBACK-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-DOMAIN-156-AC01
  kind: positive
  environment:
  - persistent_staging
  - production_read_only
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  preconditions:
  - redirect and cookie matrix is approved
  - rollback target is healthy
  steps:
  - resolve DNS/TLS
  - follow every canonical legacy link
  - verify host-only session behavior
  - exercise rollback route without customer mutation
  expected_results:
  - Old app is not disconnected before production acceptance.
  forbidden_effects:
  - redirect loop
  - legacy session reuse
  - wrong origin
  - old app disconnect before acceptance
  evidence_profile: domain_cutover
  cleanup: none
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-DOMAIN-157

Post-migration redirects are verified.

- Area: `DOMAIN`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `platform`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 12-MIGRATION-CUTOVER-ROLLBACK-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-DOMAIN-157-AC01
  kind: positive
  environment:
  - persistent_staging
  - production_read_only
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  preconditions:
  - redirect and cookie matrix is approved
  - rollback target is healthy
  steps:
  - resolve DNS/TLS
  - follow every canonical legacy link
  - verify host-only session behavior
  - exercise rollback route without customer mutation
  expected_results:
  - Post-migration redirects are verified.
  forbidden_effects:
  - redirect loop
  - legacy session reuse
  - wrong origin
  - old app disconnect before acceptance
  evidence_profile: domain_cutover
  cleanup: none
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-MIGRATION-206

Legacy users re-register; no old password, session, child profile, access, billing, or consent is imported.

- Area: `MIGRATION`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `migration`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-215, OTV2-DOMAIN-155`
- Source references: `12-MIGRATION-CUTOVER-ROLLBACK-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-MIGRATION-206-AC01
  kind: negative
  environment:
  - persistent_staging
  - production_read_only
  - production_operator_canary
  actors:
  - admin
  - parent
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - redirect and cookie matrix is approved
  - rollback target is healthy
  steps:
  - resolve DNS/TLS
  - follow every canonical legacy link
  - verify host-only session behavior
  - exercise rollback route without customer mutation
  expected_results:
  - Legacy users re-register; no old password, session, child profile, access, billing, or consent is imported.
  forbidden_effects:
  - redirect loop
  - legacy session reuse
  - wrong origin
  - old app disconnect before acceptance
  evidence_profile: domain_cutover
  cleanup: none
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-MIGRATION-207

Tisha B'Av funnel assets are archived as an inactive reusable event template with no active route, audience, or workflow enrollment.

- Area: `MIGRATION`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `migration`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-215, OTV2-DOMAIN-155`
- Source references: `04-SUPERSESSION-AND-SYSTEM-DISPOSITION-v2.1.md, 12-MIGRATION-CUTOVER-ROLLBACK-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-MIGRATION-207-AC01
  kind: negative
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  preconditions:
  - production route/action/job inventory is generated from the exact candidate
  steps:
  - inspect navigation, direct routes, API/actions, workers, configuration, and production UI
  - attempt direct access to the absent surface
  expected_results:
  - Tisha B'Av funnel assets are archived as an inactive reusable event template with no active route, audience,
    or workflow enrollment.
  forbidden_effects:
  - hidden-but-callable mutation
  - stale navigation
  - provider action from a retired subsystem
  evidence_profile: absence_inventory
  cleanup: remove only disposable operator-owned probe records; absence must remain
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
