# P25 — Family Plan, Free Period, Hosted Checkout, Portal, Cancellation, and Refund — Locked Context

**Outcome:** Implement the $67 Family commercial experience, fixed free period, no-card signup boundary, GHL-hosted Checkout/billing portal, period-end cancellation, and manual refund exception.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `BILLING_COMMERCIAL`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- One Time must not create or mutate Stripe financial objects directly.

## Dependency gates

- Start after: `F04, F05, F06, F07`
- Full merge after: `F04, F05, F06, F07`
- Candidate integration partners (non-ordering): `P08, P28`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `apps/web/src/client/app/parent/billing/**`
- `apps/web/src/server/features/billing/commercial/**`
- `packages/contracts/src/billing/commercial/**`
- `packages/db/src/billing/commercial/**`
- `packages/domain/src/billing/commercial/**`

Scope notes below explain intent but do not grant additional path authority:

- packages/db/src/billing/commercial/** except migrations and central index
- GHL-hosted billing adapter modules
- billing commercial/idempotency tests
- steward requests for config/dependency/route/migration changes

## Deliverables

- Family plan and fixed free-period semantics
- hosted Checkout and billing portal entrypoints
- scheduled paid continuation/no premature charge
- period-end cancellation and manual refund exception

## Relevant locked decisions (7)

| Decision | Status | Exact decision |
|---|---|---|
| DEC-019 | LOCKED | The same adult identity may own multiple separate household subscriptions. Each household has its own billing/access state and up to three Student seats. |
| DEC-033 | LOCKED | Before the fixed free-expiry instant, a Family signup receives immediate free access from the email/password submitted on the public form, creates one Parent/account-owner identity, and may create up to three Student seats. At or after expiry it creates an inactive account and continues to standard Checkout. |
| DEC-040 | LOCKED | The standard Family plan is One Time Live + Library at USD $67 per month, normally including up to three active Students. |
| DEC-041 | LOCKED | Family signup never collects a card in the signup form. Before the fixed free expiry it produces free access and no automatic charge. At or after expiry it creates the adult account and household in `inactive` access and continues to standard Checkout; it grants no new rolling trial. |
| DEC-042 | LOCKED | Default free access ends at `2026-09-13T19:24:00+03:00` in `Asia/Jerusalem`. Every pre-expiry Family household loses the free source at that instant unless verified paid or approved School access exists. |
| DEC-043 | INFERRED | The paid continuation offer may be displayed before expiry, but completing it before expiry schedules paid access to begin at the configured free-period end and must not create an immediate charge unless the Parent is shown and explicitly accepts an immediate-charge exception. The standard path is no charge before expiry. |
| DEC-048 | LOCKED | Cancellation stops future renewal and preserves access through the paid period. Refunds are manual exceptions; cancellation does not delete learning data. |

## Acceptance requirements and exact cases (12 requirements)


### OTV2-BILLING-101

Single Live + Library plan is $67 USD monthly per household.

- Area: `BILLING`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `billing_access`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-PARENT-031`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-BILLING-101-AC01
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
  - Single Live + Library plan is $67 USD monthly per household.
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

### OTV2-BILLING-102

Plan covers up to three active Students.

- Area: `BILLING`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `billing_access`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-PARENT-031`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-BILLING-102-AC01
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
  - Plan covers up to three active Students.
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

### OTV2-BILLING-103

Free signup does not collect a card.

- Area: `BILLING`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `billing_access`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-PARENT-031`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-BILLING-103-AC01
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
  - Free signup does not collect a card.
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

### OTV2-BILLING-104

Free access ends at configured Rosh Hashanah timestamp.

- Area: `BILLING`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `billing_access`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-PARENT-031`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-BILLING-104-AC01
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
  - Free access ends at configured Rosh Hashanah timestamp.
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

### OTV2-BILLING-105

Countdown uses one Jerusalem-time source and is not hardcoded.

- Area: `BILLING`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `billing_access`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-PARENT-031`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-BILLING-105-AC01
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
  - Countdown uses one Jerusalem-time source and is not hardcoded.
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

### OTV2-BILLING-106

No automatic charge occurs without Checkout.

- Area: `BILLING`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `billing_access`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-PARENT-031`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-BILLING-106-AC01
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
  - No automatic charge occurs without Checkout.
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

### OTV2-BILLING-107

Stripe Checkout creates paid subscription idempotently.

- Area: `BILLING`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `billing_access`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-PARENT-031`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-BILLING-107-AC01
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
  - Stripe Checkout creates paid subscription idempotently.
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

### OTV2-BILLING-108

Parent billing portal updates payment method.

- Area: `BILLING`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `billing_access`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-PARENT-031`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-BILLING-108-AC01
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
  - Parent billing portal updates payment method.
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

### OTV2-BILLING-109

Cancellation ends at paid period end.

- Area: `BILLING`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `billing_access`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-PARENT-031`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-BILLING-109-AC01
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
  - Cancellation ends at paid period end.
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

### OTV2-BILLING-110

Refunds require Admin approval.

- Area: `BILLING`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `billing_access`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-PARENT-031`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-BILLING-110-AC01
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
  - Refunds require Admin approval.
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

### OTV2-BILLING-224

Standard Checkout completed before free-period expiry creates no immediate charge and schedules the first charge for the configured expiry; an immediate-charge exception requires separately displayed amount/time and explicit Parent consent.

- Area: `BILLING`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `billing_access`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-PARENT-031, OTV2-BILLING-101, OTV2-BILLING-104, OTV2-BILLING-106, OTV2-BILLING-107`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 03-DECISION-REGISTER-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-BILLING-224-STANDARD
  kind: time_boundary
  environment:
  - ci
  - provider_sandbox
  actors:
  - parent
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - the family household is in free access before 2026-09-13 19:24 Asia/Jerusalem
  - the approved standard price is $67 USD monthly and no paid subscription exists
  - the Stripe test clock, exact Checkout mode, price, customer, and webhook identities are recorded
  steps:
  - set the provider test clock before free-period expiry and complete standard Parent Checkout
  - read back Checkout, subscription or schedule, invoice, charge, and One Time access projection
  - replay the signed completion event and verify idempotency
  - advance to one second before the configured expiry and read back charges and access
  - advance to the configured expiry and read back the first billing attempt and resulting access
  expected_results:
  - standard pre-expiry Checkout creates no immediate charge
  - the first $67 USD charge is scheduled for exactly 2026-09-13 19:24 Asia/Jerusalem
  - access remains `free` before expiry and changes only from verified billing evidence at or after expiry
  - event replay creates no duplicate subscription, schedule, invoice, or charge
  forbidden_effects:
  - pre-expiry charge
  - wrong price or timestamp
  - duplicate subscription or charge
  - access activation from an unsigned or unmatched event
  evidence_profile: billing_live
  cleanup: cancel/refund only the approved operator canary and reconcile final access
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
- case_id: OTV2-BILLING-224-IMMEDIATE-EXCEPTION
  kind: consent_boundary
  environment:
  - ci
  - provider_sandbox
  actors:
  - parent
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - a separately authorized immediate-charge exception is configured for the operator-owned test household
  - the standard pre-expiry path remains unchanged for every household without that exception
  steps:
  - open the exception Checkout and read the separately displayed exact amount and charge timing
  - cancel before affirmative consent and verify no provider or local financial effect
  - repeat, affirm the immediate-charge consent, and complete Checkout
  - read back the single charge, consent receipt, subscription timing, and access projection
  - replay completion and expiry events to prove no second first-period charge
  expected_results:
  - without the separate affirmative consent, no immediate charge occurs
  - with consent, exactly the displayed amount is charged at the displayed time and the consent version, actor,
    scope, and timestamp are auditable
  - the exception cannot silently alter the standard path or create a duplicate expiry charge
  forbidden_effects:
  - preselected or bundled consent
  - undisclosed immediate charge
  - wrong amount or customer
  - duplicate charge at free-period expiry
  evidence_profile: billing_live
  cleanup: cancel/refund only the approved operator canary and reconcile final access
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-PARENT-038

Parent can update billing through the approved GHL/Stripe-hosted billing surface.

- Area: `PARENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `parent_application`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-FOUNDATION-003`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-PARENT-038-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - parent
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
  - sign in as the named actor
  - perform the visible action
  - refresh and sign in again to prove persistence
  - repeat against sibling/cross-household/wrong-role target
  expected_results:
  - Parent can update billing through the approved GHL/Stripe-hosted billing surface.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
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
