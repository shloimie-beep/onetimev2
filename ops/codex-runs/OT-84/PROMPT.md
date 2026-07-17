# Direct Codex Prompt — OT-84 Telegram Capability Gateway and One Time Bot

You are the principal application-security and messaging engineer implementing OT-84. Work directly in the target repository, produce production-grade code and evidence, and do not weaken any requirement below for convenience.

## 1. Mission and exact Git coordinates

Implement a secure Telegram alert/action gateway in `webcraft-media/onetimev2`.

- Resolve the current remote head of `codex/ot83-household-portals-foundation` from `origin` and record its actual 40-character commit SHA.
- Create or safely resume `codex/ot84-telegram-action-gateway` from that resolved remote commit.
- Push the implementation branch and open or update a **draft** pull request with exact base `codex/ot83-household-portals-foundation` and exact head `codex/ot84-telegram-action-gateway`.
- Use a clean One Time worktree even if your starting directory is a BNA/Academy checkout or any unrelated repository. Never modify the starting BNA worktree.
- Before writing implementation code, persist this complete prompt plus initialized state, resume, and final-report artifacts under `ops/codex-runs/OT-84/` and commit that initialization.

Do not ask for routine implementation choices. Inspect the repository, follow its architecture and conventions, record assumptions, and choose the least-privileged fail-closed design.

## 2. Non-negotiable topology and product boundaries

1. Operate one production **One Time** Telegram bot. Do not provision or model a separate staging bot as part of OT-84.
2. Rabbi Scheller maps to the internal role `one_time_owner`.
3. Shloimie maps to the internal role `one_time_admin`.
4. Each acts only as himself. Implement no impersonation, “view as Rabbi,” delegated principal, role switch, or owner approval that executes as another user.
5. Keep the existing BNA/Academy bot completely separate: separate token, installation identity, webhook/consumer ownership, authorization scope, and deployment process. OT-84 may define the stable `support.ticket.received` contract that a later OT-89 BNA subscriber-alert consumer can use; do not implement that consumer here.
6. Telegram is an alert/action transport over the same authorization-checked application services used by the web app. The gateway may own transport infrastructure tables, but it must not bypass domain services with direct domain-table mutations.
7. Telegram is not the system of record and must never be introduced into the synchronous public signup request path. A Telegram outage must not degrade signup availability.
8. Production is webhook-only when webhook mode is configured. Do not run `getUpdates`/long polling in production, and prove one active consumer per bot token.

## 3. Establish a clean, reproducible worktree

Do not assume the current directory is the target repository. Use the following exact refs and equivalent safe Git operations:

```bash
set -euo pipefail

mkdir -p "${CODEX_WORKSPACE_ROOT:-$HOME/.codex-workspaces}"

# Reuse a trusted local clone of webcraft-media/onetimev2 when available;
# otherwise clone it into the workspace root. Never repurpose a BNA checkout.
# Confirm that origin identifies webcraft-media/onetimev2 before continuing.

git fetch --prune origin \
  +refs/heads/codex/ot83-household-portals-foundation:refs/remotes/origin/codex/ot83-household-portals-foundation

git rev-parse refs/remotes/origin/codex/ot83-household-portals-foundation
```

Record the command output as the base SHA. Then create a new clean worktree on `codex/ot84-telegram-action-gateway`. If that head branch already exists locally or remotely from a prior OT-84 run, resume it without force-resetting or deleting unrelated work, but verify that the resolved base commit is an ancestor and record the divergence. Do not force-push.

Before implementation, verify and record all of the following:

- `origin` points to `webcraft-media/onetimev2`.
- the worktree is clean;
- the checked-out branch is `codex/ot84-telegram-action-gateway`;
- the resolved remote base SHA is an ancestor of the starting OT-84 head;
- no BNA/Academy worktree will be modified.

## 4. Persist run artifacts before code

Create `ops/codex-runs/OT-84/` before implementation code. At minimum create:

