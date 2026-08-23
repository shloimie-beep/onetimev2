## Context

The accepted controller already isolates Meeting SDK artifacts by role and browser session. It has a durable live receipt, but its host UI is separate from the Admin shell and its generic CRM/classroom surfaces do not represent the one-class launch operation.

## Goals / Non-Goals

**Goals:**

- Route normal Admin/Rabbi work through one shell and contextual strip.
- Keep the launch classroom boundary truthful: One Time starts the Meeting SDK session, while the host ends it with Zoom’s native control.
- Derive canonical learner access from current entitled identities without making Students CRM contacts.
- Enforce the account-email-only boundary on the server and render safe history.

**Non-Goals:**

- No provider calls, meeting creation, GHL/Resend mutations, billing behavior, Platform Console, Telegram, deployment, or real operator canary.

## Decisions

- The canonical Today route is `/app/today`; legacy Admin routes remain only as semantic redirects or advanced technical entry points. This removes duplicate primary navigation without breaking secure direct links.
- The host client never issues a provider End command. A status-3 event may update local explanatory UI only; it never clears the live marker or claims server-confirmed closure. The host uses Zoom’s native End Meeting for All control.
- Existing entitlement projections remain authoritative. The canonical class resolves eligible Parent and Student identities at access time, avoiding duplicate attendance/CRM identities.
- The live marker remains bounded at its existing two-hour TTL. Parent and Student launch checks require the current marker; expiry is automatic and does not mutate Zoom or require a cleanup route.
- Communications uses an allow-list of app account lifecycle email sources/intents at its global endpoint. Workflow readback remains read-only but is surfaced only through Operations technical navigation.

## Risks / Trade-offs

- [Zoom ends while the host browser is open] → show that One Time access will close automatically; do not infer provider-confirmed server closure.
- [Existing legacy URLs have broader semantics] → retain only aliases whose title, active category, and Back/Forward behavior remain correct.
- [Entitlement data is unavailable] → render unavailable state rather than a manual enrollment workaround.

## Migration Plan

No migration is required. Migration 2288 is removed because it is unmerged and undeployed. Provider-verified event ingestion, exact meeting-instance proof, host-session lifecycle, reconciliation, and app-managed End/Cleanup remain later work.
