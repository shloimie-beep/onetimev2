# Buffer provider adapter and readiness contract

## Server-only configuration

Recognized environment variables:

- `BUFFER_ACCESS_TOKEN`
- `BUFFER_ORGANIZATION_ID`
- `BUFFER_DESTINATION_IDS`

Values are deployment secrets/configuration. Access tokens never appear in code, client bundles, logs, snapshots, reports, telemetry, exception strings, or command output. Destination ids are server/audit data and are exposed to authorized UI only through opaque labels and capabilities required for selection.

## Adapter boundary

All Buffer operations use a server-only interface equivalent to:

- `readiness()` — returns `unconfigured`, `auth_invalid`, `organization_missing`, `destinations_missing`, `ready`, or `degraded` with safe reason codes.
- `listDestinations()` — returns authorized destination id, safe display label, platform, timezone/capabilities, and capability version.
- `reconcile(command)` — checks whether an idempotent provider post/update already exists.
- `createScheduledPost(command, draft)` — creates one scheduled provider record after all local gates.
- `updateScheduledPost(command, draft)` — only when provider capability permits and a new approval exists.
- `cancelScheduledPost(providerId)` — only for unpublished scheduled records when supported.
- `deletePublishedPost(providerId)` — only when provider reports support and authorization.
- `getPost(providerId)` — obtains safe status needed for reconciliation/audit.

No UI, event consumer, renderer, or controller calls the provider client directly.

## Idempotency and reconciliation

Before a create/update/delete retry, call `reconcile` using stored command idempotency and provider ids. Store one provider attempt record per command/destination/attempt, response status, sanitized code, response-body SHA-256 when retained, and provider object id. Never assume a timeout means no post was created.

Rate limits and transient errors use bounded backoff with jitter. Authentication, organization, destination, privacy, validation, and unsupported-operation failures are non-transient until configuration or content changes.

## Readiness and no-dead-action behavior

Authorized UI receives a safe readiness object and destination capability list from the server. When unconfigured or missing usable destinations, schedule/publish controls are hidden or disabled with a reason such as configuration missing, authentication invalid, or no destination access. Draft and preview work remains available. No success toast or synthetic destination is allowed.

## Read-only canary

Create executable `bin/ot86-buffer-canary` with `--mode read-only`. It validates configuration shape, authenticates, lists accessible organization/destinations, maps platform/timezone/capabilities, performs no create/update/delete, redacts token/provider private fields, supports machine-readable JSON output, and exits nonzero for missing or inconclusive access.

The initial release has no live write canary. A real post is created only by the normal human-approved scheduler path.

## Required checkpoint

When access token, organization context, or usable destination ids are unavailable, write exactly:

```text
WAITING_FOR_BUFFER_ACCOUNTS
```

to `ops/codex-runs/OT-86B/CHECKPOINT`, with one trailing newline. This is an external-readiness checkpoint, not a provider success result.
