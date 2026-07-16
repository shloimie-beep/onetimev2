# Codex Packet — OT89A One Time Subscriber Support Producer

## Mission

Implement the One Time producer half of OT89 in `webcraft-media/onetimev2`. The result is a subscriber-only support form and durable local outbox that delivers the frozen signed support event to BNA asynchronously. The subscriber request path must never load, embed, call, poll, or wait for BNA or its UI.

Work only in a clean isolated clone or worktree created for this task. Do not edit any BNA repository. Do not broaden scope into BNA cleanup, school separation, a brand control plane, unrelated refactoring, or dependency modernization.

Proceed without asking for implementation choices that can be resolved from repository conventions. Stop only when a required remote precondition is absent, authentication prevents read/push access, or the repository contains mutually incompatible authoritative policies. Record any stop condition in the persistent run files before exiting.

## Packet inputs and integrity

This prompt is distributed with:

- `SUPPORT-EVENT-CONTRACT.json`
- `AUTHORIZATION-MATRIX.md`
- `TRIAGE-POLICY.md`
- `ACCEPTANCE-MATRIX.md`
- `SHA256SUMS.txt`

Before repository work:

1. Verify every line in `SHA256SUMS.txt` from the packet root using SHA-256.
2. Parse `SUPPORT-EVENT-CONTRACT.json` as JSON and validate its included example against the schema.
3. Treat these files as immutable. Do not “improve,” reorder, reformat, or regenerate the contract.
4. Refuse to continue when a checksum or schema validation fails.

## Git and base-branch preflight

Use these exact repository and branch names:

- repository: `https://github.com/webcraft-media/onetimev2.git`
- required remote base: `codex/ot84-telegram-action-gateway`
- feature branch: `codex/ot89a-subscriber-support-producer`

Execute the equivalent of the following in the current shell, adapting syntax only for the operating system:

1. Confirm `git`, the repository host authentication, and `gh` are usable.
2. Run `git ls-remote --exit-code --heads https://github.com/webcraft-media/onetimev2.git refs/heads/codex/ot84-telegram-action-gateway`.
3. Record the exact remote base commit. Do not use a local branch of the same name as evidence.
4. Create a new clean clone in a task-specific temporary directory. Do not reuse a dirty worktree.
5. Fetch the required base and all remote feature-branch state.
6. When `origin/codex/ot89a-subscriber-support-producer` does not exist, create it from the exact recorded `origin/codex/ot84-telegram-action-gateway` commit.
7. When the feature branch already exists, resume it without force-push after proving its merge base descends from the recorded required base. If it does not descend from that base, stop and document the conflict; do not rewrite it.
8. Set upstream tracking and confirm the worktree is clean before any edits.

Never force-push, reset a shared branch, amend a remote commit, or delete remote state.

## Persistent run record

Create `ops/codex-runs/OT-89A/` before implementation and keep it current throughout the run. Commit all of these files:

