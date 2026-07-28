# P11 — Admin Dashboard, Operational Views, and Global Search — Locked Context

**Outcome:** Implement real-data Admin dashboard, authorized global search, and operable cross-domain status views without fake/demo dependencies.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `ADMIN_OPERATIONS_UI`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- Apply the exact task packet and execution contract.

## Dependency gates

- Start after: `F05, F07`
- Full merge after: `F05, F07`
- Candidate integration partners (non-ordering): `P10, F06, P22, P24, P26, P33`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `apps/web/src/client/app/admin/dashboard/**`
- `apps/web/src/client/app/admin/search/**`
- `apps/web/src/server/features/admin/operations/**`
- `packages/contracts/src/admin/operations/**`
- `packages/domain/src/admin-search/**`

Scope notes below explain intent but do not grant additional path authority:

- Admin dashboard/search focused tests
- steward requests for route/registration changes

## Deliverables

- real-data dashboard
- authorized cross-entity search
- operational queue/provider/access/support summaries
- zero fictional/demo fallback data

## Relevant locked decisions (2)

| Decision | Status | Exact decision |
|---|---|---|
| DEC-132 | LOCKED | Global Admin search is launch-required. |
| DEC-135 | INFERRED | Full Admin mutation workflows are supported on desktop and tablet. Mobile Admin supports urgent status, search, class/live controls, and simple edits; dense configuration may require tablet/desktop with clear messaging. |

## Acceptance requirements and exact cases (3 requirements)


### OTV2-ADMIN-021

Admin Dashboard contains real operational data only.

- Area: `ADMIN`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `admin_application`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-FOUNDATION-003`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-ADMIN-021-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
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
  - Admin Dashboard contains real operational data only.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-ADMIN-029

Admin can view communications, tickets, billing/access, audit, integrations, and operations.

- Area: `ADMIN`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `admin_application`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-FOUNDATION-003`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-ADMIN-029-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
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
  - Admin can view communications, tickets, billing/access, audit, integrations, and operations.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-ADMIN-205

Global Admin search finds authorized adults, households, Students, classes, content, questions, and tickets without placing private search terms in URLs.

- Area: `ADMIN`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `admin_application`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-FOUNDATION-003`
- Source references: `08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-ADMIN-205-AC01
  kind: negative
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
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
  - Global Admin search finds authorized adults, households, Students, classes, content, questions, and tickets
    without placing private search terms in URLs.
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
