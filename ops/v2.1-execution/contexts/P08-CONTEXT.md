# P08 — Family Signup, Deduplication, Expiry, and Recovery — Locked Context

**Outcome:** Implement cardless Family signup, pre/post-expiry access branching, adult dedupe, interrupted recovery, and safe duplicate handling.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `FAMILY_SIGNUP`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- Apply the exact task packet and execution contract.

## Dependency gates

- Start after: `F03, F04, F06, F07`
- Full merge after: `F03, F04, F06, F07`
- Candidate integration partners (non-ordering): `P25, P27`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `apps/web/src/client/public/signup/**`
- `apps/web/src/server/features/signup/family/**`
- `packages/contracts/src/signup/family/**`
- `packages/domain/src/signup/family/**`

Scope notes below explain intent but do not grant additional path authority:

- family-signup focused tests
- steward requests for route/config/migration changes

## Deliverables

- family classification/signup flow
- fixed-expiry branch and inactive Checkout continuation
- local-first outbox recovery
- safe dedupe and duplicate-account paths

## Relevant locked decisions (9)

| Decision | Status | Exact decision |
|---|---|---|
| DEC-020 | INFERRED | One normalized email maps to one adult identity and one HumanAccount/login with role memberships `admin`, `parent`, or both. A dual-role adult uses an explicit Admin/Parent context switcher; a multi-household Parent then uses the household switcher. Household transfer to an existing Admin adds Parent membership and never creates a duplicate adult or credential. |
| DEC-032 | LOCKED | Public signup classifies the inquiry as `family` or `school`. |
| DEC-033 | LOCKED | Before the fixed free-expiry instant, a Family signup receives immediate free access from the email/password submitted on the public form, creates one Parent/account-owner identity, and may create up to three Student seats. At or after expiry it creates an inactive account and continues to standard Checkout. |
| DEC-041 | LOCKED | Family signup never collects a card in the signup form. Before the fixed free expiry it produces free access and no automatic charge. At or after expiry it creates the adult account and household in `inactive` access and continues to standard Checkout; it grants no new rolling trial. |
| DEC-050 | LOCKED | An existing HighLevel lead who signs up is matched to the same adult contact; no duplicate GHL contact is created. One GHL contact represents the adult, while each household uses a separately keyed GHL household opportunity/account record and a household-scoped Stripe Customer. Adult suppression/consent never gets overwritten by one household’s lifecycle. |
| DEC-051 | INFERRED | Adult matching order is verified provider link, normalized email, then manual CRM-link quarantine. Name or phone alone may not silently merge adults. An ambiguous GHL match blocks only GHL synchronization/workflows/billing; it does not block local Family account creation/login, applicable Resend security delivery, or pre-expiry free product access. |
| DEC-054 | INFERRED | Duplicate signup for an active account returns a safe “Sign in or reset your password” path without exposing whether unrelated addresses exist. |
| DEC-055 | INFERRED | Local account creation commits first with a durable outbox. Resend and unambiguous GHL effects retry asynchronously. GHL ambiguity is a visible CRM-link quarantine; provider failure must not create duplicate accounts, silently broaden access, or lose the local signup. |
| DEC-141 | LOCKED | Existing adult GHL leads/contacts are deduplicated and updated when they sign up again. |

## Acceptance requirements and exact cases (5 requirements)


### OTV2-SIGNUP-176

Public intake requires Family or School classification.

- Area: `SIGNUP`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `public_signup`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-AUTH-007`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 03-DECISION-REGISTER-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-SIGNUP-176-FAMILY-OR-SCHOOL-BRANCH
  kind: public_journey
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
  - open the public landing page signed out and inspect the two intake choices
  - choose Family and verify navigation to the Family account form with email/password and no School fields
  - return signed out, choose School, and verify navigation to the School inquiry form with no password, card, household,
    or Student fields
  - submit an omitted, unsupported, and hybrid classification directly to the public API
  expected_results:
  - public intake offers exactly Family signup and School inquiry as mutually exclusive branches
  - Family is the only branch that can create a Parent account/household; School creates an inquiry only
  - missing, unsupported, or hybrid classification is rejected without a local or provider write
  forbidden_effects:
  - implicit classification
  - hybrid household/inquiry
  - School password or access creation
  - partial provider effect
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-SIGNUP-177

Before the fixed free-expiry instant, Family signup creates immediate free Parent access from a submitted email and password with no card; fresh public signup does not require a setup email.

- Area: `SIGNUP`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `public_signup`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-AUTH-007`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-SIGNUP-177-AC01
  kind: negative
  environment:
  - ci
  - provider_sandbox
  - production_operator_canary
  actors:
  - parent
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
  - Before the fixed free-expiry instant, Family signup creates immediate free Parent access from a submitted email
    and password with no card; fresh public signup does not require a setup email.
  forbidden_effects:
  - duplicate external effect
  - unfenced worker completion
  - blind retry with new key
  - PII or bearer in URL
  evidence_profile: api_job_saga
  cleanup: reconcile every effect and clear only disposable operator-owned work
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-SIGNUP-179

