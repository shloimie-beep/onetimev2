# OT-LAUNCH-01 HighLevel Application Contracts

## Scope

- Base: `codex/full-app-staging-live` at `ca89b900a6faf8e4915b1b4fa72f3eb107cdb896`
- GHL evidence: PR #107 at `c9f779495ea40a61684c5f01c02ce3f68e450227`
- Location: `pBSnOK2nkdxp6gf9Rg3o`
- Provider mode: default-off
- External HighLevel calls: 0
- Messages sent: 0
- Student contacts created: 0
- Persistent staging changed: no

## Implemented Contracts

Outbound `1.0.0` adult-only events use the shared `onetime.outbox_events` table:

- `adult.signup.submitted`
- `parent.portal.invitation_requested`
- `parent.portal.activated`
- `class.reminder.requested`
- `recording.available`

Inbound `1.0.0` OT-A1 actions use raw-body HMAC-authenticated, scoped, rate-limited, deduplicated POST requests to `/internal/highlevel/v1/actions`:

- `bot.complete_signup`
- `bot.next_confirmed_class_info`
- `bot.member_login`
- `bot.password_help`
- `bot.apply_opt_out`

Password help delegates token creation and delivery to One Time/Resend and returns no token. Opt-out applies One Time suppression before any later eligible event and authorizes no acknowledgement while the registry conflict remains unresolved.

## Provider Decision

Outbound projection uses HighLevel contact upsert followed by add-tags with canonical field IDs and tag names. It does not call or invent a direct workflow-run endpoint. Every outbound row starts held. A batch must persist an immutable canary run with an exact delivery-key allowlist, positive budget of at most 20, transport mode, and allowlist hash before only matching rows can claim. Disabled, mock, held, wrong-mode and non-allowlisted backlog cannot enter a provider canary.

Provider operations are split into durable contact-upsert and add-tag receipts. Each row has an independent 120-second lease and claim token. The real adapter carries the operation key in `Idempotency-Key`, and completion/retry requires the current claim token. An interrupted or ambiguous provider operation becomes `uncertain` and is not replayed; this deliberately prefers operator reconciliation to repeating a workflow-triggering tag.

Inbound actions bind HMAC-SHA256 to the credential key ID, epoch timestamp, unique nonce, body idempotency key and exact raw body. The endpoint enforces a five-minute freshness window and durably rejects captured nonce replay while allowing a legitimate idempotent retry only with a fresh signed nonce. HighLevel's documented Custom Webhook action supports static/dynamic headers but does not document per-request HMAC computation. Jobs `GHL-UI-19` through `GHL-UI-23` therefore remain Draft unless an approved HighLevel-side signer is proven; a static secret header is forbidden.

Primary sources:

- https://marketplace.gohighlevel.com/docs/ghl/contacts/contacts/
- https://marketplace.gohighlevel.com/docs/ghl/contacts/add-tags/index.html
- https://help.gohighlevel.com/support/solutions/articles/155000002482-workflow-trigger-contact-tag
- https://help.gohighlevel.com/support/solutions/articles/155000002673
- https://help.gohighlevel.com/support/solutions/articles/155000003305/
- https://help.gohighlevel.com/support/solutions/articles/155000003362-workflow-action-custom-code

## Migration Decision

- Added `2216_highlevel_application_contracts.sql`.
- SHA-256: `b95b46a573606eaa00fe9339ffb68d705ee20d0393f06c0d7c7b9cb33c3c0e0c`.
- `2216` extends the existing shared outbox channel constraint and adds the held/authorized transport state, immutable canary runs and allowlists, row fencing, durable provider-operation receipts, inbound action receipts, one-use HMAC nonces, and the cached channel-DND projection.
- Open-PR migration audit found `2214_learning_delivery_content_factory.sql` on PR #104, confirmed `2215` reserved for Experience Preview, and found no other `2216`.
- Canonical `2205_highlevel_business_projection.sql` was inspected from commit `c5f3d33432a57b72346496c44bcf652edc9d7db8`, Git blob `cf65084399fe8f84986f62451a34c9e606403107`, SHA-256 `3135ccd5942c649dd1133f1709806bdb77de016cfd3e78f55f04ec86cb7001fd`.
- `2205` was not restored because this accepted design requires none of its parent/entitlement projections and restoring its dedicated `highlevel_outbox_events` table would violate the no-parallel-queue boundary.
- Historical media migrations `2209` and `2210` were not replayed or modified.
- Canonical `2213_learning_delivery_autotrim_transcripts.sql` remains byte-for-byte unchanged at Git blob `fe21dd9002f18c7d50a3736861f4089d3da96d4f`, SHA-256 `de79b58418608f4466ffadda967411b43cfca2df477911071ed4060805b5dae1`.
- The isolated PR-108 database that had recorded an obsolete `2213` variant was retired instead of changing `2213` or its ledger. A fresh disposable PostgreSQL 16 service and volume now back only the PR-108 web and worker services.