- `PROMPT.md` — this complete prompt, verbatim.
- `STATE.json` — machine-readable run state containing repository, exact base ref, resolved base SHA, exact head branch, current head SHA, phase, checkpoint, worktree cleanliness, test status, canary status, secret availability booleans without secret values, provider-mutation count, PR status, timestamps, and the next safe action.
- `RESUME.md` — human-readable instructions that allow a new agent to resume from the current commit without relying on chat history or local scratch state.
- `FINAL.md` — initialized with required final sections and marked incomplete.
- `DECISIONS.md` — architecture/security decisions and repository-specific adaptations.

Commit these files as the first OT-84 commit before application code. Update `STATE.json` and `RESUME.md` after each material phase and commit useful checkpoints. Never place a token, webhook secret, full Telegram update payload, contact details, or local credential path in these artifacts.

## 5. Repository reconnaissance and implementation plan

Inspect the repository before choosing libraries or table names. Find and reuse:

- the canonical internal user/account/product authorization context;
- One Time owner/admin role definitions and membership checks;
- application command/service boundaries used by the web app;
- CRM, contact, tags, classes, content processing, tasks, support, and audit services;
- database and migration framework;
- queue/outbox/worker conventions, transaction helpers, idempotency utilities, and structured logging/redaction;
- deployment/runtime process definitions and health checks;
- test framework, fixtures, factories, and CI commands;
- event contract/versioning conventions, if any.

Write the repository-specific plan and discovered commands to `DECISIONS.md`, `STATE.json`, and `RESUME.md`. Prefer existing primitives when they satisfy the guarantees below. If no primitive exists, add the smallest auditable implementation.

## 6. Required architecture

Implement the following logical components. Repository-native names are acceptable, but map every component to concrete code and schema locations in `FINAL.md`.

### 6.1 Bot installation and protected secrets

Represent the One Time bot as one installation with a stable non-secret installation identifier and a token fingerprint. Keep the raw bot token and webhook secret only in the repository’s protected runtime secret mechanism.

- Never commit, print, echo, serialize to run artifacts, include in exceptions, place in URLs emitted to logs, or expose through health/status endpoints.
- Disable shell tracing around any command that can read a secret.
- Use the token from protected runtime storage when available without displaying it.
- Use a webhook secret independent of the bot token.
- Treat missing secrets as a live-provider blocker, not an implementation blocker.

### 6.2 Server-side identity linking and fixed scope

Implement a server-side mapping keyed by the numeric Telegram user ID and the One Time bot installation. Do not authorize by username, display name, message text, forwarded identity, or client-supplied role.

Each active mapping must bind:

- bot installation;
- numeric Telegram user ID;
- approved private chat ID;
- internal One Time principal/user ID;
- fixed One Time account ID and product ID;
- role (`one_time_owner` or `one_time_admin`) derived from the application’s authoritative membership model;
- status, mapping version, linked/revoked timestamps, and audit provenance.

The binding is:

- Rabbi Scheller → his internal principal → `one_time_owner`;
- Shloimie → his internal principal → `one_time_admin`.

Do not invent numeric Telegram IDs or internal IDs. Load/bootstrap them through protected configuration or an authenticated self-link flow. A self-link flow, if implemented, must begin from an authenticated One Time web session, issue a random single-use short-lived audience-bound challenge stored only as a hash, and bind the Telegram numeric ID to that same internal principal. No Telegram user may choose a role or account. No owner may link as or execute as the admin, and vice versa.

Accept action commands only from the linked user in the linked private chat. Deny group/supergroup/channel actions and mismatched chat/user combinations. Re-read the active mapping and current application membership for every action and again at confirmation time. Revocation or mapping-version change invalidates pending confirmations and future actions immediately.

Construct scope server-side. Parsed commands must not contain an account, tenant, product, or role override. A cross-account reference must fail closed even when the referenced object exists.

### 6.3 Webhook ingress, verification, limits, and durable inbox

Add a dedicated Telegram webhook route outside the public signup path.

Ingress requirements:

