# V41 — Provider Foundation, Billing, Access, and GHL Identity Verification — Locked Context

**Outcome:** Verify provider idempotency/reconciliation, commercial billing flows, signed access projection, grace/recovery, adult GHL mapping, and zero Student GHL contacts.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `VERIFY_BILLING_PROVIDERS`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- Apply the exact task packet and execution contract.

## Dependency gates

- Start after: `I36`
- Full merge after: `None`
- Candidate integration partners (non-ordering): `None`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `ops/v2.1-execution/results/<candidate-digest>/V41/**`
- `ops/v2.1-execution/verification-harness/V41/**`

Scope notes below explain intent but do not grant additional path authority:

- verification-only branch codex/v21-verify-<candidate-short-sha>-v41

## Deliverables

- one schema-valid candidate-bound result record per assigned acceptance case
- lane summary with exact pass/fail/blocked counts
- zero unrecorded external effects
- reproduction packet for every failure

## Relevant locked decisions (17)

| Decision | Status | Exact decision |
|---|---|---|
| DEC-014 | LOCKED | Students never require or receive an email address. No Student is created as a HighLevel contact. |
| DEC-019 | LOCKED | The same adult identity may own multiple separate household subscriptions. Each household has its own billing/access state and up to three Student seats. |
| DEC-033 | LOCKED | Before the fixed free-expiry instant, a Family signup receives immediate free access from the email/password submitted on the public form, creates one Parent/account-owner identity, and may create up to three Student seats. At or after expiry it creates an inactive account and continues to standard Checkout. |
| DEC-040 | LOCKED | The standard Family plan is One Time Live + Library at USD $67 per month, normally including up to three active Students. |
| DEC-041 | LOCKED | Family signup never collects a card in the signup form. Before the fixed free expiry it produces free access and no automatic charge. At or after expiry it creates the adult account and household in `inactive` access and continues to standard Checkout; it grants no new rolling trial. |
| DEC-042 | LOCKED | Default free access ends at `2026-09-13T19:24:00+03:00` in `Asia/Jerusalem`. Every pre-expiry Family household loses the free source at that instant unless verified paid or approved School access exists. |
| DEC-043 | INFERRED | The paid continuation offer may be displayed before expiry, but completing it before expiry schedules paid access to begin at the configured free-period end and must not create an immediate charge unless the Parent is shown and explicitly accepts an immediate-charge exception. The standard path is no charge before expiry. |
| DEC-044 | LOCKED | HighLevel is the operator-facing CRM, campaign, and billing workflow surface and uses its Stripe integration; Stripe remains financial truth. One Time never mutates financial objects. Parent billing entrypoints use approved GHL-hosted billing pages; GHL orchestrates Checkout/schedule/portal/cancellation/refund/repair, Stripe creates the financial objects and sends signed events directly to GHL and One Time, and Stripe Dashboard is an audited break-glass exception only. |
| DEC-045 | LOCKED | One Time stores only the minimum billing references, signed event receipts/idempotency data, reconciliation state, and effective access projection needed to know whether a household is `free`, `active`, `grace`, or `inactive`. One Time does not fabricate invoices or a parallel financial ledger. |
| DEC-046 | LOCKED | Failed payment has a seven-day grace period. A newer unresolved current-term failure atomically invalidates the prior paid source as an access winner and creates grace; recovery creates a new verified winning paid source. Student access remains during grace and pauses when grace expires without recovery. |
| DEC-047 | INFERRED | An inactive Parent may authenticate only into overview/status, household switcher, billing/reactivation, support list/detail, account, privacy, and data-rights routes. Every other Parent route and all Student authentication/learning routes are blocked before protected rendering. |
| DEC-048 | LOCKED | Cancellation stops future renewal and preserves access through the paid period. Refunds are manual exceptions; cancellation does not delete learning data. |
| DEC-050 | LOCKED | An existing HighLevel lead who signs up is matched to the same adult contact; no duplicate GHL contact is created. One GHL contact represents the adult, while each household uses a separately keyed GHL household opportunity/account record and a household-scoped Stripe Customer. Adult suppression/consent never gets overwritten by one household’s lifecycle. |
| DEC-051 | INFERRED | Adult matching order is verified provider link, normalized email, then manual CRM-link quarantine. Name or phone alone may not silently merge adults. An ambiguous GHL match blocks only GHL synchronization/workflows/billing; it does not block local Family account creation/login, applicable Resend security delivery, or pre-expiry free product access. |
| DEC-055 | INFERRED | Local account creation commits first with a durable outbox. Resend and unambiguous GHL effects retry asynchronously. GHL ambiguity is a visible CRM-link quarantine; provider failure must not create duplicate accounts, silently broaden access, or lose the local signup. |
| DEC-090 | LOCKED | HighLevel owns adult CRM, campaigns, email workflows, the website lead-capture bot, conversations, consent/suppression projection, and the operator-facing Stripe workflow. |
| DEC-122 | INFERRED | Product access lifecycle is `free`, `active`, `grace`, `inactive`. In `inactive`, the exact restricted Parent route allowlist in DEC-047 remains available; Student access does not. |

## Acceptance requirements and exact cases (27 requirements)


### OTV2-PROVIDER-209

Stripe is financial processor truth, GHL is the adult CRM, campaign, and hosted billing-workflow surface, and One Time stores only effective access and minimal signed-event/reconciliation records without mutating financial objects.

