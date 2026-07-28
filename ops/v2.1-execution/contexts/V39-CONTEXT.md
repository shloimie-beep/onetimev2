# V39 — Schema, Jobs, Classroom, Zoom, and Content Verification — Locked Context

**Outcome:** Verify schema/state invariants, jobs, canonical enrollment, embedded Zoom, attendance, upload/processing/publication/playback, and denial paths against the immutable candidate.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `VERIFY_CLASSROOM_CONTENT`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- Apply the exact task packet and execution contract.

## Dependency gates

- Start after: `I36`
- Full merge after: `None`
- Candidate integration partners (non-ordering): `None`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `ops/v2.1-execution/results/<candidate-digest>/V39/**`
- `ops/v2.1-execution/verification-harness/V39/**`

Scope notes below explain intent but do not grant additional path authority:

- verification-only branch codex/v21-verify-<candidate-short-sha>-v39

## Deliverables

- one schema-valid candidate-bound result record per assigned acceptance case
- lane summary with exact pass/fail/blocked counts
- zero unrecorded external effects
- reproduction packet for every failure

## Relevant locked decisions (29)

| Decision | Status | Exact decision |
|---|---|---|
| DEC-016 | LOCKED | A Parent account never receives Student-class, recording, question, or learning-library access. |
| DEC-055 | INFERRED | Local account creation commits first with a durable outbox. Resend and unambiguous GHL effects retry asynchronously. GHL ambiguity is a visible CRM-link quarantine; provider failure must not create duplicate accounts, silently broaden access, or lose the local signup. |
| DEC-060 | LOCKED | The launch catalog has exactly one active published recurring 60-minute class, Sunday through Thursday at 7:00 p.m. `Asia/Jerusalem`. Occurrences generate on a rolling 90-day horizon, prepare automatically 24 hours before start (or manually earlier), open Student join 10 minutes before start, and auto-close 15 minutes after scheduled end unless an Admin closes or extends. Additional Admin-created series start `draft`, enroll nobody, and remain invisible until explicit activation. |
| DEC-061 | LOCKED | Every active Student is immediately enrolled in the canonical class. No enrollment request or Admin approval is required for the launch class. |
| DEC-062 | LOCKED | Parent and Student calendars display the canonical class automatically. |
| DEC-063 | LOCKED | The classroom is an embedded Zoom experience inside the authenticated Student portal. |
| DEC-064 | LOCKED | Each Student receives a Student-specific, single-use 60-second embedded-class bootstrap and no transferable join bearer. No raw Zoom join URL is stored in browser-visible URLs, email, GHL, logs, or UI. |
| DEC-065 | LOCKED | Waiting room, participant renaming, participant screen sharing, participant file transfer, and participant chat are disabled for the canonical class. Students are muted on join. |
| DEC-066 | LOCKED | A Student may join while the occurrence is open; there is no product-level “too late” rejection while the live occurrence remains open. |
| DEC-067 | INFERRED | Only one concurrent live classroom session is allowed per Student. Its device lease heartbeats every 30 seconds and expires after 90 seconds without heartbeat; reconnect on the same device/session is permitted. A second device is denied with a clear message; an Admin may revoke/reset the lease. |
| DEC-068 | LOCKED | Student voice and video may be captured only after versioned account-owner consent. OBS is the sole launch recording source and Zoom cloud recording is disabled. Admin verifies the consent-gated roster and visible/verbal recording notice, starts/stops OBS, transfers the encrypted local file by direct upload or dedicated Drive within 24 hours, and deletes the local copy only after durable checksum readback. |
| DEC-069 | LOCKED | Attendance is recorded and visible in appropriate Admin, Parent-summary, and Student views. Reconnects are merged; manual corrections require Admin audit. |
| DEC-070 | LOCKED | An Admin can drag and drop a recording directly into the application. |
| DEC-071 | LOCKED | A monitored Drive incoming folder is also supported. Both sources enter the same deduplicated content pipeline. |
| DEC-072 | LOCKED | The pipeline compresses/resizes the OBS recording under versioned launch profile `OT-VIDEO-1`, transcribes it, prepares review material/worksheet drafts, prepares a future knowledge-base artifact, and prepares private Vimeo publication. `OT-VIDEO-1` is MP4/H.264/AAC, maximum 1080p/30 fps without upscaling, H.264 CRF 23 medium preset, AAC-LC 48 kHz stereo at 128 kbps, and web fast-start. |
| DEC-073 | INFERRED | Direct app uploads are streamed into managed staging and represented in the same content-source model as Drive files. A checksum prevents duplicate processing across app and Drive ingestion. |
| DEC-074 | INFERRED | Launch supports files up to 5 GiB with bounded memory, resumable or safely restartable transfer, pagination, checksums, and visible retry/dead-letter recovery. |
| DEC-075 | LOCKED | Content and transcription language is English only. No Hebrew UI or multilingual content-processing requirement exists at launch. |
| DEC-076 | LOCKED | Transcript, worksheet, knowledge-base, trim, captions, and publication outputs are drafts until an Admin approves them. |
| DEC-077 | LOCKED | Student playback uses a five-minute renewable authorization through the protected One Time surface backed by private Vimeo access. Raw Vimeo URLs are not exposed. Playback requires access, enrollment/assignment, and published state, not recording-participation consent. |
| DEC-078 | INFERRED | Launch library search covers title, English transcript text, date, class/topic, and structured Mishnah references when available. Favorites are deferred. Basic resume playback is included. |
| DEC-079 | INFERRED | Durable direct-upload staging is private versioned SSE-KMS AWS S3 in `eu-central-1`, with public access blocked and multipart uploads. English transcription uses OpenAI `gpt-4o-transcribe`; worksheet/review/knowledge drafts use the OpenAI Responses API with `gpt-4.1-mini` Structured Outputs. Model, prompt, glossary, and schema versions are pinned per content version and every output remains human-approved. |
| DEC-120 | INFERRED | Human account lifecycle is `invited`, `active`, `disabled`, `archived`. “Archived” is retained history and cannot log in; “disabled” is reversible access suspension. |
| DEC-121 | INFERRED | Student lifecycle is `active` or `archived`. Archived Students retain history, cannot authenticate, and do not consume an active seat. |
| DEC-122 | INFERRED | Product access lifecycle is `free`, `active`, `grace`, `inactive`. In `inactive`, the exact restricted Parent route allowlist in DEC-047 remains available; Student access does not. |
| DEC-123 | INFERRED | Class occurrence lifecycle is `scheduled`, `preparing`, `ready`, `live`, `completed`, or `canceled`. Draft recurrence edits exist at the series level, not as visible fake occurrences. |
| DEC-124 | INFERRED | Content lifecycle is `received`, `validating`, `processing`, `needs_review`, `approved`, `publishing`, `published`, `failed`, or `archived`. |
| DEC-125 | INFERRED | Question lifecycle is `submitted`, `answered_private`, `approved_for_class`, `published`, `closed`, or `declined`. |
| DEC-126 | INFERRED | Support lifecycle is `open`, `in_progress`, `waiting_on_requester`, `resolved`, or `closed`. |

