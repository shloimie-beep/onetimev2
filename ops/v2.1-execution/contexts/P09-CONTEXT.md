# P09 — School Inquiry and Approved-School Accounts — Locked Context

**Outcome:** Implement manual-sales School inquiry and approved-school configuration using the same Parent/Student product with no school-specific role or portal.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `SCHOOL_INQUIRY`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- Apply the exact task packet and execution contract.

## Dependency gates

- Start after: `P08`
- Full merge after: `P08`
- Candidate integration partners (non-ordering): `F06, P27, P30`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `apps/web/src/client/public/school/**`
- `apps/web/src/server/features/signup/school/**`
- `packages/contracts/src/signup/school/**`
- `packages/domain/src/signup/school/**`

Scope notes below explain intent but do not grant additional path authority:

- school-inquiry focused tests
- steward requests for route/config/migration changes

## Deliverables

- school inquiry form and manual-sales state
- no automatic access/nurture enforcement
- approved-school allowance/terms configuration path
- shared Parent/Student experience reuse

## Relevant locked decisions (5)

| Decision | Status | Exact decision |
|---|---|---|
| DEC-034 | LOCKED | A School submission is a sales lead. It does not enter a nurture sequence or receive automatic product access. The operator contacts the school manually. |
| DEC-035 | LOCKED | Once approved, a School uses the same application experience: one adult account manager and separate Student accounts. There is no school-specific role, portal, bulk roster, or organization administration at launch. |
| DEC-036 | INFERRED | School price, seat allowance, billing start, and terms are configured manually per approved school account. The normal household default remains three Students unless an Admin explicitly grants a contracted school allowance. |
| DEC-097 | LOCKED | School leads receive an immediate acknowledgment only and no automated nurture sequence. The operator follows up manually. |
| DEC-144 | DEFERRED | Class Helper, Buffer/social publishing, demos, preview routes, test lanes, Parent-created goals, editable badge rules, favorites, PWA push, and school-specific administration are not launch features. |

## Acceptance requirements and exact cases (4 requirements)


### OTV2-SIGNUP-178

School submission creates one adult sales lead and acknowledgment but no automatic access, nurture, or subscription.

- Area: `SIGNUP`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `public_signup`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-AUTH-007`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-SIGNUP-178-SCHOOL-INQUIRY-NO-ACCESS
  kind: public_journey
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
  - submit school name, contact first name, contact last name, and email with optional phone/note omitted
  - read back the durable acknowledgment and safely matched GHL adult lead/manual-follow-up record
  - repeat the normalized email and inspect deduplication
  - inspect local accounts, households, Students, subscriptions, access projections, campaigns, and workflow enrollments
  expected_results:
  - one adult School lead and one acknowledgment exist, and repeat submission does not create a duplicate adult
    contact
  - no Parent login, passwordless claim, household, Student, subscription, or product access is created
  - no Family, newsletter, conversion, reactivation, or other automated nurture workflow begins
  forbidden_effects:
  - automatic product access
  - automatic subscription
  - Family conversion
  - nurture enrollment
  - duplicate GHL contact
  evidence_profile: ghl_workflow
  cleanup: remove unintended seed enrollment and preserve approved delivery evidence
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-SIGNUP-229

The public School form collects exactly school/contact fields, displays the approved CTA and success copy, and creates only a deduplicated adult lead plus manual follow-up—never product access or nurture.

- Area: `SIGNUP`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `public_signup`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-AUTH-007, OTV2-SIGNUP-176, OTV2-SIGNUP-178`
- Source references: `05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-SIGNUP-229-PUBLIC-SCHOOL-INQUIRY
  kind: public_journey
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
  - open /school signed out and inventory required, optional, and absent fields
  - submit school name, contact first/last name, and email with phone/note empty
  - inspect the durable success screen and provider/local readback
  - repeat the same normalized email and inspect dedupe and follow-up behavior
  expected_results:
  - required fields are exactly school name, contact first name, contact last name, and email; phone and note are
    optional
  - CTA is “Send school inquiry” and success is “Thanks—we received your school inquiry. We’ll be in touch shortly.”
  - one safely matched adult lead and manual follow-up exist with no password, household, Student, subscription,
    access, Family conversion, or nurture enrollment
  forbidden_effects:
  - product account
  - automatic access
  - subscription
  - nurture enrollment
  - duplicate adult contact
  evidence_profile: ghl_workflow
  cleanup: remove unintended seed enrollment and preserve approved delivery evidence
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-SCHOOL-200

Approved School accounts reuse the Parent/Student product model while pricing and seat allowance are set manually.

- Area: `SCHOOL`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `sales_and_accounts`
- Semantic acceptance dependencies: `OTV2-SIGNUP-176, OTV2-GHL-119`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 03-DECISION-REGISTER-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-SCHOOL-200-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
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
  - Approved School accounts reuse the Parent/Student product model while pricing and seat allowance are set manually.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-SCHOOL-214

No School authorization role, school-specific portal, bulk roster, or automated school nurture exists at launch.

- Area: `SCHOOL`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `sales_and_accounts`
- Semantic acceptance dependencies: `OTV2-SIGNUP-176, OTV2-GHL-119`
- Source references: `04-SUPERSESSION-AND-SYSTEM-DISPOSITION-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-SCHOOL-214-AC01
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
  - No School authorization role, school-specific portal, bulk roster, or automated school nurture exists at launch.
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