Existing GHL adults are matched by provider link or normalized email without duplicate contact creation.

- Area: `SIGNUP`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `public_signup`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-AUTH-007`
- Source references: `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-SIGNUP-179-AC01
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
  - student_operator_canary_1
  preconditions:
  - typed route/job contract and stable idempotency key are defined
  steps:
  - submit the authorized operation
  - double-submit and send a stale version
  - inject timeout/acceptance-unknown
  - reconcile or safely reprocess through governed controls
  expected_results:
  - Existing GHL adults are matched by provider link or normalized email without duplicate contact creation.
  forbidden_effects:
  - duplicate external effect
  - unfenced worker completion
  - blind retry with new key
  - PII or bearer in URL
  evidence_profile: api_job_saga
  cleanup: reconcile every effect and clear only disposable operator-owned work
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-SIGNUP-213

Duplicate and interrupted signup is idempotent and provides safe sign-in, resend, or recovery paths without duplicate household or GHL contact.

- Area: `SIGNUP`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `public_signup`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-AUTH-007`
- Source references: `06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-SIGNUP-213-AC01
  kind: negative
  environment:
  - ci
  - provider_sandbox
  - production_operator_canary
  actors:
  - parent
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
  - Duplicate and interrupted signup is idempotent and provides safe sign-in, resend, or recovery paths without
    duplicate household or GHL contact.
  forbidden_effects:
  - duplicate external effect
  - unfenced worker completion
  - blind retry with new key
  - PII or bearer in URL
  evidence_profile: api_job_saga
  cleanup: reconcile every effect and clear only disposable operator-owned work
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-SIGNUP-228

The public Family form and CTA change exactly at 2026-09-13T19:24:00+03:00: before it creates immediate cardless free access; at or after it creates an inactive account and continues to hosted checkout, with no rolling trial.

- Area: `SIGNUP`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `public_signup`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-AUTH-007, OTV2-SIGNUP-176, OTV2-SIGNUP-177, OTV2-BILLING-224`
- Source references: `05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-SIGNUP-228-BEFORE-EXPIRY
  kind: time_boundary
  environment: &id001
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
  - server clock is one second before 2026-09-13T19:24:00+03:00
  - submitted email controls no active local household
  steps:
  - open /signup signed out and inventory the exact fields, CTA, helper, legal links, and absent fields
  - submit adult first/last name, email, password, timezone, required Terms/privacy acceptance, and no optional
    marketing permissions
  - sign in with the submitted email/password and read back household/access state
  - attempt Student creation without entering any card
  expected_results:
  - the form has no phone, country, Student, learner relationship, guardian/recording/recognition consent, reminder
    preference, or card field
  - CTA is “Create my free family account” and helper is “No credit card. Free access ends September 13, 2026 at
    7:24 p.m. Jerusalem time.”
  - one free Family household is immediately usable and no setup email or charge is required
  forbidden_effects:
  - rolling trial
  - card collection
  - setup-token dependency
  - duplicate adult or household
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
- case_id: OTV2-SIGNUP-228-AT-AND-AFTER-EXPIRY
  kind: time_boundary
  environment: *id001
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
  - isolated signups exist exactly at and one second after 2026-09-13T19:24:00+03:00
  steps:
  - open /signup at each clock instant and inspect copy and CTA
  - submit the exact Family fields without a card
  - read back local account, household, access, checkout continuation, and financial effects
  - attempt Student creation and learning before then after verified checkout
  expected_results:
  - CTA is “Create account and continue to checkout” at and after the instant
  - the account and one inactive household persist; the form itself creates no charge and grants no rolling trial
  - Student creation/learning remain blocked until the household-scoped paid projection is verified
  forbidden_effects:
  - free access at the boundary
  - form-side charge
  - Student access before payment
  - rolling trial
  evidence_profile: role_browser_persistence
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