- Area: `PROVIDER`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `integrations`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-BILLING-115`
- Source references: `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-PROVIDER-209-AC01
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
  - Stripe is financial processor truth, GHL is the adult CRM, campaign, and hosted billing-workflow surface, and
    One Time stores only effective access and minimal signed-event/reconciliation records without mutating financial
    objects.
  forbidden_effects:
  - test/live crossover
  - duplicate subscription
  - tag-only access change
  - charge above budget
  - parallel fabricated ledger
  evidence_profile: billing_live
  cleanup: cancel/refund only the approved operator canary and reconcile final access
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-PROVIDER-231

One adult GHL contact can own multiple household-keyed GHL records and household-scoped Stripe Customers; contact-level consent/suppression and household-level lifecycle/preferences remain separated through ownership transfer.

- Area: `PROVIDER`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `integrations`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-BILLING-115, OTV2-PROVIDER-209, OTV2-ACCOUNT-181, OTV2-ACCOUNT-182`
- Source references: `06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-PROVIDER-231-MULTI-HOUSEHOLD-MAPPING
  kind: provider_mapping
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
  - create two households owned by one adult email and complete isolated checkout for each
  - read back local, GHL, and Stripe identifiers and scope
  - change contact-level marketing suppression and one household reminder/lifecycle state
  - transfer one household to a replacement adult and reconcile provider references
  expected_results:
  - exactly one adult GHL contact exists, with one household-keyed GHL opportunity/account and one Stripe Customer
    per household
  - contact-level suppression affects the adult contact while service preference/lifecycle changes remain household-scoped
  - transfer preserves the household Stripe Customer and moves owner linkage without changing the other household
  forbidden_effects:
  - one Stripe Customer shared across households
  - duplicate GHL adult contact
  - cross-household lifecycle bleed
  - financial object recreated on transfer
  evidence_profile: billing_live
  cleanup: cancel/refund only the approved operator canary and reconcile final access
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-PROVIDER-243

An ambiguous GHL contact match quarantines only CRM linkage, workflow, and paid billing while local login, Resend security delivery, and otherwise valid pre-expiry free access continue without duplicate contact creation.

- Area: `PROVIDER`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `integrations`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-BILLING-115, OTV2-SIGNUP-179, OTV2-SIGNUP-213, OTV2-PROVIDER-209`
- Source references: `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md, 12-MIGRATION-CUTOVER-ROLLBACK-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-PROVIDER-243-GHL-IDENTITY-QUARANTINE
  kind: partial_provider_failure
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
  - student_operator_canary_1
  preconditions:
  - typed route/job contract and stable idempotency key are defined
  steps:
  - prepare two GHL contacts with the submitted normalized email and submit a pre-expiry Family signup
  - sign in locally, create a Student, and request a Resend security message
  - inspect GHL contact/workflow/billing effects and attempt paid checkout
  - resolve the conflict through the governed Admin action and replay the original outbox intent
  expected_results:
  - one local adult/login/household and valid free access persist, Student creation works, and Resend security delivery
    continues
  - no GHL contact is created/overwritten, no workflow enrolls, and paid billing is blocked while CRM link is identity_review
  - resolution links exactly one adult contact and resumes projection idempotently without duplicate local/provider
    records
  forbidden_effects:
  - local access suspension
  - duplicate GHL contact
  - campaign enrollment during quarantine
  - paid checkout before resolution
  evidence_profile: api_job_saga
  cleanup: reconcile every effect and clear only disposable operator-owned work
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

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

### OTV2-GHL-117

Adult records are classified as active legacy, former/canceled, opted-in lead, suppressed, or review.

- Area: `GHL`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `communications`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-GHL-119`
- Source references: `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-GHL-117-AC01
  kind: positive
  environment:
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - exact registry, sender, audience, consent, and content digests are approved
  steps:
  - save and reopen the workflow
  - read back trigger/actions/waits/exits
  - execute one operator seed
  - change suppression after approval and verify send-time blocking
  - verify effect counters
  expected_results:
  - Adult records are classified as active legacy, former/canceled, opted-in lead, suppressed, or review.
  forbidden_effects:
  - Student contact
  - wrong sender
  - broad unapproved enrollment
  - disabled WhatsApp send
  - audience/content drift
  evidence_profile: ghl_workflow
  cleanup: remove unintended seed enrollment and preserve approved delivery evidence
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-GHL-118

Active status does not apply to every export row.

- Area: `GHL`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `communications`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-GHL-119`
- Source references: `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-GHL-118-AC01
  kind: negative
  environment:
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - exact registry, sender, audience, consent, and content digests are approved
  steps:
  - save and reopen the workflow
  - read back trigger/actions/waits/exits
  - execute one operator seed
  - change suppression after approval and verify send-time blocking
  - verify effect counters
  expected_results:
  - Active status does not apply to every export row.
  forbidden_effects:
  - Student contact
  - wrong sender
  - broad unapproved enrollment
  - disabled WhatsApp send
  - audience/content drift
  evidence_profile: ghl_workflow
  cleanup: remove unintended seed enrollment and preserve approved delivery evidence
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-GHL-119

No Student contact is created in GHL.

- Area: `GHL`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `communications`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001`
- Source references: `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-GHL-119-AC01
  kind: negative
  environment:
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - exact registry, sender, audience, consent, and content digests are approved
  steps:
  - save and reopen the workflow
  - read back trigger/actions/waits/exits
  - execute one operator seed
  - change suppression after approval and verify send-time blocking
  - verify effect counters
  expected_results:
  - No Student contact is created in GHL.
  forbidden_effects:
  - Student contact
  - wrong sender
  - broad unapproved enrollment
  - disabled WhatsApp send
  - audience/content drift
  evidence_profile: ghl_workflow
  cleanup: remove unintended seed enrollment and preserve approved delivery evidence
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
