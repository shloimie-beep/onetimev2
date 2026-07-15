# OT-44 Baseline Audit

## Scope

- Task: OT-44 Communications V1A, truthful local intent read model.
- Repository: `webcraft-media/onetimev2`.
- Audited SHA: `571b18f36cdc645f757cc3be6b0519f1af3225f6`.
- Branch: `codex/parallel-ot44-communications-v1a`.
- PR base ref: `codex/parallel-base-ot40-571b18f`.
- PR base ref tip verified: `571b18f36cdc645f757cc3be6b0519f1af3225f6`.
- Foundation ancestor proven: `3465bd7d4c6b6829a6be6e4b4f8a003d608f3680`.
- Common ancestor proven: `a73458d1884b8fcb4843c4852425009577f59ef7`.

## Start Gate Evidence

- Source checkout before worktree creation was clean.
- OT-44 branch and worktree were absent before creation.
- Worktree was created directly from `571b18f36cdc645f757cc3be6b0519f1af3225f6`.
- New worktree HEAD equals the audited SHA.
- No merge, rebase, or unrelated branch update occurred.

## Migration Inventory

| Migration | SHA-256 |
| --- | --- |
| `0001_onetime_lead_slice.sql` | `c6290bffe0fd832332d6c72f44c7499bf4ab56155e70875ff1d2c76d9fa667c0` |
| `0002_crm_auth_core.sql` | `be47978a67c11f058bea4e2216305ca76e3eeb4e52af4cf2e931b3d9b7c3b09c` |
| `0004_delivery_worker_claim_index.sql` | `bf18bcd8510dcb12cd47f35288a322f9073d55a5bff92411c4366ac323363686` |

No migration exists in reserved OT-44 namespace `1200..1299` at the audited SHA.

## Schema Findings From Applied Migration Text

`onetime.outbox_events` columns:

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `delivery_key text NOT NULL UNIQUE`
- `account_key text NOT NULL`
- `product_key text NOT NULL`
- `contact_key text`
- `signup_key text`
- `event_type text NOT NULL`
- `channel text NOT NULL CHECK (channel IN ('email', 'whatsapp', 'internal_email'))`
- `transport_mode text NOT NULL DEFAULT 'sink'`
- `payload jsonb NOT NULL`
- `status text NOT NULL DEFAULT 'pending'`
- `attempts integer NOT NULL DEFAULT 0`
- `next_attempt_at timestamptz NOT NULL DEFAULT now()`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `delivered_at timestamptz`

Outbox schema has no check constraint for `status`. The integrated type lists possible worker statuses, but persisted truth must be proven by current producers and workers.

Current indexes relevant to communications:

- `outbox_events_delivery_worker_sink_claim_idx` on account/product/transport/event/channel/status/next_attempt_at/created_at/id, partial to sink pending/processing supported event-channel pairs.

## Audited Event And Channel Pairs

Current contract and producer allowlist:

- `family_signup_email_ack.v1` + `email`
- `family_signup_whatsapp_confirmation.v1` + `whatsapp`
- `school_signup_email_ack.v1` + `email`
- `school_signup_whatsapp_receipt.v1` + `whatsapp`
- `internal_lead_alert` + `internal_email`

Unknown event types must not be echoed into the public Communications DTO.

## Producer Paths

Current local producer:

- `packages/domain/src/lead/service.ts`
- Inserts `onetime.outbox_events` during public signup capture.
- Insert columns: `delivery_key`, `account_key`, `product_key`, `contact_key`, `signup_key`, `event_type`, `channel`, `transport_mode`, `payload`.
- Inserted rows rely on defaults for `status='pending'`, `attempts=0`, `next_attempt_at=now()`, `created_at=now()`, and `delivered_at=NULL`.
- Producer also writes `onetime.audit_events` for `lead_captured`, but audit rows are not Communications rows.

Payload contains recipient hashes, policy metadata, and for internal owner alerts `contact_key` and `signup_key`; Communications V1A must not read payload to recover recipients or expose raw/payload identifiers.

## Worker State Transition Matrix

| State | Allowed by schema/type | Written by producer | Written by integrated worker | Safe public V1A mapping |
| --- | --- | --- | --- | --- |
| `pending` | Yes | Yes, default | Retry returns row to `pending` | `intent_queued` / `Queued locally` |
| `processing` | Yes | No | Claim updates pending/stale processing to `processing` and sets `next_attempt_at` to lease expiry | `status_unavailable` unless observed only as transient internal lease state |
| `sink_delivered` | Yes | No | Sink receipt completion writes `sink_delivered` and `delivered_at` | `sink_processed` / `Processed in test mode` |
| `delivered` | Yes, dormant type path | No | Outcome code can write when receipt is non-sink, but current config/router is sink-only | `status_unavailable`; not provider truth in V1A |
| `suppressed` | Yes | No | Terminal contact suppression writes `suppressed`; no provider delivery implied | `status_unavailable` for V1A unless later product copy explicitly audits it |
| `skipped` | Yes | No | Terminal eligibility/window skip writes `skipped`; no provider delivery implied | `status_unavailable` for V1A unless later product copy explicitly audits it |
| `dead_lettered` | Yes | No | Terminal retry exhaustion writes `dead_lettered`; no provider delivery implied | `status_unavailable` for V1A unless later product copy explicitly audits it |
| unknown/null/contradictory | Schema permits unknown status text because no status check exists | Not current producer | Not current worker intentionally | `status_unavailable` / `Status unavailable` |

