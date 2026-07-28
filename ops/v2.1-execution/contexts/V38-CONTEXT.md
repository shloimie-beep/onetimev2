# V38 — UX, Parent, Student, Calendar, Support, and Copy Verification — Locked Context

**Outcome:** Verify role journeys, responsive/accessibility behavior, Parent/Student privacy boundaries, calendars, support, and exact approved copy against the immutable candidate.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `VERIFY_PORTALS_UX`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- Apply the exact task packet and execution contract.

## Dependency gates

- Start after: `I36`
- Full merge after: `None`
- Candidate integration partners (non-ordering): `None`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `ops/v2.1-execution/results/<candidate-digest>/V38/**`
- `ops/v2.1-execution/verification-harness/V38/**`

Scope notes below explain intent but do not grant additional path authority:

- verification-only branch codex/v21-verify-<candidate-short-sha>-v38

## Deliverables

- one schema-valid candidate-bound result record per assigned acceptance case
- lane summary with exact pass/fail/blocked counts
- zero unrecorded external effects
- reproduction packet for every failure

## Relevant locked decisions (23)

| Decision | Status | Exact decision |
|---|---|---|
| DEC-002 | LOCKED | One Time is standalone. It has its own application, database, sessions/cookies, provider configuration, failure domain, and release authority. It must not depend on BNA runtime state. |
| DEC-014 | LOCKED | Students never require or receive an email address. No Student is created as a HighLevel contact. |
| DEC-015 | LOCKED | A Parent creates and manages up to three active Student seats and can set or reset each Student username/password. Existing passwords are never displayed. |
| DEC-016 | LOCKED | A Parent account never receives Student-class, recording, question, or learning-library access. |
| DEC-022 | LOCKED | Parents cannot see private Student questions or Rabbi answers. They may see Parent-specific schedule, attendance/progress summaries, billing, notices, newsletter, reminders, and Student credential management. |
| DEC-033 | LOCKED | Before the fixed free-expiry instant, a Family signup receives immediate free access from the email/password submitted on the public form, creates one Parent/account-owner identity, and may create up to three Student seats. At or after expiry it creates an inactive account and continues to standard Checkout. |
| DEC-060 | LOCKED | The launch catalog has exactly one active published recurring 60-minute class, Sunday through Thursday at 7:00 p.m. `Asia/Jerusalem`. Occurrences generate on a rolling 90-day horizon, prepare automatically 24 hours before start (or manually earlier), open Student join 10 minutes before start, and auto-close 15 minutes after scheduled end unless an Admin closes or extends. Additional Admin-created series start `draft`, enroll nobody, and remain invisible until explicit activation. |
| DEC-062 | LOCKED | Parent and Student calendars display the canonical class automatically. |
| DEC-063 | LOCKED | The classroom is an embedded Zoom experience inside the authenticated Student portal. |
| DEC-075 | LOCKED | Content and transcription language is English only. No Hebrew UI or multilingual content-processing requirement exists at launch. |
| DEC-080 | LOCKED | Students may submit a Torah/class question to Rabbi Eli and may separately submit a technical support request. |
| DEC-082 | LOCKED | Student support remains inside One Time. A Student is never created as a GHL contact because of a support request. |
| DEC-092 | LOCKED | Resend sends account setup, password recovery, and security messages. |
| DEC-099 | LOCKED | Telegram is an internal Admin notification/action transport only. One Time remains source of truth, and Telegram payloads minimize Student/customer information. |
| DEC-110 | LOCKED | The canonical Parent class reminder is scheduled 30 minutes before start. Email and eventual WhatsApp service reminders go to the single household account owner, not to Students. |
| DEC-111 | LOCKED | Student devices receive in-app notices relevant to the Student. |
| DEC-121 | INFERRED | Student lifecycle is `active` or `archived`. Archived Students retain history, cannot authenticate, and do not consume an active seat. |
| DEC-126 | INFERRED | Support lifecycle is `open`, `in_progress`, `waiting_on_requester`, `resolved`, or `closed`. |
| DEC-130 | LOCKED | One Time uses its black, white, yellow, and restrained cyan identity. BNA branding and navigation do not appear. |
| DEC-131 | LOCKED | Launch UI and generated learning material are English only. Names accept Unicode, but there is no Hebrew interface requirement. |
| DEC-134 | INFERRED | Public and authenticated UI meets WCAG 2.2 AA and supports current Chrome, Safari, Edge, iPadOS Safari, and Android Chrome. |
| DEC-135 | INFERRED | Full Admin mutation workflows are supported on desktop and tablet. Mobile Admin supports urgent status, search, class/live controls, and simple edits; dense configuration may require tablet/desktop with clear messaging. |
| DEC-144 | DEFERRED | Class Helper, Buffer/social publishing, demos, preview routes, test lanes, Parent-created goals, editable badge rules, favorites, PWA push, and school-specific administration are not launch features. |

