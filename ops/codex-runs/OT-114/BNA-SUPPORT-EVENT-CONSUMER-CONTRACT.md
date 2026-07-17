# OT-114 BNA Support Event Consumer Contract

This is the One Time producer contract output for the separate BNA consumer lane. BNA code was not edited in OT-114.

## Endpoint

- Method: `POST`
- Path: `/api/internal/integrations/onetime/support-events/v1`
- Content type: `application/json`
- Encoding: UTF-8 raw bytes; verify signature against the exact bytes received before JSON parsing.
- Body size cap: `131072` bytes.

## Required Headers

- `X-OT89-Key-Id`: configured One Time -> BNA HMAC key id.
- `X-OT89-Timestamp`: Unix seconds.
- `X-OT89-Nonce`: 24 random bytes, base64url without padding.
- `X-OT89-Signature`: `v1=` plus lowercase hex HMAC-SHA256.
- `X-OT89-Event-Id`: must equal body `event_id`.

Canonical string lines:

1. Uppercase HTTP method.
2. Exact request-target path.
3. `X-OT89-Timestamp`.
4. `X-OT89-Nonce`.
5. Lowercase hex SHA-256 of raw request body.

Use LF line separators and no trailing line separator.

## Replay And Idempotency

- Reject timestamps outside a 300 second clock-skew window.
- Store `(key_id, nonce)` for at least 86400 seconds and reject replay.
- Deduplicate by `event_id` plus raw-body SHA-256.
- Same `event_id` with different body fingerprint is a security collision and should return `409`.
- Same `source_ticket_id` with matching immutable payload may return the original BNA ticket reference; different immutable payload should return `409`.

## Event Body

Required top-level fields for OT-114 producer output:

- `contract_version`: `1.0.0`
- `event_type`: `onetime.support.ticket.submitted.v1`
- `event_id`
- `occurred_at`
- `producer`: service, environment, deployment id, source commit.
- `scope`: `account_key`, `product_key`.
- `submission`: `source_ticket_id`, `receipt_id`, `outbox_id`.
- `actor`: opaque One Time user/account ids.
- `authorization`: authenticated proof, policy version, account id, entitlement product/id/status, checked time, valid-until.
- `ticket`: category, severity, title, redacted summary, sanitized message, issue details, client context, reply preference, idempotency key hash, operator triage.
- `attachments`: private attachment metadata and private transfer locators only.
- `privacy`: redaction policy, content state, redaction fields/count, false secret/contact-detail flags.
- `trace`: correlation id and request id.

OT-114 categories:

- `access_login`
- `class_zoom`
- `billing`
- `content`
- `technical_bug`
- `account_family`
- `other`

Operator triage:

- Clear reproducible technical bugs may set `bna_triage_candidate: true` and `decision_state: "triage_candidate"`.
- Requests, ambiguous items, new features, and non-reproducible issues must set `decision_state: "decision_needed"` with structured options.
- No code execution, deployment, account action, provider mutation, or external send is authorized by this event alone.

## Consumer Response

Accepted new event:

```json
{
  "accepted": true,
  "duplicate": false,
  "event_id": "evt_01J00000000000000000000000",
  "source_ticket_id": "ots_01J00000000000000000000001",
  "bna_ticket_ref": "bna_01J00000000000000000000002",
  "ingestion_status": "accepted",
  "status_version": 1,
  "received_at": "2026-07-17T00:00:00Z"
}
```

Accepted duplicate:

- Return `200`.
- Return the original `bna_ticket_ref`.
- Do not create another ticket, history row, attachment transfer, or alert.

Retryable statuses:

- `408`, `425`, `429`, `500`, `502`, `503`, `504`, network, DNS, TLS, and timeout failures.

Non-retryable statuses:

- `400`, `401`, `403`, `404`, `409`, `413`, `422`.

## Exclusions

The producer must not send passwords, session tokens, activation/class links, provider secrets, unnecessary raw messages, direct contact details, full household data, private student questions, or attachment bytes/public attachment URLs.

## Status Projection

One Time subscriber UI reads local cached status only. A separate signed status projection request may use:

- Method: `POST`
- Path: `/api/internal/integrations/onetime/support-ticket-status/v1`
- Auth: same HMAC scheme over the actual request target and request body.
- Request fields: `source_ticket_id`, `onetime_account_id`.
- Response fields: `source_ticket_id`, `bna_ticket_ref`, `status`, `public_summary`, `status_version`, `updated_at`.

Allowed BNA status values: `new`, `triage`, `pending_operator`, `waiting_customer`, `in_progress`, `resolved`, `closed`, `rejected`.
