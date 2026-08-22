## Context

The accepted controller already isolates Meeting SDK artifacts by role and browser session. It has a durable live receipt, but its host UI is separate from the Admin shell and its generic CRM/classroom surfaces do not represent the one-class launch operation.

## Goals / Non-Goals

**Goals:**

- Route normal Admin/Rabbi work through one shell and contextual strip.
- Keep provider-end confirmation ahead of local receipt cleanup and make unknown effects non-retriable at the provider layer.
- Derive canonical learner access from current entitled identities without making Students CRM contacts.
- Enforce the account-email-only boundary on the server and render safe history.

**Non-Goals:**

- No provider calls, meeting creation, GHL/Resend mutations, billing behavior, Platform Console, Telegram, deployment, or real operator canary.

## Decisions

- The canonical Today route is `/app/today`; legacy Admin routes remain only as semantic redirects or advanced technical entry points. This removes duplicate primary navigation without breaking secure direct links.
- The host client owns the single SDK End Meeting for All call. A status-3 event is only a reconciliation hint; only verified server-side provider proof for the exact bound meeting instance can record provider end and permit local cleanup. A rejected or interrupted end is an unknown effect, so the UI offers reconciliation, not another provider end.
- Existing entitlement projections remain authoritative. The canonical class resolves eligible Parent and Student identities at access time, avoiding duplicate attendance/CRM identities.
- Migration 2288 persists the host lifecycle by account, product, and canonical occurrence. It stores domain-separated SHA-256 digests of the meeting reference, exact authenticated session, authorized actor, opaque browser context, and exact provider meeting instance. Narrow verified event rows are digest-only and never contain a raw payload, meeting UUID, token, URL, passcode, ZAK, credential, or raw context.
- Communications uses an allow-list of app account lifecycle email sources/intents at its global endpoint. Workflow readback remains read-only but is surfaced only through Operations technical navigation.

## Risks / Trade-offs

- [A host browser is interrupted during provider end] → retain the receipt and require reconciliation before allowing local cleanup.
- [Existing legacy URLs have broader semantics] → retain only aliases whose title, active category, and Back/Forward behavior remain correct.
- [Entitlement data is unavailable] → render unavailable state rather than a manual enrollment workaround.

## Migration Plan

Apply migration 2288 before enabling the host lifecycle. It is additive and retains expired lifecycle rows only as normal durable history; application rollback leaves those harmless opaque digests unread. No external or provider effect is introduced by the migration.

## Exact host-session authority

The v2.1 session ID or legacy session key is a server-only lifecycle input. Every
host lifecycle read or mutation checks account, product, canonical occurrence,
configured meeting digest, actor digest, exact session digest, lifecycle-context
digest, expiry, and allowed prior state. A second valid session for the same Admin
or Rabbi cannot read, refresh, reconcile, end, or clean up the first session's lifecycle.
The browser keeps only the separate opaque lifecycle context in session storage so
`GET /host-end-status` remains database-read-only across a reload.

## Verified Zoom provider proof

`POST /api/v1/providers/zoom/events` consumes the exact raw JSON body before global
JSON parsing. It applies Zoom's `v0` HMAC contract, a five-minute replay window,
constant-time signature comparison, a 64 KiB limit, event allowlisting, and exact
configured account, host, and recurring-meeting checks. Endpoint validation returns
only the required challenge response.

A verified `meeting.started` event binds one exact meeting-instance digest to one
canonical occurrence within a bounded start-time window. Only `meeting.ended` for
that same instance advances `live | end_requested | unknown_effect` to
`provider_ended`. Delivery can precede or follow lifecycle creation, duplicates are
idempotent, a later distinct instance cannot replace the binding, and cleanup targets
only the correlated occurrence. The old browser-confirmation route is an authenticated
fail-closed tombstone.