- Verify the configured Telegram webhook-secret header using a constant-time comparison before accepting/parsing application data.
- Enforce a hard request-body limit and configurable request-rate/concurrency limits appropriate for this two-principal bot.
- Reject unsupported content types and malformed updates without revealing internals.
- Never put the bot token in the route path.
- Durably insert a minimally necessary, encrypted-at-rest or equivalently protected update payload before acknowledging success.
- Deduplicate on `(bot_installation_id, telegram_update_id)` with a database uniqueness constraint.
- Return an idempotent success for an already accepted update. Return a retryable server error only when durable acceptance genuinely failed.
- Store a payload digest and retention metadata; minimize/expire raw update data according to repository privacy conventions.
- Redact message bodies, names, usernames, phone numbers, email addresses, callback data, tokens, and secret headers from request logs.

### 6.4 Lease-safe single consumer

Implement a durable inbox consumer with a database-backed lease keyed to the bot installation/token fingerprint.

- Lease acquisition must be atomic and carry a monotonically increasing fencing token or equivalent stale-worker protection.
- Only the current lease holder may claim/process updates or mark them complete.
- Heartbeat and expiry must permit safe recovery after process death.
- A stale worker that resumes after losing the lease must be unable to commit a domain action or acknowledge the inbox item.
- The design may run multiple standby replicas, but exactly one may process this bot token at a time.
- Add an automated concurrency test proving the singleton property.
- Do not combine webhook mode with a long-poll consumer.

Process each update at least once internally, but make every observable effect idempotent. Use bounded exponential backoff with jitter, a maximum attempt policy, terminal error classification, and a dead-letter record with sanitized reason codes. Provide an operator-visible replay path through existing authenticated operational tooling, not through arbitrary Telegram text.

### 6.5 Durable Telegram outbox

Never make Telegram provider delivery the transaction boundary for domain work. Write outbound responses/alerts to a durable outbox with a unique deduplication key and deliver asynchronously.

- Retry transient network errors, provider 5xx, and rate limits; honor provider retry hints.
- Classify permanent failures without infinite retry.
- Dead-letter exhausted messages with redacted metadata.
- Do not store or log the token in provider request URLs.
- Do not send the same logical response twice after an ambiguous retry; use application idempotency and stored provider result state.
- Outbound content must be concise, scoped, and redacted.

### 6.6 Typed application commands and capability enforcement

The transport layer may parse, authenticate, authorize, request confirmation, and render results. Domain reads/writes must execute through the same application command/service layer used by the web app with an explicit authorization context for the mapped principal and fixed One Time scope.

All capabilities are deny-by-default. Implement only the following transport action identifiers, subject to existing service availability and feature flags. “Allowed” never bypasses the application service’s own authorization or object-scope checks.

| Typed action | Owner | Admin | Confirmation | Notes |
|---|---:|---:|---|---|
| `gateway.help` | allow | allow | none | Show allowlisted commands only. |
| `gateway.identity.read_self` | allow | allow | none | Show own role/mapping state; no raw numeric IDs. |
| `gateway.scope.read` | allow | allow | none | Show fixed One Time account/product scope. |
| `crm.lead.list` | allow | allow | none | Concise, scoped, paginated. |
| `crm.lead.read` | allow | allow | none | Redact unnecessary contact data. |
| `crm.lead.create` | allow | allow | always | Manual internal creation only; never a public-signup dependency. |
| `crm.contact.read_redacted` | allow | allow | none | Mask phone/email and omit unrelated fields. |
| `crm.lead_tag.list` | allow | allow | none | Scoped tags only. |
| `crm.lead_tag.add` | allow | allow | NL preview | Explicit deterministic command/button may execute directly; natural language must preview. |
| `crm.lead_tag.remove` | allow | allow | always | Destructive/reversing action. |
| `class.schedule.read` | allow | allow | none | One Time classes only. |
| `class.status.read` | allow | allow | none | One Time classes only. |
| `class.status.update` | allow | allow | always | May become externally visible. |
| `content.pipeline.read` | allow | allow | none | Summaries, no provider secrets. |
| `content.item.read` | allow | allow | none | Redacted operational state. |
| `content.item.retry` | allow | allow | always | Existing application service only. |
| `task.list` | allow | allow | none | Fixed scope; concise. |
| `task.read` | allow | allow | none | Fixed scope. |
| `task.create` | allow | allow | NL preview | Explicit deterministic command/button may execute directly. |
| `task.update` | allow | allow | NL preview | Escalate to always-confirm when change is destructive or externally visible. |
| `support.ticket.list` | allow | allow | none | Subscriber support state only. |
| `support.ticket.read_redacted` | allow | allow | none | No unnecessary message body/contact data. |
| `support.ticket.assign_self` | allow | allow | NL preview | Cannot assign as another principal. |
| `support.ticket.status.update` | allow | allow | always | Use existing service; no external reply/send. |
| `class.question.list` | allow | allow | none | Feature-gated; fail closed until the real queue service exists. |
| `class.question.read_redacted` | allow | allow | none | Feature-gated; no invented provider logic. |
| `class.question.select` | allow | allow | always | Feature-gated; emits contract only through real service. |
| `telegram.audit.read_recent` | allow | deny | none | Sanitized OT-84 audit summaries only. |