## Acceptance requirements and exact cases (58 requirements)


### OTV2-UX-158

Admin primary navigation is Dashboard, Contacts, Content, Classroom, Live Console.

- Area: `UX`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `design`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-003, OTV2-AUTH-019`
- Source references: `08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-UX-158-AC01
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
  - screen has representative populated, empty, loading, error, and denied states
  steps:
  - render the supported viewport/browser matrix
  - complete keyboard-only journey
  - inspect focus/name/role/state/contrast/reflow
  - capture candidate-bound screenshots
  expected_results:
  - Admin primary navigation is Dashboard, Contacts, Content, Classroom, Live Console.
  forbidden_effects:
  - viewport-level horizontal overflow
  - unlabeled control
  - focus loss
  - placeholder or unexplained disabled action
  evidence_profile: visual_accessibility
  cleanup: none
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-UX-159

Dashboard is an operating dashboard, not a first-run wizard.

- Area: `UX`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `design`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-003, OTV2-AUTH-019`
- Source references: `08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-UX-159-AC01
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
  - screen has representative populated, empty, loading, error, and denied states
  steps:
  - render the supported viewport/browser matrix
  - complete keyboard-only journey
  - inspect focus/name/role/state/contrast/reflow
  - capture candidate-bound screenshots
  expected_results:
  - Dashboard is an operating dashboard, not a first-run wizard.
  forbidden_effects:
  - viewport-level horizontal overflow
  - unlabeled control
  - focus loss
  - placeholder or unexplained disabled action
  evidence_profile: visual_accessibility
  cleanup: none
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-UX-160

Calendar has left categories, top filters, even branded cells, and responsive details.

- Area: `UX`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `design`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-003, OTV2-AUTH-019`
- Source references: `08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-UX-160-AC01
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
  - screen has representative populated, empty, loading, error, and denied states
  steps:
  - render the supported viewport/browser matrix
  - complete keyboard-only journey
  - inspect focus/name/role/state/contrast/reflow
  - capture candidate-bound screenshots
  expected_results:
  - Calendar has left categories, top filters, even branded cells, and responsive details.
  forbidden_effects:
  - viewport-level horizontal overflow
  - unlabeled control
  - focus loss
  - placeholder or unexplained disabled action
  evidence_profile: visual_accessibility
  cleanup: none
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-UX-161

Dashboard Next Class and Needs Attention modules and the class-scoped leaderboard display real persistent data.

- Area: `UX`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `design`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-003, OTV2-AUTH-019`
- Source references: `08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-UX-161-AC01
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
  - screen has representative populated, empty, loading, error, and denied states
  steps:
  - render the supported viewport/browser matrix
  - complete keyboard-only journey
  - inspect focus/name/role/state/contrast/reflow
  - capture candidate-bound screenshots
  expected_results:
  - Dashboard Next Class and Needs Attention modules and the class-scoped leaderboard display real persistent data.
  forbidden_effects:
  - viewport-level horizontal overflow
  - unlabeled control
  - focus loss
  - placeholder or unexplained disabled action
  evidence_profile: visual_accessibility
  cleanup: none
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-UX-162

No Hebrew dates appear.

