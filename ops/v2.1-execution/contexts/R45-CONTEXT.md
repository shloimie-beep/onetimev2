# R45 — Final Interactive Certification and Cutover Decision — Locked Context

**Outcome:** Certify every visible control and all release invariants against the same immutable candidate, confirm legal/provider/operations gates, and execute or withhold production cutover with auditable reasoning.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `FINAL_RELEASE_AUTHORITY`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- Apply the exact task packet and execution contract.

## Dependency gates

- Start after: `R44, V43`
- Full merge after: `None`
- Candidate integration partners (non-ordering): `None`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `ops/v2.1-execution/authority/<candidate-digest>/R45/**`
- `ops/v2.1-execution/effects/<candidate-digest>/R45/**`
- `ops/v2.1-execution/merge/FINAL-RELEASE-DECISION.yaml`
- `ops/v2.1-execution/observations/<candidate-digest>/**`
- `ops/v2.1-execution/results/<candidate-digest>/R45/**`

Scope notes below explain intent but do not grant additional path authority:

- production deployment/DNS only when explicitly authorized and all gates pass

## Deliverables

- interactive-element inventory with all five required zero counts
- candidate/environment/provider/legal/effect reconciliation
- final release decision with no unauthorized waivers
- production deploy/cutover verification or an exact blocked-release record
- rollback readiness and post-deploy readback

## Relevant locked decisions (4)

| Decision | Status | Exact decision |
|---|---|---|
| DEC-004 | LOCKED | Product-path work has priority. Historical cleanup or evidence work may not block a real Admin, Parent, Student, billing, class, calendar, content, or communication journey unless it prevents safe production operation. |
| DEC-007 | INFERRED | Automated unit, integration, browser, accessibility, concurrency, security, migration, provider-sandbox, and bounded production-canary verification remain required. “No tests” means no fictional/demo/test product surfaces and no test-only operating lane, not removal of production-safety verification. |
| DEC-133 | LOCKED | Every visible interactive control works against persistent data or is absent. No placeholder controls or “coming soon” cards appear in production. |
| DEC-152 | INFERRED | Manual acceptance supplements, but does not replace, automated safety and regression evidence tied to the exact release candidate. |

## Acceptance requirements and exact cases (1 requirements)


### OTV2-OPS-175

Interactive certification has zero failed, untested, placeholder, or fake-data-dependent controls.

- Area: `OPS`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `operations`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-DOMAIN-154`
- Source references: `11-ENVIRONMENT-FIXTURE-CANARY-MANIFEST-v2.1.yaml, 12-MIGRATION-CUTOVER-ROLLBACK-v2.1.md, 13-OPERATIONS-SLO-DR-INCIDENT-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-OPS-175-AC01
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
  - Interactive certification has zero failed, untested, placeholder, or fake-data-dependent controls.
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

## Embedded normative source sections

These exact source-package sections are embedded so this task does not need to rediscover its workflow/journey/certification contract.

### PS-028 through PS-030 certification and final checklist

## PS-028. Interactive-element and route certification

A machine-readable inventory covers every production-visible:

- route;
- navigation item;
- button/link;
- field/select/checkbox;
- filter/sort/pagination;
- dialog/drawer/tab action;
- calendar action;
- provider action;
- upload/media control;
- send/billing/destructive action.

Each inventory row records:

- acceptance ID;
- decision/spec/screen source;
- actor/role;
- route/screen;
- label/message ID;
- preconditions;
- expected effect;
- persistent readback;
- authorization-negative result;
- cross-household/sibling result where relevant;
- supported viewport/browser;
- keyboard/screen-reader result where relevant;
- evidence artifact;
- final `PASSED` or `REMOVED`.

Release gates:

- `FAILED = 0`;
- `UNTESTED = 0`;
- `PLACEHOLDER = 0`;
- `FAKE_DATA_DEPENDENCY = 0`;
- `UNAUTHORIZED_VISIBLE = 0`.

The executable contract is `02-ACCEPTANCE-CONTRACT-v2.1.yaml`; traceability is `14-TRACEABILITY-CROSSWALK-v2.1.yaml`.

## PS-029. Explicit launch absences

The following are absent at launch and may not appear as placeholders:

- cross-workspace super-admin UI;
- BNA merge/navigation/runtime dependency;
- roles other than `admin`, `parent`, `student`;
- Parent Learner Mode;
- simultaneous co-guardian access;
- school role/portal/bulk roster/organization administration;
- public Student registration;
- Class Helper;
- Buffer/social publishing;
- demos/preview/product test lanes;
- Google Calendar sync;
- Hebrew calendar;
- Hebrew/multilingual interface or content processing;
- multiple standard Family plans;
- library-only plan;
- MFA of any kind, enrollment, challenge, recovery code, or settings;
- voice bot;
- WhatsApp lead assistant/qualification bot;
- active WhatsApp sends before complete activation;
- open Student chat;
- Parent-created goals;
- editable badge rules;
- reward currency/catalog/redemption;
- combined leaderboard score;
- favorites;
- PWA/background push;
- advanced video editing beyond beginning/end trim;
- automatic publication;
- old disposable Zoom cleanup as a normal product dependency;
- unrelated BNA features.

## PS-030. Final release checklist

### PS-030.1 Application and identity

- [ ] `app.onetimeonetime.com` live on exact candidate
- [ ] `join.onetimeonetime.com` approved Family/School funnel
- [ ] two equal Admin accounts
- [ ] Parent setup and multi-household switcher
- [ ] one-owner transfer
- [ ] three Student accounts
- [ ] adult learner through separate Student seat
- [ ] no code or MFA UI
- [ ] no fictional/deferred surface
- [ ] global search
- [ ] every route/control certified

### PS-030.2 Classroom

- [ ] canonical Sunday–Thursday 7:00 p.m. Jerusalem schedule
- [ ] automatic active-Student enrollment
- [ ] calendars for all roles
- [ ] Prepare Class & Send Access
- [ ] embedded Zoom
- [ ] three unique registrations/tablets
- [ ] one-concurrent-session enforcement/reconnect
- [ ] late-live join
- [ ] attendance/reconciliation/correction
- [ ] Live Console

### PS-030.3 Content and learning

- [ ] direct 5 GiB upload
- [ ] Drive ingest and cross-source dedupe
- [ ] compression/resize
- [ ] trim
- [ ] English transcript/captions
- [ ] worksheet/review/knowledge-base drafts
- [ ] private Vimeo
- [ ] Admin review/approval
- [ ] Student search/playback/resume
- [ ] unpublish/revoke
- [ ] fixed goals/badges
- [ ] category leaderboards
- [ ] private questions
- [ ] Student technical support

### PS-030.4 Commercial and communications

- [ ] free signup without card
- [ ] canonical countdown/expiry
- [ ] scheduled no-charge-before-expiry continuation
- [ ] USD $67 standard plan
- [ ] hosted billing
- [ ] grace/cancellation/refund/access projection
- [ ] GHL workflow registry collision resolved
- [ ] email-only launch works
- [ ] WhatsApp dormant truthfully
- [ ] website lead bot
- [ ] Parent newsletter
- [ ] Student notification center
- [ ] Telegram separation

### PS-030.5 Security, privacy, UX, and operations

- [ ] versioned account-owner/recording consent
- [ ] no Student GHL identity
- [ ] no raw provider destination
- [ ] cross-household/sibling denial
- [ ] WCAG 2.2 AA
- [ ] supported browser/device matrix
- [ ] desktop/tablet full Admin and mobile urgent subset
- [ ] immutable web/worker agreement
- [ ] migrations/backup/restore/rollback
- [ ] queue/provider health
- [ ] SLO/incident readiness
- [ ] migration without old credentials/children/inferred consent/access
- [ ] zero unexpected send/charge
- [ ] final automated and operator acceptance

### OPS-080 through OPS-084 deployment, observation, and legal gate

## 10. Deployment and rollback operations

### OPS-080 — immutable deployment

Production web and worker use the same immutable application image or provably identical build output. Each exposes protected readback of:

- semantic application SHA;
- artifact digest;
- configuration digest;
- migration/schema version;
- build timestamp;
- `runtime_tier`;
- `verification_environment_id`.

### OPS-081 — deployment gates

Every production deployment requires:

- exact approved candidate;
- complete automated suite;
- security, accessibility, migration, concurrency, and browser gates;
- current backup and restore proof;
- a recorded migration-compatible rollback artifact;
- provider-effect scope;
- stop conditions;
- post-deploy verification;
- explicit production authority.

### OPS-082 — migration safety

