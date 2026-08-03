# P27 — GHL Adult Classification and Student-Contact Prohibition — Locked Context

**Outcome:** Implement exact adult-contact matching/classification, household opportunity mapping, local-first signup synchronization, and a hard prohibition on Student GHL contacts.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `GHL_IDENTITY`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- Apply the exact task packet and execution contract.

## Dependency gates

- Start after: `F04, F06`
- Full merge after: `F04, F06`
- Candidate integration partners (non-ordering): `P08, P09`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `apps/worker/src/runners/ghl-identity/**`
- `integrations/highlevel/v21/identity/**`
- `packages/contracts/src/communications/ghl-identity/**`
- `packages/db/src/communications/ghl-identity/**`
- `packages/domain/src/communications/ghl-identity/**`

Scope notes below explain intent but do not grant additional path authority:

- packages/db/src/communications/ghl-identity/** except migrations and central index
- GHL dedupe/ambiguity/Student-prohibition tests
- steward requests for config/dependency/worker/migration changes

## Deliverables

- adult normalized-email matching and provider-link precedence
- household-scoped opportunity/account mapping
- visible CRM ambiguity quarantine
- zero Student HighLevel contacts

## Relevant locked decisions (2)

| Decision | Status | Exact decision |
|---|---|---|
| DEC-014 | LOCKED | Students never require or receive an email address. No Student is created as a HighLevel contact. |
| DEC-090 | LOCKED | HighLevel owns adult CRM, campaigns, email workflows, the website lead-capture bot, conversations, consent/suppression projection, and the operator-facing Stripe workflow. |

## Acceptance requirements and exact cases (3 requirements)


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