- Area: `UX`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `design`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-003, OTV2-AUTH-019`
- Source references: `08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-UX-162-AC01
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
  - screen has representative populated, empty, loading, error, and denied states
  steps:
  - render the supported viewport/browser matrix
  - complete keyboard-only journey
  - inspect focus/name/role/state/contrast/reflow
  - capture candidate-bound screenshots
  expected_results:
  - No Hebrew dates appear.
  forbidden_effects:
  - viewport-level horizontal overflow
  - unlabeled control
  - focus loss
  - placeholder or unexplained disabled action
  evidence_profile: visual_accessibility
  cleanup: none
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-UX-163

No disabled control lacks explanation.

- Area: `UX`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `design`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-003, OTV2-AUTH-019`
- Source references: `08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-UX-163-AC01
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
  - screen has representative populated, empty, loading, error, and denied states
  steps:
  - render the supported viewport/browser matrix
  - complete keyboard-only journey
  - inspect focus/name/role/state/contrast/reflow
  - capture candidate-bound screenshots
  expected_results:
  - No disabled control lacks explanation.
  forbidden_effects:
  - viewport-level horizontal overflow
  - unlabeled control
  - focus loss
  - placeholder or unexplained disabled action
  evidence_profile: visual_accessibility
  cleanup: none
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-UX-164

Desktop, tablet, 360px, keyboard, reduced motion, and reflow pass.

- Area: `UX`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `design`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-003, OTV2-AUTH-019`
- Source references: `08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-UX-164-AC01
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
  - screen has representative populated, empty, loading, error, and denied states
  steps:
  - render the supported viewport/browser matrix
  - complete keyboard-only journey
  - inspect focus/name/role/state/contrast/reflow
  - capture candidate-bound screenshots
  expected_results:
  - Desktop, tablet, 360px, keyboard, reduced motion, and reflow pass.
  forbidden_effects:
  - viewport-level horizontal overflow
  - unlabeled control
  - focus loss
  - placeholder or unexplained disabled action
  evidence_profile: visual_accessibility
  cleanup: none
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-UX-165

No BNA visual leakage appears.

- Area: `UX`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `design`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-003, OTV2-AUTH-019`
- Source references: `08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-UX-165-AC01
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
  - screen has representative populated, empty, loading, error, and denied states
  steps:
  - render the supported viewport/browser matrix
  - complete keyboard-only journey
  - inspect focus/name/role/state/contrast/reflow
  - capture candidate-bound screenshots
  expected_results:
  - No BNA visual leakage appears.
  forbidden_effects:
  - viewport-level horizontal overflow
  - unlabeled control
  - focus loss
  - placeholder or unexplained disabled action
  evidence_profile: visual_accessibility
  cleanup: none
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-UX-204

Launch UI and generated learning output are English-only while names accept Unicode.

- Area: `UX`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `design`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-003, OTV2-AUTH-019`
- Source references: `08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-UX-204-AC01
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
  - screen has representative populated, empty, loading, error, and denied states
  steps:
  - render the supported viewport/browser matrix
  - complete keyboard-only journey
  - inspect focus/name/role/state/contrast/reflow
  - capture candidate-bound screenshots
  expected_results:
  - Launch UI and generated learning output are English-only while names accept Unicode.
  forbidden_effects:
  - viewport-level horizontal overflow
  - unlabeled control
  - focus loss
  - placeholder or unexplained disabled action
  evidence_profile: visual_accessibility
  cleanup: none
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-PARENT-031

Parent sees only the linked household.

- Area: `PARENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `parent_application`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-FOUNDATION-003`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-PARENT-031-AC01
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
  - Parent sees only the linked household.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-PARENT-032

Parent can add up to three active Students.

- Area: `PARENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `parent_application`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-FOUNDATION-003`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-PARENT-032-AC01
  kind: concurrency
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
  - Parent can add up to three active Students.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-PARENT-033

Parent sees the actual-name instruction.

- Area: `PARENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `parent_application`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-FOUNDATION-003`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-PARENT-033-AC01
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
  - Parent sees the actual-name instruction.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-PARENT-034

