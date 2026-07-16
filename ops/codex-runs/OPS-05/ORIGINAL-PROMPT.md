# OPS-05 — Provider control center, webhook conformance, and email readiness

## Mission

Create a provider-neutral, owner-only staging control plane and conformance suite for Resend/email, WhatsApp, Telegram, Zoom, Vimeo, Buffer, Stripe TEST, OpenAI/helper runtime, and the BNA support bridge. Correct unsafe webhook handling before any provider is enabled. This lane owns feature-local operations/readiness/test files and narrow provider-neutral contracts; the final conductor owns shared runtime wiring.

## Source

- Repository: `webcraft-media/onetimev2`
- Exact base: `codex/ops03-staging-readiness-repair` at `fb5f5eebc539afc9e93833e9417ee67524d62c36`
- Branch: `codex/ops05-provider-control-center`
- Draft PR base: `codex/ops03-staging-readiness-repair`
- Inspect current provider inventory and PRs #42–#48 without merging them wholesale.

## Critical email/webhook correction

The audit found the existing Resend webhook verification uses a custom HMAC. Do not enable it. Implement Resend's current documented Svix/raw-body verification semantics: preserve exact raw body before JSON parsing, verify the required `svix-id`, `svix-timestamp`, and `svix-signature` headers using the protected signing secret/library, enforce timestamp/replay policy, and deduplicate idempotently by event/provider ID. Add fixtures for valid, altered-body, wrong-secret, stale, replayed, duplicated, oversized, wrong-content-type, and out-of-order events.

Build equivalent provider-specific conformance fixtures for Stripe, Meta/WhatsApp, Telegram, Zoom, Vimeo, Buffer callbacks where supported, and BNA signed support events. Never force every provider through one invented signature algorithm.

## Owner-only operations surface

Provide a protected capability-gated internal operations route/API, not normal Rabbi/admin navigation, showing per provider:

- `not_configured`, `configured_provider_off`, `sink_tested`, `canary_ready`, `canary_passed`, `degraded`, or `failed`;
- required variable names without values;
- webhook endpoint path and last verified event time/status;
- queue/worker dependency readiness;
- last allowlisted canary summary and rollback/disable action;
- exact distinction between provider accepted, delivered/published, and merely queued.

The Rabbi/admin product experience should show only relevant operational status (for example, class or content processing unavailable), not integration secrets/configuration.

## Canonical endpoint requirements

- Discover endpoints from code/contracts and prove them; never point a webhook at the site root.
- Stripe staging webhook must use the application route currently defined as `/api/v1/billing/webhooks/provider` unless the integrated contract changes it explicitly.
- Every webhook is HTTPS, POST-only, size bounded, content-type validated, signature verified before business processing, replay/deduplication protected, account/product scoped, quickly acknowledged after durable enqueue, and asynchronously processed.
- Webhook handlers must not log full bodies or secrets.

## Email deliverability readiness

Add non-secret checks/evidence for verified sender/domain, SPF, DKIM, DMARC policy/readiness, return-path/bounce handling, reply-to/support mailbox, suppression/bounce/complaint state, lifecycle encryption key, exact canary allowlist, and guarded provider flags. Never claim inbox delivery from API acceptance. No broad send is authorized.

## Canary policy

Canary actions require owner capability, recent email assurance, explicit confirmation, exact allowlisted target/fixture, provider test/sandbox mode where applicable, idempotency key, and audit. This branch must not run a real canary or mutate provider configuration; build the safe executor/contracts and deterministic fixtures. The final conductor may run bounded canaries using protected staging configuration.

## Verification

Run webhook conformance tests, raw-body middleware ordering tests, replay/concurrency/idempotency tests, provider-state projection tests, authorization/step-up tests, secret/PII leak scans, and build/bundle checks. Include a machine-readable capability matrix and canonical endpoint registry.

Persist `ops/codex-runs/OPS-05/{ORIGINAL-PROMPT.md,STATE.json,DECISIONS.md,PROVIDER-MATRIX.json,WEBHOOK-ENDPOINTS.json,RESUME.md,FINAL-REPORT.md}`. Commit/push/open a draft PR. Report exact code/tests and remaining shared wiring. No deploy, provider mutation, real send, charge, Buffer publication, DNS action, production data access, or BNA edit is authorized.