All unlisted actions are denied. Explicitly deny and test requests for arbitrary shell/CLI execution, arbitrary SQL, raw secret retrieval, environment dumps, cross-tenant lookup, account switching, contact export, mass/broadcast send, external support reply, live charge/refund, deletion, impersonation, role change, arbitrary URL fetch, arbitrary code/tool selection, and silent destructive mutation.

### 6.7 Deterministic commands/buttons first

Implement deterministic slash commands and server-generated inline buttons before natural-language input. At minimum provide equivalents for:

- `/help`, `/whoami`, `/scope`;
- leads/contact/tag reads and allowlisted tag changes;
- class schedule/status reads and confirmed status changes;
- content status reads and confirmed retry;
- task list/read/create/update;
- support list/read/assign-self/status;
- feature-gated question list/read/select.

Use opaque callback identifiers that reference server-side state. Do not embed writable object fields, role/scope, SQL, service names, or secrets in callback data. Validate Telegram callback provenance, mapped user, private chat, expiry, action digest, and current authorization.

Every response must display the effective One Time scope and the result. Reads must be concise and redact unnecessary contact data. Errors must use stable safe reason codes and a correlation reference, not stack traces.

### 6.8 Natural-language intent compiler

Implement a constrained intent compiler that returns a sealed, versioned discriminated union of the allowlisted typed actions and validated arguments.

- The compiler cannot emit account, product, role, principal, SQL, shell, URL, class name, service method, or arbitrary tool names.
- Validate output against a strict schema and reject unknown fields/actions.
- Enforce input/argument length limits and canonical identifier formats.
- Treat all message text, contact names, ticket bodies, question text, and provider output as untrusted data, never instructions.
- Ambiguous entity names produce a read-only disambiguation list; they never pick or mutate silently.
- Authorization, scope checks, confirmation policy, idempotency, and domain validation occur after compilation and cannot be overridden by parser output.
- A parser/provider outage, malformed output, low confidence, prompt-injection text, or unsupported intent fails closed with help or a deterministic alternative. It must not fall back to raw execution.
- Prefer a deterministic grammar/rules layer for known commands. If an external language model/provider is used, place it behind an adapter, require strict structured output, store no secrets in prompts, minimize PII, and test provider outage/failure. Do not make that provider required for deterministic commands.

### 6.9 Confirmation and idempotency

Implement server-side previews and one-time confirmation records.

A confirmation must be bound to:

- bot installation;
- mapped principal and mapping version;
- linked private chat;
- fixed account/product scope;
- typed action and canonical argument digest;
- target object versions/ETags where available;
- generated preview text and risk class;
- idempotency key;
- creation/expiry timestamps;
- one-time consumed/cancelled state.

Use at least 128 bits of cryptographic randomness and store only a hash of the confirmation token. Use a short TTL (five minutes unless repository policy is stricter). Prefer server-generated buttons; a generic “yes” must never confirm whichever action happens to be latest.