Parent can edit Student actual/display name.

- Area: `PARENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `parent_application`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-FOUNDATION-003`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-PARENT-034-AC01
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
  - Parent can edit Student actual/display name.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-PARENT-035

Parent can change Student username and password.

- Area: `PARENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `parent_application`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-FOUNDATION-003`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-PARENT-035-AC01
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
  - Parent can change Student username and password.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-PARENT-036

Parent can archive/restore a Student within the active limit.

- Area: `PARENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `parent_application`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-FOUNDATION-003`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-PARENT-036-AC01
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
  - Parent can archive/restore a Student within the active limit.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-PARENT-040

Parent cannot access another household or Admin actions.

- Area: `PARENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `parent_application`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-FOUNDATION-003`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-PARENT-040-AC01
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
  - Parent cannot access another household or Admin actions.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

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

### OTV2-STUDENT-041

Student sees only self.

- Area: `STUDENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `student_application`
- Semantic acceptance dependencies: `OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-STUDENT-041-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
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
  - real actor, target resource, and denial-scope fixture exist
  steps:
  - sign in as the named actor
  - perform the visible action
  - refresh and sign in again to prove persistence
  - repeat against sibling/cross-household/wrong-role target
  expected_results:
  - Student sees only self.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-STUDENT-042

Student Today view works.

- Area: `STUDENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `student_application`
- Semantic acceptance dependencies: `OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-STUDENT-042-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
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
  - real actor, target resource, and denial-scope fixture exist
  steps:
  - sign in as the named actor
  - perform the visible action
  - refresh and sign in again to prove persistence
  - repeat against sibling/cross-household/wrong-role target
  expected_results:
  - Student Today view works.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-STUDENT-043

Student Calendar view works.

- Area: `STUDENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `student_application`
- Semantic acceptance dependencies: `OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-STUDENT-043-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
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
  - real actor, target resource, and denial-scope fixture exist
  steps:
  - sign in as the named actor
  - perform the visible action
  - refresh and sign in again to prove persistence
  - repeat against sibling/cross-household/wrong-role target
  expected_results:
  - Student Calendar view works.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-STUDENT-044

Student Join Class works.

- Area: `STUDENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `student_application`
- Semantic acceptance dependencies: `OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-STUDENT-044-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
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
  - real actor, target resource, and denial-scope fixture exist
  steps:
  - sign in as the named actor
  - perform the visible action
  - refresh and sign in again to prove persistence
  - repeat against sibling/cross-household/wrong-role target
  expected_results:
  - Student Join Class works.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-STUDENT-045

Student Library/playback works.

- Area: `STUDENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `student_application`
- Semantic acceptance dependencies: `OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-STUDENT-045-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
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
  - real actor, target resource, and denial-scope fixture exist
  steps:
  - sign in as the named actor
  - perform the visible action
  - refresh and sign in again to prove persistence
  - repeat against sibling/cross-household/wrong-role target
  expected_results:
  - Student Library/playback works.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-STUDENT-046

Student Progress/rewards works.

- Area: `STUDENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `student_application`
- Semantic acceptance dependencies: `OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-STUDENT-046-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
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
  - real actor, target resource, and denial-scope fixture exist
  steps:
  - sign in as the named actor
  - perform the visible action
  - refresh and sign in again to prove persistence
  - repeat against sibling/cross-household/wrong-role target
  expected_results:
  - Student Progress/rewards works.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-STUDENT-047

Student private Questions works.

- Area: `STUDENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `student_application`
- Semantic acceptance dependencies: `OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-STUDENT-047-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
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
  - real actor, target resource, and denial-scope fixture exist
  steps:
  - sign in as the named actor
  - perform the visible action
  - refresh and sign in again to prove persistence
  - repeat against sibling/cross-household/wrong-role target
  expected_results:
  - Student private Questions works.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-STUDENT-048

Student Updates works.

