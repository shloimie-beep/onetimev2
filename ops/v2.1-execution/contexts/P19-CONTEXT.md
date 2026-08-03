# P19 — Direct Upload, Drive Intake, and Source Deduplication — Locked Context

**Outcome:** Implement Admin drag-and-drop upload through 5 GiB, Drive-folder intake, validation, streaming-safe transfer, and one deduplicated media-ingest identity.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `CONTENT_INGEST`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- Apply the exact task packet and execution contract.

## Dependency gates

- Start after: `F05, F06, P16`
- Full merge after: `F05, F06, P16`
- Candidate integration partners (non-ordering): `P33`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `apps/web/src/client/app/admin/content/ingest/**`
- `apps/web/src/server/features/content/ingest/**`
- `apps/worker/src/runners/content-ingest/**`
- `packages/contracts/src/content/ingest/**`
- `packages/db/src/content/ingest/**`
- `packages/domain/src/content/ingest/**`

Scope notes below explain intent but do not grant additional path authority:

- packages/db/src/content/ingest/** except migrations and central index
- Drive/direct-upload/dedupe tests
- steward requests for config/dependency/route/worker/migration changes

## Deliverables

- direct multipart/resumable upload
- Drive watcher/intake
- source identity and deduplication
- streaming validation and durable ingest states

## Relevant locked decisions (5)

| Decision | Status | Exact decision |
|---|---|---|
| DEC-070 | LOCKED | An Admin can drag and drop a recording directly into the application. |
| DEC-071 | LOCKED | A monitored Drive incoming folder is also supported. Both sources enter the same deduplicated content pipeline. |
| DEC-073 | INFERRED | Direct app uploads are streamed into managed staging and represented in the same content-source model as Drive files. A checksum prevents duplicate processing across app and Drive ingestion. |
| DEC-074 | INFERRED | Launch supports files up to 5 GiB with bounded memory, resumable or safely restartable transfer, pagination, checksums, and visible retry/dead-letter recovery. |
| DEC-124 | INFERRED | Content lifecycle is `received`, `validating`, `processing`, `needs_review`, `approved`, `publishing`, `published`, `failed`, or `archived`. |

## Acceptance requirements and exact cases (6 requirements)


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