## Acceptance requirements and exact cases (46 requirements)


### OTV2-STATE-202

Account, Student, access, occurrence, content, question, support, and billing transitions enforce the canonical state tables.

- Area: `STATE`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `domain`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-AUTH-019`
- Source references: `06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-STATE-202-AC01
  kind: positive
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
  - submit the authorized operation
  - double-submit and send a stale version
  - inject timeout/acceptance-unknown
  - reconcile or safely reprocess through governed controls
  expected_results:
  - Account, Student, access, occurrence, content, question, support, and billing transitions enforce the canonical
    state tables.
  forbidden_effects:
  - duplicate external effect
  - unfenced worker completion
  - blind retry with new key
  - PII or bearer in URL
  evidence_profile: api_job_saga
  cleanup: reconcile every effect and clear only disposable operator-owned work
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-API-217

Every production route has a typed request/response/error contract, server-derived scope, idempotency/concurrency behavior, and no PII or bearer credential in URLs.

- Area: `API`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `api`
- Semantic acceptance dependencies: `OTV2-AUTH-020, OTV2-FOUNDATION-001`
- Source references: `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-API-217-AC01
  kind: negative
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
  - submit the authorized operation
  - double-submit and send a stale version
  - inject timeout/acceptance-unknown
  - reconcile or safely reprocess through governed controls
  expected_results:
  - Every production route has a typed request/response/error contract, server-derived scope, idempotency/concurrency
    behavior, and no PII or bearer credential in URLs.
  forbidden_effects:
  - duplicate external effect
  - unfenced worker completion
  - blind retry with new key
  - PII or bearer in URL
  evidence_profile: api_job_saga
  cleanup: reconcile every effect and clear only disposable operator-owned work
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-JOBS-210

Prepare Class and other external-effect operations use durable versioned sagas with idempotent retry and partial-failure visibility.

- Area: `JOBS`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `worker`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-OPS-171`
- Source references: `06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-JOBS-210-AC01
  kind: positive
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
  - submit the authorized operation
  - double-submit and send a stale version
  - inject timeout/acceptance-unknown
  - reconcile or safely reprocess through governed controls
  expected_results:
  - Prepare Class and other external-effect operations use durable versioned sagas with idempotent retry and partial-failure
    visibility.
  forbidden_effects:
  - duplicate external effect
  - unfenced worker completion
  - blind retry with new key
  - PII or bearer in URL
  evidence_profile: api_job_saga
  cleanup: reconcile every effect and clear only disposable operator-owned work
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-JOBS-211

Provider timeouts after dispatch enter acceptance-unknown quarantine and are reconciled before retry.

- Area: `JOBS`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `worker`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-OPS-171`
- Source references: `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-JOBS-211-AC01
  kind: positive
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
  - submit the authorized operation
  - double-submit and send a stale version
  - inject timeout/acceptance-unknown
  - reconcile or safely reprocess through governed controls
  expected_results:
  - Provider timeouts after dispatch enter acceptance-unknown quarantine and are reconciled before retry.
  forbidden_effects:
  - duplicate external effect
  - unfenced worker completion
  - blind retry with new key
  - PII or bearer in URL
  evidence_profile: api_job_saga
  cleanup: reconcile every effect and clear only disposable operator-owned work
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

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

### OTV2-CLASSROOM-068

Prepare Class & Send Access validates occurrence and roster.

- Area: `CLASSROOM`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `classroom`
- Semantic acceptance dependencies: `OTV2-CALENDAR-058, OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CLASSROOM-068-AC01
  kind: concurrency
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
  - Prepare Class & Send Access validates occurrence and roster.
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

