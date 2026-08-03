# P15 — Calendar, Recurrence, Timezone, and DST — Locked Context

**Outcome:** Implement canonical class recurrence, role-specific calendars, restrictions, Gregorian display, timezone-safe rendering, DST handling, and responsive calendar interactions.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `CALENDAR`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- Apply the exact task packet and execution contract.

## Dependency gates

- Start after: `F02, F07`
- Full merge after: `F02, F07`
- Candidate integration partners (non-ordering): `F03`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `apps/web/src/client/features/calendar/**`
- `apps/web/src/server/features/calendar/**`
- `packages/contracts/src/calendar/**`
- `packages/db/src/calendar/**`
- `packages/domain/src/calendar/**`

Scope notes below explain intent but do not grant additional path authority:

- packages/db/src/calendar/** except migrations and central index
- calendar/timezone/DST focused tests
- steward requests for route/migration/registration changes

## Deliverables

- rolling recurrence and calendar query contract
- Admin/Parent/Student role calendar views
- timezone and DST-safe occurrence rendering
- responsive accessible calendar UI

## Relevant locked decisions (3)

| Decision | Status | Exact decision |
|---|---|---|
| DEC-060 | LOCKED | The launch catalog has exactly one active published recurring 60-minute class, Sunday through Thursday at 7:00 p.m. `Asia/Jerusalem`. Occurrences generate on a rolling 90-day horizon, prepare automatically 24 hours before start (or manually earlier), open Student join 10 minutes before start, and auto-close 15 minutes after scheduled end unless an Admin closes or extends. Additional Admin-created series start `draft`, enroll nobody, and remain invisible until explicit activation. |
| DEC-062 | LOCKED | Parent and Student calendars display the canonical class automatically. |
| DEC-144 | DEFERRED | Class Helper, Buffer/social publishing, demos, preview routes, test lanes, Parent-created goals, editable badge rules, favorites, PWA push, and school-specific administration are not launch features. |

## Acceptance requirements and exact cases (14 requirements)


### OTV2-CALENDAR-051

Admin Month view works.

- Area: `CALENDAR`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `calendar`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-AUTH-019`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CALENDAR-051-AC01
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
  - Admin Month view works.
  forbidden_effects:
  - silent browser-timezone mutation
  - duplicate occurrence
  - forbidden schedule acceptance
  - past occurrence rewrite
  evidence_profile: calendar_time
  cleanup: remove disposable future occurrence only when explicitly authorized
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-CALENDAR-052

Admin Week view works.

- Area: `CALENDAR`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `calendar`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-AUTH-019`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CALENDAR-052-AC01
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
  - Admin Week view works.
  forbidden_effects:
  - silent browser-timezone mutation
  - duplicate occurrence
  - forbidden schedule acceptance
  - past occurrence rewrite
  evidence_profile: calendar_time
  cleanup: remove disposable future occurrence only when explicitly authorized
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-CALENDAR-053

Admin Day view works.

- Area: `CALENDAR`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `calendar`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-AUTH-019`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CALENDAR-053-AC01
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
  - Admin Day view works.
  forbidden_effects:
  - silent browser-timezone mutation
  - duplicate occurrence
  - forbidden schedule acceptance
  - past occurrence rewrite
  evidence_profile: calendar_time
  cleanup: remove disposable future occurrence only when explicitly authorized
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-CALENDAR-054

Admin Agenda/List view works.

- Area: `CALENDAR`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `calendar`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-AUTH-019`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CALENDAR-054-AC01
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
  - Admin Agenda/List view works.
  forbidden_effects:
  - silent browser-timezone mutation
  - duplicate occurrence
  - forbidden schedule acceptance
  - past occurrence rewrite
  evidence_profile: calendar_time
  cleanup: remove disposable future occurrence only when explicitly authorized
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-CALENDAR-055

Parent Month/Week/List calendar works with Student filters.

- Area: `CALENDAR`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `calendar`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-AUTH-019`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CALENDAR-055-AC01
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
  - Parent Month/Week/List calendar works with Student filters.
  forbidden_effects:
  - silent browser-timezone mutation
  - duplicate occurrence
  - forbidden schedule acceptance
  - past occurrence rewrite
  evidence_profile: calendar_time
  cleanup: remove disposable future occurrence only when explicitly authorized
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-CALENDAR-056

Student Today/Week calendar works.

- Area: `CALENDAR`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `calendar`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-AUTH-019`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CALENDAR-056-AC01
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
  - Student Today/Week calendar works.
  forbidden_effects:
  - silent browser-timezone mutation
  - duplicate occurrence
  - forbidden schedule acceptance
  - past occurrence rewrite
  evidence_profile: calendar_time
  cleanup: remove disposable future occurrence only when explicitly authorized
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-CALENDAR-057

All dates are Gregorian/English.

- Area: `CALENDAR`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `calendar`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-AUTH-019`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CALENDAR-057-AC01
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
  - All dates are Gregorian/English.
  forbidden_effects:
  - silent browser-timezone mutation
  - duplicate occurrence
  - forbidden schedule acceptance
  - past occurrence rewrite
  evidence_profile: calendar_time
  cleanup: remove disposable future occurrence only when explicitly authorized
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-CALENDAR-058

Default schedule is Sunday-Thursday at 7pm Asia/Jerusalem.

- Area: `CALENDAR`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `calendar`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-AUTH-019`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CALENDAR-058-AC01
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
  - Default schedule is Sunday-Thursday at 7pm Asia/Jerusalem.
  forbidden_effects:
  - silent browser-timezone mutation
  - duplicate occurrence
  - forbidden schedule acceptance
  - past occurrence rewrite
  evidence_profile: calendar_time
  cleanup: remove disposable future occurrence only when explicitly authorized
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-CALENDAR-059

Friday-night and Saturday-night default scheduling is rejected.

- Area: `CALENDAR`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `calendar`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-AUTH-019`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CALENDAR-059-AC01
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
  - Friday-night and Saturday-night default scheduling is rejected.
  forbidden_effects:
  - silent browser-timezone mutation
  - duplicate occurrence
  - forbidden schedule acceptance
  - past occurrence rewrite
  evidence_profile: calendar_time
  cleanup: remove disposable future occurrence only when explicitly authorized
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-CALENDAR-060

Admins can set different permitted times.

- Area: `CALENDAR`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `calendar`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-AUTH-019`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CALENDAR-060-AC01
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
  - Admins can set different permitted times.
  forbidden_effects:
  - silent browser-timezone mutation
  - duplicate occurrence
  - forbidden schedule acceptance
  - past occurrence rewrite
  evidence_profile: calendar_time
  cleanup: remove disposable future occurrence only when explicitly authorized
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-CALENDAR-061

Recurring series, skip dates, and single/future edits work.

- Area: `CALENDAR`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `calendar`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-AUTH-019`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CALENDAR-061-AC01
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
  - Recurring series, skip dates, and single/future edits work.
  forbidden_effects:
  - silent browser-timezone mutation
  - duplicate occurrence
  - forbidden schedule acceptance
  - past occurrence rewrite
  evidence_profile: calendar_time
  cleanup: remove disposable future occurrence only when explicitly authorized
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-CALENDAR-062

DST/timezone behavior is correct.

- Area: `CALENDAR`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `calendar`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-AUTH-019`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CALENDAR-062-AC01
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
  - DST/timezone behavior is correct.
  forbidden_effects:
  - silent browser-timezone mutation
  - duplicate occurrence
  - forbidden schedule acceptance
  - past occurrence rewrite
  evidence_profile: calendar_time
  cleanup: remove disposable future occurrence only when explicitly authorized
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-CALENDAR-063

Calendar uses branded even cells and responsive layout.

- Area: `CALENDAR`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `calendar`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-AUTH-019`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CALENDAR-063-AC01
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
  - Calendar uses branded even cells and responsive layout.
  forbidden_effects:
  - silent browser-timezone mutation
  - duplicate occurrence
  - forbidden schedule acceptance
  - past occurrence rewrite
  evidence_profile: calendar_time
  cleanup: remove disposable future occurrence only when explicitly authorized
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-CALENDAR-064

No Google Calendar integration is required.

- Area: `CALENDAR`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `calendar`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-AUTH-019`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CALENDAR-064-AC01
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
  - parent_operator_canary
  - student_operator_canary_1
  preconditions:
  - production route/action/job inventory is generated from the exact candidate
  steps:
  - inspect navigation, direct routes, public assets, API/action inventory, configuration, and background jobs
  - attempt the prohibited or non-goal surface through a direct request
  expected_results:
  - No Google Calendar integration is required.
  - the non-goal surface is absent or returns the documented safe denial without a partial write
  forbidden_effects:
  - hidden-but-callable mutation
  - stale navigation
  - provider action from a retired subsystem
  evidence_profile: absence_inventory
  cleanup: remove only disposable operator-owned probe records; absence must remain
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
