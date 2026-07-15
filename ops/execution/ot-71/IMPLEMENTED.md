# OT-71R Implemented

## Initial Execution Packet

- Created the OT-71R worktree and branch from the immutable authorized base.
- Preserved the execution prompt under `ops/execution/ot-71/ORIGINAL-PROMPT.md`.
- Recorded base resolution, input manifest, checksums, non-blocking inherited control drift, current checkpoint, resume instructions, blockers, test results, integration manifest, and phase ledgers.

## Product Code

## Phase 1: Canonical Class Occurrence And Fulfillment

- Added migration namespace `1100` for class series, class occurrences, fulfillment intents, attendance marks, access requests, and class reminder sink claim indexing.
- Added canonical daily 19:00 Asia/Jerusalem scheduling with 18:30 reminder boundary handling, immediate 18:30-19:00 dispatch, next-day targeting at/after 19:00, and DST-safe conversion.
- Added class reminder delivery event types for email and WhatsApp, eligibility checks, message building, and delivery worker sink claim support.
- Updated lead capture so signup/contact/idempotency commit first; class reminder scheduling runs after commit and fails closed without blocking public signup.
- Kept School submissions lead-only with no class target, fulfillment intent, class occurrence, or entitlement.
- Added owner/admin class list/detail APIs exposing readiness and fulfillment counts with `provider_unavailable` state.
- Added portal class access adapter hooks returning protected `provider_unavailable` launch descriptors without raw Zoom/provider targets.
- Added unit and integration coverage for DST/boundaries, replay/idempotency, school negatives, owner/admin API role gates, portal descriptors, delivery eligibility, and no provider URL leakage.

## Phase 2: Provider-Neutral Content And Library

- Added migration namespace `1400` for content items, content revisions, content item entitlements, content outcome idempotency records, content audit events, content redaction events, and content retention events.
- Added content lifecycle contracts for `received`, `transcribing`, `processing`, `review_needed`, `published`, `failed`, and `superseded` states.
- Added local asynchronous content outcome admission with deterministic idempotency replay, changed-byte idempotency conflicts, stale older revision handling, and newer revision supersession.
- Added recursive transcript/source/review/playback metadata redaction so raw provider URLs, URL-shaped keys, credential-like keys, and provider refs are not persisted or returned.
- Stored provider event/source refs as SHA-256 digests only.
- Added all-active-learner entitlements for published outcomes and a portal adapter that returns only published entitled video/source library items and sheet/review items.
- Added local protected content/review actions under app-relative paths with no Vimeo/provider URLs.
- Added owner/admin content library list/detail APIs and a CSRF-protected local outcome admission endpoint; viewer sessions are denied.
- Added unit and integration coverage for redaction, replay/idempotency, stale revision ordering, supersession, portal entitlement filtering, bounded lists, owner/admin APIs, CSRF, and no raw provider URL leakage.

## Phase 3: Account And Credential Lifecycle

- Added migration namespace `1700` for account lifecycle tokens, local delivery intents, idempotency records, audit events, session invalidations, learner identity links, and expanded parent/student canonical account roles.
- Added account lifecycle contracts for owner/admin invitation, parent activation, student setup/reset, password reset, token completion, delivery summaries, and student state responses.
- Added default-off local sink lifecycle delivery intents that persist only token digests and safe metadata; direct tests receive proof tokens only from the immediate service response.
- Added owner/admin invitation acceptance through canonical users with required privileged TOTP MFA lifecycle.
- Added parent activation and parent-managed student setup/reset/suspend/restore while keeping learner profiles separate from login identities.
- Added password reset requests with durable rate limits, expiring hashed single-use tokens, audit rows, and session-family invalidation.
- Reused existing `account_users`, password hashing, MFA, session, security-version, and rate-limit runtime; no second auth system was introduced.
- Added integration coverage for invitation replay/conflict, raw-token non-persistence, parent/student lifecycle, student session invalidation, password reset single-use behavior, and migration application.
