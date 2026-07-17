# OT-86B Data Model

Packet id: OT-86B<br>
Branch: codex/ot86b-buffer-social<br>
Base SHA: 87a1bb7ffd6a2fa0d016a1831894d430aa2ee065<br>
Current head SHA: pending until final commit/push<br>
Generated UTC: 2026-07-15T17:50:30Z

## Entities

- `ot86b_social_event_inbox`: signed event receipts, raw body hashes, payload hashes, validation state, processing state, replay/idempotency keys.
- `ot86b_social_sources`: accepted social source projection from OT86A approved content.
- `ot86b_social_draft_jobs`: draft generation queue.
- `ot86b_social_drafts`: per-platform draft workflow state.
- `ot86b_social_draft_revisions`: immutable revisions with renderer version, source excerpt ids, privacy proof, warnings, and revision checksum.
- `ot86b_social_approvals`: human approval records bound to exact revision, media order, destination snapshot, schedule, timezone, and privacy.
- `ot86b_social_destination_bindings`: Buffer destination binding snapshot for each approval.
- `ot86b_social_publish_commands`: idempotent scheduled provider commands.
- `ot86b_social_provider_attempts`: sanitized provider attempt evidence.
- `ot86b_social_audit_events`: safe audit trail for workflow transitions and security decisions.

## Keys And Constraints

- Event id, idempotency key, source id, job id, draft id, revision id, approval id, binding id, command id, and attempt id are unique.
- `(tenant_id, content_id, version_id, sequence)` prevents duplicate source ordering.
- `(source_id, platform)` prevents duplicate platform drafts.
- `(draft_id, revision_sha256)` prevents duplicate immutable revisions.
- `(approval_id, destination_id)` prevents duplicate commands for the same approved destination.
- Workflow states are constrained in SQL and domain transition logic.

## Indexes

- Event queue: `(processing_state, received_at)`.
- Source list: `(tenant_id, created_at DESC)`.
- Draft list: `(tenant_id, workflow_state, updated_at DESC, draft_id)`.
- Revision lookup: `(draft_id, created_at DESC)`.
- Approval lookup: `(tenant_id, draft_id, approval_state)`.
- Due command selection: `(command_state, scheduled_for, id)`.
- Audit lookup: `(tenant_id, draft_id, created_at DESC)`.

## Ownership And Retention

- Raw OT86A event JSON is stored only after schema/privacy validation.
- Provider responses are stored only as sanitized status/code/hash fields.
- No learner/private flags are permitted in accepted events, revisions, approvals, or commands.
- Leases and attempts are local scheduler state; provider writes stay behind the Buffer adapter boundary.