- Area: `STUDENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `student_application`
- Semantic acceptance dependencies: `OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-STUDENT-048-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
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
  - real actor, target resource, and denial-scope fixture exist
  steps:
  - sign in as the named actor
  - perform the visible action
  - refresh and sign in again to prove persistence
  - repeat against sibling/cross-household/wrong-role target
  expected_results:
  - Student Updates works.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-STUDENT-049

Student cannot see sibling/private Parent/Admin data.

- Area: `STUDENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `student_application`
- Semantic acceptance dependencies: `OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-STUDENT-049-AC01
  kind: negative
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
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
  - real actor, target resource, and denial-scope fixture exist
  steps:
  - sign in as the named actor
  - perform the visible action
  - refresh and sign in again to prove persistence
  - repeat against sibling/cross-household/wrong-role target
  expected_results:
  - Student cannot see sibling/private Parent/Admin data.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-STUDENT-050

Student credentials are managed by Parent/Admin.

- Area: `STUDENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `student_application`
- Semantic acceptance dependencies: `OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-STUDENT-050-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
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
  - real actor, target resource, and denial-scope fixture exist
  steps:
  - sign in as the named actor
  - perform the visible action
  - refresh and sign in again to prove persistence
  - repeat against sibling/cross-household/wrong-role target
  expected_results:
  - Student credentials are managed by Parent/Admin.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

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

### OTV2-EMAIL-139

Rabbi emails begin Hi {{contact.first_name}}.

- Area: `EMAIL`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `communications`
- Semantic acceptance dependencies: `OTV2-GHL-120, OTV2-GHL-121, OTV2-GHL-122`
- Source references: `09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md, 10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-EMAIL-139-AC01
  kind: positive
  environment:
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_rabbi_eli
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - template variables and intended actor/audience are defined
  steps:
  - render with representative real seed data
  - inspect subject/body/CTA/sender/reply-to
  - verify every destination
  - record named approval and content digest
  - deliver one seed
  expected_results:
  - Rabbi emails begin Hi {{contact.first_name}}.
  forbidden_effects:
  - missing variable
  - wrong destination
  - unapproved broad send
  - content changed after approval
  evidence_profile: copy_human_approval
  cleanup: none beyond seed reconciliation
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-EMAIL-140

Rabbi emails end Hatzlacha, Rabbi Eli Scheller, One Time Mishnayos.

- Area: `EMAIL`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `communications`
- Semantic acceptance dependencies: `OTV2-GHL-120, OTV2-GHL-121, OTV2-GHL-122`
- Source references: `09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md, 10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-EMAIL-140-AC01
  kind: positive
  environment:
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_rabbi_eli
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - template variables and intended actor/audience are defined
  steps:
  - render with representative real seed data
  - inspect subject/body/CTA/sender/reply-to
  - verify every destination
  - record named approval and content digest
  - deliver one seed
  expected_results:
  - Rabbi emails end Hatzlacha, Rabbi Eli Scheller, One Time Mishnayos.
  forbidden_effects:
  - missing variable
  - wrong destination
  - unapproved broad send
  - content changed after approval
  evidence_profile: copy_human_approval
  cleanup: none beyond seed reconciliation
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-EMAIL-141

Rabbi copy is brief, personal, confident, Torah-centered, and one-CTA.

- Area: `EMAIL`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `communications`
- Semantic acceptance dependencies: `OTV2-GHL-120, OTV2-GHL-121, OTV2-GHL-122`
- Source references: `09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md, 10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-EMAIL-141-AC01
  kind: positive
  environment:
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_rabbi_eli
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - template variables and intended actor/audience are defined
  steps:
  - render with representative real seed data
  - inspect subject/body/CTA/sender/reply-to
  - verify every destination
  - record named approval and content digest
  - deliver one seed
  expected_results:
  - Rabbi copy is brief, personal, confident, Torah-centered, and one-CTA.
  forbidden_effects:
  - missing variable
  - wrong destination
  - unapproved broad send
  - content changed after approval
  evidence_profile: copy_human_approval
  cleanup: none beyond seed reconciliation
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-EMAIL-142

Operational email is direct and useful.

- Area: `EMAIL`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `communications`
- Semantic acceptance dependencies: `OTV2-GHL-120, OTV2-GHL-121, OTV2-GHL-122`
- Source references: `09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md, 10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-EMAIL-142-AC01
  kind: positive
  environment:
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_rabbi_eli
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - template variables and intended actor/audience are defined
  steps:
  - render with representative real seed data
  - inspect subject/body/CTA/sender/reply-to
  - verify every destination
  - record named approval and content digest
  - deliver one seed
  expected_results:
  - Operational email is direct and useful.
  forbidden_effects:
  - missing variable
  - wrong destination
  - unapproved broad send
  - content changed after approval
  evidence_profile: copy_human_approval
  cleanup: none beyond seed reconciliation
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-EMAIL-143