### OTV2-CLASSROOM-069

One app-owned Zoom meeting is created per occurrence.

- Area: `CLASSROOM`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `classroom`
- Semantic acceptance dependencies: `OTV2-CALENDAR-058, OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CLASSROOM-069-AC01
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
  - One app-owned Zoom meeting is created per occurrence.
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

### OTV2-CLASSROOM-070

One separate Zoom registrant is created per Student.

- Area: `CLASSROOM`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `classroom`
- Semantic acceptance dependencies: `OTV2-CALENDAR-058, OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CLASSROOM-070-AC01
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
  - One separate Zoom registrant is created per Student.
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

### OTV2-CLASSROOM-071

Student portals receive secure Join Class state.

- Area: `CLASSROOM`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `classroom`
- Semantic acceptance dependencies: `OTV2-CALENDAR-058, OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CLASSROOM-071-AC01
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
  - Student portals receive secure Join Class state.
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

### OTV2-CLASSROOM-072

Parent class reminders label affected Students and use safe app links without authenticating a Student or exposing a raw Zoom URL.

- Area: `CLASSROOM`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `classroom`
- Semantic acceptance dependencies: `OTV2-CALENDAR-058, OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CLASSROOM-072-AC01
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
  - Parent class reminders label affected Students and use safe app links without authenticating a Student or exposing
    a raw Zoom URL.
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

### OTV2-CLASSROOM-074

Students join muted.

- Area: `CLASSROOM`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `classroom`
- Semantic acceptance dependencies: `OTV2-CALENDAR-058, OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CLASSROOM-074-AC01
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
  - Students join muted.
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

### OTV2-CLASSROOM-076

Three separate tablet joins pass.

- Area: `CLASSROOM`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `classroom`
- Semantic acceptance dependencies: `OTV2-CALENDAR-058, OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CLASSROOM-076-AC01
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
  - Three separate tablet joins pass.
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

### OTV2-CLASSROOM-077

Sibling/cross-household join is denied.

- Area: `CLASSROOM`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `classroom`
- Semantic acceptance dependencies: `OTV2-CALENDAR-058, OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CLASSROOM-077-AC01
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
  - Sibling/cross-household join is denied.
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

### OTV2-CLASSROOM-079

Old disposable Zoom canary cleanup does not block normal classroom use.

- Area: `CLASSROOM`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `classroom`
- Semantic acceptance dependencies: `OTV2-CALENDAR-058, OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CLASSROOM-079-AC01
  kind: negative
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - admin
  - student
  fixtures:
  - admin_shloimie
  - student_operator_canary_1
  preconditions:
  - production route/action/job inventory is generated from the exact candidate
  steps:
  - inspect navigation and visible controls
  - attempt direct route and API access
  - inspect workers, webhooks, configuration, and scheduled jobs
  - confirm historical records are outside runtime
  expected_results:
  - Old disposable Zoom canary cleanup does not block normal classroom use.
  forbidden_effects:
  - hidden-but-callable mutation
  - stale navigation
  - provider action from a retired subsystem
  evidence_profile: absence_inventory
  cleanup: remove only disposable operator-owned probe records; absence must remain
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-CLASSROOM-188

Canonical Zoom settings disable waiting room, participant rename, participant chat, participant screen sharing, and participant file transfer.

- Area: `CLASSROOM`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `classroom`
- Semantic acceptance dependencies: `OTV2-CALENDAR-058, OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CLASSROOM-188-AC01
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
  - Canonical Zoom settings disable waiting room, participant rename, participant chat, participant screen sharing,
    and participant file transfer.
  forbidden_effects:
  - raw Zoom URL exposure
  - shared bearer credential
  - duplicate meeting
  - cross-Student join
  - blind retry after unknown acceptance
  evidence_profile: zoom_classroom
  cleanup: reconcile and remove disposable provider resources without blocking normal classroom paths
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-CLASSROOM-073

An authorized Student can join while the live occurrence remains open; no product-level late rejection occurs.

- Area: `CLASSROOM`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `classroom`
- Semantic acceptance dependencies: `OTV2-CALENDAR-058, OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CLASSROOM-073-AC01
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
  - An authorized Student can join while the live occurrence remains open; no product-level late rejection occurs.
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

### OTV2-CLASSROOM-075

Participant video is available, camera guidance is shown, and recorded Student audio/video requires versioned account-owner consent.