At confirm time, re-authenticate, re-load the mapping, re-authorize the capability and object scope, compare target versions, verify expiry/unconsumed state, atomically consume the confirmation, and execute with the stored idempotency key. If state drifted, expire the preview and produce a new one. A second callback returns the stored prior result without a second mutation.

Always require confirmation for destructive or externally visible actions. Natural-language writes marked “NL preview” also require confirmation; their deterministic command/button equivalents may execute directly only when the command itself is explicit, the operation is low-risk and reversible, and all policy checks pass.

### 6.10 Auditing and privacy

Create structured audit entries for accepted/denied updates, mapping lifecycle, capability decision, preview creation, confirmation, domain command start/result, idempotent replay, provider delivery, retry, dead-letter, lease ownership change, and operator replay.

Audit records must contain stable IDs, principal ID, role, fixed scope IDs, typed action, decision, reason code, correlation/causation IDs, resource references, result class, and timestamps. Do not include tokens, webhook secrets, raw message bodies, full phone/email, full ticket/question text, or full provider payloads. Use redacted summaries and digests.

Provide retention controls for raw inbox payloads and dead letters. Ensure application logs and error reporting use the repository’s redaction hooks. Add automated tests that scan representative logs/run artifacts for secret and PII leakage.

## 7. Stable action-gateway event contracts

Create versioned machine-readable contracts and redacted examples for these exact event types:

- `class.question.created`
- `class.question.selected`
- `support.ticket.received`
- `content.processing.status_changed`
- `lead.created`
- `task.created`
- `task.updated`

Use a CloudEvents-compatible versioned envelope or the repository’s stricter existing equivalent. The envelope must include at least: event ID, exact type, schema version, source, subject, timestamp, content type, fixed account/product scope, actor principal/role/transport, correlation ID, causation ID when applicable, idempotency key, trace reference, and typed `data`.

Contract requirements:

- IDs and state needed by downstream consumers are present, but unnecessary PII and raw bodies are absent.
- Breaking changes require a new schema major version; additive optional fields are allowed in v1.
- Producers write the event transactionally with the domain mutation through an outbox or equivalent.
- Delivery is at-least-once; consumers deduplicate by event ID/idempotency key.
- Retry/backoff/dead-letter semantics are explicit.
- Contract tests validate each producer example against the schema.
- `class.question.*` is for later OT-88 consumption. Define and emit only where a real existing question service is available; do not invent a question provider/queue implementation.
- `support.ticket.received` is for later OT-89 BNA subscriber-alert consumption. Do not modify the BNA bot or implement its consumer/provider logic in OT-84.

Minimum redacted data fields:

- `class.question.created`: question ID, class ID, submitted timestamp, status, optional pseudonymous author reference, and a short redacted excerpt.
- `class.question.selected`: question ID, class ID, selected timestamp, selecting internal principal, selection revision/status, and optional reason code.
- `support.ticket.received`: ticket ID, subscriber reference, received timestamp, channel, status, priority, redacted subject, and attachment-presence flag.
- `content.processing.status_changed`: content ID, pipeline name, previous/current status, changed timestamp, attempt, terminal flag, and sanitized error code.
- `lead.created`: lead ID, created timestamp, source channel, status, and a redacted display label; no raw contact fields.
- `task.created`: task ID, created timestamp, status, optional assignee principal, due timestamp, revision, and redacted title.
- `task.updated`: task ID, updated timestamp, revision, changed-field names, status, optional assignee/due timestamp, and redacted title.

## 8. Deployment and process contract

Document and implement repository-native equivalents of these processes:

1. **Web ingress** — serves the secret-verified webhook and durably enqueues updates. It does not execute Telegram domain writes inline.
2. **Telegram inbox consumer** — the lease-holding singleton for the One Time bot token.
3. **Telegram outbox sender** — sends redacted responses with retry/dead-letter behavior.
4. **Action-gateway event dispatcher** — publishes domain events from the transactional event outbox.
5. **Lease/retry maintenance** — reclaims expired work and exposes safe operational status.

Requirements:

