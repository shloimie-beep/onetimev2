# P22 — Questions, Announcements, Badges, Leaderboard, and Recognition — Locked Context

**Outcome:** Implement private Rabbi questions, announcements, fixed launch badges, attendance/question/review recognition, streaks, consent-aware aliases, and basic scoped leaderboards.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `LEARNING_ENGAGEMENT`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- Apply the exact task packet and execution contract.

## Dependency gates

- Start after: `F02, F05, F07`
- Full merge after: `F02, F05, F07`
- Candidate integration partners (non-ordering): `P14, P18, P21, P32`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `apps/web/src/client/app/admin/learning/**`
- `apps/web/src/client/app/student/learning/**`
- `apps/web/src/server/features/learning/**`
- `packages/contracts/src/gamification/**`
- `packages/contracts/src/learning/**`
- `packages/db/src/gamification/**`
- `packages/db/src/learning/**`
- `packages/domain/src/gamification/**`
- `packages/domain/src/learning/**`

Scope notes below explain intent but do not grant additional path authority:

- packages/db/src/learning/** except migrations and central index
- packages/db/src/gamification/** except migrations and central index
- learning/recognition/privacy-boundary tests
- steward requests for route/migration/registration changes

## Deliverables

- private question and Rabbi-answer lifecycle
- announcement delivery/read state
- fixed launch badge and streak rules
- scoped leaderboard with stable alias behavior

## Relevant locked decisions (9)

| Decision | Status | Exact decision |
|---|---|---|
| DEC-069 | LOCKED | Attendance is recorded and visible in appropriate Admin, Parent-summary, and Student views. Reconnects are merged; manual corrections require Admin audit. |
| DEC-080 | LOCKED | Students may submit a Torah/class question to Rabbi Eli and may separately submit a technical support request. |
| DEC-081 | LOCKED | Student questions remain private from Parents. A question may be marked for class/publication only by an Admin/Rabbi. |
| DEC-083 | LOCKED | Launch goals are system-defined: attend class consistently, ask meaningful questions, and attend/complete the review. Parent-created goals are deferred. |
| DEC-084 | LOCKED | Launch rewards are badges only. There is no redeemable currency or reward catalog. |
| DEC-085 | INFERRED | Badge levels are fixed configuration at launch: Consistency I/II/III at 5/20/60 consecutive scheduled attendances; Curious Learner I/II/III at 1/5/15 questions answered or approved for class; Review Ready I/II/III at 1/4/12 completed review events. Admin badge editing is deferred. |
| DEC-086 | INFERRED | The leaderboard has separate rolling-30-day categories for attendance count, current attendance streak, and questions approved/published. It does not calculate a vague combined score. |
| DEC-087 | INFERRED | Member-visible leaderboard recognition is a separate optional scope and defaults off. With consent, display uses first name plus last initial. Without or after withdrawal, the Student remains ranked; self sees `You` and peers see a stable class-scoped nonidentifying alias. Full actual names remain available only to authorized Admins and within the live classroom. |
| DEC-125 | INFERRED | Question lifecycle is `submitted`, `answered_private`, `approved_for_class`, `published`, `closed`, or `declined`. |

## Acceptance requirements and exact cases (11 requirements)


### OTV2-LEARNING-093

Attendance, minutes, and progress are stored by Student.

- Area: `LEARNING`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `learning`
- Semantic acceptance dependencies: `OTV2-STUDENT-041, OTV2-CLASSROOM-078`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-LEARNING-093-AC01
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
  - admin_rabbi_eli
  - parent_operator_canary
  - student_operator_canary_1
  - denial_household
  - admin_shloimie
  preconditions:
  - real Student learning events and class scope exist
  steps:
  - create the qualifying event
  - read back the Student calculation/state
  - exercise correction or tie/empty branch
  - verify Parent/Student/Admin projections and denials
  expected_results:
  - Attendance, minutes, and progress are stored by Student.
  forbidden_effects:
  - cross-Student private data
  - unexplained point currency
  - public leaderboard
  - unaudited manual correction
  evidence_profile: learning_domain
  cleanup: reverse only operator-canary awards with an audited reason
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-LEARNING-094

Fixed launch badges for attendance consistency, approved/answered questions, and review completion are scoped and auditable.

- Area: `LEARNING`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `learning`
- Semantic acceptance dependencies: `OTV2-STUDENT-041, OTV2-CLASSROOM-078`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-LEARNING-094-AC01
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
  - admin_rabbi_eli
  - parent_operator_canary
  - student_operator_canary_1
  - denial_household
  - admin_shloimie
  preconditions:
  - real Student learning events and class scope exist
  steps:
  - create the qualifying event
  - read back the Student calculation/state
  - exercise correction or tie/empty branch
  - verify Parent/Student/Admin projections and denials
  expected_results:
  - Fixed launch badges for attendance consistency, approved/answered questions, and review completion are scoped
    and auditable.
  forbidden_effects:
  - cross-Student private data
  - unexplained point currency
  - public leaderboard
  - unaudited manual correction
  evidence_profile: learning_domain
  cleanup: reverse only operator-canary awards with an audited reason
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-LEARNING-095

Authenticated class leaderboards separately show rolling attendance count, current attendance streak, and approved/published question count.

- Area: `LEARNING`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `learning`
- Semantic acceptance dependencies: `OTV2-STUDENT-041, OTV2-CLASSROOM-078`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-LEARNING-095-AC01
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
  - admin_rabbi_eli
  - parent_operator_canary
  - student_operator_canary_1
  - denial_household
  - admin_shloimie
  preconditions:
  - real Student learning events and class scope exist
  steps:
  - create the qualifying event
  - read back the Student calculation/state
  - exercise correction or tie/empty branch
  - verify Parent/Student/Admin projections and denials
  expected_results:
  - Authenticated class leaderboards separately show rolling attendance count, current attendance streak, and approved/published
    question count.
  forbidden_effects:
  - cross-Student private data
  - unexplained point currency
  - public leaderboard
  - unaudited manual correction
  evidence_profile: learning_domain
  cleanup: reverse only operator-canary awards with an audited reason
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-LEARNING-096

Student submits private question.

- Area: `LEARNING`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `learning`
- Semantic acceptance dependencies: `OTV2-STUDENT-041, OTV2-CLASSROOM-078`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-LEARNING-096-AC01
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
  - admin_rabbi_eli
  - parent_operator_canary
  - student_operator_canary_1
  - denial_household
  - admin_shloimie
  preconditions:
  - real Student learning events and class scope exist
  steps:
  - create the qualifying event
  - read back the Student calculation/state
  - exercise correction or tie/empty branch
  - verify Parent/Student/Admin projections and denials
  expected_results:
  - Student submits private question.
  forbidden_effects:
  - cross-Student private data
  - unexplained point currency
  - public leaderboard
  - unaudited manual correction
  evidence_profile: learning_domain
  cleanup: reverse only operator-canary awards with an audited reason
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-LEARNING-097

Rabbi/Admin answers question.

- Area: `LEARNING`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `learning`
- Semantic acceptance dependencies: `OTV2-STUDENT-041, OTV2-CLASSROOM-078`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-LEARNING-097-AC01
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
  - admin_rabbi_eli
  - parent_operator_canary
  - student_operator_canary_1
  - denial_household
  - admin_shloimie
  preconditions:
  - real Student learning events and class scope exist
  steps:
  - create the qualifying event
  - read back the Student calculation/state
  - exercise correction or tie/empty branch
  - verify Parent/Student/Admin projections and denials
  expected_results:
  - Rabbi/Admin answers question.
  forbidden_effects:
  - cross-Student private data
  - unexplained point currency
  - public leaderboard
  - unaudited manual correction
  evidence_profile: learning_domain
  cleanup: reverse only operator-canary awards with an audited reason
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-LEARNING-098

Moderated class publication works.

- Area: `LEARNING`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `learning`
- Semantic acceptance dependencies: `OTV2-STUDENT-041, OTV2-CLASSROOM-078`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-LEARNING-098-AC01
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
  - admin_rabbi_eli
  - parent_operator_canary
  - student_operator_canary_1
  - denial_household
  - admin_shloimie
  preconditions:
  - real Student learning events and class scope exist
  steps:
  - create the qualifying event
  - read back the Student calculation/state
  - exercise correction or tie/empty branch
  - verify Parent/Student/Admin projections and denials
  expected_results:
  - Moderated class publication works.
  forbidden_effects:
  - cross-Student private data
  - unexplained point currency
  - public leaderboard
  - unaudited manual correction
  evidence_profile: learning_domain
  cleanup: reverse only operator-canary awards with an audited reason
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-LEARNING-099

No open student-to-student chat exists.

- Area: `LEARNING`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `learning`
- Semantic acceptance dependencies: `OTV2-STUDENT-041, OTV2-CLASSROOM-078`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-LEARNING-099-AC01
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
  - admin_rabbi_eli
  - parent_operator_canary
  - student_operator_canary_1
  - denial_household
  - admin_shloimie
  preconditions:
  - real Student learning events and class scope exist
  steps:
  - create the qualifying event
  - read back the Student calculation/state
  - exercise correction or tie/empty branch
  - verify Parent/Student/Admin projections and denials
  expected_results:
  - No open student-to-student chat exists.
  forbidden_effects:
  - cross-Student private data
  - unexplained point currency
  - public leaderboard
  - unaudited manual correction
  evidence_profile: learning_domain
  cleanup: reverse only operator-canary awards with an audited reason
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-LEARNING-100

Announcements support program/class/Parent/Student scopes.

- Area: `LEARNING`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `learning`
- Semantic acceptance dependencies: `OTV2-STUDENT-041, OTV2-CLASSROOM-078`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-LEARNING-100-AC01
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
  - admin_rabbi_eli
  - parent_operator_canary
  - student_operator_canary_1
  - denial_household
  - admin_shloimie
  preconditions:
  - real Student learning events and class scope exist
  steps:
  - create the qualifying event
  - read back the Student calculation/state
  - exercise correction or tie/empty branch
  - verify Parent/Student/Admin projections and denials
  expected_results:
  - Announcements support program/class/Parent/Student scopes.
  forbidden_effects:
  - cross-Student private data
  - unexplained point currency
  - public leaderboard
  - unaudited manual correction
  evidence_profile: learning_domain
  cleanup: reverse only operator-canary awards with an audited reason
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-LEARNING-196

Fixed Consistency, Curious Learner, and Review Ready badge thresholds are calculated and auditable; Review Ready counts one unique completion per Admin-published review item without a correctness or score threshold.

- Area: `LEARNING`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `learning`
- Semantic acceptance dependencies: `OTV2-STUDENT-041, OTV2-CLASSROOM-078`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 03-DECISION-REGISTER-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-LEARNING-196-AC01
  kind: negative
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  - student
  - parent
  fixtures:
  - admin_rabbi_eli
  - parent_operator_canary
  - student_operator_canary_1
  - denial_household
  - admin_shloimie
  preconditions:
  - real Student learning events and class scope exist
  steps:
  - create the qualifying event
  - read back the Student calculation/state
  - exercise correction or tie/empty branch
  - verify Parent/Student/Admin projections and denials
  expected_results:
  - Fixed Consistency, Curious Learner, and Review Ready badge thresholds are calculated and auditable; Review Ready
    counts one unique completion per Admin-published review item without a correctness or score threshold.
  forbidden_effects:
  - cross-Student private data
  - unexplained point currency
  - public leaderboard
  - unaudited manual correction
  evidence_profile: learning_domain
  cleanup: reverse only operator-canary awards with an audited reason
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-LEARNING-197

Rolling-30-day leaderboard categories show attendance count, attendance streak, and approved/published question count using safe member-visible names.

- Area: `LEARNING`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `learning`
- Semantic acceptance dependencies: `OTV2-STUDENT-041, OTV2-CLASSROOM-078`
- Source references: `03-DECISION-REGISTER-v2.1.md, 10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-LEARNING-197-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - student
  - admin
  fixtures:
  - admin_rabbi_eli
  - parent_operator_canary
  - student_operator_canary_1
  - denial_household
  - admin_shloimie
  preconditions:
  - real Student learning events and class scope exist
  steps:
  - create the qualifying event
  - read back the Student calculation/state
  - exercise correction or tie/empty branch
  - verify Parent/Student/Admin projections and denials
  expected_results:
  - Rolling-30-day leaderboard categories show attendance count, attendance streak, and approved/published question
    count using safe member-visible names.
  forbidden_effects:
  - cross-Student private data
  - unexplained point currency
  - public leaderboard
  - unaudited manual correction
  evidence_profile: learning_domain
  cleanup: reverse only operator-canary awards with an audited reason
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-LEARNING-238

A question contributes one Curious Learner recognition event at first answer or class approval, later publication cannot double-count, correction recalculates, and recognition-consent changes only the member-visible name or stable alias.

- Area: `LEARNING`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `learning`
- Semantic acceptance dependencies: `OTV2-STUDENT-041, OTV2-CLASSROOM-078, OTV2-LEARNING-094, OTV2-LEARNING-095, OTV2-LEARNING-196, OTV2-LEARNING-197`
- Source references: `06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md, 10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-LEARNING-238-QUESTION-DEDUPE
  kind: calculation
  environment: &id001
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  - student
  - parent
  fixtures:
  - admin_rabbi_eli
  - parent_operator_canary
  - student_operator_canary_1
  - denial_household
  - admin_shloimie
  preconditions:
  - real Student learning events and class scope exist
  steps:
  - move one question through answered_private, approved_for_class, and published with repeated events at each state
  - read back recognition ledger, Curious Learner badge, and question leaderboard after every transition
  - revoke/correct the qualifying state and recalculate twice
  expected_results:
  - the question contributes exactly one event at first answered_private or approved_for_class
  - later approval/publication and replay do not increment it again
  - correction deterministically removes or restores the projection and repeated recalculation is stable
  forbidden_effects:
  - double count
  - publication increment
  - unaudited manual points
  - Parent private-question access
  evidence_profile: learning_domain
  cleanup: reverse only operator-canary awards with an audited reason
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
- case_id: OTV2-LEARNING-238-RECOGNITION-CONSENT
  kind: privacy_projection
  environment: *id001
  actors:
  - student
  - parent
  fixtures:
  - admin_rabbi_eli
  - parent_operator_canary
  - student_operator_canary_1
  - denial_household
  preconditions:
  - real Student learning events and class scope exist
  steps:
  - with recognition consent default-off, view the same ranking as the subject Student and another Student
  - opt in and inspect name rendering, then withdraw and inspect again
  - repeat across sessions and verify class scoping
  expected_results:
  - consent default is off; the subject sees You and peers see a stable class-scoped alias such as Anonymous Student
    • A7
  - opt-in shows first name plus last initial and withdrawal returns to alias without removing rank or rewriting
    learning facts
  - the alias is stable within the class and is not a global identifier
  forbidden_effects:
  - full name
  - rank removal for nonconsent
  - consent inferred from service use
  - cross-class stable identifier
  evidence_profile: learning_domain
  cleanup: reverse only operator-canary awards with an audited reason
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
