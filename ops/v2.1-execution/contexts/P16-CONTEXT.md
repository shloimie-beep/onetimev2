# P16 — Class Series, Occurrences, and Canonical Enrollment — Locked Context

**Outcome:** Implement class-series and occurrence lifecycle plus atomic automatic enrollment in the single canonical launch class.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `CLASSROOM_CORE`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- Apply the exact task packet and execution contract.

## Dependency gates

- Start after: `F04, F05, P15`
- Full merge after: `F04, F05, P15`
- Candidate integration partners (non-ordering): `P12, P14`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `apps/web/src/client/app/admin/classroom/core/**`
- `apps/web/src/server/features/classes/core/**`
- `packages/contracts/src/classes/core/**`
- `packages/db/src/classes/core/**`
- `packages/domain/src/classes/core/**`

Scope notes below explain intent but do not grant additional path authority:

- packages/db/src/classes/core/** except migrations and central index
- class/enrollment concurrency tests
- steward requests for route/migration/registration changes

## Deliverables

- class series and occurrence lifecycle
- canonical launch-class singleton invariant
- atomic active-Student enrollment
- draft/invisible behavior for additional series

## Relevant locked decisions (4)

| Decision | Status | Exact decision |
|---|---|---|
| DEC-060 | LOCKED | The launch catalog has exactly one active published recurring 60-minute class, Sunday through Thursday at 7:00 p.m. `Asia/Jerusalem`. Occurrences generate on a rolling 90-day horizon, prepare automatically 24 hours before start (or manually earlier), open Student join 10 minutes before start, and auto-close 15 minutes after scheduled end unless an Admin closes or extends. Additional Admin-created series start `draft`, enroll nobody, and remain invisible until explicit activation. |
| DEC-061 | LOCKED | Every active Student is immediately enrolled in the canonical class. No enrollment request or Admin approval is required for the launch class. |
| DEC-062 | LOCKED | Parent and Student calendars display the canonical class automatically. |
| DEC-123 | INFERRED | Class occurrence lifecycle is `scheduled`, `preparing`, `ready`, `live`, `completed`, or `canceled`. Draft recurrence edits exist at the series level, not as visible fake occurrences. |

## Acceptance requirements and exact cases (7 requirements)


### OTV2-CLASSROOM-065

Admin can create, edit, pause, archive, restore, and explicitly activate/publish class series; creation and restoration always begin in `draft`.

- Area: `CLASSROOM`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `classroom`
- Semantic acceptance dependencies: `OTV2-CALENDAR-058, OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CLASSROOM-065-SERIES-LIFECYCLE
  kind: state_transition
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  preconditions:
  - the canonical launch series remains active and untouched
  - Admin is authorized to create one bounded noncanonical series
  steps:
  - create a noncanonical series and verify its persisted initial state is draft with no enrollment or Parent/Student
    visibility
  - edit draft metadata, explicitly activate it, and verify occurrence generation and visibility begin only after
    activation
  - pause then resume the series and verify each persisted transition and scheduling consequence
  - archive the series, restore it, and verify restoration returns to draft rather than active
  - attempt an archived-to-active shortcut and repeat each accepted command
  expected_results:
  - creation and restoration always persist draft and never auto-enroll or auto-publish
  - valid lifecycle actions persist once, survive refresh/relogin, and have the documented occurrence consequences
  - archived-to-active is rejected without a partial write and repeated commands are idempotent
  forbidden_effects:
  - implicit activation
  - automatic enrollment while draft
  - Parent or Student visibility while draft
  - archived-to-active shortcut
  - duplicate occurrence generation
  evidence_profile: role_browser_persistence
  cleanup: archive the bounded noncanonical operator series after evidence is retained
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-CLASSROOM-066

Admin can create/edit/reschedule/cancel/complete occurrences.

- Area: `CLASSROOM`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `classroom`
- Semantic acceptance dependencies: `OTV2-CALENDAR-058, OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CLASSROOM-066-AC01
  kind: positive
  environment:
  - ci
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
  - student
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - student_operator_canary_1
  - student_operator_canary_2
  - student_operator_canary_3
  - denial_household
  preconditions:
  - operator-owned occurrence and up to three real Student fixtures exist
  - Zoom live/sandbox authority is explicit
  steps:
  - prepare the roster and confirm it
  - read back meeting and per-Student registration
  - join through embedded portals on separate tablets
  - exercise sibling, second-device, timeout, and reconnect branches
  expected_results:
  - Admin can create/edit/reschedule/cancel/complete occurrences.
  forbidden_effects:
  - raw Zoom URL exposure
  - shared bearer credential
  - duplicate meeting
  - cross-Student join
  - blind retry after unknown acceptance
  evidence_profile: zoom_classroom
  cleanup: reconcile and remove disposable provider resources without blocking normal classroom paths
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-CLASSROOM-067

Every active entitled Student is automatically enrolled in the canonical launch class; no request, approval, or manual opt-out exists for that canonical enrollment.

- Area: `CLASSROOM`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `classroom`
- Semantic acceptance dependencies: `OTV2-CALENDAR-058, OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CLASSROOM-067-AC01
  kind: negative
  environment:
  - ci
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
  - student
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - student_operator_canary_1
  - student_operator_canary_2
  - student_operator_canary_3
  - denial_household
  preconditions:
  - operator-owned occurrence and up to three real Student fixtures exist
  - Zoom live/sandbox authority is explicit
  steps:
  - prepare the roster and confirm it
  - read back meeting and per-Student registration
  - join through embedded portals on separate tablets
  - exercise sibling, second-device, timeout, and reconnect branches
  expected_results:
  - Every active entitled Student is automatically enrolled in the canonical launch class; no request, approval,
    or manual opt-out exists for that canonical enrollment.
  forbidden_effects:
  - raw Zoom URL exposure
  - shared bearer credential
  - duplicate meeting
  - cross-Student join
  - blind retry after unknown acceptance
  evidence_profile: zoom_classroom
  cleanup: reconcile and remove disposable provider resources without blocking normal classroom paths
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-CLASSROOM-184

All active Students are automatically enrolled in the single canonical Sunday-through-Thursday 7 p.m. Jerusalem class.

- Area: `CLASSROOM`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `classroom`
- Semantic acceptance dependencies: `OTV2-CALENDAR-058, OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CLASSROOM-184-AC01
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
  - parent_operator_canary
  - student_operator_canary_1
  preconditions:
  - canonical timezone and recurrence configuration are loaded
  steps:
  - create or inspect the canonical series
  - render Admin/Parent/Student local times
  - exercise recurrence exception and reschedule
  - test Israel/US DST divergence and forbidden schedule boundary
  expected_results:
  - All active Students are automatically enrolled in the single canonical Sunday-through-Thursday 7 p.m. Jerusalem
    class.
  forbidden_effects:
  - silent browser-timezone mutation
  - duplicate occurrence
  - forbidden schedule acceptance
  - past occurrence rewrite
  evidence_profile: calendar_time
  cleanup: remove disposable future occurrence only when explicitly authorized
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-CLASSROOM-223

The launch catalog has exactly one active published canonical class; an additional Admin-created series begins `draft`, enrolls nobody, and is invisible to Parent/Student calendars until explicitly activated.

- Area: `CLASSROOM`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `classroom`
- Semantic acceptance dependencies: `OTV2-CALENDAR-058, OTV2-AUTH-008, OTV2-PARENT-032, OTV2-CLASSROOM-065, OTV2-CLASSROOM-184`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 03-DECISION-REGISTER-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CLASSROOM-223-DRAFT-THEN-ACTIVATE
  kind: state_transition
  environment:
  - ci
  - persistent_staging
  actors:
  - admin
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
  - the canonical Sunday-through-Thursday 7 p.m. Jerusalem series is the only active published series
  - an isolated future date range and disposable series title are reserved
  - baseline enrollment, Parent/Student calendar, Zoom-resource, outbox, and message-effect counts are recorded
  steps:
  - sign in as Admin and create a valid additional future series without activating or publishing it
  - refresh and sign in again, then read back the series state and audit event
  - query enrollment, occurrence, Parent/Student calendar, Zoom, outbox, and communication effects by the new series
    identifier
  - attempt to find or open the series as the linked Parent and Student
  - perform the explicit audited activate/publish action in the isolated staging scope
  - read back the state transition and prove configured downstream effects occur at most once
  expected_results:
  - before explicit activation the new series is durably `draft`, enrolls zero Students, creates zero visible occurrences,
    creates zero Zoom resources, and emits zero messages
  - Parent and Student navigation and direct access cannot reveal the draft series
  - only the explicit audited activate/publish action changes the series to `active`; any configured downstream
    effects are idempotent
  - the production launch dataset still contains only the canonical series as active/published
  forbidden_effects:
  - automatic activation
  - enrollment, visible occurrence, Zoom resource, or message before activation
  - duplicate downstream effect
  - production mutation from this isolated case
  evidence_profile: role_browser_persistence
  cleanup: archive the disposable staging series, reconcile its effects, and verify the canonical series remains
    unchanged
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-CLASSROOM-234

ClassSeries UI and API enforce draft→active, active→paused|archived, paused→active|archived, and archived→draft only, with consequence confirmation, idempotent persisted readback, and no archived→active transition.

- Area: `CLASSROOM`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `classroom`
- Semantic acceptance dependencies: `OTV2-CALENDAR-058, OTV2-AUTH-008, OTV2-PARENT-032, OTV2-CLASSROOM-065, OTV2-CLASSROOM-223`
- Source references: `06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CLASSROOM-234-FULL-LIFECYCLE
  kind: state_transition
  environment:
  - ci
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - student_operator_canary_1
  preconditions:
  - typed route/job contract and stable idempotency key are defined
  steps:
  - from draft inspect and execute Activate, then repeat Activate
  - from active separately prove Pause and Archive branches with consequence confirmation and persisted audit readback
  - from paused prove Resume and Archive branches
  - from archived prove Restore to draft and attempt direct archived-to-active API/UI mutation
  expected_results:
  - valid transitions are exactly draft→active|archived, active→paused|archived, paused→active|archived, and archived→draft
  - every action displays target/effect/affected count/reversibility, persists once, and remains correct after refresh
  - archived→active is absent in UI and rejected by the API without a partial effect
  forbidden_effects:
  - implicit activation
  - archived-to-active
  - duplicate side effect
  - success without persisted target state
  evidence_profile: api_job_saga
  cleanup: reconcile every effect and clear only disposable operator-owned work
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-CLASSROOM-235

Student eligibility and canonical enrollment commit atomically on create/restore/activation; failure leaves neither partial state, reconciliation repairs drift, and canonical manual unenroll is absent.

- Area: `CLASSROOM`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `classroom`
- Semantic acceptance dependencies: `OTV2-CALENDAR-058, OTV2-AUTH-008, OTV2-PARENT-032, OTV2-CLASSROOM-067, OTV2-CLASSROOM-184`
- Source references: `05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CLASSROOM-235-ATOMIC-ENROLLMENT
  kind: transactional_failure
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
  - typed route/job contract and stable idempotency key are defined
  steps:
  - create, restore, and reactivate an eligible Student while injecting failure between eligibility and enrollment
    writes
  - repeat each operation without failure and read back Student, enrollment, calendar, and access
  - introduce one missing and one extra canonical enrollment row and run reconciliation twice
  - inventory Parent/Admin UI and API for canonical manual unenroll; prove unenroll on a noncanonical future series
  expected_results:
  - failure leaves neither partial Student eligibility nor partial canonical enrollment
  - successful mutation creates exactly one canonical enrollment and visible occurrence scope
  - reconciliation repairs exact drift once and second execution is a no-op
  - canonical manual opt-out/unregister is absent while noncanonical unenroll remains governed
  forbidden_effects:
  - eligible Student without canonical enrollment
  - duplicate enrollment
  - canonical manual unenroll
  - non-idempotent reconciliation
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
