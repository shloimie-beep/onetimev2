# DIRECT CODEX EXECUTION PROMPT — OT-72 PROVIDER/SANDBOX TRAIN

Run this after OT-60R has produced a remotely checkpointed canonical candidate.
It may run in parallel with OT-71 because it owns provider adapters/config/
workers only and must not edit shared app-shell or central route wiring.

```text
TASK ID: OT-72
MODE: IMPLEMENT PROVIDER ADAPTERS AND TEST/STAGING READINESS; CHECKPOINT EACH PHASE
REPOSITORY: webcraft-media/onetimev2
SOURCE BRANCH: codex/ot60r-recovery-convergence
TARGET BRANCH: codex/ot72-provider-sandbox-train
STRIPE TEST/SANDBOX USE: AUTHORIZED
LIVE STRIPE CHARGES: NOT AUTHORIZED
LIVE/BULK EXTERNAL SENDS: NOT AUTHORIZED
DEPLOYMENT/DNS/PRODUCTION DATABASE: NOT AUTHORIZED

ROLE

You are the senior provider-integration engineer for standalone One Time. Build
server-only, default-off, test/sink-capable adapters and provider-event truth for
Stripe, email, WhatsApp, Zoom, Vimeo and the separate One Time Telegram bot. Do
not mount shared UI or modify central application composition; OT-80 will wire
accepted adapters after OT-71 and OT-72 converge.

## Correct repository and automatic source

Treat the active directory as untrusted. If it is BNA, do not run BNA scripts or
modify BNA. Locate/create a clean `webcraft-media/onetimev2` worktree. Fetch
`origin/codex/ot60r-recovery-convergence`, read
`ops/execution/control/CANONICAL-CANDIDATE.json`, and verify its recorded SHA
matches the fetched remote head. Create `codex/ot72-provider-sandbox-train` from
that exact SHA.

Do not use literal SHA placeholders and do not ask the user to reconstruct old
heads. Resolve dependencies from remote refs, PRs and repository manifests.

## Persist before provider preflight

Before checking credentials or provider readiness, store this full prompt and
initialize:

- `ops/execution/ot-72/ORIGINAL-PROMPT.md`
- `ops/execution/ot-72/STATE.json`
- `ops/execution/ot-72/INPUTS.json`
- `ops/execution/ot-72/CHECKPOINT.md`
- `ops/execution/ot-72/IMPLEMENTED.md`
- `ops/execution/ot-72/REMAINING.md`
- `ops/execution/ot-72/DECISIONS.md`
- `ops/execution/ot-72/BLOCKERS.json`
- `ops/execution/ot-72/TEST-RESULTS.md`
- `ops/execution/ot-72/INTEGRATION-MANIFEST.md`
- `ops/execution/ot-72/RESUME.md`
- per-provider phase ledgers under `ops/execution/ot-72/phases/`.

Commit and push this packet before external-readiness work. Checkpoint at least
after each provider phase and before/after any authorized test-mode provider
call. A blocker in one provider must not stop independent provider phases.

## Ownership and collision boundary

Own only feature-local provider adapters, provider event/webhook contracts,
workers, config parsers, repository implementations, tests and evidence. Do not
edit:

- shared AppShell/navigation;
- central route registration/application composition;
- parent/student portal UI;
- CRM UI;
- shared auth/session logic;
- public landing/signup UI.

Expose typed registration hooks and integration manifests for OT-80. If a
central file is essential for a runnable provider test harness, keep it to the
smallest isolated test-only composition and document it as a collision.

Use additive migration namespace `1700-1799` only after verifying it is free.
Do not alter accepted migrations.

## Secret and external-action rules

- Never print, log, commit, hash into public evidence, or expose credential
  values, webhook secrets, phone numbers, emails, class URLs or provider IDs.
- Use approved secret storage and report only configured/not-configured,
  test/live mode, safe fingerprints and capability names.
- No provider call occurs at import, startup, health, landing, signup, login,
  CRM list or ordinary portal read.
- Test/sandbox Stripe use is authorized, but only test-mode credentials/objects.
  Reject all `sk_live_`, live-mode events/objects and live endpoints.
- No live charge, live subscription, production customer mutation, refund,
  provider publication, bulk send, real user invitation, webhook registration,
  DNS/Railway mutation or production migration.
- A test canary send/provider mutation requires an existing protected config
  flag naming the exact channel and canary destination/resource. Missing flag is
  a subphase blocker; implement sink/test code and continue.

## Phase 1 — Stripe test-mode Checkout and parent billing adapter

Reconcile the integrated OT-46 fixture foundation and OT-52 billing seam.

Implement server-only Stripe test adapter using the official SDK only if the
accepted dependency policy allows it. Requirements:

- test/live fail-closed separation;
- account/product/offer/price mapping with opaque local IDs;
- parent billing principal derived from authenticated household relationships,
  never email alone;
- idempotent test Customer/Checkout/Customer Portal session methods;
- fixed allowlisted server-built success/cancel/return routes;
- raw-body webhook signature verification before JSON parsing;
- immutable event ledger, replay protection and ordered reconciliation;
- entitlement changes only from authoritative verified subscription/invoice
  events plus explicit local policy, never Checkout creation alone;
- subscription/invoice/payment-method summaries with bounded safe DTOs;
- no card data storage;
- portal adapter for OT-52 and status adapter for Rabbi dashboard.

Commercial policy is still a configuration gate. Historical statements about
`$67`, 30 days and free-until-Rosh-Hashanah conflict. Do not silently choose.
Model the offer policy explicitly and keep checkout unavailable until one exact
policy record identifies currency, amount, free-period rule/date, tax,
cancellation/refund, Stripe account, product and price references. Test fixtures
may use clearly synthetic noncommercial values.

If protected test credentials plus exact test product/price/portal configuration
are already present and the exact test-canary flag is enabled, run bounded
sandbox verification and record safe object fingerprints/status only. Otherwise
complete adapter/tests and mark canary pending. Never request secret values in
chat.

Checkpoint, commit and push.

## Phase 2 — Resend email and WAPI/WhatsApp provider truth

Reconcile the integrated outbox/worker and Communications V1A.

Implement:

- server-only Resend and WAPI adapters behind deny-by-default flags;
- provider acknowledgement IDs stored server-side and redacted;
- authenticated webhook ingestion with raw-body signature/auth verification,
  request limits, replay/idempotency and out-of-order convergence;
- truthful states: queued locally, sink processed, provider accepted, delivered,
  failed, bounced, complained, suppressed, expired and dead-lettered only from
  authoritative evidence;
- verified inbound WhatsApp/email events only where the actual provider source
  supports them; missing source means unavailable, not empty inbox;
- consent/suppression/contact/archive/account/product checks at dispatch;
- bounded retry/dead-letter and operator repair reason codes;
- contact-local projection hooks without message-body/raw-payload leakage.

Family email acknowledgement remains eligible for every valid signup. Family
WhatsApp requires chosen channel, valid phone, consent and no suppression.
School output is generic acknowledgement/human follow-up only, with no class,
portal, access or payment claim.

Public WhatsApp reactive auto-reply may be supported for valid inbound senders
only behind the approved public-autoreply policy and provider canary gate. Do not
bulk-message anyone.

No canary flag means run sink/provider-fixture tests only. Checkpoint, commit and
push.

## Phase 3 — Zoom protected live-class adapter

Build a server-only Zoom adapter for the OT-71 class module contract without
modifying central routes.

Preserve:

- daily 19:00 `Asia/Jerusalem` schedule and DST behavior;
- Rabbi account/host ownership and mute-on-entry policy;
- protected last-moment launch; no raw join URL in persistent client data;
- occurrence-specific provider reference and readiness;
- webhook/event replay protection and attendance-source seam;
- provider unavailable/late/failed states;
- no Zoom call at startup or ordinary route load.

Inspect configured readiness safely. Read-only provider verification may occur
only if an approved config gate exists. Meeting creation/edit, webhook
registration or live-class mutation requires a separate explicit canary flag and
is otherwise forbidden. Implement fixtures and tests regardless.

Checkpoint, commit and push.

## Phase 4 — Vimeo protected playback/outcome adapter

One Time does not own Studio, Drive intake, editing, transcription execution or
social repurposing. Those remain BNA. Build only:

- server-only provider metadata/readiness adapter;
- protected short-lived playback descriptor seam;
- privacy/embed-domain verification;
- opaque provider references/digests;
- redacted async outcome authentication/replay/order support for OT-71 content;
- provider unavailable/failure normalization;
- zero raw Vimeo/Drive URL/token exposure.

Upload, edit, delete, privacy mutation, folder mutation, webhook registration or
publication is forbidden unless a separate exact provider-canary flag names the
operation and disposable test asset. Missing readiness does not block adapter
implementation.

Checkpoint, commit and push.

## Phase 5 — Separate One Time Telegram transport

Reconcile OT-51's mock-only bot foundation. Implement a real transport adapter,
webhook ingress and worker ownership only behind default-off flags:

- distinct One Time bot identity/token, never Academy token;
- server-side Telegram-user mapping to One Time owner/admin;
- fixed account/product scope;
- webhook secret verification, request limits and update dedupe;
- one consumer/lease per token;
- deny-by-default commands;
- preview/confirmation/idempotency/audit for writes;
- no BNA/platform context;
- redacted CRM/class/content/task responses.

Do not register a webhook, start a long-lived consumer or message Telegram
without exact staging token ownership, mapping, single-consumer and canary flags.
Fixture/mock verification remains useful and must proceed.

Checkpoint, commit and push.

## Phase 6 — Asynchronous BNA oversight contract

Implement the One Time producer side of a versioned redacted asynchronous
control-plane outcome contract. Do not edit BNA in this branch and do not create
a synchronous dependency.

Allowed outcome categories include safe deployment/source health, migration and
worker readiness, provider readiness without values, bounded operational counts,
repair reason codes and timestamps. Never export contacts, message bodies,
students, household data, transcripts, class links, invoices, payment methods,
provider IDs, credentials or raw logs.

Use outbox semantics, schema version, stable event ID, source SHA,
account/product scope, signature/auth seam, idempotency/retry/dead-letter and
staleness. Produce a consumer contract/fixture and a separate BNA follow-up
manifest; no BNA runtime write.

Checkpoint, commit and push.

## Verification

Use disposable PostgreSQL 16/CI for migrations, webhook replay/order,
concurrency, worker leases and indexed queries. Run unit/integration/security,
secret/PII/provider-URL scans, build, no-network-at-startup checks and adapter
contract tests. Test-mode provider evidence must distinguish not configured,
configured, authenticated, canary-verified and live; never collapse them.

Create no app navigation and claim no user-facing integration until OT-80 mounts
and verifies it.

## Publication

Open one draft PR from `codex/ot72-provider-sandbox-train` targeting
`codex/ot60r-recovery-convergence`. Do not merge or deploy.

Update `RESUME.md`, state and manifests before every end/blocker. Final chat
response contains only PR/branch/base/head, phase matrix, sandbox/provider calls
actually performed, tests, blockers, resume path, external mutation counts and
git status. The repository is the durable handoff.
```