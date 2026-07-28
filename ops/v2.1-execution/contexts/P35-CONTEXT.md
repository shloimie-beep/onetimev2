# P35 — Domains, Transition, Legacy Re-Registration, and Tisha B’Av Archive — Locked Context

**Outcome:** Implement canonical domains and redirects, transition safety, legacy adult re-registration without migrated credentials/child data, and a dormant Tisha B’Av funnel template with no active product route.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `DOMAIN_TRANSITION`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- Apply the exact task packet and execution contract.

## Dependency gates

- Start after: `F01`
- Full merge after: `F01`
- Candidate integration partners (non-ordering): `F04, F06, P27, P33`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `apps/web/src/client/public/domain-transition/**`
- `apps/web/src/server/features/domain-transition/**`
- `ops/archive/tisha-bav-template/**`
- `ops/runbooks/v2.1/domain-cutover/**`
- `scripts/v21-migration/**`

Scope notes below explain intent but do not grant additional path authority:

- scripts/v21-migration/** except immutable SQL migrations
- domain/redirect/migration/re-registration tests
- steward requests for config/deploy/migration/route changes

## Deliverables

- canonical app/join domain behavior and safe transition redirects
- legacy adult invitation/re-registration bridge
- explicit non-migration of old passwords, child profiles, sessions, consent, and access
- Tisha B’Av artifacts archived as a dormant template only

## Relevant locked decisions (4)

| Decision | Status | Exact decision |
|---|---|---|
| DEC-005 | LOCKED | `https://app.onetimeonetime.com` is the production application. `https://join.onetimeonetime.com` is the public/transition funnel until cutover is complete. |
| DEC-140 | LOCKED | Existing users from the old application are not migrated with passwords, Parent/Student accounts, sessions, child profiles, inferred consent, or inferred access. They sign up again through the new flow. |
| DEC-141 | LOCKED | Existing adult GHL leads/contacts are deduplicated and updated when they sign up again. |
| DEC-142 | LOCKED | Tisha B’Av campaign/funnel artifacts are archived as a reusable historical funnel template. They are not active launch product routes or workflows. |

## Acceptance requirements and exact cases (8 requirements)


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