- Migrations are forward-only and checksummed.
- One process applies migrations under an exclusive advisory lock.
- Other processes verify read-only.
- Application changes remain backward compatible for at least one recorded rollback artifact whenever a migration is deployed.
- A migration that removes or rewrites required data uses an expand/migrate/contract sequence across separate releases.

### OPS-083 — deployment observation

After deployment:

- automated probes run immediately;
- one bounded operator journey runs before broad effects;
- critical metrics are observed for at least 60 minutes;
- the prior artifact remains deployable throughout the observation period;
- no nonessential second deployment obscures the result.

### OPS-084 — customer-policy approval gate

The following exact customer-policy files form the v2.1 legal-policy bundle:

1. `legal/terms-of-service.html`;
2. `legal/privacy-notice.html`;
3. `legal/student-data-and-recording-consent.html`;
4. `legal/cancellation-policy.html`;
5. `legal/refund-policy.html`.

`legal/legal-policy-manifest.json` is the external approval record and sixth required artifact. It must contain:

- bundle and schema version;
- the exact path and lowercase 64-character SHA-256 of each of the five files;
- the deployed route and exact rendered-document digest for each file;
- an immutable policy version, effective date, and superseded-version relationship;
- `product_owner_full_name`, `product_owner_approved_at`, and the five approved hashes;
- `qualified_legal_reviewer_full_name`, `qualified_legal_reviewer_credential_or_firm`, `legal_approved_at`, review scope covering all five files and their runtime presentation, and the same five hashes;
- repository SHA, application-content SHA, and release/configuration digest.

The release manifest and acceptance evidence each record the lowercase 64-character SHA-256 of the exact `legal-policy-manifest.json` bytes. The release candidate, rendered routes, consent records, and approval manifest must all read back the same policy-file hashes. Any missing artifact, empty person name, role label without a person, placeholder text, stale or mismatched hash, unsigned substitution, rendered-content mismatch, missing reviewer credential/firm, expired/superseded approval, or approval that does not cover all five exact files fails closed.

This is an external `production_broad` gate. Codex may implement only the approved artifacts and cannot draft, approve, infer, substitute, or silently weaken their legal text. The gate cannot be satisfied by automated acceptance, an Admin checkbox, product-owner approval alone, or Rabbi content/classroom approval. `ci`, `provider_sandbox`, `persistent_staging`, `production_read_only`, and `production_operator_canary` restricted to operator-owned records may verify the mechanism, but no real-customer account activation, consent acceptance, recorded-class participation, charge, marketing enrollment, or broad operation is authorized until the named product owner and identified qualified legal reviewer have approved the exact deployed bundle.

### Environment release-result and legal gate contract

```yaml
legal_policy_artifact_gate:
  status: required_not_yet_recorded
  production_broad_allowed: false
  reason: product_owner_or_counsel_must_supply_and_approve_actual_legal_text
  required_artifacts:
  - key: terms
    repository_path: legal/terms-of-service.html
    public_route: /terms
  - key: privacy
    repository_path: legal/privacy-notice.html
    public_route: /privacy
  - key: student_data_and_recording_consent
    repository_path: legal/student-data-and-recording-consent.html
    public_route: null
    production_render_surface: student_creation_and_prejoin_consent
  - key: cancellation
    repository_path: legal/cancellation-policy.html
    public_route: /cancellation-refund
  - key: refund
    repository_path: legal/refund-policy.html
    public_route: /cancellation-refund
  approval_manifest:
    repository_path: legal/legal-policy-manifest.json
    immutable_digest_required: true
    binds_all_five_artifacts: true
  each_artifact_requires:
  - stable_external_file_id
  - immutable_content_digest
  - effective_version
  - approver_identity
  - approval_timestamp
  - production_render_readback
  closure_rule: all_required_artifacts_have_concrete_values_and_match_the_production_render
release_result_rules:
  result_file_is_separate_from_specification: true
  each_result_must_bind:
  - acceptance_case_id
  - candidate_digest
  - environment
  - timestamp
  - actor_or_automation
  - evidence_artifact
  - external_effect_count
  - cleanup_or_reconciliation
  release_blocked_when:
  - required_case_failed
  - required_case_unverified
  - required_evidence_stale
  - unauthorized_waiver
  - unexpected_external_effect
  - unreconciled_provider_effect
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
