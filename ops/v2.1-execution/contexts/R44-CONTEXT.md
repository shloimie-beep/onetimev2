# R44 — Real Operator Admin, Parent, and Three-Student Journey — Locked Context

**Outcome:** Execute the exact production operator canary with real operator-controlled identities/devices, persistent/provider readback, effect-budget reconciliation, and candidate-bound evidence.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `REAL_OPERATOR_ACCEPTANCE`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- Use only the approved manifest identities/devices/provider assets.
- Do not use fictional/demo customers or production customer data as fixtures.
- Stop on any unexpected, wrong-provider, over-budget, destructive, or acceptance-unknown effect.

## Dependency gates

- Start after: `V37, V38, V39, V40, V41, V42, V43`
- Full merge after: `None`
- Candidate integration partners (non-ordering): `P34`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `ops/v2.1-execution/authority/<candidate-digest>/R44/**`
- `ops/v2.1-execution/effects/<candidate-digest>/R44/**`
- `ops/v2.1-execution/results/<candidate-digest>/R44/**`

Scope notes below explain intent but do not grant additional path authority:

- operator-canary branch metadata only

## Deliverables

- authorized bounded canary deployment of the exact frozen artifacts with effects disabled and runtime readback
- Admin creates/operates real records
- Parent signs up/manages one household and three Students
- three Student/device journeys through class, recording, question/review, support, and notifications
- persistent and provider readback
- external-effect cleanup/reconciliation and exact evidence

## Relevant locked decisions (5)

| Decision | Status | Exact decision |
|---|---|---|
| DEC-004 | LOCKED | Product-path work has priority. Historical cleanup or evidence work may not block a real Admin, Parent, Student, billing, class, calendar, content, or communication journey unless it prevents safe production operation. |
| DEC-007 | INFERRED | Automated unit, integration, browser, accessibility, concurrency, security, migration, provider-sandbox, and bounded production-canary verification remain required. “No tests” means no fictional/demo/test product surfaces and no test-only operating lane, not removal of production-safety verification. |
| DEC-150 | LOCKED | Shloimie performs the final real-product acceptance: sign in as Admin; add a Parent; add up to three Students; use real Student credentials on separate tablets; join the embedded class; upload a real recording through app/Drive; verify processing, review, Vimeo publication, and Student playback. |
| DEC-151 | LOCKED | Rabbi Eli performs or approves the real Admin/teacher classroom and content journey. |
| DEC-152 | INFERRED | Manual acceptance supplements, but does not replace, automated safety and regression evidence tied to the exact release candidate. |

## Acceptance requirements and exact cases (2 requirements)


### OTV2-OPS-174

Final real production Admin/Parent/three-Student journeys pass.

- Area: `OPS`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `operations`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-DOMAIN-154`
- Source references: `11-ENVIRONMENT-FIXTURE-CANARY-MANIFEST-v2.1.yaml, 12-MIGRATION-CUTOVER-ROLLBACK-v2.1.md, 13-OPERATIONS-SLO-DR-INCIDENT-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-OPS-174-AC01
  kind: positive
  environment:
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - admin_rabbi_eli
  - parent_operator_canary
  - student_operator_canary_1
  - student_operator_canary_2
  - student_operator_canary_3
  preconditions:
  - exact production candidate is active
  - operator authority and effect budget are recorded
  - all lower gates passed
  steps:
  - complete the named real journey on real devices
  - record persistent and provider readback
  - inventory every visible control
  - reconcile and sign off
  expected_results:
  - Final real production Admin/Parent/three-Student journeys pass.
  forbidden_effects:
  - fictional fixture
  - placeholder control
  - unexpected external effect
  - unreconciled canary resource
  evidence_profile: manual_real_journey
  cleanup: complete manifest reconciliation and preserve candidate-bound evidence
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-OPS-222

Final operator acceptance covers Admin, Parent, three Students on separate tablets, embedded class, attendance, real upload/Drive processing, approval, Vimeo, playback, billing, and communications.

