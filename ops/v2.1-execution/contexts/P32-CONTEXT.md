# P32 — Consent, Privacy, Data Rights, Retention, Redaction, and Purge Ledger — Locked Context

**Outcome:** Implement current authority/recording consent, privacy controls, export/correction/deletion flows, retention schedules, redaction, cryptographic purge evidence, and child-data safeguards.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `PRIVACY_DATA_RIGHTS`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- Apply the exact task packet and execution contract.

## Dependency gates

- Start after: `F02, F03, F04, F05, F07`
- Full merge after: `F02, F03, F04, F05, F07`
- Candidate integration partners (non-ordering): `F06, P10, P12, P18, P22`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `apps/web/src/client/app/admin/privacy/**`
- `apps/web/src/client/app/parent/privacy/**`
- `apps/web/src/server/features/privacy/**`
- `apps/worker/src/runners/privacy-retention/**`
- `packages/contracts/src/privacy/**`
- `packages/db/src/privacy/**`
- `packages/domain/src/privacy/**`

Scope notes below explain intent but do not grant additional path authority:

- packages/db/src/privacy/** except migrations and central index
- consent/export/delete/retention/redaction tests
- steward requests for config/route/worker/migration changes

## Deliverables

- authority and recording-consent ledger
- data rights request lifecycle
- retention/redaction/purge jobs and audit ledger
- safe Parent/Student/Admin privacy UI

## Relevant locked decisions (8)

| Decision | Status | Exact decision |
|---|---|---|
| DEC-016 | LOCKED | A Parent account never receives Student-class, recording, question, or learning-library access. |
| DEC-021 | INFERRED | Household ownership may be transferred through an Admin-assisted, verified email transfer. Transfer cannot complete while the outgoing adult has an active `self` Student in that household: it must first be archived or moved, with identity/history preserved, to another household the outgoing adult owns with an available seat. It is never auto-converted or given to the replacement. Dependent Students remain only after the replacement records current authority and required recording consent for each. The replacement accepts current policies and prior-owner household sessions are revoked. |
| DEC-022 | LOCKED | Parents cannot see private Student questions or Rabbi answers. They may see Parent-specific schedule, attendance/progress summaries, billing, notices, newsletter, reminders, and Student credential management. |
| DEC-030 | LOCKED | Learner age is not restricted by product rules. The account owner decides whom to create as a Student. |
| DEC-031 | INFERRED | Launch has no learner age range and collects no Student date of birth, age, age band, or grade. Student relationship is only `self` or `dependent`. A `self` learner is the adult account owner using a Student seat; for `dependent`, the legally capable account owner attests that they are authorized to manage the Student and provide required consent. |
| DEC-068 | LOCKED | Student voice and video may be captured only after versioned account-owner consent. OBS is the sole launch recording source and Zoom cloud recording is disabled. Admin verifies the consent-gated roster and visible/verbal recording notice, starts/stops OBS, transfers the encrypted local file by direct upload or dedicated Drive within 24 hours, and deletes the local copy only after durable checksum readback. |
| DEC-081 | LOCKED | Student questions remain private from Parents. A question may be marked for class/publication only by an Admin/Rabbi. |
| DEC-087 | INFERRED | Member-visible leaderboard recognition is a separate optional scope and defaults off. With consent, display uses first name plus last initial. Without or after withdrawal, the Student remains ranked; self sees `You` and peers see a stable class-scoped nonidentifying alias. Full actual names remain available only to authorized Admins and within the live classroom. |

## Acceptance requirements and exact cases (5 requirements)


### OTV2-CONSENT-189

Versioned recording consent is required for the exact Student before joining a recorded class containing Student audio or video: the account owner consents for a dependent Student and the matching verified adult identity consents directly for a self-managed adult Student; protected playback authorization does not depend on recording consent.

- Area: `CONSENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `privacy`
- Semantic acceptance dependencies: `OTV2-AUTH-007, OTV2-PARENT-032`
- Source references: `10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CONSENT-189-DEPENDENT-STUDENT
  kind: consent_boundary
  environment: &id001
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - parent
  - student
  fixtures:
  - parent_operator_canary
  - student_operator_canary_1
  preconditions:
  - current policy versions and authorized account owner exist
  steps:
  - create a dependent Student without accepting the current recording-consent version and attempt recorded-class
    join
  - as the sole household account owner, review the exact scope/consequence copy and accept for that Student
  - join the recorded class, then withdraw that consent and attempt a later recorded-class join
  - open an otherwise-authorized published recording before and after withdrawal
  expected_results:
  - recorded-class join is blocked until the account owner records current authority and recording consent for that
    exact dependent Student
  - acceptance stores actor, Student, scope, policy version, timestamp, and evidence and then permits join
  - withdrawal blocks later recorded-class join but does not independently revoke authorized protected playback
  forbidden_effects:
  - household-wide inferred consent
  - join without Student-scoped consent
  - Student accepting dependent authority
  - playback coupled to recording consent
  evidence_profile: privacy_consent
  cleanup: follow the retention/deletion table and preserve minimal legal/security evidence
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
- case_id: OTV2-CONSENT-189-SELF-MANAGED-ADULT-STUDENT
  kind: consent_boundary
  environment: *id001
  actors:
  - parent
  - student
  fixtures:
  - parent_operator_canary
  - student_operator_canary_3
  - denial_household
  preconditions:
  - current policy versions and authorized account owner exist
  steps:
  - create the self-managed adult Student bound to the matching verified adult identity and keep recording consent
    unaccepted
  - attempt to accept the self scope from an unrelated Parent/account-owner context and attempt recorded-class join
  - authenticate as the matching adult identity, accept the current recording-consent scope, and join with the separate
    Student credentials
  - withdraw as the same verified adult identity and attempt a later recorded-class join while checking protected
    playback
  expected_results:
  - the Parent/account-owner cannot consent on behalf of a self-managed adult Student
  - only the matching verified adult identity can accept or withdraw that exact Student scope
  - current self-consent permits recorded-class join; withdrawal blocks a later recorded-class join but does not
    independently revoke otherwise-authorized protected playback
  forbidden_effects:
  - Parent proxy self-consent
  - identity mismatch
  - join without current self-consent
  - playback coupled to recording consent
  evidence_profile: privacy_consent
  cleanup: follow the retention/deletion table and preserve minimal legal/security evidence
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-PRIVACY-212

Versioned consent, retention, export, correction, deletion request, withdrawal, and provider-cascade rules are enforced.

- Area: `PRIVACY`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `privacy`
- Semantic acceptance dependencies: `OTV2-CONSENT-189, OTV2-AUTH-020`
- Source references: `10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-PRIVACY-212-AC01
  kind: positive
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  - parent
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - current policy versions and authorized account owner exist
  steps:
  - accept the exact policy
  - read back actor/scope/version/time
  - exercise missing/withdrawn consent
  - perform export/correction/deletion or provider-cascade case as applicable
  expected_results:
  - Versioned consent, retention, export, correction, deletion request, withdrawal, and provider-cascade rules are
    enforced.
  forbidden_effects:
  - recorded-class access without consent
  - cross-household data
  - raw child data in logs/Telegram
  - deletion that removes required suppression/audit tombstone
  evidence_profile: privacy_consent
  cleanup: follow the retention/deletion table and preserve minimal legal/security evidence
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-PRIVACY-221

Parents cannot view private Student questions or Rabbi answers; leaderboard recognition is separate opt-in consent and nonconsenting Students remain ranked under a stable nonidentifying class alias.

- Area: `PRIVACY`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `privacy`
- Semantic acceptance dependencies: `OTV2-CONSENT-189, OTV2-AUTH-020`
- Source references: `05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-PRIVACY-221-AC01
  kind: negative
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - parent
  - student
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - current policy versions and authorized account owner exist
  steps:
  - accept the exact policy
  - read back actor/scope/version/time
  - exercise missing/withdrawn consent
  - perform export/correction/deletion or provider-cascade case as applicable
  expected_results:
  - Parents cannot view private Student questions or Rabbi answers; leaderboard recognition is separate opt-in consent
    and nonconsenting Students remain ranked under a stable nonidentifying class alias.
  forbidden_effects:
  - recorded-class access without consent
  - cross-household data
  - raw child data in logs/Telegram
  - deletion that removes required suppression/audit tombstone
  evidence_profile: privacy_consent
  cleanup: follow the retention/deletion table and preserve minimal legal/security evidence
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-PRIVACY-239

Parent and self-managed adult Student privacy/data-rights screens enforce actor scope, recent-password reauthentication, separate consent consequence previews, request statuses, 15-minute one-time downloads, closure-versus-erasure, and reviewed dependent requests.

- Area: `PRIVACY`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `privacy`
- Semantic acceptance dependencies: `OTV2-CONSENT-189, OTV2-AUTH-020, OTV2-PRIVACY-212, OTV2-PRIVACY-221`
- Source references: `05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md, 08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md, 10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-PRIVACY-239-ACTOR-ROUTES
  kind: authorization_matrix
  environment: &id001
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - parent
  - student
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - current policy versions and authorized account owner exist
  steps:
  - open Parent privacy/data-rights routes and inspect separate scopes and consequence previews
  - open the same Student routes as a self-managed adult Student
  - attempt the routes and APIs as a dependent Student, sibling, wrong household, and Parent seeking ordinary private-body
    export
  expected_results:
  - Parent and verified self-managed adult Student see only their authorized scope
  - dependent Students have no self-service routes and a Parent uses a separately reviewed dependent request
  - ordinary Parent export excludes private dependent question/support bodies
  forbidden_effects:
  - dependent self-service route
  - cross-household request
  - private-body inclusion
  - bundled consent withdrawal
  evidence_profile: privacy_consent
  cleanup: follow the retention/deletion table and preserve minimal legal/security evidence
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
- case_id: OTV2-PRIVACY-239-REQUEST-WORKFLOW
  kind: state_transition
  environment: *id001
  actors:
  - admin
  - parent
  - student
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - current policy versions and authorized account owner exist
  steps:
  - attempt request creation without then with recent-password reauthentication
  - drive separate export, closure, erasure, and dependent-reviewed requests through requested, processing, and
    every terminal status
  - redeem a completed download once before 15 minutes, reuse it, and attempt after 15 minutes
  - withdraw each optional consent independently after reading the consequence preview
  expected_results:
  - recent-password reauthentication is required and statuses are exactly requested, processing, completed, partially_excepted,
    or failed
  - download is one-time and expires after 15 minutes; closure never masquerades as erasure
  - each consent withdrawal changes only its own scope and provider cascades/status are visible
  forbidden_effects:
  - reusable download
  - closure recorded as erasure
  - silent exception
  - cross-scope consent withdrawal
  evidence_profile: privacy_consent
  cleanup: follow the retention/deletion table and preserve minimal legal/security evidence
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-PRIVACY-240

Recorded-class participant snapshots, shared-media retention/redaction, deterministic adult-self and dependent-Student rights, provider cascades, orphan handling, and an independent append-only purge ledger enforce the exact privacy contract without collecting or inferring age.

- Area: `PRIVACY`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `privacy`
- Semantic acceptance dependencies: `OTV2-CONSENT-189, OTV2-AUTH-020, OTV2-PRIVACY-212`
- Source references: `06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md, 13-OPERATIONS-SLO-DR-INCIDENT-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-PRIVACY-240-SNAPSHOT-REDACTION
  kind: privacy_lifecycle
  environment: &id001
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
  - student_operator_canary_3
  - denial_household
  preconditions:
  - current policy versions and authorized account owner exist
  steps:
  - start a recorded occurrence and freeze the versioned participant/consent snapshot
  - change a live household/Student consent and identity after start and verify the historical snapshot does not
    mutate
  - request rights for an adult self-managed Student and a dependent Student represented by the account owner, including
    each subject's shared-media branch
  - perform required transcript/caption/worksheet/knowledge redaction and video/audio restriction, then verify all
    published/search derivatives
  expected_results:
  - the occurrence retains the exact participants, relationship, applicable consent versions, and notice state at
    recording start
  - deterministic subject-right rules preserve other participants while redacting/restricting the requesting subject
    as required
  - the rights decision uses relationship and verified authority without collecting or inferring age
  - mandatory redaction propagates to every derivative and search index before republish
  forbidden_effects:
  - mutable historical snapshot
  - whole-class deletion without rule
  - unredacted derivative
  - playback tied to recording consent
  evidence_profile: privacy_consent
  cleanup: follow the retention/deletion table and preserve minimal legal/security evidence
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
- case_id: OTV2-PRIVACY-240-RETENTION-PURGE-LEDGER
  kind: deletion_verification
  environment: *id001
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  - student_operator_canary_1
  - student_operator_canary_3
  - denial_household
  preconditions:
  - current policy versions and authorized account owner exist
  steps:
  - execute closure without erasure and inspect retained/blocked access
  - execute an eligible erasure through local and provider cascades including orphaned-provider branches
  - inspect the independent append-only purge ledger and restore an older backup into isolation
  - prove deleted content is absent and the deletion request is reapplied or honored after restore
  expected_results:
  - closure disables access but does not falsely claim deletion; erasure follows exact legal/security exceptions
    and shared-media treatment
  - the purge ledger is separate from primary backups, contains hashes/metadata but no deleted content, and proves
    provider outcomes
  - backup restore cannot resurrect usable erased data
  forbidden_effects:
  - deleted content in purge ledger
  - silent orphan
  - resurrected erased data
  - suppression/security tombstone deletion
  evidence_profile: privacy_consent
  cleanup: follow the retention/deletion table and preserve minimal legal/security evidence
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