- Area: `CLASSROOM`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `classroom`
- Semantic acceptance dependencies: `OTV2-CALENDAR-058, OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CLASSROOM-075-AC01
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
  - Participant video is available, camera guidance is shown, and recorded Student audio/video requires versioned
    account-owner consent.
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

### OTV2-CLASSROOM-078

Attendance minutes and percentage are recorded.

- Area: `CLASSROOM`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `classroom`
- Semantic acceptance dependencies: `OTV2-CALENDAR-058, OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CLASSROOM-078-AC01
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
  - Attendance minutes and percentage are recorded.
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

### OTV2-CLASSROOM-187

Only one concurrent embedded classroom session is allowed per Student; same-session reconnect works and second-device join is denied.

- Area: `CLASSROOM`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `classroom`
- Semantic acceptance dependencies: `OTV2-CALENDAR-058, OTV2-AUTH-008, OTV2-PARENT-032`
- Source references: `03-DECISION-REGISTER-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CLASSROOM-187-AC01
  kind: negative
  environment:
  - ci
  - provider_sandbox
  - production_operator_canary
  actors:
  - student
  - admin
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
  - Only one concurrent embedded classroom session is allowed per Student; same-session reconnect works and second-device
    join is denied.
  forbidden_effects:
  - raw Zoom URL exposure
  - shared bearer credential
  - duplicate meeting
  - cross-Student join
  - blind retry after unknown acceptance
  evidence_profile: zoom_classroom
  cleanup: reconcile and remove disposable provider resources without blocking normal classroom paths
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-CLASSROOM-232

The canonical 60-minute occurrence uses the 90-day horizon, 24-hour preparation, 30-minute reminder, 10-minute join opening, end-plus-15-minute close, 60-second join bootstrap, and 30-second heartbeat/90-second single-device lease.

- Area: `CLASSROOM`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `classroom`
- Semantic acceptance dependencies: `OTV2-CALENDAR-058, OTV2-AUTH-008, OTV2-PARENT-032, OTV2-CLASSROOM-184, OTV2-CLASSROOM-187, OTV2-CLASSROOM-188`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CLASSROOM-232-TIMING
  kind: time_boundary
  environment: &id001
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
  - generate the rolling horizon and prove it contains the canonical Sunday–Thursday 7 p.m. Jerusalem occurrences
    through 90 days
  - observe automatic preparation at 24 hours, reminder at 30 minutes, Join opening at 10 minutes, 60-minute scheduled
    end, and closure at end plus 15 minutes
  - exercise a manual earlier preparation and repeat every scheduler delivery
  expected_results:
  - all boundaries use the authoritative occurrence/Jerusalem clock and occur at most once
  - manual earlier preparation is allowed but does not duplicate resources or notifications
  - a Student may join any time the occurrence remains open; there is no product-level late rejection
  forbidden_effects:
  - rolling local-time drift
  - duplicate occurrence/resource/reminder
  - join before window
  - join after close
  evidence_profile: zoom_classroom
  cleanup: reconcile and remove disposable provider resources without blocking normal classroom paths
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
- case_id: OTV2-CLASSROOM-232-BOOTSTRAP-LEASE
  kind: concurrency
  environment: *id001
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
  - issue a Student-bound class bootstrap and redeem it before then after 60 seconds
  - join one tablet and send 30-second heartbeats while reading the 90-second lease
  - attempt a second-device join, then stop heartbeats and reconnect after lease expiry
  - perform an audited Admin reset and reconnect
  expected_results:
  - the bootstrap is single-use, bearer-free outside the exchange, and expires at 60 seconds
  - one device owns the 90-second renewable lease; same-session reconnect works and second-device join is denied
  - lease expiry or Admin reset permits a new authorized acquisition without overlapping active leases
  forbidden_effects:
  - raw Zoom URL
  - reusable bootstrap
  - two concurrent Student devices
  - unbounded lease
  evidence_profile: zoom_classroom
  cleanup: reconcile and remove disposable provider resources without blocking normal classroom paths
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-CONTENT-080

OBS is the normal recording source.

- Area: `CONTENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `content`
- Semantic acceptance dependencies: `OTV2-CLASSROOM-066, OTV2-AUTH-008`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CONTENT-080-AC01
  kind: positive
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
  - student_operator_canary_1
  - parent_operator_canary
  preconditions:
  - operator-controlled English representative recording is available
  - Drive/Vimeo/storage authority is explicit
  steps:
  - ingest through the named source
  - observe validation/compression/transcript/draft states
  - approve and publish
  - play through an authorized Student route and then test revoke/unpublish
  expected_results:
  - OBS is the normal recording source.
  forbidden_effects:
  - whole-file in-process buffering
  - duplicate processing
  - publication before approval
  - raw Vimeo URL exposure
  - sibling playback
  evidence_profile: content_pipeline
  cleanup: reconcile provider assets and retain/delete source and derivatives according to retention policy
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-CONTENT-081

Google Drive private intake detects stable uploads idempotently.