The worker logs and audit metadata use opaque hashed delivery references. Audit events associated with delivery completion are not Communication intent rows.

## Timestamp Semantics

- `created_at`: outbox intent creation time; safe as `queued_at`.
- `delivered_at`: set when worker completes a sink or non-sink delivered outcome. Current integrated runtime is sink-only, so `delivered_at` can support `state_at` for `sink_processed` only when status is `sink_delivered`.
- `next_attempt_at`: scheduling or lease-expiry timestamp depending on state. It must not be exposed as sent, delivered, attempted, or processing time.
- `attempts`: internal worker counter; do not expose.

## Authenticated Session Findings

Current authenticated app and APIs use:

- `apps/web/src/server/app.ts`
- `packages/domain/src/auth/service.ts`

Session object returned to browser includes user identity/role and `expires_at`, but does not expose `account_key` or `product_key`.

`getSessionByToken` derives account/product scope server-side from `AppConfig`, joins `user_sessions` to `account_users`, and mutates `last_seen_at` on every session lookup. `ensureSessionCsrfCookie` may rotate CSRF and also update `last_seen_at`.

Communications V1A therefore cannot call existing `getSessionByToken` directly and still satisfy the read-only contract. This branch must use a Communications-owned `ReadOnlySessionScopePort` with deterministic adapters and document later binding to an accepted non-mutating session resolver.

Role helpers currently use explicit role checks for contact editing. Communications must use its own explicit allowlist: `owner`, `admin` allowed; all other or malformed roles denied.

## Client And Shell Findings

Authenticated app entry:

- Vite app input: `apps/web/src/client/app/crm-entry.tsx`
- Authenticated server route: `/app/crm` and `/app/crm/*`
- Current contact detail path: `/app/crm/contacts/:contactId`

The existing app is a single CRM React entry, not yet route-chunked for Communications. OT-44 must not edit the shared CRM entry or AppShell hotspot, so it will provide Communications-owned lazy route/tab descriptors and a feature entry for later shell integration.

Current CRM overview opens directly on contact details. There is no Communications tab today.

Browser fetches currently omit `cache: "no-store"` and do not use a shared persistent query cache. No `localStorage`, `sessionStorage`, `IndexedDB`, `CacheStorage`, or service worker use was found in authenticated app code.

## Logging And Cache Findings

- `traceMiddleware` exists in observability and the app sets `Cache-Control: no-store` on authenticated HTML and session response.
- CRM API responses do not consistently set `Cache-Control: private, no-store`.
- Communications route registration must set `Cache-Control: private, no-store` on every success and error response and `Vary: Cookie` where cookie-backed auth is used.
- Communications code must not log raw dynamic paths, query strings, cursor values, recipient fields, payload, or contact identifiers.

## Capability Evidence Matrix

| Capability | Evidence at audited SHA | V1A availability |
| --- | --- | --- |
| Local signup/outbox intent rows | Producer inserts outbox rows for signup events | Available |
| Synthetic sink processing | Worker uses `SinkDeliveryRouter`; completion writes `sink_delivered` | Available as test-mode processing only |
| Provider acceptance | No provider adapter is active in integrated runtime | Unavailable |
| Provider delivery | No provider delivery proof exists | Unavailable |
| Inbound import | No inbound mailbox source exists | Unavailable |
| Replies/threads | No reply/thread schema or source exists | Unavailable |
| Subject/body/HTML/attachments | Worker can build requests internally, but Communications must not expose payload/body | Unavailable |
| Reminder execution completeness | Outbox is local intent/worker only | Unavailable |
| Compose/resend/campaign/template/settings | No V1A mutation surface owned here | Unavailable |

## Public Normalized-State Proposal

- `pending` -> `intent_queued` / `Queued locally`
- `sink_delivered` -> `sink_processed` / `Processed in test mode`
- all other, unknown, null, contradictory, unsupported, or uninterpretable statuses -> `status_unavailable` / `Status unavailable`

## Explicit Exclusions

Do not expose payload, raw recipient, full display name, raw email, raw phone, contact key, signup key, delivery key, outbox UUID, class link, provider, provider ID, provider receipt, subject, body, HTML, attachment metadata, integration config, retry error detail, worker lease timestamps, internal notes, arbitrary audit metadata, cursor values, or production identifiers.

Do not union `audit_events` or `signup_leads` into Communications rows. Signup/contact rows may be bounded supporting context only after a selected outbox intent.

## Real PostgreSQL Status

`OT44_TEST_DATABASE_URL` is not configured in this local environment. `psql` and `docker` are not available. Per the packet, pg-mem is not equivalent proof. Real PostgreSQL pg_catalog inspection and 10k `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` plan proof are marked `integration_pending`; implementation may continue with deterministic synthetic adapter tests and exact later commands recorded in the integration manifest.

## Unresolved Contradictions

No contradiction blocks a truthful V1A local-intent projection. The only unresolved gate is real disposable PostgreSQL proof, which is `integration_pending` rather than a module-build stop condition.
