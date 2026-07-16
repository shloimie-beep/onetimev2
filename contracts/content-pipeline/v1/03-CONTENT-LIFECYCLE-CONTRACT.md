# Content lifecycle, data, idempotency, and audit contract

## Aggregate identity and provenance

A content aggregate has stable `tenant_id` and `content_id`. Every incoming source has a `source_record_id`, `source_kind`, original filename or approved reference, byte length when applicable, SHA-256 checksum, received time, origin service, and opaque submitting actor id. A source checksum is computed before provider upload or processing.

Equivalent repository-native records must cover:

- content items;
- source objects/references;
- ingest attempts and resumable step state;
- Vimeo/provider objects and webhook receipts;
- transcription jobs and parser jobs;
- immutable content versions;
- sections/chapters and artifacts;
- approvals and privacy attestations;
- publication attempts and delivery receipts;
- transactional outbox and idempotent inbox;
- audit events and revision lineage;
- One Time local publication projection and search documents.

## State semantics

| State           | Meaning                                                                        |
| --------------- | ------------------------------------------------------------------------------ |
| `received`      | Durable source/reference and provenance exist; processing has not begun.       |
| `uploading`     | An automated Vimeo upload session is active or being reconciled.               |
| `transcribing`  | A validated Vimeo reference/source is undergoing transcription.                |
| `processing`    | Transcript and source are being parsed into typed artifacts and sections.      |
| `review_needed` | A candidate version is complete enough for authorized human review.            |
| `approved`      | An authorized actor approved an immutable version and privacy attestation.     |
| `published`     | One Time acknowledged and applied the current approved version locally.        |
| `failed`        | A typed step failed; `retry_target_state` and retry policy are recorded.       |
| `corrected`     | A previously approved/published version has been superseded by a correction.   |
| `retired`       | Content is intentionally unavailable and excluded from delivery and retrieval. |

## Allowed transitions

- `received → uploading`, `received → transcribing`, or `received → failed`.
- `uploading → transcribing` or `uploading → failed`.
- `transcribing → processing` or `transcribing → failed`.
- `processing → review_needed` or `processing → failed`.
- `review_needed → processing`, `review_needed → approved`, `review_needed → retired`, or `review_needed → failed`.
- `approved → published`, `approved → corrected`, `approved → retired`, or `approved → failed` only when publication delivery fails without mutating the approved version.
- `published → corrected` or `published → retired`.
- `failed → received`, `failed → uploading`, `failed → transcribing`, `failed → processing`, or `failed → retired`, but only through the recorded `retry_target_state` and a new attempt number.
- `corrected → retired`. A replacement version follows its own normal path to `approved` and `published`.
- `retired` is terminal for that version. Restoration requires a new version and approval.

Any other transition is rejected and audited.

## Immutability and correction

Before approval, candidate revisions may be replaced while retaining revision history. Approval freezes the normalized metadata, section order, searchable text, artifact references, and every SHA-256 checksum. Database constraints or domain guards must prevent an approved version from being updated in place.

A correction creates a new `version_id`, sets `supersedes_version_id`, reruns privacy/approval, and publishes action `correct`. The prior version becomes `corrected` only after the replacement is validly approved. One Time atomically activates the replacement and removes the superseded version from active search.

## Idempotency and duplicate prevention

Use stable unique keys at these boundaries:

- source ingest: `(tenant_id, source_kind, source_record_id, source_sha256)`;
- provider object: `(provider, provider_video_id)` and provider upload idempotency key;
- provider event receipt: `(provider, provider_event_id)` plus raw-body SHA-256;
- processing step: `(content_id, source_sha256, step_name, processor_version)`;
- candidate/approved version: `(content_id, normalized_version_sha256)`;
- outbox event: `(event_type, aggregate_id, aggregate_version, action)`;
- publication delivery: `message_id`, `idempotency_key`, and `(tenant_id, content_id, sequence)`;
- One Time index document: `(tenant_id, version_id, section_id, document_sha256)`.

A duplicate with identical bytes returns the prior result. A duplicate identifier with different bytes is a conflict, emits an audit/security event, and does not overwrite data.

## Retry policy

Retries are bounded, typed, and observable. Store attempt count, first/last attempt time, next eligible time, last sanitized error code, and retry target. Use exponential backoff with jitter for transient provider/network failures and no automatic retry for authentication, permission, privacy, schema, checksum, or invariant failures. Manual retry requires an authorized actor and a reason.

## Audit minimum

Every state change, approval, correction, retirement, provider reference import, publish/revoke delivery, replay conflict, entitlement denial, and admin retry records:

- audit id and UTC time;
- tenant/content/version ids;
- opaque actor or service id and actor type;
- action, previous state, next state, reason code;
- correlation id, causation id, and idempotency key when present;
- source/result checksums;
- sanitized provider/error code;
- request origin and authorization decision id.

Audit payloads exclude access tokens, webhook secrets, raw private transcripts, learner questions, and learner identity attributes.