- `TASK.md` — mission, non-negotiable product rules, scope exclusions, repository, branch, and owner.
- `PLAN.md` — ordered work plan with acceptance IDs and progress state.
- `DISCOVERY.md` — repository architecture, auth/entitlement model, route map, data model, jobs, storage, logging, tests, WhatsApp lead path, OT84 patterns, and resolved base evidence.
- `DECISIONS.md` — implementation decisions and repository evidence for each decision.
- `SUPPORT-EVENT-CONTRACT.json` — byte-for-byte copy from this packet.
- `AUTHORIZATION-MATRIX.md` — byte-for-byte copy from this packet.
- `TRIAGE-POLICY.md` — byte-for-byte copy from this packet.
- `ACCEPTANCE-MATRIX.md` — byte-for-byte copy from this packet.
- `CONTRACT-SHA256.txt` — lowercase SHA-256 and relative path for the copied contract.
- `COMMANDS.log` — commands executed, timestamps, working directory, exit status, and redacted output references. Never record secrets.
- `TEST-RESULTS.md` — test command, result, duration, acceptance IDs covered, and failure disposition.
- `MIGRATION-MANIFEST.md` — each new migration path, SHA-256, apply/rollback result, and data-safety notes.
- `EXTERNAL-MUTATIONS.md` — every branch, push, draft PR, CI/preview action, test object, config request, bot message, or deployment; explicitly write `none` for untouched categories.
- `DEPLOYMENT-CANARY.md` — exact state from `NOT_DEPLOYED`, `PREVIEW_ONLY`, `STAGING_CANARY`, or `PRODUCTION_CANARY`, with commit, environment, checks, rollback path, and observed result.
- `RESUME.md` — clone path, remote, base branch/commit, feature branch, HEAD, clean-state command, completed acceptance IDs, exact next command, blockers, and non-destructive recovery steps.
- `PR-BODY.md` — draft PR summary, architecture, security model, migrations, tests, rollout, risks, exclusions, and acceptance table.
- `FINAL.md` — final commit list, PR URL, CI state, acceptance disposition, known limitations, and deployment/canary truth.

Update `RESUME.md` and `COMMANDS.log` before every push and before any operation that can mutate an external system.

## Discovery requirements

Inspect the required OT84 base before designing code. Record exact file paths and symbols for:

1. session authentication, account ownership checks, CSRF protection, and server actions/API conventions;
2. the authoritative One Time entitlement model, active/inactive/expired semantics, and transaction boundary;
3. authenticated account navigation, branded form components, validation, accessibility, and error presentation;
4. existing public WhatsApp lead assistant route or configuration;
5. any existing ticket/help/contact routes, sitemap generation, robots headers, static export, and public navigation;
6. database ORM, migration conventions, transaction support, unique constraints, locking, and test database setup;
7. background jobs, schedulers, queues, retry utilities, dead-letter conventions, and health checks;
8. private object storage, upload validation, image processing, content serving, and cleanup semantics;
9. structured logging, audit records, metrics, tracing, redaction helpers, and secret loading;
10. OT84 signature/action-gateway conventions that can be reused without coupling the subscriber request path to BNA;
11. existing feature-flag or staged-rollout mechanism;
12. test framework, network fakes, time controls, concurrency tests, and CI commands.

Prefer existing abstractions. Introduce the smallest cohesive components required for OT89. Do not redesign auth, entitlements, navigation, jobs, storage, or telemetry.

## Required implementation

### 1. Subscriber-only entry and server authorization

Implement one branded authenticated support entry using repository-native UI and helper/action conventions.

- Show it only when the server-rendered authenticated account has an active `one_time` entitlement.
- Repeat authentication, account ownership, active entitlement, CSRF, and rate-limit checks in the submit action, attachment action, receipt route, and status route. Page visibility never authorizes a later request.
- Recheck entitlement inside the same database transaction that creates the submission and outbox. An entitlement that expires after render but before submit must fail with no durable support rows or blobs.
- Use the repository's not-found or authenticated-account redirect behavior for unauthorized routes. Do not render a disabled, teaser, or fake ticket form.
- Apply `Cache-Control: private, no-store` and `X-Robots-Tag: noindex, nofollow`. Remove or hide any anonymous ticket route from public navigation, sitemap, static generation, and indexing.
- Preserve the existing public WhatsApp lead assistant as the only public support/lead path. Discover and reuse its canonical route or configuration; do not invent a second WhatsApp destination.
- Add server-side per-account throttling using the existing limiter. When no support-specific policy exists, enforce at most 5 submission attempts per 15 minutes and 20 accepted submissions per rolling 24 hours. Rejections create no submission/outbox row.

### 2. Form and validated support data

Expose exactly these categories:

`bug`, `access_login`, `class_zoom`, `billing`, `content`, `complaint`, `other`.

Collect and validate:

