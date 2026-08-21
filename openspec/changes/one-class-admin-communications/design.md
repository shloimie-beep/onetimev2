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
- The host client owns the single SDK End Meeting for All call. A status-3 event is the definitive confirmation; only then can the server clear the receipt. A rejected or interrupted end is an unknown effect, so the UI offers refresh, not another provider end.
- Existing entitlement projections remain authoritative. The canonical class resolves eligible Parent and Student identities at access time, avoiding a new migration and avoiding duplicate attendance/CRM identities.
- Communications uses an allow-list of app account lifecycle email sources/intents at its global endpoint. Workflow readback remains read-only but is surfaced only through Operations technical navigation.

## Risks / Trade-offs

- [A host browser is interrupted during provider end] → retain the receipt and require reconciliation before allowing local cleanup.
- [Existing legacy URLs have broader semantics] → retain only aliases whose title, active category, and Back/Forward behavior remain correct.
- [Entitlement data is unavailable] → render unavailable state rather than a manual enrollment workaround.

## Migration Plan

No schema migration is required: canonical access is derived from existing account/product-scoped entitlement projections. Rollback is a source rollback; no external or durable provider effect is introduced.
