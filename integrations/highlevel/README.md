# One Time HighLevel Business Integration

HighLevel is the One Time business operating system for parent/lead contacts,
marketing consent and suppression, marketing email, WhatsApp, conversations,
opportunities, ordinary follow-up, marketing workflows, and GHL-operated Stripe
billing operations.

One Time remains authoritative for parent authentication, household and student
records, portal access, class/content/progress, leaderboard data, Rabbi-moderated
questions, local entitlement projection, and security email through Resend.
Students never enter HighLevel.

## Modes

- `disabled`: default. No HighLevel sync, reconciliation, provider calls, or live
  route registration.
- `mock`: local/test only. Exercises typed operations without external effects.
- `provider`: fails closed unless location ID, Private Integration Token, webhook
  secret, and protected runtime mode are present.

The code path in this lane never performs a live HighLevel call automatically.
The webhook router is isolated in `apps/web/src/server/features/highlevel/router.ts`
and is not registered in `app.ts`.

## Official API Surface

The provider client is a small typed HTTP client using documented HighLevel API
operations. Private Integration Tokens are sent as server-side bearer tokens.
Contact upsert uses the documented `/contacts/upsert` endpoint. Tags are added
or removed through dedicated tag operations so ordinary contact upsert never
overwrites a complete tag set.

Workflow creation is treated as a HighLevel UI setup task. API enrollment is
allowed only after an operator records an existing workflow ID in
`workflows.yaml` and protected config.

## Signup Flow

`browser -> One Time validates -> local receipt -> HighLevel outbox -> GHL upsert
-> custom fields/tags -> workflow enrollment`

Matching is email first, phone second, and never by name. Email/phone conflicts
become `sync_conflict`. A tag alone must never unlock the One Time portal.

## Manual Upload Policy

The existing production CRM contacts are not uploaded by code in this lane.
Operators may upload contacts manually in HighLevel. The later mapping tool can
dry-run matches, detect conflicts, and store `ghl_contact_id` locally without
creating duplicate HighLevel contacts or changing HighLevel records by default.

## Resend Backlog

The Resend backlog inventory tool is read-only and counts-only in public output.
It does not download attachments by default and does not commit message bodies.
Backfill into HighLevel conversations is a later credentialed step with
idempotency, import tagging, and automation suppression.
