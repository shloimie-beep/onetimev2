# F06 — Provider Truth, Idempotency, Reconciliation, and Mapping — Locked Context

**Outcome:** Implement the shared provider-operation contract, provider truth/readback, exact multi-household mappings, reconciliation, and GHL ambiguity boundary.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `PROVIDER_CORE, PROVIDER_REGISTRY`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- This task implements provider-independent infrastructure; it has no authority to mutate live provider assets.

## Dependency gates

- Start after: `F04, F05`
- Full merge after: `F04, F05`
- Candidate integration partners (non-ordering): `F03`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `apps/worker/src/runners/provider-reconciliation/**`
- `packages/contracts/src/providers/**`
- `packages/db/src/providers/**`
- `packages/domain/src/providers/shared/**`

Scope notes below explain intent but do not grant additional path authority:

- packages/db/src/providers/** except migrations and central index
- provider client factory and operation ledger modules
- steward requests for config/dependencies/registration/migrations

## Deliverables

- ProviderOperation and reconciliation contracts
- idempotent provider mutation/readback foundation
- household-scoped provider mapping model
- safe GHL ambiguity quarantine semantics

## Relevant locked decisions (6)

| Decision | Status | Exact decision |
|---|---|---|
| DEC-044 | LOCKED | HighLevel is the operator-facing CRM, campaign, and billing workflow surface and uses its Stripe integration; Stripe remains financial truth. One Time never mutates financial objects. Parent billing entrypoints use approved GHL-hosted billing pages; GHL orchestrates Checkout/schedule/portal/cancellation/refund/repair, Stripe creates the financial objects and sends signed events directly to GHL and One Time, and Stripe Dashboard is an audited break-glass exception only. |
| DEC-045 | LOCKED | One Time stores only the minimum billing references, signed event receipts/idempotency data, reconciliation state, and effective access projection needed to know whether a household is `free`, `active`, `grace`, or `inactive`. One Time does not fabricate invoices or a parallel financial ledger. |
| DEC-050 | LOCKED | An existing HighLevel lead who signs up is matched to the same adult contact; no duplicate GHL contact is created. One GHL contact represents the adult, while each household uses a separately keyed GHL household opportunity/account record and a household-scoped Stripe Customer. Adult suppression/consent never gets overwritten by one household’s lifecycle. |
| DEC-051 | INFERRED | Adult matching order is verified provider link, normalized email, then manual CRM-link quarantine. Name or phone alone may not silently merge adults. An ambiguous GHL match blocks only GHL synchronization/workflows/billing; it does not block local Family account creation/login, applicable Resend security delivery, or pre-expiry free product access. |
| DEC-055 | INFERRED | Local account creation commits first with a durable outbox. Resend and unambiguous GHL effects retry asynchronously. GHL ambiguity is a visible CRM-link quarantine; provider failure must not create duplicate accounts, silently broaden access, or lose the local signup. |
| DEC-090 | LOCKED | HighLevel owns adult CRM, campaigns, email workflows, the website lead-capture bot, conversations, consent/suppression projection, and the operator-facing Stripe workflow. |

## Acceptance requirements and exact cases (3 requirements)


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
