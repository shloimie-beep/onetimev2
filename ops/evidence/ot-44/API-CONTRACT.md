# OT-44 API Contract

Owned registration hook: `apps/web/src/server/communications/register.ts`.

Routes provided by hook:

- `GET /api/v1/communications`
- `GET /api/v1/crm/contacts/:contactId/communications`
- `GET /app/communications` page hook for later shell binding

The shared server entry is intentionally not edited in this branch.

Contact-local behavior:

- The contact path identifier is checked against the authenticated session scope before outbox projection.
- Missing or cross-scope contact identifiers return `404`.

Allowed query filters:

- `from`: RFC 3339 instant
- `to`: RFC 3339 instant
- `channel`: `email`, `whatsapp`, `internal_email`
- `intent_type`: audited safe intent type
- `status`: `intent_queued`, `sink_processed`, `status_unavailable`
- `limit`: 1 through 25, default 25

Cursor:

- Response field: `next_cursor`
- Request header: `X-OT-Communications-Cursor`
- Not accepted in a URL query parameter.
- Encrypted and authenticated with AES-256-GCM.
- Binds scope, mode, contact, filters, limit, and expiration.

Response truth:

- `availability`: `available` or `unavailable`
- `source_scope`: `local_communication_intents_only`
- `mailbox_complete`: `false`
- Capabilities explicitly mark provider acceptance, provider delivery, inbound import, replies, threads, subject/body access, attachments, reminder execution, compose, resend, campaigns, templates, and integration settings unavailable.

Item fields only:

- `channel`
- `intent_type`
- `event_label`
- `local_state`
- `state_label`
- `recipient_masked`
- `queued_at`
- `state_at`
- `contact_path`

Every Communications API response path sets:

- `Cache-Control: private, no-store`
- `Vary: Cookie`
