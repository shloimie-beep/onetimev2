# P26 — Billing Projection, Grace, Recovery, and Inactive Authorization — Locked Context

**Outcome:** Implement minimum signed billing-event projection, verified access winners, seven-day grace, recovery, inactive route authorization, and household-scoped access.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `BILLING_ACCESS`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- Apply the exact task packet and execution contract.

## Dependency gates

- Start after: `F03, F04, F05, F06`
- Full merge after: `F03, F04, F05, F06`
- Candidate integration partners (non-ordering): `P13, P14, P25, P28`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `apps/web/src/server/features/billing/access/**`
- `apps/worker/src/runners/billing-reconciliation/**`
- `packages/contracts/src/billing/access/**`
- `packages/db/src/billing/access/**`
- `packages/domain/src/billing/access/**`

Scope notes below explain intent but do not grant additional path authority:

- packages/db/src/billing/access/** except migrations and central index
- billing projection/grace/authorization/concurrency tests
- steward requests for config/dependency/route/worker/migration changes

## Deliverables

- signed event receipt and idempotency projection
- free/active/grace/inactive access calculation
- newer-failure and recovery ordering
- server-side inactive Parent allowlist and Student denial

## Relevant locked decisions (5)

| Decision | Status | Exact decision |
|---|---|---|
| DEC-044 | LOCKED | HighLevel is the operator-facing CRM, campaign, and billing workflow surface and uses its Stripe integration; Stripe remains financial truth. One Time never mutates financial objects. Parent billing entrypoints use approved GHL-hosted billing pages; GHL orchestrates Checkout/schedule/portal/cancellation/refund/repair, Stripe creates the financial objects and sends signed events directly to GHL and One Time, and Stripe Dashboard is an audited break-glass exception only. |
| DEC-045 | LOCKED | One Time stores only the minimum billing references, signed event receipts/idempotency data, reconciliation state, and effective access projection needed to know whether a household is `free`, `active`, `grace`, or `inactive`. One Time does not fabricate invoices or a parallel financial ledger. |
| DEC-046 | LOCKED | Failed payment has a seven-day grace period. A newer unresolved current-term failure atomically invalidates the prior paid source as an access winner and creates grace; recovery creates a new verified winning paid source. Student access remains during grace and pauses when grace expires without recovery. |
| DEC-047 | INFERRED | An inactive Parent may authenticate only into overview/status, household switcher, billing/reactivation, support list/detail, account, privacy, and data-rights routes. Every other Parent route and all Student authentication/learning routes are blocked before protected rendering. |
| DEC-122 | INFERRED | Product access lifecycle is `free`, `active`, `grace`, `inactive`. In `inactive`, the exact restricted Parent route allowlist in DEC-047 remains available; Student access does not. |

## Acceptance requirements and exact cases (9 requirements)


### OTV2-BILLING-111

Failed payment starts seven-day grace.

- Area: `BILLING`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `billing_access`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-PARENT-031`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-BILLING-111-AC01
  kind: positive
  environment:
  - ci
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
  - parent
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - correct test/live billing account and operator-owned customer are bound
  - price and webhook identities are approved
  steps:
  - perform the checkout or inject the signed event
  - read back provider and One Time access projection
  - replay and reorder events
  - exercise mismatch/failure/recovery and reconcile
  expected_results:
  - Failed payment starts seven-day grace.
  forbidden_effects:
  - test/live crossover
  - duplicate subscription
  - tag-only access change
  - charge above budget
  - parallel fabricated ledger
  evidence_profile: billing_live
  cleanup: cancel/refund only the approved operator canary and reconcile final access
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-BILLING-112

Student access remains during grace.

- Area: `BILLING`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `billing_access`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-PARENT-031`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-BILLING-112-AC01
  kind: positive
  environment:
  - ci
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
  - parent
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - correct test/live billing account and operator-owned customer are bound
  - price and webhook identities are approved
  steps:
  - perform the checkout or inject the signed event
  - read back provider and One Time access projection
  - replay and reorder events
  - exercise mismatch/failure/recovery and reconcile
  expected_results:
  - Student access remains during grace.
  forbidden_effects:
  - test/live crossover
  - duplicate subscription
  - tag-only access change
  - charge above budget
  - parallel fabricated ledger
  evidence_profile: billing_live
  cleanup: cancel/refund only the approved operator canary and reconcile final access
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-BILLING-113

After grace, Parent billing/support remains and Student learning pauses.

- Area: `BILLING`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `billing_access`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-PARENT-031`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-BILLING-113-AC01
  kind: positive
  environment:
  - ci
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
  - parent
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - correct test/live billing account and operator-owned customer are bound
  - price and webhook identities are approved
  steps:
  - perform the checkout or inject the signed event
  - read back provider and One Time access projection
  - replay and reorder events
  - exercise mismatch/failure/recovery and reconcile
  expected_results:
  - After grace, Parent billing/support remains and Student learning pauses.
  forbidden_effects:
  - test/live crossover
  - duplicate subscription
  - tag-only access change
  - charge above budget
  - parallel fabricated ledger
  evidence_profile: billing_live
  cleanup: cancel/refund only the approved operator canary and reconcile final access
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-BILLING-114

Payment recovery restores access.

- Area: `BILLING`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `billing_access`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-PARENT-031`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-BILLING-114-AC01
  kind: positive
  environment:
  - ci
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
  - parent
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - correct test/live billing account and operator-owned customer are bound
  - price and webhook identities are approved
  steps:
  - perform the checkout or inject the signed event
  - read back provider and One Time access projection
  - replay and reorder events
  - exercise mismatch/failure/recovery and reconcile
  expected_results:
  - Payment recovery restores access.
  forbidden_effects:
  - test/live crossover
  - duplicate subscription
  - tag-only access change
  - charge above budget
  - parallel fabricated ledger
  evidence_profile: billing_live
  cleanup: cancel/refund only the approved operator canary and reconcile final access
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-BILLING-115

GHL/Stripe payment history projects current access without a One Time payment ledger.

- Area: `BILLING`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `billing_access`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-PARENT-031`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-BILLING-115-AC01
  kind: negative
  environment:
  - ci
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
  - parent
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - correct test/live billing account and operator-owned customer are bound
  - price and webhook identities are approved
  steps:
  - perform the checkout or inject the signed event
  - read back provider and One Time access projection
  - replay and reorder events
  - exercise mismatch/failure/recovery and reconcile
  expected_results:
  - GHL/Stripe payment history projects current access without a One Time payment ledger.
  forbidden_effects:
  - test/live crossover
  - duplicate subscription
  - tag-only access change
  - charge above budget
  - parallel fabricated ledger
  evidence_profile: billing_live
  cleanup: cancel/refund only the approved operator canary and reconcile final access
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-BILLING-116

Replay/out-of-order billing events are safe.

- Area: `BILLING`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `billing_access`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-PARENT-031`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-BILLING-116-AC01
  kind: replay
  environment:
  - ci
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
  - parent
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - correct test/live billing account and operator-owned customer are bound
  - price and webhook identities are approved
  steps:
  - perform the checkout or inject the signed event
  - read back provider and One Time access projection
  - replay and reorder events
  - exercise mismatch/failure/recovery and reconcile
  expected_results:
  - Replay/out-of-order billing events are safe.
  forbidden_effects:
  - test/live crossover
  - duplicate subscription
  - tag-only access change
  - charge above budget
  - parallel fabricated ledger
  evidence_profile: billing_live
  cleanup: cancel/refund only the approved operator canary and reconcile final access
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-BILLING-201

Inactive Parent authentication reaches only overview, household switcher, billing/reactivation, support, account, privacy, and data-rights routes; Student authentication and every other Parent/Student route are denied.

- Area: `BILLING`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `billing_access`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-PARENT-031`
- Source references: `05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-BILLING-201-INACTIVE-ROUTE-AUTHORIZATION
  kind: authorization_matrix
  environment:
  - ci
  - provider_sandbox
  - production_operator_canary
  actors:
  - parent
  - student
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - student_operator_canary_1
  preconditions:
  - correct test/live billing account and operator-owned customer are bound
  - price and webhook identities are approved
  steps:
  - project the household to inactive and authenticate as its Parent
  - open exactly Parent overview/status, household switcher, billing/reactivation, support list/detail, account,
    privacy, and data rights
  - attempt every other Parent route directly, including Students, calendar/class, progress, updates, newsletter,
    and reminder preferences
  - authenticate as each linked Student and attempt every Student route and stale deep link
  expected_results:
  - only the exact Parent allowlist renders and it exposes no Student classroom, library, question, or recording
    data
  - every excluded Parent route denies before protected data or provider bootstrap is returned
  - all Student authentication/routes are denied with the exact inactive-household copy
  forbidden_effects:
  - extra Parent route
  - Student access
  - protected pre-render
  - billing return URL changing access
  evidence_profile: billing_live
  cleanup: cancel/refund only the approved operator canary and reconcile final access
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-BILLING-242

A current-term paid event wins only when no newer unresolved failure exists; a newer failure invalidates the paid winner, begins the seven-day grace once, and recovery or grace expiry projects access idempotently.

- Area: `BILLING`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `billing_access`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-PARENT-031, OTV2-BILLING-101, OTV2-BILLING-104, OTV2-BILLING-107, OTV2-PROVIDER-209`
- Source references: `06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-BILLING-242-EVENT-PRECEDENCE-GRACE
  kind: event_ordering
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
  - correct test/live billing account and operator-owned customer are bound
  - price and webhook identities are approved
  steps:
  - deliver a current-term paid event and verify active access
  - deliver a newer unresolved current-term failure and replay/reorder both events
  - resolve the failure successfully in one branch and let the seven-day grace expire in another
  - repeat every signed event and reconciliation pass
  expected_results:
  - paid wins only while it is the latest applicable resolved truth and no newer unresolved failure exists
  - the newer failure invalidates paid, starts one seven-day grace window, and preserves active Student use only
    during grace
  - verified recovery restores active once; expiry projects inactive once; replay and reordering do not extend grace
    or duplicate effects
  forbidden_effects:
  - older paid overriding newer failure
  - grace restart on replay
  - tag-only access
  - duplicate notification/access transition
  evidence_profile: billing_live
  cleanup: cancel/refund only the approved operator canary and reconcile final access
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-PARENT-236

Inactive access uses the exact Parent route allowlist and exact Student denial copy, blocks excluded direct links before protected rendering, and restores full role-appropriate access only from verified billing recovery.

- Area: `PARENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `parent_application`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-FOUNDATION-003, OTV2-BILLING-201, OTV2-PARENT-185`
- Source references: `05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-PARENT-236-INACTIVE-ALLOWLIST
  kind: authorization_matrix
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - parent
  - student
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - dual_role_operator_canary
  - replacement_owner_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - real actor, target resource, and denial-scope fixture exist
  steps:
  - set the household inactive and sign in as Parent
  - open overview, household switcher, billing/reactivation, support list/detail, account, privacy, and data rights
  - attempt every Student-management, calendar/class, progress, updates, newsletter, reminder-preference, classroom,
    library, question, and notification route directly
  - attempt Student login and each stale Student deep link while capturing pre-render network/data behavior
  expected_results:
  - only the exact allowlist renders and all excluded routes deny before protected data is returned
  - Student denial copy is exactly “This household’s access is inactive. Ask your account owner to restore access.”
  - no stale session, cached page, or provider bootstrap bypasses inactivity
  forbidden_effects:
  - protected pre-render
  - Student access
  - extra Parent route
  - raw billing/provider secret
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
- case_id: OTV2-PARENT-236-VERIFIED-RECOVERY
  kind: state_transition
  environment:
  - ci
  - provider_sandbox
  - production_operator_canary
  actors:
  - parent
  - student
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - student_operator_canary_1
  preconditions:
  - real actor, target resource, and denial-scope fixture exist
  steps:
  - complete the governed billing repair but withhold or invalidate the signed provider confirmation
  - prove access remains inactive
  - deliver the valid reconciled signed recovery event and refresh Parent/Student sessions
  expected_results:
  - checkout return or GHL tag alone cannot restore access
  - verified household-matched billing truth restores full role-appropriate access once and preserves route boundaries
  forbidden_effects:
  - return-URL activation
  - tag-only activation
  - duplicate recovery event effect
  evidence_profile: billing_live
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
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
