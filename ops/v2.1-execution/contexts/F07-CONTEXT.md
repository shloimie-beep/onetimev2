# F07 — Design System, App Shells, Navigation, and Accessibility — Locked Context

**Outcome:** Deliver responsive, polished, accessible public and authenticated shells, canonical route navigation, design tokens, and interactive-state primitives.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `DESIGN_SYSTEM`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- Terra may implement frozen design contracts but must escalate schema, security, billing, privacy, or provider-authority decisions.

## Dependency gates

- Start after: `F01`
- Full merge after: `F01`
- Candidate integration partners (non-ordering): `None`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `apps/web/src/client/styles/v21/**`
- `packages/brand-system/**`

Scope notes below explain intent but do not grant additional path authority:

- shared AppShell/WorkspaceTabs/navigation primitives
- shared/global CSS and route-branding inventory
- responsive/accessibility/interaction primitive tests
- steward requests for root route registration only

## Deliverables

- canonical visual tokens and UI primitives
- role-appropriate responsive shells
- keyboard/focus/error/loading/empty state patterns
- WCAG 2.2 AA design and interaction foundation

## Relevant locked decisions (5)

| Decision | Status | Exact decision |
|---|---|---|
| DEC-075 | LOCKED | Content and transcription language is English only. No Hebrew UI or multilingual content-processing requirement exists at launch. |
| DEC-130 | LOCKED | One Time uses its black, white, yellow, and restrained cyan identity. BNA branding and navigation do not appear. |
| DEC-131 | LOCKED | Launch UI and generated learning material are English only. Names accept Unicode, but there is no Hebrew interface requirement. |
| DEC-134 | INFERRED | Public and authenticated UI meets WCAG 2.2 AA and supports current Chrome, Safari, Edge, iPadOS Safari, and Android Chrome. |
| DEC-135 | INFERRED | Full Admin mutation workflows are supported on desktop and tablet. Mobile Admin supports urgent status, search, class/live controls, and simple edits; dense configuration may require tablet/desktop with clear messaging. |

## Acceptance requirements and exact cases (9 requirements)


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