- The deployment can run multiple web replicas and standby workers, but the database lease proves one active inbox consumer for the token.
- Webhook registration is an explicit idempotent release/operations command, not an uncontrolled mutation on every process boot.
- The command verifies the expected webhook URL and secret configuration through protected runtime access and records only redacted evidence.
- Health checks do not reveal secrets or PII. Readiness distinguishes “code healthy but live Telegram secret unavailable” from a process failure.
- Migrations are backward-compatible for rolling deployment where the repository supports it.
- The public signup path and core web application continue operating if Telegram, the parser provider, or the outbox sender is unavailable.
- The existing BNA/Academy bot remains outside these processes.
- Document environment variable/secret names, ownership, rotation, rollback, retention, metrics, alerts, and dead-letter operations without recording values.

## 9. Required tests

Add unit, integration, contract, migration, and concurrency tests. At minimum prove:

1. wrong/unmapped Telegram user is denied and audited;
2. revoked mapping is denied immediately;
3. replayed Telegram update is acknowledged idempotently with no repeated action;
4. stale/expired confirmation is denied;
5. confirmation from another user/chat/mapping version is denied;
6. cross-account or cross-product object reference is denied even if the object exists;
7. injection text requesting SQL/shell/secret/tool-policy override compiles to no action and causes no mutation;
8. destructive/externally visible action without valid confirmation is denied;
9. Telegram transport retry does not duplicate the domain mutation or response;
10. parser/provider outage fails closed while deterministic commands continue;
11. wrong/missing webhook secret is rejected before durable acceptance;
12. oversized/malformed request is rejected safely;
13. duplicate callbacks and idempotency keys return the prior result;
14. mapping revocation between preview and confirm invalidates the confirmation;
15. target version drift between preview and confirm forces a fresh preview;
16. two worker candidates cannot both process the token; a stale fenced worker cannot commit;
17. transient provider errors back off and eventually deliver once;
18. exhausted/permanent provider errors dead-letter with redacted metadata;
19. private-chat restriction blocks group/channel action execution;
20. all unlisted capabilities, mass send, live charge, raw secret, arbitrary URL, SQL, shell, deletion, export, role switch, and impersonation are denied;
21. domain commands use the existing authorization-checked application services, not direct domain-table writes;
22. action-gateway examples validate against the machine-readable schema;
23. `task.created` and `task.updated` remain distinct event types;
24. `support.ticket.received` does not invoke BNA provider logic in this branch;
25. representative logs, dead letters, run artifacts, and responses contain no bot token, webhook secret, full email/phone, or unredacted body.

Run all repository-required lint, formatting, type, unit, integration, migration, and contract checks. Record exact commands, exit status, and concise results in `ops/codex-runs/OT-84/FINAL.md`.

## 10. Canary and secret-dependent behavior

Create one repository-backed canary command at `ops/codex-runs/OT-84/canary.sh` (it may delegate to a native application command). It must default to safe synthetic checks and must use `set +x` around secret access.

Synthetic canary must verify:

- webhook-secret rejection/acceptance using test fixtures;
- durable inbox insertion and update deduplication;
- mapped principal resolution and fixed scope;
- read-only `/whoami` or `/scope` result rendering;
- confirmation preview/expiry/replay behavior;
- outbox retry with a fake transport;
- singleton lease behavior;
- event-schema validation;
- redaction and no-secret output.

A real Telegram canary may run only when all of these are true:

- the protected bot token and webhook secret are available;
- the numeric identity mapping and a single allowlisted private canary chat are configured;
- an isolated staging/canary deployment boundary exists without introducing a second One Time bot and without concurrent ownership of the production token;
- the environment proves exclusive webhook/consumer ownership for the token;
- the operator explicitly enables the real canary;
- no broad audience or group chat will be contacted.

The real canary must be narrow: one linked principal, a read-only identity/scope round trip, and at most one reversible confirmed mutation against a dedicated canary record. Record exact redacted evidence and cleanup. Never send a broadcast, contact subscribers, create a live charge, or mutate a real class/support record.

