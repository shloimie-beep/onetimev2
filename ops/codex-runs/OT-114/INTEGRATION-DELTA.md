# OT-114 Integration Delta

## Routes And APIs

- `GET /app/support` and `GET /app/support/receipts/:receiptId` now render support inside the authenticated CRM shell.
- `GET /api/v1/support/eligibility` exposes server-side subscriber/owner-admin eligibility and categories.
- `GET /api/v1/support/tickets` lists authenticated support tickets with human states.
- `POST /api/v1/support/tickets` accepts OT-114 categories and emits scoped support events.
- `GET /api/v1/crm/tags`, `POST /api/v1/crm/tags`.
- `POST /api/v1/crm/contacts/:contactId/tags/:tagId` and `/remove`.
- `POST /api/v1/crm/contacts/:contactId/notes`.
- `POST /api/v1/crm/contacts/:contactId/archive`.
- `POST /api/v1/crm/contacts/:contactId/replies/preview`.
- `POST /api/v1/crm/contacts/:contactId/replies/confirm`.

## Data And Contracts

- Added migration `packages/db/migrations/2010_ot114_crm_communications_support.sql`.
- Support categories are now `access_login`, `class_zoom`, `billing`, `content`, `technical_bug`, `account_family`, and `other`.
- Added `onetime.crm_reply_drafts` for provider-off reply confirmations.
- Contact contracts now include tags, system facts, relationships, notes, tasks, support tickets, enrollment summary, and timeline.
- Communications contract now distinguishes `queued`, `provider_accepted`, `delivered`, `failed`, `bounced`, `complained`, `suppressed`, `draft_saved`, and `unknown`.
- Support event producer includes account/product scope, severity, redacted summary, idempotency-key hash, and operator triage fields.

## Client UX

- Added `SupportFeature` to the authenticated app shell.
- CRM detail now shows profile facts, custom tags, system facts, relationships, enrollment, support tickets, tasks, notes, reply draft controls, timeline, and archive.
- Single-recipient reply preview shows masked destination, channel, body revision, provider-off mode, blockers, and no-send messaging.
- Support forms use human labels and avoid receipt IDs, event names, signatures, delivery versions, or provider payloads in normal UI.

## Tests Added Or Updated

- Added CRM integration coverage for tags, notes, archive, provider-off reply preview/confirm/idempotency, system facts, timeline, and sink outbox proof.
- Updated support integration coverage for OT-114 categories and emitted support-event fields.
- Updated communications unit/integration expectations for the expanded local state model.
- Updated browser, accessibility, and performance fixtures for support categories and communications labels.
