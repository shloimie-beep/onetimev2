# P13 — Parent Schedule, Progress, Updates, and Support Boundary — Locked Context

**Outcome:** Implement Parent-specific schedule, attendance/progress summaries, notices/newsletter/reminders, and support access without exposing Student class, recording, library, or private-question content.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `PARENT_SUMMARY_UI`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- Apply the exact task packet and execution contract.

## Dependency gates

- Start after: `P12, F07`
- Full merge after: `P12, F07`
- Candidate integration partners (non-ordering): `P15, P22, P24, P26`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `apps/web/src/client/app/parent/progress/**`
- `apps/web/src/client/app/parent/schedule/**`
- `apps/web/src/client/app/parent/updates/**`
- `apps/web/src/server/features/portals/parent-summary/**`
- `packages/contracts/src/portals/parent-summary/**`

Scope notes below explain intent but do not grant additional path authority:

- Parent support route-link steward request; P24 owns the support workspace
- Parent boundary focused tests
- steward requests for route/registration changes

## Deliverables

- Parent schedule and progress summaries
- Parent updates/newsletter/reminder surfaces
- Parent support entry
- hard absence of Student learning/private-question views

## Relevant locked decisions (2)

| Decision | Status | Exact decision |
|---|---|---|
| DEC-016 | LOCKED | A Parent account never receives Student-class, recording, question, or learning-library access. |
| DEC-022 | LOCKED | Parents cannot see private Student questions or Rabbi answers. They may see Parent-specific schedule, attendance/progress summaries, billing, notices, newsletter, reminders, and Student credential management. |

## Acceptance requirements and exact cases (3 requirements)


### OTV2-PARENT-037

Parent can view Parent-specific schedule, attendance/progress summaries, and badges but cannot open Student class, recordings, library, or private questions.

- Area: `PARENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `parent_application`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-FOUNDATION-003`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-PARENT-037-AC01
  kind: negative
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
  - Parent can view Parent-specific schedule, attendance/progress summaries, and badges but cannot open Student
    class, recordings, library, or private questions.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-PARENT-039

Parent can view updates/newsletter/support/account.

- Area: `PARENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `parent_application`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-FOUNDATION-003`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-PARENT-039-AC01
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
  - Parent can view updates/newsletter/support/account.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-PARENT-185

Parent cannot open Student Join Class, recording playback, library, private questions, or Rabbi answers.

- Area: `PARENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `parent_application`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-FOUNDATION-003`
- Source references: `05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-PARENT-185-AC01
  kind: negative
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
  - Parent cannot open Student Join Class, recording playback, library, private questions, or Rabbi answers.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
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