If the bot token is unavailable, finish the implementation, migrations, fixtures, deployment configuration, documentation, tests, synthetic canary, branch push, and draft PR. Set `STATE.json.checkpoint` to `WAITING_FOR_TELEGRAM_SECRET`, set the live canary status to `NOT_RUN_MISSING_SECRET`, list the exact protected prerequisites without values, and do not abandon the task.

If a protected token exists but no isolated canary boundary exists, do not improvise with a broad real audience or a second bot. Record `NOT_RUN_NO_ISOLATED_CANARY` and complete the remaining work.

## 11. Evidence, checksums, and final run artifacts

Before the final commit, update `ops/codex-runs/OT-84/` with:

- `STATE.json` — final phase/checkpoint and clean resume state;
- `RESUME.md` — exact next step if any live secret/canary gate remains;
- `FINAL.md` — full implementation report;
- `BASE-HEAD.json` — repository, exact base ref, resolved base SHA, exact head branch, final head SHA, merge-base, and PR base/head verification;
- `TESTS.md` — commands and outcomes;
- `CANARY.json` — synthetic and real canary status/evidence;
- `PROVIDER-MUTATIONS.json` — every Telegram API mutation/message performed, or an explicit empty list;
- `MIGRATIONS.sha256` — SHA-256 for every migration file added or modified relative to the resolved base SHA, sorted by path;
- `CHANGED-FILES.sha256` — SHA-256 for all added/modified implementation and contract files, excluding generated/vendor output and the checksum file itself;
- `DEPLOYMENT.md` — process, webhook registration, singleton lease, secret ownership/rotation, metrics, alerts, rollback, dead-letter, and retention contract;
- `PR.md` — draft PR URL, title, exact base/head, review notes, known gates, and rollback summary.

`FINAL.md` must explicitly include:

- exact base branch and resolved base SHA;
- exact head branch and final head SHA;
- worktree path category and proof it was a clean One Time worktree;
- implementation map from requirements to code/migrations/tests;
- identity mappings by human name and role only, with no protected numeric IDs;
- command/capability matrix and confirmation behavior;
- event contract paths/versions;
- migration checksum verification result;
- deployment/process contract;
- all test commands/results;
- synthetic and real canary status;
- all provider mutations, including webhook changes and messages, or “none”;
- secret availability state without values;
- limitations/feature gates for OT-88/OT-89;
- draft PR URL and verified base/head;
- exact resume instructions when checkpointed.

Generate checksums from the actual files. Do not write guessed hashes. Verify the checksum files successfully before commit.

## 12. Git and draft PR completion

Commit coherent checkpoints. Do not commit secrets, raw provider payloads, local environment files, or generated dependency caches.

Before pushing:

- run `git diff --check`;
- run the repository’s complete required checks;
- verify migrations and both checksum manifests;
- verify no secret-like values or raw contact payloads appear in the diff/run artifacts;
- verify the working tree is clean after the final commit;
- verify the resolved base SHA remains an ancestor of the head.

Push without force:

```bash
git push -u origin codex/ot84-telegram-action-gateway
```

Open or update a draft PR with exact refs:

```bash
gh pr create --draft \
  --repo webcraft-media/onetimev2 \
  --base codex/ot83-household-portals-foundation \
  --head codex/ot84-telegram-action-gateway
```

If a PR already exists, keep it draft and update its body. Verify the PR metadata after creation and save the result to `BASE-HEAD.json`, `PR.md`, and `FINAL.md`.

## 13. Definition of done

OT-84 is complete when all non-secret-dependent implementation and evidence are committed and pushed, the draft PR has the exact base/head, required tests pass, schemas/examples validate, migration/changed-file checksums verify, the deployment contract proves webhook-only singleton consumption, and the canary state is accurately recorded.

A missing Telegram secret is **not** grounds to stop early. The correct terminal checkpoint is `WAITING_FOR_TELEGRAM_SECRET` after all durable work is complete. Never print the secret, create a second staging bot, use production long polling, message a broad real audience, implement BNA/OT88/OT89 provider logic, or bypass authorization/application-service boundaries.