## Railway Containment

During fresh-database setup, Railway CLI echoed the generated credential for an initial unmounted disposable service. That service was deleted before use, had no volume, and its service/variable endpoint now rejects lookup. The replacement credential was generated independently and supplied only through standard input. No credential value is present in Git, the PR, or this report.

## Concurrency And Replay

Real PostgreSQL uses one atomic CTE claim with exact account, product, channel, transport mode, canary run, allowlist hash, persisted allowlist membership, budget and authorization-state predicates plus `FOR UPDATE OF outbox SKIP LOCKED`. Every claimed row receives a unique fencing token and independent 120-second lease; both provider-operation completion and terminal row completion require that token. A two-dispatcher assertion proves one claim, a slow-row assertion proves no reclaim after the former 60-second boundary, and crash-after-upsert/add-tag assertions prove uncertain operations are never repeated. The exact PostgreSQL SQL contract is asserted, and `scripts/highlevel/postgres-claim-assurance.ts` runs a disposable real-PostgreSQL race that holds the first authorized row lock while a second claimant proves it can claim only the other authorized row and never the held backlog.

The disposable real-PostgreSQL race passed against the isolated PR-108 PostgreSQL 16 service: two authorized rows were claimed with unique fencing tokens while the unauthorized backlog remained unclaimed. A temporary credential-protected TCP proxy was created only for the proof and deleted immediately afterward; the service again has no public proxy. Harness cleanup closes all pool clients before database removal. No production or persistent-staging database was used by that proof.

## Verification

- HighLevel unit contract tests: passed
- HighLevel HTTP adapter operation-key test: passed
- HighLevel integration, canary-backlog isolation, crash quarantine, slow-row fencing, HMAC mutation/freshness/replay/scope and two-worker claim tests: passed
- Focused lead capture and class fulfillment regressions: passed
- Focused account lifecycle, content library, delivery repository and web/worker independence regressions: passed
- Focused total: 53 tests passed
- Final full integration reconciliation: 261 tests passed across 55 files
- Final full unit reconciliation: 291 tests passed across 63 files
- Final Chromium reconciliation: 56 tests passed, including both governed portal recording journeys
- Disposable real-PostgreSQL HighLevel claim race: passed against the isolated PR-108 PostgreSQL 16 service
- Goal governance validation: 18 checks passed, including 470 parsed strings with zero hash-comment truncations
- Registry and workflow projection validation: passed; canonical projection matches the registry
- Workflow control remains intentionally fail-closed only for unverified archived/AI inventory and explicit unknown/cross-kind assets; `drifted=[]` and `reportMatches=true`
- Scoped Prettier, lint, typecheck, build, migration safety, secret scan and `git diff --check`: passed before publication
- All tests used fake/sink adapters; external calls and sends remained zero

## Convergence

Shared composition edits are intentionally limited to config fields, the existing contract/domain boundaries, the web raw-body route mount, and the existing worker batch call. Both HighLevel modes remain disabled and no deployment or Agent Mode job is authorized by this report. After release re-audit, the persistent-staging conductor may deploy this PR in an isolated PR Environment, apply migration `2216`, run the real-PostgreSQL claim assertion, and keep provider mode off until the exact canary run, allowlist and budget are approved. Jobs `GHL-UI-19` through `GHL-UI-23` must remain Draft until an approved per-request HMAC signer is proven.

Exact remaining dependency: approve and prove a HighLevel-side per-request raw-body HMAC signer before any OT-B01 through OT-B05 Agent Mode activation.