- Area: `OPS`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `operations`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-DOMAIN-154`
- Source references: `11-ENVIRONMENT-FIXTURE-CANARY-MANIFEST-v2.1.yaml`

Exact acceptance case data:

```yaml
- case_id: OTV2-OPS-222-AC01
  kind: positive
  environment:
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
  - student_operator_canary_2
  - student_operator_canary_3
  preconditions:
  - exact production candidate is active
  - operator authority and effect budget are recorded
  - all lower gates passed
  steps:
  - complete the named real journey on real devices
  - record persistent and provider readback
  - inventory every visible control
  - reconcile and sign off
  expected_results:
  - Final operator acceptance covers Admin, Parent, three Students on separate tablets, embedded class, attendance,
    real upload/Drive processing, approval, Vimeo, playback, billing, and communications.
  forbidden_effects:
  - fictional fixture
  - placeholder control
  - unexpected external effect
  - unreconciled canary resource
  evidence_profile: manual_real_journey
  cleanup: complete manifest reconciliation and preserve candidate-bound evidence
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

## Embedded normative source sections

These exact source-package sections are embedded so this task does not need to rediscover its workflow/journey/certification contract.

### PS-027 exact real production acceptance journeys

## PS-027. Real production acceptance journeys

### PS-027.1 Shloimie Admin journey

Shloimie:

1. signs in with email/password and no code or MFA;
2. uses Dashboard and global search;
3. creates/edits/archives/restores an adult;
4. creates a Family household and Parent;
5. creates three Students and sees fourth-seat rejection;
6. changes Student username/password and verifies session revoke;
7. sees automatic canonical enrollment/calendar;
8. schedules/edits a permitted class occurrence;
9. prepares class and previews/sends access;
10. operates Live Console;
11. resets a Student’s second-device conflict;
12. uploads a real recording directly;
13. verifies Drive duplicate/deduplication path;
14. trims, reviews, corrects, approves, and publishes;
15. verifies Student playback/resume and unpublish denial;
16. reviews attendance/progress/badges/leaderboard;
17. handles adult and Student technical tickets;
18. opens billing/access, communications, integrations, operations, and audit;
19. logs out/in and verifies persistence.

### PS-027.2 Rabbi Eli Admin/teacher journey

Rabbi Eli proves identical Admin authority and:

1. uses teaching calendar and roster;
2. uses Live Console;
3. receives private-question notification;
4. answers privately;
5. approves for class and publishes moderated result;
6. reviews/approves content;
7. creates announcement and newsletter draft/readback;
8. verifies his actual Admin identity in audit.

### PS-027.3 Family Parent journey

A real Parent:

1. signs up without a card;
2. receives and uses seven-day setup;
3. confirms timezone/policies;
4. creates three actual Students;
5. sees automatic canonical enrollment and next class;
6. sees fourth-seat rejection;
7. copies initial credential handoff;
8. resets one Student password;
9. uses household switcher when owning multiple households;
10. sees calendar and Parent-safe progress/badges;
11. cannot enter class/library/private questions;
12. chooses reminder intent with truthful WhatsApp availability;
13. uses billing/reactivation provider path;
14. views newsletter/updates;
15. submits support;
16. logs out/in.

### PS-027.4 Approved School journey

1. Public representative submits School inquiry.
2. No product access or nurture is created.
3. Admin follows up and approves manually.
4. Admin configures account manager, allowance, price, billing start, and terms.
5. Account manager uses the Parent experience.
6. Separate Student accounts use the normal Student experience.
7. No school role, portal, or bulk administration appears.

### PS-027.5 Student journey on three tablets

For each Student:

1. sign in with own username/password;
2. see own actual/display name;
3. see own Today/calendar;
4. enter embedded class;
5. verify unique registration and muted entry;
6. verify recording/camera guidance;
7. join after start while occurrence remains live;
8. reconnect same session;
9. deny second device;
10. deny sibling/cross-household data;
11. play/resume approved recording;
12. see progress/fixed badges/leaderboard;
13. submit private Torah question;
14. submit separate technical support;
15. use notification center/audible preference;
16. log out/in.

### PS-027.6 Commercial journey

1. free Family signup without card;
2. free access;
3. early continuation schedules first charge at expiry;
4. active access at verified event;
5. hosted billing update;
6. failed payment;
7. seven-day grace with Student access;
8. recovery;
9. period-end cancellation;
10. inactive Parent restricted access and Student denial;
11. reactivation;
12. Admin-approved refund;
13. replay/out-of-order safety.

### PS-027.7 Communications journey

1. GHL segment and suppression readback;
2. exact rendered-copy/sender/cadence readback;
3. one bounded operator-only provider canary through the release-verification harness, outside ordinary product navigation;
4. Admin approval;
5. governed Start/Pause;
6. active migration and former reactivation;
7. nurture ready/paused until Start;
8. school acknowledgment only;
9. email works with WhatsApp dormant;
10. replies reach correct adult GHL conversation;
11. no Student GHL contact.