- Area: `CONTENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `content`
- Semantic acceptance dependencies: `OTV2-CLASSROOM-066, OTV2-AUTH-008`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CONTENT-081-AC01
  kind: recovery
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
  - student_operator_canary_1
  - parent_operator_canary
  preconditions:
  - operator-controlled English representative recording is available
  - Drive/Vimeo/storage authority is explicit
  steps:
  - ingest through the named source
  - observe validation/compression/transcript/draft states
  - approve and publish
  - play through an authorized Student route and then test revoke/unpublish
  expected_results:
  - Google Drive private intake detects stable uploads idempotently.
  forbidden_effects:
  - whole-file in-process buffering
  - duplicate processing
  - publication before approval
  - raw Vimeo URL exposure
  - sibling playback
  evidence_profile: content_pipeline
  cleanup: reconcile provider assets and retain/delete source and derivatives according to retention policy
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-CONTENT-082

Admin can match recording to occurrence.

- Area: `CONTENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `content`
- Semantic acceptance dependencies: `OTV2-CLASSROOM-066, OTV2-AUTH-008`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CONTENT-082-AC01
  kind: positive
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
  - student_operator_canary_1
  - parent_operator_canary
  preconditions:
  - operator-controlled English representative recording is available
  - Drive/Vimeo/storage authority is explicit
  steps:
  - ingest through the named source
  - observe validation/compression/transcript/draft states
  - approve and publish
  - play through an authorized Student route and then test revoke/unpublish
  expected_results:
  - Admin can match recording to occurrence.
  forbidden_effects:
  - whole-file in-process buffering
  - duplicate processing
  - publication before approval
  - raw Vimeo URL exposure
  - sibling playback
  evidence_profile: content_pipeline
  cleanup: reconcile provider assets and retain/delete source and derivatives according to retention policy
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-CONTENT-083

Original recording is preserved.

- Area: `CONTENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `content`
- Semantic acceptance dependencies: `OTV2-CLASSROOM-066, OTV2-AUTH-008`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CONTENT-083-AC01
  kind: positive
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
  - student_operator_canary_1
  - parent_operator_canary
  preconditions:
  - operator-controlled English representative recording is available
  - Drive/Vimeo/storage authority is explicit
  steps:
  - ingest through the named source
  - observe validation/compression/transcript/draft states
  - approve and publish
  - play through an authorized Student route and then test revoke/unpublish
  expected_results:
  - Original recording is preserved.
  forbidden_effects:
  - whole-file in-process buffering
  - duplicate processing
  - publication before approval
  - raw Vimeo URL exposure
  - sibling playback
  evidence_profile: content_pipeline
  cleanup: reconcile provider assets and retain/delete source and derivatives according to retention policy
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-CONTENT-190

Admin can drag and drop a recording directly into the application and see durable upload/processing state.

- Area: `CONTENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `content`
- Semantic acceptance dependencies: `OTV2-CLASSROOM-066, OTV2-AUTH-008`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CONTENT-190-AC01
  kind: positive
  environment:
  - ci
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - student_operator_canary_1
  preconditions:
  - operator-controlled English representative recording is available
  - Drive/Vimeo/storage authority is explicit
  steps:
  - ingest through the named source
  - observe validation/compression/transcript/draft states
  - approve and publish
  - play through an authorized Student route and then test revoke/unpublish
  expected_results:
  - Admin can drag and drop a recording directly into the application and see durable upload/processing state.
  forbidden_effects:
  - whole-file in-process buffering
  - duplicate processing
  - publication before approval
  - raw Vimeo URL exposure
  - sibling playback
  evidence_profile: content_pipeline
  cleanup: reconcile provider assets and retain/delete source and derivatives according to retention policy
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-CONTENT-192

Direct upload and Drive intake share one checksum-based deduplicated processing pipeline.

- Area: `CONTENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `content`
- Semantic acceptance dependencies: `OTV2-CLASSROOM-066, OTV2-AUTH-008`
- Source references: `06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CONTENT-192-AC01
  kind: positive
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
  - submit the authorized operation
  - double-submit and send a stale version
  - inject timeout/acceptance-unknown
  - reconcile or safely reprocess through governed controls
  expected_results:
  - Direct upload and Drive intake share one checksum-based deduplicated processing pipeline.
  forbidden_effects:
  - duplicate external effect
  - unfenced worker completion
  - blind retry with new key
  - PII or bearer in URL
  evidence_profile: api_job_saga
  cleanup: reconcile every effect and clear only disposable operator-owned work
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-CONTENT-084

Admin can trim beginning and end.

- Area: `CONTENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `content`
- Semantic acceptance dependencies: `OTV2-CLASSROOM-066, OTV2-AUTH-008`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CONTENT-084-AC01
  kind: positive
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
  - student_operator_canary_1
  - parent_operator_canary
  preconditions:
  - operator-controlled English representative recording is available
  - Drive/Vimeo/storage authority is explicit
  steps:
  - ingest through the named source
  - observe validation/compression/transcript/draft states
  - approve and publish
  - play through an authorized Student route and then test revoke/unpublish
  expected_results:
  - Admin can trim beginning and end.
  forbidden_effects:
  - whole-file in-process buffering
  - duplicate processing
  - publication before approval
  - raw Vimeo URL exposure
  - sibling playback
  evidence_profile: content_pipeline
  cleanup: reconcile provider assets and retain/delete source and derivatives according to retention policy
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-CONTENT-085

Transcript and captions are generated.

- Area: `CONTENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `content`
- Semantic acceptance dependencies: `OTV2-CLASSROOM-066, OTV2-AUTH-008`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CONTENT-085-AC01
  kind: positive
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
  - student_operator_canary_1
  - parent_operator_canary
  preconditions:
  - operator-controlled English representative recording is available
  - Drive/Vimeo/storage authority is explicit
  steps:
  - ingest through the named source
  - observe validation/compression/transcript/draft states
  - approve and publish
  - play through an authorized Student route and then test revoke/unpublish
  expected_results:
  - Transcript and captions are generated.
  forbidden_effects:
  - whole-file in-process buffering
  - duplicate processing
  - publication before approval
  - raw Vimeo URL exposure
  - sibling playback
  evidence_profile: content_pipeline
  cleanup: reconcile provider assets and retain/delete source and derivatives according to retention policy
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-CONTENT-086

