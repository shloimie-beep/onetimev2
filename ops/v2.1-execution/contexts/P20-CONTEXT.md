# P20 — Media Processing, Compression, Transcription, and Draft Generation — Locked Context

**Outcome:** Implement streaming-safe validation, resize/compression, begin/end trim, transcript/captions, review worksheet, and future knowledge-base draft generation.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `CONTENT_PROCESSING`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- Apply the exact task packet and execution contract.

## Dependency gates

- Start after: `F05, P19`
- Full merge after: `F05, P19`
- Candidate integration partners (non-ordering): `F06, P33`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `apps/worker/src/runners/content-processing/**`
- `packages/contracts/src/content/processing/**`
- `packages/db/src/content/processing/**`
- `packages/domain/src/content/processing/**`
- `scripts/media/v21/**`

Scope notes below explain intent but do not grant additional path authority:

- packages/db/src/content/processing/** except migrations and central index
- Admin processing/review feature modules
- streaming/trim/transcript/draft tests
- steward requests for config/dependency/worker/migration changes

## Deliverables

- bounded-memory media pipeline
- operator-configurable practical compression output
- trim and English transcription/captions
- review worksheet and knowledge-base draft artifacts

## Relevant locked decisions (6)

| Decision | Status | Exact decision |
|---|---|---|
| DEC-068 | LOCKED | Student voice and video may be captured only after versioned account-owner consent. OBS is the sole launch recording source and Zoom cloud recording is disabled. Admin verifies the consent-gated roster and visible/verbal recording notice, starts/stops OBS, transfers the encrypted local file by direct upload or dedicated Drive within 24 hours, and deletes the local copy only after durable checksum readback. |
| DEC-072 | LOCKED | The pipeline compresses/resizes the OBS recording under versioned launch profile `OT-VIDEO-1`, transcribes it, prepares review material/worksheet drafts, prepares a future knowledge-base artifact, and prepares private Vimeo publication. `OT-VIDEO-1` is MP4/H.264/AAC, maximum 1080p/30 fps without upscaling, H.264 CRF 23 medium preset, AAC-LC 48 kHz stereo at 128 kbps, and web fast-start. |
| DEC-074 | INFERRED | Launch supports files up to 5 GiB with bounded memory, resumable or safely restartable transfer, pagination, checksums, and visible retry/dead-letter recovery. |
| DEC-075 | LOCKED | Content and transcription language is English only. No Hebrew UI or multilingual content-processing requirement exists at launch. |
| DEC-076 | LOCKED | Transcript, worksheet, knowledge-base, trim, captions, and publication outputs are drafts until an Admin approves them. |
| DEC-079 | INFERRED | Durable direct-upload staging is private versioned SSE-KMS AWS S3 in `eu-central-1`, with public access blocked and multipart uploads. English transcription uses OpenAI `gpt-4o-transcribe`; worksheet/review/knowledge drafts use the OpenAI Responses API with `gpt-4.1-mini` Structured Outputs. Model, prompt, glossary, and schema versions are pinned per content version and every output remains human-approved. |

## Acceptance requirements and exact cases (6 requirements)


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
