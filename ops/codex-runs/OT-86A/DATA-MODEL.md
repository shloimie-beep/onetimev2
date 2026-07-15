# OT-86A Data Model

Packet id: OT-86A  
Branch: codex/ot86a-vimeo-content-kb  
Base SHA: a02d1d254ae0d17804fb657079a7871567260ea2  
Head SHA: pending until commit/push  
Generated UTC: 2026-07-15T17:15:21.808Z

## Tables

- `onetime.ot86_content_items`: tenant-scoped source records, aggregate lifecycle state, retry target, attempts, and current/published version pointers.
- `onetime.ot86_content_state_events`: append-only state/audit events with actor, action, previous/next state, idempotency, checksum, and sanitized error code.
- `onetime.ot86_vimeo_provider_records`: audited Vimeo reference/upload readiness records with sanitized metadata only.
- `onetime.ot86_provider_event_receipts`: provider webhook/poll receipt dedupe, raw-body hash, normalized event key, and conflict state.
- `onetime.ot86_content_versions`: normalized version payloads, sections/artifacts/search docs JSON, privacy flags, approval metadata, and `immutable_after_approval`.
- `onetime.ot86_publication_outbox`: local durable outbox for approved-for-social handoff and related events.
- `onetime.ot86_publication_inbox_receipts`: signed manifest delivery receipts, idempotency keys, raw-body hash, manifest checksum, validation, and queued/applied state.
- `onetime.ot86_published_content_versions`: local delivery projection for active/corrected/revoked/retired versions.
- `onetime.ot86_published_sections`: local sections and deep links.
- `onetime.ot86_published_artifacts`: local artifact metadata and checksums.
- `onetime.ot86_search_documents`: tenant-scoped KB documents for retrieval.
- `onetime.ot86_retrieval_audit_events`: authorization/outcome audit without raw question storage.

## Keys And Indexes

- Duplicate source prevention: `(tenant_id, source_kind, source_record_id, source_sha256)` and `(tenant_id, content_id)`.
- Version immutability/dedupe: `(tenant_id, content_id, version_id)` and `(tenant_id, content_id, normalized_version_sha256)`.
- Publish idempotency: unique `message_id`, unique `(tenant_id, content_id, sequence)`, and unique `idempotency_key`.
- Local serving indexes: active version list, active version by content, section order, deep-link lookup, search-document lookup, and inbox queue.
- Provider replay prevention: unique `(provider, provider_event_id)` and `(provider, normalized_event_key)`.

## Ownership

BNA owns ingest, provider operations, transcription, parsing, review, approval, and publication intent. One Time owns durable receipt, local projection, entitlement-scoped local KB, canonical links, and retrieval serving.

## Retention And Privacy

Provider metadata is sanitized before persistence. Retrieval audits store tenant/principal/decision/outcome/citation count/latency only. Raw learner question text is not persisted by default.

## Immutable Approval

`approveOt86ContentVersion` rejects learner/private flags and marks approved versions immutable. `createOt86CandidateVersion` refuses to update an immutable version in place; corrections use a new `version_id` and explicit supersession.