Review questions/materials are draftable and editable.

- Area: `CONTENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `content`
- Semantic acceptance dependencies: `OTV2-CLASSROOM-066, OTV2-AUTH-008`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CONTENT-086-AC01
  kind: positive
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
  - student_operator_canary_1
  - parent_operator_canary
  preconditions:
  - operator-controlled English representative recording is available
  - Drive/Vimeo/storage authority is explicit
  steps:
  - ingest through the named source
  - observe validation/compression/transcript/draft states
  - approve and publish
  - play through an authorized Student route and then test revoke/unpublish
  expected_results:
  - Review questions/materials are draftable and editable.
  forbidden_effects:
  - whole-file in-process buffering
  - duplicate processing
  - publication before approval
  - raw Vimeo URL exposure
  - sibling playback
  evidence_profile: content_pipeline
  cleanup: reconcile provider assets and retain/delete source and derivatives according to retention policy
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-CONTENT-191

The pipeline streams and validates an English recording up to 5 GiB without full-file process-memory buffering, then creates a verified `OT-VIDEO-1` MP4/H.264/AAC derivative at no more than 1080p/30 fps.

- Area: `CONTENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `content`
- Semantic acceptance dependencies: `OTV2-CLASSROOM-066, OTV2-AUTH-008`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 03-DECISION-REGISTER-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CONTENT-191-AC01
  kind: negative
  environment:
  - ci
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - student_operator_canary_1
  preconditions:
  - operator-controlled English representative recording is available
  - Drive/Vimeo/storage authority is explicit
  steps:
  - ingest through the named source
  - observe validation/compression/transcript/draft states
  - approve and publish
  - play through an authorized Student route and then test revoke/unpublish
  expected_results:
  - The pipeline streams and validates an English recording up to 5 GiB without full-file process-memory buffering,
    then creates a verified `OT-VIDEO-1` MP4/H.264/AAC derivative at no more than 1080p/30 fps.
  forbidden_effects:
  - whole-file in-process buffering
  - duplicate processing
  - publication before approval
  - raw Vimeo URL exposure
  - sibling playback
  evidence_profile: content_pipeline
  cleanup: reconcile provider assets and retain/delete source and derivatives according to retention policy
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-CONTENT-193

Compressed video, transcript, captions, worksheet/review material, and future knowledge artifact remain drafts until Admin approval.

