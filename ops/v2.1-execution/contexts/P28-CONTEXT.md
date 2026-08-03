# P28 — Communication Foundation, Suppression, Readback, Website Bot, and WhatsApp Preference — Locked Context

**Outcome:** Implement the sole GHL registry, sender/suppression truth, readbacks, website lead bot, channel preference model, and email-first workflows that remain correct while WhatsApp is dormant.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `GHL_REGISTRY, COMMUNICATION_FOUNDATION`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- Dormant WhatsApp intent must never be represented as a successful send.
- P29 and P30 create isolated workflow fragments; P28 or I36 registers them.

## Dependency gates

- Start after: `F06, P27, P31`
- Full merge after: `F06, P27, P31`
- Candidate integration partners (non-ordering): `P17, P25, P26`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `apps/worker/src/runners/communications-foundation/**`
- `integrations/highlevel/registry/workflow-registry.yaml`
- `integrations/highlevel/v21/foundation/**`
- `packages/contracts/src/communications/foundation/**`
- `packages/db/src/communications/foundation/**`
- `packages/domain/src/communications/foundation/**`

Scope notes below explain intent but do not grant additional path authority:

- packages/db/src/communications/foundation/** except migrations and central index
- website bot lead-capture modules
- sender/suppression/readback/preference tests
- steward requests for config/dependency/route/worker/migration changes

## Deliverables

- single canonical GHL workflow registry and generation contract
- sender and suppression readback truth
- website bot Family/School lead capture
- email-first channel selection with dormant WhatsApp preference

## Relevant locked decisions (7)

| Decision | Status | Exact decision |
|---|---|---|
| DEC-091 | LOCKED | The lead-capture bot sits on the public website. It is not a WhatsApp qualification bot. |
| DEC-093 | LOCKED | Launch workflows must be fully functional with email alone. |
| DEC-094 | LOCKED | WhatsApp reminder/blast steps may be designed into workflow contracts, but no WhatsApp send occurs until a provider, approved templates, consent, sender, webhook, and production canary are configured. Disabled WhatsApp steps must not break or delay email. |
| DEC-095 | LOCKED | There is no WhatsApp lead assistant at launch. |
| DEC-096 | INFERRED | Parent chooses reminder preference from `email`, `whatsapp`, `both`, or `none` for optional reminders. Until WhatsApp is activated, the UI explains that WhatsApp is unavailable and stores intent without claiming delivery; essential account/security email cannot be disabled. |
| DEC-098 | LOCKED | GHL campaigns are authored/executed in GHL. One Time may show status/readback and governed launch actions but does not become a second campaign editor. |
| DEC-100 | LOCKED | Existing OT-11/OT-12 workflow identifier collisions must be reconciled through a registry migration; identifiers may never be silently reused for different purposes. |

## Acceptance requirements and exact cases (9 requirements)


### OTV2-GHL-120

Rabbi sender uses rabbi@onetimeonetime.com after acceptance.

- Area: `GHL`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `communications`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-GHL-119`
- Source references: `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-GHL-120-AC01
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
  - Rabbi sender uses rabbi@onetimeonetime.com after acceptance.
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

### OTV2-GHL-121

Reply-To is info@onetimeonetime.com.

- Area: `GHL`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `communications`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-GHL-119`
- Source references: `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-GHL-121-AC01
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
  - Reply-To is info@onetimeonetime.com.
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

### OTV2-GHL-122

Office/brand operational sender uses info@onetimeonetime.com.

- Area: `GHL`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `communications`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-GHL-119`
- Source references: `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-GHL-122-AC01
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
  - Office/brand operational sender uses info@onetimeonetime.com.
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

### OTV2-GHL-137

Suppression/DND/unsubscribe/complaint/hard-bounce gates are enforced.

- Area: `GHL`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `communications`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-GHL-119`
- Source references: `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-GHL-137-AC01
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
  - Suppression/DND/unsubscribe/complaint/hard-bounce gates are enforced.
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

### OTV2-GHL-138

Communications Review displays workflow identity, audience and suppression counts, rendered copy, cadence, readiness, delivery readback, and governed Start/Pause requests; it exposes no test-send action or campaign editor.

- Area: `GHL`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `communications`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-GHL-119`
- Source references: `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-GHL-138-COMMUNICATIONS-READBACK
  kind: authorization_matrix
  environment:
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  preconditions:
  - one approved GHL workflow has current audience, suppression, copy, cadence, readiness, and delivery readback
  - one non-Admin denial session is available
  steps:
  - open Communications and the selected workflow readback as Admin
  - verify workflow identity, audience/eligible/excluded counts, sender, rendered copy, cadence, readiness, delivery
    state, and safe GHL link
  - submit governed Start and Pause requests and read back the persisted audited outcome
  - inventory visible controls and direct application APIs for campaign authoring, test-send, seed-send, or provider-canary
    actions
  - attempt the route and mutations as a non-Admin
  expected_results:
  - the exact readback is visible and Start/Pause requests are authorized, persisted, and audited
  - campaign body authoring remains in GHL and no test-send, seed-send, or provider-canary action exists in ordinary
    product navigation or application APIs
  - non-Admin access is denied before workflow data renders
  forbidden_effects:
  - campaign editor in One Time
  - product test-send action
  - provider canary from ordinary navigation
  - non-Admin workflow disclosure
  - Start/Pause success without provider readback
  evidence_profile: role_browser_persistence
  cleanup: return the operator-owned workflow to its approved desired state and retain audit evidence
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-GHL-198

OT-B01 is a public website lead-capture bot and never acts as a WhatsApp qualification bot or creates Students.

- Area: `GHL`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `communications`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-GHL-119`
- Source references: `09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-GHL-198-AC01
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
  - OT-B01 is a public website lead-capture bot and never acts as a WhatsApp qualification bot or creates Students.
  forbidden_effects:
  - Student contact
  - wrong sender
  - broad unapproved enrollment
  - disabled WhatsApp send
  - audience/content drift
  evidence_profile: ghl_workflow
  cleanup: remove unintended seed enrollment and preserve approved delivery evidence
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-GHL-199

Email workflows complete successfully while unconfigured WhatsApp actions are recorded as safely skipped and send nothing.

- Area: `GHL`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `communications`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-GHL-119`
- Source references: `09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md, 11-ENVIRONMENT-FIXTURE-CANARY-MANIFEST-v2.1.yaml`

Exact acceptance case data:

```yaml
- case_id: OTV2-GHL-199-AC01
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
  - Email workflows complete successfully while unconfigured WhatsApp actions are recorded as safely skipped and
    send nothing.
  forbidden_effects:
  - Student contact
  - wrong sender
  - broad unapproved enrollment
  - disabled WhatsApp send
  - audience/content drift
  evidence_profile: ghl_workflow
  cleanup: remove unintended seed enrollment and preserve approved delivery evidence
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-GHL-220

OT-11 remains retired, OT-12 remains adult support, OT-14 is Parent Newsletter, and OT-15 is Former Member Reactivation.

- Area: `GHL`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `communications`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-GHL-119`
- Source references: `09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-GHL-220-AC01
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
  - OT-11 remains retired, OT-12 remains adult support, OT-14 is Parent Newsletter, and OT-15 is Former Member Reactivation.
  forbidden_effects:
  - Student contact
  - wrong sender
  - broad unapproved enrollment
  - disabled WhatsApp send
  - audience/content drift
  evidence_profile: ghl_workflow
  cleanup: remove unintended seed enrollment and preserve approved delivery evidence
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-PARENT-226

Parent optional-reminder preference supports exactly email, whatsapp, both, or none; while WhatsApp is dormant the UI is truthful, intent persists, no WhatsApp is sent, email remains the active fallback except for none, and essential account/security/billing email cannot be disabled.

- Area: `PARENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `parent_application`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-FOUNDATION-003, OTV2-GHL-137, OTV2-GHL-199`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-PARENT-226-PREFERENCES
  kind: state_matrix
  environment:
  - ci
  - persistent_staging
  - provider_sandbox
  actors:
  - parent
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - WhatsApp provider, sender, templates, consent gate, webhook, and canary are not activated
  - the Parent has an active Family household and a deliverable email address
  steps:
  - save each allowed value—email, whatsapp, both, and none—then refresh and sign in again after each save
  - attempt an invalid fifth value through the typed API
  - for each saved value trigger one optional class reminder and read back UI status, email effects, WhatsApp skips,
    and dedupe
  expected_results:
  - exactly the four allowed values persist and an invalid value is rejected without a partial write
  - the UI labels WhatsApp unavailable and never claims WhatsApp delivery
  - email sends for email, whatsapp, and both while WhatsApp is dormant; none suppresses the optional Parent reminder
  - zero WhatsApp provider sends occur and duplicate triggers do not duplicate email
  forbidden_effects:
  - claimed WhatsApp delivery
  - WhatsApp provider call
  - optional Parent reminder when preference is none
  - invalid preference persistence
  evidence_profile: ghl_workflow
  cleanup: remove unintended seed enrollment and preserve approved delivery evidence
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
- case_id: OTV2-PARENT-226-ESSENTIAL-EMAIL
  kind: suppression_boundary
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
  - the Parent saved none for optional reminders and has marketing unsubscribe/DND
  - the email address remains deliverable
  steps:
  - request an account password reset
  - trigger an essential verified billing/access notice
  - trigger one optional reminder and one marketing message
  - read back Resend/GHL effects, suppression decisions, and message purpose
  expected_results:
  - requested security and essential billing/access email is delivered despite optional-reminder and marketing preferences
  - the optional reminder and marketing message are suppressed
  - message purpose and provider are auditable without creating a Student contact
  forbidden_effects:
  - Student contact
  - wrong sender
  - broad unapproved enrollment
  - disabled WhatsApp send
  - audience/content drift
  evidence_profile: ghl_workflow
  cleanup: remove unintended seed enrollment and preserve approved delivery evidence
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