Token-bearing setup/reset email is Resend-only.

- Area: `EMAIL`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `communications`
- Semantic acceptance dependencies: `OTV2-GHL-120, OTV2-GHL-121, OTV2-GHL-122`
- Source references: `09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md, 10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-EMAIL-143-AC01
  kind: positive
  environment:
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_rabbi_eli
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - template variables and intended actor/audience are defined
  steps:
  - render with representative real seed data
  - inspect subject/body/CTA/sender/reply-to
  - verify every destination
  - record named approval and content digest
  - deliver one seed
  expected_results:
  - Token-bearing setup/reset email is Resend-only.
  forbidden_effects:
  - missing variable
  - wrong destination
  - unapproved broad send
  - content changed after approval
  evidence_profile: copy_human_approval
  cleanup: none beyond seed reconciliation
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-EMAIL-144

Marketing campaigns send only after exact Admin copy approval.

- Area: `EMAIL`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `communications`
- Semantic acceptance dependencies: `OTV2-GHL-120, OTV2-GHL-121, OTV2-GHL-122`
- Source references: `09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md, 10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-EMAIL-144-AC01
  kind: positive
  environment:
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_rabbi_eli
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - template variables and intended actor/audience are defined
  steps:
  - render with representative real seed data
  - inspect subject/body/CTA/sender/reply-to
  - verify every destination
  - record named approval and content digest
  - deliver one seed
  expected_results:
  - Marketing campaigns send only after exact Admin copy approval.
  forbidden_effects:
  - missing variable
  - wrong destination
  - unapproved broad send
  - content changed after approval
  evidence_profile: copy_human_approval
  cleanup: none beyond seed reconciliation
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-EMAIL-145

Active migration and former reactivation are intended to start immediately after approval.

- Area: `EMAIL`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `communications`
- Semantic acceptance dependencies: `OTV2-GHL-120, OTV2-GHL-121, OTV2-GHL-122`
- Source references: `09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md, 10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-EMAIL-145-AC01
  kind: positive
  environment:
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_rabbi_eli
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - template variables and intended actor/audience are defined
  steps:
  - render with representative real seed data
  - inspect subject/body/CTA/sender/reply-to
  - verify every destination
  - record named approval and content digest
  - deliver one seed
  expected_results:
  - Active migration and former reactivation are intended to start immediately after approval.
  forbidden_effects:
  - missing variable
  - wrong destination
  - unapproved broad send
  - content changed after approval
  evidence_profile: copy_human_approval
  cleanup: none beyond seed reconciliation
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-EMAIL-146

Parent newsletter is adult-only and consented.

- Area: `EMAIL`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `communications`
- Semantic acceptance dependencies: `OTV2-GHL-120, OTV2-GHL-121, OTV2-GHL-122`
- Source references: `09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md, 10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-EMAIL-146-AC01
  kind: positive
  environment:
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_rabbi_eli
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - template variables and intended actor/audience are defined
  steps:
  - render with representative real seed data
  - inspect subject/body/CTA/sender/reply-to
  - verify every destination
  - record named approval and content digest
  - deliver one seed
  expected_results:
  - Parent newsletter is adult-only and consented.
  forbidden_effects:
  - missing variable
  - wrong destination
  - unapproved broad send
  - content changed after approval
  evidence_profile: copy_human_approval
  cleanup: none beyond seed reconciliation
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