- title: 5–120 normalized characters;
- message: 20–6000 normalized characters;
- optional reproduction steps: at most 10, each at most 500 characters;
- optional expected and actual behavior: each at most 1500 characters;
- occurrence: `once`, `intermittent`, `always`, or `not_applicable`;
- optional first-observed timestamp;
- optional normalized error code matching the contract;
- provider enum from the contract;
- reply preference: `in_app`, `email`, or `whatsapp` without embedding direct contact data in the event;
- normalized route template, app release, locale, and timezone from trusted application context, not arbitrary browser-provided URLs.

Use accessible labels, descriptions, focus handling, keyboard operation, screen-reader error association, and repository-native loading/success states. The success state must say that One Time received the request; it must not claim BNA delivery, operator review, diagnosis, or resolution before those states are known.

### 3. Safe private attachments

Implement the exact frozen policy:

- maximum 3 attachments;
- maximum 5 MiB per image;
- maximum 1 MiB for text;
- maximum 10 MiB aggregate;
- accepted types only: PNG, JPEG, WebP, and plain UTF-8 text;
- reject SVG, HTML, PDF, archives, office documents, executables, scripts, MIME spoofing, polyglots, path traversal, invalid UTF-8, decompression bombs, images over 8000 pixels on either axis, and images over 20 decoded megapixels;
- detect by content, not filename or browser MIME;
- fully decode images with resource limits, remove metadata, re-encode using a safe library, and hash the normalized bytes;
- normalize text to UTF-8/LF, remove NUL and unsafe controls, force a `.txt` filename, and hash the normalized bytes;
- store under an opaque generated object key in private storage; never derive a path from the filename;
- serve only through an authenticated private endpoint with forced `Content-Disposition: attachment`, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, no redirects, and hard streaming limits;
- remove staged blobs when submission validation or transaction commit fails.

Create the reverse-authenticated attachment endpoint at the contract path. It accepts only BNA service requests signed with the separate BNA-to-One-Time key. It must verify that the requested attachment belongs to a support event already accepted for delivery. Never place a public URL or bearer token in the event.

### 4. Durable local submission, receipt, and outbox

Use repository conventions to add the logical equivalents of:

- support submission/receipt;
- support attachment metadata;
- immutable support event/outbox;
- delivery attempt history;
- cached BNA status projection;
- audit events.

Do not edit an existing migration. Add new migrations with unique and foreign-key constraints.

In one database transaction:

1. lock or consistently read the authenticated account and entitlement;
2. prove the entitlement is active and belongs to the same account;
3. create opaque ULID-based `source_ticket_id`, `receipt_id`, `outbox_id`, and stable `event_id` values with the prefixes in the contract;
4. store normalized/redacted support data and accepted attachment metadata;
5. construct the exact contract event, with `authorization.checked_at` no more than 300 seconds before `occurred_at` and no more than 60 seconds after it; when `valid_until` is non-null it must be later than `checked_at` and not earlier than `occurred_at`;
6. serialize the event once to UTF-8 bytes, store those immutable bytes or their exact lossless equivalent, and store the lowercase SHA-256 body fingerprint;
7. create the outbox row in `PENDING` state;
8. append an audit record;
9. commit before returning the subscriber response.

The request returns an opaque local receipt and authenticated local status path immediately after commit. It must make zero BNA network calls. A BNA outage, DNS error, timeout, or disabled delivery worker cannot roll back the local receipt.

Required local delivery states are `PENDING`, `DELIVERING`, `DELIVERED`, `RETRY_WAIT`, and `DEAD_LETTER`. Subscriber-facing wording must distinguish `queued`, `delivered`, `delivery_delayed`, and `delivery_failed` honestly.

### 5. Signed asynchronous event delivery

Implement the event endpoint and HMAC formula exactly as frozen in `SUPPORT-EVENT-CONTRACT.json`.

Use these runtime configuration names, integrated through the repository's existing config/secret loader:

- `OT89_BNA_BASE_URL`
- `OT89_ONETIME_TO_BNA_KEY_ID`
- `OT89_ONETIME_TO_BNA_HMAC_SECRET`
- `OT89_BNA_TO_ONETIME_KEY_ID`
- `OT89_BNA_TO_ONETIME_HMAC_SECRET`

Do not commit values. Validate required format at process startup for the worker/attachment service, and redact them from diagnostics.

For every delivery attempt:

- load the previously stored immutable body bytes and event ID;
- generate a fresh Unix-seconds timestamp and a fresh base64url nonce from 24 random bytes;
- calculate the lowercase SHA-256 of the exact body bytes;
- build the five-line canonical string in the contract with LF and no trailing LF;
- calculate HMAC-SHA256 and send the exact bytes that were hashed;
- enforce 5-second connect and 15-second total request timeouts;
- record only opaque IDs, response class, latency, attempt number, next-attempt time, and body digest;
- never record request bodies, signing secrets, signatures, nonces, subscriber text, or attachment locators in ordinary logs.

Use the repository's safe worker-locking mechanism so concurrent workers cannot deliver the same row simultaneously. Apply exponential backoff with full jitter, 30-second base, 6-hour cap, maximum 12 attempts, and maximum event age 48 hours. Retry only the status codes and transport failures named in the contract. Move terminal failures to `DEAD_LETTER` and preserve the exact last failure class. An audited operator action may requeue; automatic code must not silently reset terminal rows.

A successful new or duplicate response caches the opaque BNA ticket reference and marks the event delivered. Validate the response shape before persisting it. Duplicate acceptance is success, not an error.

### 6. Status and deep-link seam

Create a scheduled asynchronous reconciler that sends the frozen signed JSON status request to `POST /api/internal/integrations/onetime/support-ticket-status/v1` with both `source_ticket_id` and the authenticated event account ID, updates the local status projection only when `status_version` increases, and never blocks a subscriber HTTP request.

The subscriber status page:

- reads only the authenticated same-account local receipt and cached projection;
- never embeds or links the subscriber to the heavy BNA UI;
- displays the opaque receipt, truthful delivery state, current public BNA summary when available, and last refresh time;
- displays retry/delay language without exposing internal endpoints, stack traces, BNA identifiers beyond the approved opaque reference, or operator-only deep links.

The BNA protected deep link exists only in the operator alert generated by OT89B. One Time stores no operator session URL.

### 7. Redaction, audit, and observability

Implement `ot89-redaction-v1` before event serialization. At minimum redact secrets, passwords, OTPs, cookies, session values, bearer tokens, JWTs, API keys, private keys, webhook secrets, connection strings, email addresses, phone numbers, payment/bank identifiers, street addresses, and government identifiers. Use the typed markers in `TRIAGE-POLICY.md`.

Apply NFKC normalization, LF line endings, NUL/control removal, bidirectional-control removal, bounded field lengths, route-template stripping, and filename normalization. Store redaction field names/counts. Do not store removed values in audit or logs.

Add structured metrics and health/readiness signals for:

- accepted and rejected submissions by reason;
- pending, retrying, delivered, and dead-letter outbox counts/age;
- delivery latency and response class;
- attachment rejection/normalization/transfer counts;
- status reconciliation success/failure/staleness;
- redaction counts without redacted values.

Use opaque IDs and existing telemetry conventions.

### 8. Feature flags and rollout

Use the existing feature/config mechanism, not a new control plane. Add the smallest two gates when the repository supports feature flags:

- `ot89_subscriber_support_form`
- `ot89_bna_delivery`

The form gate controls subscriber UI and submission. The delivery gate controls worker transmission while preserving queued receipts. Both are off by default in production configuration unless existing repository conventions require code defaults elsewhere. Do not create or mutate production flag values in this task.

## Required tests

Add unit, integration, route/action, migration, concurrency, worker, and fault-injection tests using repository-native tools. Test names may follow project conventions but the run record must map them to every applicable acceptance ID.

At minimum implement and pass:

- anonymous route hidden and public WhatsApp-only path;
- authenticated non-subscriber denied;
- expired entitlement denied at transaction time;
- active subscriber accepted;
- cross-account receipt/status denied;
- exact category and field validation;
- no BNA call in subscriber request path;
- BNA outage returns durable receipt and pending outbox;
- recovery reconciliation delivers the original event once;
- retryable/non-retryable response handling, jitter bounds, attempt/age cap, dead letter, and audited requeue;
- duplicate worker/concurrency lock behavior;
- attachment count, byte, aggregate, dimension, megapixel, MIME, spoof, traversal, polyglot, decompression-bomb, invalid UTF-8, and cleanup cases;
- accepted image/text normalization and private serving headers;
- reverse-HMAC attachment authorization and cross-ticket denial;
- event schema, stable event ID/body bytes, exact HMAC test vector, fresh nonce per attempt, and response validation;
- redaction of every required secret/PII class across event, logs, audit, and snapshots;
- shell/SQL/prompt/callback injection strings remain inert data;
- status version monotonicity and local-only subscriber rendering;
- migration apply from a clean database and safe rollback behavior supported by the framework;
- noindex/no-store/sitemap/static-route assertions.

Use a mock/fake BNA endpoint for OT89A tests. Do not clone or edit BNA for this packet.

Run the repository's complete required checks: formatting, lint, type checking, unit tests, integration tests, migration checks, build, and any security/static-analysis task already enforced by CI. Record unavailable checks honestly; do not mark them passed.

## Migration and checksum discipline

- Follow the repository migration naming and ordering convention.
- Do not alter previously committed migrations.
- Test a clean apply. Test rollback only when the framework supports safe rollback; otherwise document forward-only recovery.
- Record SHA-256 for every new migration and the copied contract in `MIGRATION-MANIFEST.md`.
- Add an automated check that detects drift between the committed OT89A contract copy and the application fixture/schema used by the producer.

## Commit, push, and draft PR

Before committing:

1. review the diff against the recorded OT84 base;
2. remove unrelated changes and generated secrets;
3. confirm no BNA files or references outside the required integration seam were modified;
4. run secret scanning and all required checks;
5. update every persistent task file;
6. confirm `git status` is clean after intended files are staged/committed.

Create intentional commits. A suitable primary commit subject is:

`feat(support): add subscriber support outbox producer`

Push `codex/ot89a-subscriber-support-producer` without force. Create or update a draft PR with:

- base: `codex/ot84-telegram-action-gateway`
- head: `codex/ot89a-subscriber-support-producer`
- title: `OT89A: add One Time subscriber support producer`
- body: `ops/codex-runs/OT-89A/PR-BODY.md`

Record the PR URL, remote commit, CI/check state, and all external mutations. Do not merge the PR.

## Deployment and canary rule

Do not deploy production or create production secrets/configuration. When the repository automatically creates a preview from a draft PR, validate it only with synthetic accounts and synthetic attachments, record it as `PREVIEW_ONLY`, and do not enable BNA delivery against production. A staging canary is allowed only through an already-authorized repository workflow and must use a synthetic active entitlement plus a mock or staging BNA consumer. Otherwise record `NOT_DEPLOYED`.

## Completion gate

The packet is complete only when:

- every OT89A acceptance row is passed or explicitly failed with reproducible evidence;
- the frozen contract is committed byte-for-byte under `ops/codex-runs/OT-89A/` and published on the remote feature branch;
- migrations and checksums are recorded;
- the branch is clean, pushed, and represented by a draft PR;
- deployment/canary state and external mutations are truthful;
- `RESUME.md` can be followed from a fresh shell without guessing;
- no anonymous ticket surface, synchronous BNA dependency, public attachment, secret leak, or unrelated scope is present.

End the Codex run with a concise report containing the branch, base commit, HEAD, draft PR URL, contract SHA-256, migration list, test summary, acceptance failures, deployment/canary state, and exact resume command.
