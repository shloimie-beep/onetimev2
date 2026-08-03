# P21 — Vimeo Publication, Protected Library, Search, and Resume — Locked Context

**Outcome:** Implement approval-gated private Vimeo publication, occurrence attachment, authorized Student playback, unpublish/revoke, library search, and playback resume.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `CONTENT_PUBLICATION`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- Never expose raw Vimeo playback URLs in UI, logs, handoffs, or evidence.

## Dependency gates

- Start after: `F05, F06, P14`
- Full merge after: `F05, F06, P14`
- Candidate integration partners (non-ordering): `P20, P23, P26`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `apps/web/src/client/app/admin/content/publication/**`
- `apps/web/src/client/app/student/library/**`
- `apps/web/src/server/features/content/publication/**`
- `packages/contracts/src/content/publication/**`
- `packages/db/src/content/publication/**`
- `packages/domain/src/content/publication/**`

Scope notes below explain intent but do not grant additional path authority:

- packages/db/src/content/publication/** except migrations and central index
- Vimeo/playback/search/resume authorization tests
- steward requests for config/dependency/route/migration changes

## Deliverables

- approval and publication lifecycle
- private Vimeo reference and protected playback tokenization
- Student library search and resume
- unpublish/revoke and occurrence attachment

## Relevant locked decisions (6)

| Decision | Status | Exact decision |
|---|---|---|
| DEC-016 | LOCKED | A Parent account never receives Student-class, recording, question, or learning-library access. |
| DEC-072 | LOCKED | The pipeline compresses/resizes the OBS recording under versioned launch profile `OT-VIDEO-1`, transcribes it, prepares review material/worksheet drafts, prepares a future knowledge-base artifact, and prepares private Vimeo publication. `OT-VIDEO-1` is MP4/H.264/AAC, maximum 1080p/30 fps without upscaling, H.264 CRF 23 medium preset, AAC-LC 48 kHz stereo at 128 kbps, and web fast-start. |
| DEC-076 | LOCKED | Transcript, worksheet, knowledge-base, trim, captions, and publication outputs are drafts until an Admin approves them. |
| DEC-077 | LOCKED | Student playback uses a five-minute renewable authorization through the protected One Time surface backed by private Vimeo access. Raw Vimeo URLs are not exposed. Playback requires access, enrollment/assignment, and published state, not recording-participation consent. |
| DEC-078 | INFERRED | Launch library search covers title, English transcript text, date, class/topic, and structured Mishnah references when available. Favorites are deferred. Basic resume playback is included. |
| DEC-124 | INFERRED | Content lifecycle is `received`, `validating`, `processing`, `needs_review`, `approved`, `publishing`, `published`, `failed`, or `archived`. |

## Acceptance requirements and exact cases (8 requirements)


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
