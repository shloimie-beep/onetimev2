# OT-86B Implementation

Packet id: OT-86B<br>
Branch: codex/ot86b-buffer-social<br>
Base SHA: 87a1bb7ffd6a2fa0d016a1831894d430aa2ee065<br>
Current head SHA: pending until final commit/push<br>
Generated UTC: 2026-07-15T17:50:30Z

## Implemented Surface

- Added `POST /internal/social-publishing/v1/events` as a raw-body, HMAC-authenticated internal route for OT86A `content.approved_for_social` events.
- Added owner/admin `GET /api/v1/social-publishing/readiness` and `GET /api/v1/social-publishing/drafts` APIs for safe operations readiness/listing.
- Added social publishing contracts under `packages/contracts/src/social/`.
- Added domain workflow logic under `packages/domain/src/social/publishing.ts`.
- Added additive migration `2100_ot86b_social_publishing.sql`.
- Added server-only `bin/ot86-buffer-canary`.
- Added integration tests and `scripts/ot86/social-performance-probe.ts`.

## Workflow

- Event intake verifies headers, timestamp freshness, HMAC signature, event id match, schema, payload checksum, origin, type, and privacy flags before inserting an accepted inbox receipt.
- Dispatch records an approved social source and draft job without calling Buffer.
- Draft generation creates immutable platform revisions for LinkedIn, Facebook, Instagram, and X using only approved excerpts/media from the OT86A event.
- Human approval binds the exact revision hash, media order hash, destination snapshot, capability version, timezone, and future schedule.
- Edits create a new revision, invalidate active approvals, cancel pending commands, and move the draft back to `review_needed`.
- Scheduler selects due commands only, reconciles before create, marks existing posts as published without duplicate writes, and records sanitized provider attempts.
- Retraction only reaches `retracted` after provider confirmation; unsupported deletes enter `retraction_manual_required`.

## UI Readiness

- No dedicated client route or Buffer SDK was added.
- The readiness API reports missing Buffer capability classes so a future UI can show disabled scheduling controls without attempting provider calls.
- Draft list API is owner/admin only and bounded.

## OT86A Independence

- OT86A publication/library/retrieval/outbox tests pass on this branch.
- The OT86B consumer is additive and does not block OT86A event publication when disabled or unconfigured.
