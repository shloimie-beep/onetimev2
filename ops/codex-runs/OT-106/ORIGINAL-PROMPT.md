# OT-106 - Buffer Social Draft and Publishing Runtime

## Mission

Build the Rabbi's One Time social-publishing domain and Buffer runtime. V1 accepts approved social derivatives from the One Time content pipeline, creates auditable Buffer drafts, and supports owner-approved scheduling. It must never expose private classroom material or publish automatically by default.

Use Buffer's current official authentication, GraphQL, post/scheduling, error/rate-limit and media-hosting documentation. Verify API behavior rather than relying on remembered endpoints.

## Source

- Repository: `webcraft-media/onetimev2`
- Exact base SHA: `fb3c397ce8ece100cf7873fdddcd940a1552ea9b`
- Branch: `codex/ot106-buffer-social-publishing-runtime`
- Draft PR base: `codex/ops03-staging-readiness-repair`
- Additive migration reservation: `2160_ot106_buffer_social_publishing.sql` if durable social queue/state does not already exist.
- Clean isolated worktree only.

Persist `ops/codex-runs/OT-106/{ORIGINAL-PROMPT.md,STATE.json,PROGRESS.md,DECISIONS.md,BLOCKERS.md,RESUME.md,FINAL-REPORT.md}`. Missing Buffer account/channel configuration blocks only provider canary.

## Collision boundary

Own social contracts/domain/Buffer client/feature-local worker/scripts/tests/evidence. Do not edit shared app/config/worker/main/env/root manifests, landing/auth/portals, other providers, Railway or BNA. Export factories/read-only status projection and write `OPS04-INTEGRATION-DELTA.md`.

## Implementation

- Signed account/product-scoped publication manifest from trusted One Time content pipeline: provenance, approved caption, public-safe derivative references, target channel aliases, mode `draft` or `scheduled`, UTC due time, approval actor/time and idempotency key.
- Reject caller-supplied Buffer organization/channel IDs; map approved aliases server-side.
- Durable state machine: received, validated, awaiting approval, queued, provider draft created, scheduled, sent, retryable failure, dead-lettered, canceled.
- Lease/generation-safe claims, retry/backoff, immutable audit and unique artifact/channel/idempotency rules.
- Buffer client with protected bearer key and exact internal organization/channel allowlists. Account-wide provider credentials do not weaken internal isolation.
- Parse both HTTP and GraphQL/mutation errors correctly. Handle authorization, deleted-channel drift, rate limits/Retry-After, 5xx/timeouts and partial failures truthfully.
- Default provider operation creates a Buffer draft only. Scheduling requires recorded owner/admin approval plus explicit runtime authorization. Prohibit immediate/share-now publishing in this branch.
- Support text/image/video contracts, but media must be an approved public-safe stable HTTPS derivative. Never pass private Vimeo/classroom links, signed/expiring URLs, student recordings/questions/names/faces or other learner data. If no safe media exists, create text-only draft or pause.
- Modes: disabled, sink, Buffer draft, Buffer scheduled. Default disabled/sink. Provider failure cannot break classroom/content flows.

## Tests and canary

Test bad signature, wrong account/product, arbitrary org/channel, missing approval, duplicate input, lease race, revoked token, forbidden/deleted channel, HTTP-200 GraphQL error, mutation error, 429, timeout/5xx, past schedule/DST, unsafe media URLs, learner-data sentinels, replay and cancel.

Run a 10k synthetic queue proof and prove no new client bundle/provider request on public/CRM routes.

Always run sink proof. If protected Buffer key exists, perform read-only organization/channel discovery and validate internal allowlists. Only with `OT106_BUFFER_DRAFT_CANARY_AUTHORIZED=true`, create one unmistakably synthetic text-only draft in one allowlisted channel. Do not schedule or publish it. Missing accounts/channels must not stop implementation/PR.

Run scoped checks and open a draft PR. Final report includes branch/SHA/PR, schema/checksum, manifest/state machine, provider modes, tests/volume proof, canary truth, config names, OPS-04 delta, rollback and blockers.