- Area: `CONTENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `content`
- Semantic acceptance dependencies: `OTV2-CLASSROOM-066, OTV2-AUTH-008`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CONTENT-193-AC01
  kind: positive
  environment:
  - ci
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - student_operator_canary_1
  preconditions:
  - operator-controlled English representative recording is available
  - Drive/Vimeo/storage authority is explicit
  steps:
  - ingest through the named source
  - observe validation/compression/transcript/draft states
  - approve and publish
  - play through an authorized Student route and then test revoke/unpublish
  expected_results:
  - Compressed video, transcript, captions, worksheet/review material, and future knowledge artifact remain drafts
    until Admin approval.
  forbidden_effects:
  - whole-file in-process buffering
  - duplicate processing
  - publication before approval
  - raw Vimeo URL exposure
  - sibling playback
  evidence_profile: content_pipeline
  cleanup: reconcile provider assets and retain/delete source and derivatives according to retention policy
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-CONTENT-233

OBS is the sole launch capture with Zoom cloud recording off; controlled-device upload, private eu-central-1 S3/SSE-KMS processing, OT-VIDEO-1 transcode, pinned OpenAI transcription/Structured Outputs, and checksum-readback deletion follow the exact contract.

- Area: `CONTENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `content`
- Semantic acceptance dependencies: `OTV2-CLASSROOM-066, OTV2-AUTH-008, OTV2-CONTENT-190, OTV2-CONTENT-191, OTV2-CONTENT-192, OTV2-CONTENT-193`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md, 11-ENVIRONMENT-FIXTURE-CANARY-MANIFEST-v2.1.yaml`

Exact acceptance case data:

```yaml
- case_id: OTV2-CONTENT-233-OBS-CAPTURE
  kind: operator_journey
  environment: &id001
  - ci
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - student_operator_canary_1
  preconditions:
  - Zoom cloud recording is disabled
  - the operator uses the controlled encrypted OBS device
  steps:
  - capture an occurrence with the approved recording notice and participant snapshot
  - upload the source to Drive or direct intake within 24 hours
  - verify destination checksum/readback and linked ingest record
  - delete the local OBS source only after every deletion prerequisite passes
  expected_results:
  - OBS is the sole launch capture and no Zoom cloud recording exists
  - upload meets the 24-hour target and local deletion cannot occur before checksum/readback and ingest linkage
  forbidden_effects:
  - Zoom cloud recording
  - uncontrolled capture device
  - premature local deletion
  - unlinked source
  evidence_profile: content_pipeline
  cleanup: reconcile provider assets and retain/delete source and derivatives according to retention policy
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
- case_id: OTV2-CONTENT-233-STORAGE-MODELS-TRANSCODE
  kind: provider_contract
  environment: *id001
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - student_operator_canary_1
  preconditions:
  - operator-controlled English representative recording is available
  - Drive/Vimeo/storage authority is explicit
  steps:
  - inspect private S3 region, public-access block, versioning, SSE-KMS, IAM, and browser-credential boundaries
  - process the representative 3–5 GiB English source using the OT-VIDEO-1 profile
  - read back gpt-4o-transcribe and gpt-4.1-mini Responses Structured Outputs model/schema pins
  - verify transcript/captions/material/knowledge artifacts remain draft until Admin approval
  expected_results:
  - source/processing storage is private AWS S3 in eu-central-1 with versioning, SSE-KMS, and public access blocked
  - the verified derivative is MP4 H.264 yuv420p at no more than 1080p/30 fps, CRF 23 medium, AAC-LC 48 kHz stereo
    128 kbps, fast-start
  - model and schema revisions are recorded, output is validated, and nothing auto-publishes
  forbidden_effects:
  - browser cloud credentials
  - public object
  - unpinned schema
  - publication before approval
  - full-file application-memory buffering
  evidence_profile: content_pipeline
  cleanup: reconcile provider assets and retain/delete source and derivatives according to retention policy
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-CONTENT-087

Private Vimeo upload works.

- Area: `CONTENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `content`
- Semantic acceptance dependencies: `OTV2-CLASSROOM-066, OTV2-AUTH-008`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CONTENT-087-AC01
  kind: positive
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
  - student_operator_canary_1
  - parent_operator_canary
  preconditions:
  - operator-controlled English representative recording is available
  - Drive/Vimeo/storage authority is explicit
  steps:
  - ingest through the named source
  - observe validation/compression/transcript/draft states
  - approve and publish
  - play through an authorized Student route and then test revoke/unpublish
  expected_results:
  - Private Vimeo upload works.
  forbidden_effects:
  - whole-file in-process buffering
  - duplicate processing
  - publication before approval
  - raw Vimeo URL exposure
  - sibling playback
  evidence_profile: content_pipeline
  cleanup: reconcile provider assets and retain/delete source and derivatives according to retention policy
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-CONTENT-088

Admin approval is required before publication.

- Area: `CONTENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `content`
- Semantic acceptance dependencies: `OTV2-CLASSROOM-066, OTV2-AUTH-008`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CONTENT-088-AC01
  kind: positive
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
  - student_operator_canary_1
  - parent_operator_canary
  preconditions:
  - operator-controlled English representative recording is available
  - Drive/Vimeo/storage authority is explicit
  steps:
  - ingest through the named source
  - observe validation/compression/transcript/draft states
  - approve and publish
  - play through an authorized Student route and then test revoke/unpublish
  expected_results:
  - Admin approval is required before publication.
  forbidden_effects:
  - whole-file in-process buffering
  - duplicate processing
  - publication before approval
  - raw Vimeo URL exposure
  - sibling playback
  evidence_profile: content_pipeline
  cleanup: reconcile provider assets and retain/delete source and derivatives according to retention policy
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-CONTENT-089

Authorized Student protected playback works; Parent playback is denied.