### C5/operator canary manifest contract

```yaml
production_operator_canary_effect_budget:
  one_time:
    parent_accounts_created_or_updated_max: 2
    households_created_or_updated_max: 2
    student_accounts_created_or_updated_max: 6
    support_tickets_max: 4
    student_questions_max: 4
    unexpected_cross_household_reads_max: 0
  highlevel:
    operator_contacts_created_or_updated_max: 2
    workflow_enrollments_max: 4
    broad_campaign_contacts_max: 0
    student_contacts_max: 0
  email:
    resend_messages_max: 8
    ghl_messages_max: 12
    unrelated_recipients_max: 0
  whatsapp:
    messages_max: 0
    workflow_executions_max: 0
  zoom:
    meetings_created_max: 1
    registrants_created_max: 3
    simultaneous_student_sessions_max: 3
    raw_join_urls_exposed_max: 0
  stripe:
    live_checkout_sessions_max: 1
    live_charge_total_usd_max: 67
    live_refunds_max: 1
    unrelated_customer_mutations_max: 0
  drive:
    files_ingested_max: 1
    unrelated_files_moved_or_deleted_max: 0
  vimeo:
    assets_uploaded_max: 1
    unrelated_assets_mutated_max: 0
  telegram:
    operator_notifications_max: 12
    customer_messages_max: 0
  destructive_effects:
    customer_deletions_max: 0
    provider_account_deletions_max: 0
    broad_data_rewrites_max: 0
canary_sequence:
- gate: C1
  name: isolated_automated
  environment: ci
  next_requires: all_required_cases_pass
- gate: C2
  name: persistent_staging_roles_and_devices
  environment: persistent_staging
  next_requires: exact_candidate_and_zero_placeholder_controls
- gate: C3
  name: provider_sandbox
  environment: provider_sandbox
  next_requires: all_provider_effects_reconciled_and_cleaned
- gate: C4
  name: production_read_only
  environment: production_read_only
  next_requires: healthy_identity_configuration_backup_and_migrations
- gate: C5
  name: production_operator_end_to_end
  environment: production_operator_canary
  journeys:
  - admin_login_and_global_search
  - family_signup_and_immediate_login
  - seven_day_legacy_or_ownership_setup_link
  - parent_adds_three_students
  - three_tablet_student_login
  - embedded_zoom_join_and_one_concurrent_session_per_student
  - attendance_reconciliation
  - direct_app_recording_upload
  - drive_recording_ingest
  - compression_transcript_review_material_and_knowledge_artifact
  - admin_approval_and_private_vimeo_publication
  - student_library_search_resume_and_playback
  - billing_checkout_event_access_and_repair
  - parent_and_student_support
  - email_only_workflow_with_whatsapp_safely_skipped
  next_requires: explicit_product_owner_and_rabbi_signoff
- gate: C6
  name: broad_production
  environment: production_broad
stop_conditions:
- unexpected_recipient_or_audience
- any_student_created_in_highlevel
- raw_zoom_or_vimeo_access_url_exposed
- any_whatsapp_send_before_channel_approval
- live_charge_above_budget
- duplicate_subscription
- unexpected_refund_or_deletion
- wrong_provider_workspace_or_account
- web_worker_or_configuration_digest_mismatch
- migration_checksum_or_readback_failure
- backup_or_restore_gate_failure
- provider_acceptance_unknown_without_quarantine
- cross_household_or_sibling_authorization_failure
- consent_missing_for_recorded_student_audio_or_video
- required_legal_policy_artifact_missing_or_digest_mismatch
- campaign_content_or_audience_digest_drift
cleanup_and_reconciliation:
  required_for_each_external_effect: true
  cleanup_may_not_block_normal_product_path_after_safe_quarantine: true
  retain:
  - immutable_event_receipts
  - redacted_audit_evidence
  - acceptance_results
  - authorized_canary_business_records_when_designated_persistent
  remove_or_revoke:
  - disposable_provider_resources
  - temporary_tokens
  - abandoned_test_checkouts
  - unintended_workflow_enrollments
  destructive_cleanup_requires_explicit_target_and_authority: true
  production_customer_data_may_not_be_used_as_cleanup_fixture: true
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
