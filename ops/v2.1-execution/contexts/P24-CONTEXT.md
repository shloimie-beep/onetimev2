# P24 — Adult and Student Support, Rabbi Questions, and Telegram Routing — Locked Context

**Outcome:** Implement role-appropriate support tickets, separate Torah/class questions, secure conversation access, Admin operations, and bounded Telegram notification routing.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `SUPPORT`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- Apply the exact task packet and execution contract.

## Dependency gates

- Start after: `F03, F04, F05, F07`
- Full merge after: `F03, F04, F05, F07`
- Candidate integration partners (non-ordering): `F06, P22`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `apps/web/src/client/app/admin/support/**`
- `apps/web/src/client/app/student/support/**`
- `apps/web/src/server/features/support/**`
- `packages/contracts/src/support/**`
- `packages/db/src/support/**`
- `packages/domain/src/support/**`

Scope notes below explain intent but do not grant additional path authority:

- packages/db/src/support/** except migrations and central index
- apps/web/src/client/app/parent/support/** integration module
- support/Telegram/privacy tests
- steward requests for config/dependency/route/migration changes

## Deliverables

- adult and Student technical support lifecycle
- Torah question separation and privacy
- Admin ticket operations
- redacted Telegram operator notifications

## Relevant locked decisions (5)

| Decision | Status | Exact decision |
|---|---|---|
| DEC-002 | LOCKED | One Time is standalone. It has its own application, database, sessions/cookies, provider configuration, failure domain, and release authority. It must not depend on BNA runtime state. |
| DEC-080 | LOCKED | Students may submit a Torah/class question to Rabbi Eli and may separately submit a technical support request. |
| DEC-082 | LOCKED | Student support remains inside One Time. A Student is never created as a GHL contact because of a support request. |
| DEC-099 | LOCKED | Telegram is an internal Admin notification/action transport only. One Time remains source of truth, and Telegram payloads minimize Student/customer information. |
| DEC-126 | INFERRED | Support lifecycle is `open`, `in_progress`, `waiting_on_requester`, `resolved`, or `closed`. |

## Acceptance requirements and exact cases (7 requirements)


### OTV2-TICKETS-147

Billing/support/access/technical/system tickets route to Shloimie's existing Telegram bot under OT namespace.

- Area: `TICKETS`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `support`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-AUTH-008`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-TICKETS-147-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  - parent
  - student
  fixtures:
  - admin_shloimie
  - admin_rabbi_eli
  - parent_operator_canary
  - student_operator_canary_1
  - denial_household
  preconditions:
  - real role and governed support destinations exist
  steps:
  - submit the ticket/question
  - read back routing and provider reference
  - reply and change status
  - exercise cross-household and provider-failure branches
  expected_results:
  - Billing/support/access/technical/system tickets route to Shloimie's existing Telegram bot under OT namespace.
  forbidden_effects:
  - Student GHL contact
  - private Student question disclosed to Parent
  - duplicate outbound reply
  - Telegram becoming source of truth
  evidence_profile: support_ticket
  cleanup: close operator-canary ticket while preserving audit history
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-TICKETS-148

Student questions/readiness/Rabbi-answer communication routes only to Rabbi Telegram.

- Area: `TICKETS`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `support`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-AUTH-008`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-TICKETS-148-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  - parent
  - student
  fixtures:
  - admin_shloimie
  - admin_rabbi_eli
  - parent_operator_canary
  - student_operator_canary_1
  - denial_household
  preconditions:
  - real role and governed support destinations exist
  steps:
  - submit the ticket/question
  - read back routing and provider reference
  - reply and change status
  - exercise cross-household and provider-failure branches
  expected_results:
  - Student questions/readiness/Rabbi-answer communication routes only to Rabbi Telegram.
  forbidden_effects:
  - Student GHL contact
  - private Student question disclosed to Parent
  - duplicate outbound reply
  - Telegram becoming source of truth
  evidence_profile: support_ticket
  cleanup: close operator-canary ticket while preserving audit history
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-TICKETS-149

BNA and One Time data, sessions, permissions, and workspaces remain separate.

- Area: `TICKETS`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `support`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-AUTH-008`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-TICKETS-149-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  - parent
  - student
  fixtures:
  - admin_shloimie
  - admin_rabbi_eli
  - parent_operator_canary
  - student_operator_canary_1
  - denial_household
  preconditions:
  - real role and governed support destinations exist
  steps:
  - submit the ticket/question
  - read back routing and provider reference
  - reply and change status
  - exercise cross-household and provider-failure branches
  expected_results:
  - BNA and One Time data, sessions, permissions, and workspaces remain separate.
  forbidden_effects:
  - Student GHL contact
  - private Student question disclosed to Parent
  - duplicate outbound reply
  - Telegram becoming source of truth
  evidence_profile: support_ticket
  cleanup: close operator-canary ticket while preserving audit history
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-TICKETS-150

Adult support may link one GHL conversation.

- Area: `TICKETS`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `support`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-AUTH-008`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-TICKETS-150-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  - parent
  - student
  fixtures:
  - admin_shloimie
  - admin_rabbi_eli
  - parent_operator_canary
  - student_operator_canary_1
  - denial_household
  preconditions:
  - real role and governed support destinations exist
  steps:
  - submit the ticket/question
  - read back routing and provider reference
  - reply and change status
  - exercise cross-household and provider-failure branches
  expected_results:
  - Adult support may link one GHL conversation.
  forbidden_effects:
  - Student GHL contact
  - private Student question disclosed to Parent
  - duplicate outbound reply
  - Telegram becoming source of truth
  evidence_profile: support_ticket
  cleanup: close operator-canary ticket while preserving audit history
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-TICKETS-151

Student communication never creates a child GHL conversation.

- Area: `TICKETS`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `support`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-AUTH-008`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-TICKETS-151-AC01
  kind: negative
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  - parent
  - student
  fixtures:
  - admin_shloimie
  - admin_rabbi_eli
  - parent_operator_canary
  - student_operator_canary_1
  - denial_household
  preconditions:
  - real role and governed support destinations exist
  steps:
  - submit the ticket/question
  - read back routing and provider reference
  - reply and change status
  - exercise cross-household and provider-failure branches
  expected_results:
  - Student communication never creates a child GHL conversation.
  forbidden_effects:
  - Student GHL contact
  - private Student question disclosed to Parent
  - duplicate outbound reply
  - Telegram becoming source of truth
  evidence_profile: support_ticket
  cleanup: close operator-canary ticket while preserving audit history
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-TICKETS-152

Admin ticket UI supports list, assignment, status, reply, and audit.

- Area: `TICKETS`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `support`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-AUTH-008`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-TICKETS-152-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  - parent
  - student
  fixtures:
  - admin_shloimie
  - admin_rabbi_eli
  - parent_operator_canary
  - student_operator_canary_1
  - denial_household
  preconditions:
  - real role and governed support destinations exist
  steps:
  - submit the ticket/question
  - read back routing and provider reference
  - reply and change status
  - exercise cross-household and provider-failure branches
  expected_results:
  - Admin ticket UI supports list, assignment, status, reply, and audit.
  forbidden_effects:
  - Student GHL contact
  - private Student question disclosed to Parent
  - duplicate outbound reply
  - Telegram becoming source of truth
  evidence_profile: support_ticket
  cleanup: close operator-canary ticket while preserving audit history
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-TICKETS-186

Student can submit and receive in-app technical support separately from a Rabbi question without a GHL Student contact.

- Area: `TICKETS`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `support`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-AUTH-008`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-TICKETS-186-AC01
  kind: negative
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - student
  - admin
  fixtures:
  - admin_shloimie
  - admin_rabbi_eli
  - parent_operator_canary
  - student_operator_canary_1
  - denial_household
  preconditions:
  - real role and governed support destinations exist
  steps:
  - submit the ticket/question
  - read back routing and provider reference
  - reply and change status
  - exercise cross-household and provider-failure branches
  expected_results:
  - Student can submit and receive in-app technical support separately from a Rabbi question without a GHL Student
    contact.
  forbidden_effects:
  - Student GHL contact
  - private Student question disclosed to Parent
  - duplicate outbound reply
  - Telegram becoming source of truth
  evidence_profile: support_ticket
  cleanup: close operator-canary ticket while preserving audit history
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