- Area: `CONTENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `content`
- Semantic acceptance dependencies: `OTV2-CLASSROOM-066, OTV2-AUTH-008`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CONTENT-089-STUDENT
  kind: positive
  environment: &id001
  - ci
  - provider_sandbox
  - production_operator_canary
  actors:
  - student
  fixtures:
  - student_operator_canary_1
  preconditions:
  - operator-controlled English representative recording is available
  - Drive/Vimeo/storage authority is explicit
  steps:
  - ingest through the named source
  - observe validation/compression/transcript/draft states
  - approve and publish
  - play through an authorized Student route and then test revoke/unpublish
  expected_results:
  - The entitled Student opens the published item through the protected One Time player and no raw Vimeo URL is
    exposed.
  forbidden_effects:
  - whole-file in-process buffering
  - duplicate processing
  - publication before approval
  - raw Vimeo URL exposure
  - sibling playback
  evidence_profile: content_pipeline
  cleanup: reconcile provider assets and retain/delete source and derivatives according to retention policy
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
- case_id: OTV2-CONTENT-089-PARENT-DENY
  kind: negative
  environment: *id001
  actors:
  - parent
  fixtures:
  - parent_operator_canary
  - student_operator_canary_1
  preconditions:
  - operator-controlled English representative recording is available
  - Drive/Vimeo/storage authority is explicit
  steps:
  - sign in as the linked Parent
  - attempt the Student playback route through navigation and a direct URL
  - verify a safe denial with no provider bootstrap, playback grant, or partial write
  expected_results:
  - The Parent cannot open Student recording or library playback even for a linked Student.
  forbidden_effects:
  - whole-file in-process buffering
  - duplicate processing
  - publication before approval
  - raw Vimeo URL exposure
  - sibling playback
  evidence_profile: content_pipeline
  cleanup: reconcile provider assets and retain/delete source and derivatives according to retention policy
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-CONTENT-090

Sibling and revoked access are denied.

- Area: `CONTENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `content`
- Semantic acceptance dependencies: `OTV2-CLASSROOM-066, OTV2-AUTH-008`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CONTENT-090-AC01
  kind: negative
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
  - student_operator_canary_1
  - parent_operator_canary
  preconditions:
  - operator-controlled English representative recording is available
  - Drive/Vimeo/storage authority is explicit
  steps:
  - ingest through the named source
  - observe validation/compression/transcript/draft states
  - approve and publish
  - play through an authorized Student route and then test revoke/unpublish
  expected_results:
  - Sibling and revoked access are denied.
  forbidden_effects:
  - whole-file in-process buffering
  - duplicate processing
  - publication before approval
  - raw Vimeo URL exposure
  - sibling playback
  evidence_profile: content_pipeline
  cleanup: reconcile provider assets and retain/delete source and derivatives according to retention policy
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-CONTENT-091

Unpublish revokes playback.

- Area: `CONTENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `content`
- Semantic acceptance dependencies: `OTV2-CLASSROOM-066, OTV2-AUTH-008`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CONTENT-091-AC01
  kind: positive
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
  - student_operator_canary_1
  - parent_operator_canary
  preconditions:
  - operator-controlled English representative recording is available
  - Drive/Vimeo/storage authority is explicit
  steps:
  - ingest through the named source
  - observe validation/compression/transcript/draft states
  - approve and publish
  - play through an authorized Student route and then test revoke/unpublish
  expected_results:
  - Unpublish revokes playback.
  forbidden_effects:
  - whole-file in-process buffering
  - duplicate processing
  - publication before approval
  - raw Vimeo URL exposure
  - sibling playback
  evidence_profile: content_pipeline
  cleanup: reconcile provider assets and retain/delete source and derivatives according to retention policy
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-CONTENT-092

Recording-available notification uses protected app URL.

- Area: `CONTENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `content`
- Semantic acceptance dependencies: `OTV2-CLASSROOM-066, OTV2-AUTH-008`
- Source references: `01-PRODUCT-SPEC-v2.1.md, 06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md, 07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CONTENT-092-AC01
  kind: positive
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
  - student_operator_canary_1
  - parent_operator_canary
  preconditions:
  - operator-controlled English representative recording is available
  - Drive/Vimeo/storage authority is explicit
  steps:
  - ingest through the named source
  - observe validation/compression/transcript/draft states
  - approve and publish
  - play through an authorized Student route and then test revoke/unpublish
  expected_results:
  - Recording-available notification uses protected app URL.
  forbidden_effects:
  - whole-file in-process buffering
  - duplicate processing
  - publication before approval
  - raw Vimeo URL exposure
  - sibling playback
  evidence_profile: content_pipeline
  cleanup: reconcile provider assets and retain/delete source and derivatives according to retention policy
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-CONTENT-194

Student library search supports title, English transcript, date, topic, and structured Mishnah reference where available.

- Area: `CONTENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `content`
- Semantic acceptance dependencies: `OTV2-CLASSROOM-066, OTV2-AUTH-008`
- Source references: `08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CONTENT-194-AC01
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
  - Student library search supports title, English transcript, date, topic, and structured Mishnah reference where
    available.
  forbidden_effects:
  - cross-scope read or write
  - UI-only success without persistence
  - duplicate write on resubmit
  evidence_profile: role_browser_persistence
  cleanup: archive only records created for the operator canary when the manifest requires cleanup
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

### OTV2-CONTENT-195

Protected playback stores and resumes each Student's last authorized position without leaking sibling progress.

- Area: `CONTENT`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `content`
- Semantic acceptance dependencies: `OTV2-CLASSROOM-066, OTV2-AUTH-008`
- Source references: `06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-CONTENT-195-AC01
  kind: negative
  environment:
  - ci
  - persistent_staging
  - production_operator_canary
  actors:
  - student
  fixtures:
  - admin_rabbi_eli
  - parent_operator_canary
  - student_operator_canary_1
  - denial_household
  preconditions:
  - real Student learning events and class scope exist
  steps:
  - create the qualifying event
  - read back the Student calculation/state
  - exercise correction or tie/empty branch
  - verify Parent/Student/Admin projections and denials
  expected_results:
  - Protected playback stores and resumes each Student's last authorized position without leaking sibling progress.
  forbidden_effects:
  - cross-Student private data
  - unexplained point currency
  - public leaderboard
  - unaudited manual correction
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
