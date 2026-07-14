ROLE

You are Codex acting as the senior implementation engineer for communications-source truth, provider-event ingestion, privacy, security, PostgreSQL concurrency, Railway process ownership, and authenticated frontend integration in the standalone One Time product.

You are implementing OT-67. You are not writing another prompt, design memo, speculative provider contract, or rewrite for another agent.

Repository:

webcraft-media/onetimev2

Task:

OT-67 — Communications V1B: verified provider status, inbound-source truth, and contact-local communication history.

Your job is to:

1. Enforce the complete pre-write gate below.
2. Re-audit the exact accepted integrated repository head.
3. Reconcile accepted OT-44 Communications V1A with accepted OT-50 delivery-provider truth.
4. Implement the minimum truthful, secure, privacy-bounded OT-67 backend, webhook, read-model, CRM-history, and frontend changes.
5. Prove the result with real PostgreSQL, concurrency, security, browser, accessibility, bundle, and performance evidence.
6. Push an isolated branch and open a draft PR.
7. Do not merge, deploy, register a provider webhook, activate a provider, send a message, mutate DNS, mutate production, or perform any provider-side operation.

Do not delegate this task. Do not generate a second prompt. Do not ask for a rewrite. If a required gate is not satisfied, stop with BLOCKED as defined below.


IMMUTABLE EXECUTION INPUTS

These placeholders are mandatory. They must be replaced with exact approved values before execution. Do not infer, abbreviate, normalize, or substitute branch names, tags, PR numbers, “latest,” or current local HEAD for any exact SHA.

ACCEPTED_OT60_CONVERGENCE_SHA = <ACCEPTED_OT60_CONVERGENCE_SHA>

ACCEPTED_OT44_COMMUNICATIONS_V1A_SHA = <ACCEPTED_OT44_COMMUNICATIONS_V1A_SHA>

ACCEPTED_OT50_LIVE_DELIVERY_PROVIDER_SHA = <ACCEPTED_OT50_LIVE_DELIVERY_PROVIDER_SHA>

APPROVED_STAGING_PROJECT_SERVICE_DATABASE_FINGERPRINT = <APPROVED_STAGING_PROJECT_SERVICE_DATABASE_FINGERPRINT>

PROVIDER_READINESS_EVIDENCE_REFERENCES = <PROVIDER_READINESS_EVIDENCE_REFERENCES>

CANARY_AUTHORIZATION_OR_NONE = <CANARY_AUTHORIZATION_OR_NONE>

Rules for these inputs:

- Each accepted SHA must be a full 40-character Git commit SHA.
- The staging fingerprint must be the exact approved canonical fingerprint. It may contain only safe identifiers or one-way fingerprints. It must not contain a database URL, credential, token, webhook secret, raw provider account ID, email address, phone number, or other secret/PII.
- Provider-readiness references must identify exact repository-relative evidence files and immutable content digests or exact accepted sections attributable to the accepted OT-50 SHA.
- Canary authorization must be either the exact literal `NONE` or an exact, channel-specific approved authorization reference.
- A canary authorization does not override this task’s prohibition on provider mutation, sending, webhook registration, deployment, or production changes. It is retained and validated for future activation readiness and guard implementation only.
- If any placeholder still contains `<` or `>`, is empty, uses a shortened SHA, or uses an unpinned reference, the result is BLOCKED.


EXECUTION PRECEDENCE

Use this precedence order:

1. This OT-67 prompt.
2. Exact accepted OT-60, OT-44, and OT-50 evidence at their supplied SHAs.
3. Actual source, migrations, tests, and configuration at the exact accepted OT-60 convergence SHA.
4. Exact provider-readiness evidence tied to accepted OT-50.
5. Current official provider documentation rechecked on the execution date.
6. Conservative fail-closed behavior.

A PR description, branch name, local note, stale evidence file, provider dashboard screenshot, inferred payload field, third-party blog, copied sample, or undocumented behavior is not authoritative.

When sources conflict:

- Do not guess.
- Do not expand a capability.
- Preserve the most conservative truthful state.
- Mark the source or capability unavailable or partial.
- Record the contradiction in OT-67 evidence.
- Return NOT_READY if the contradiction prevents a required security or truth guarantee.


HARD EXTERNAL-MUTATION BOUNDARY

This implementation task permits:

- Read-only Git/GitHub inspection before the gate.
- Local ephemeral Git object/ref updates needed to inspect origin.
- Local source changes only after the complete pre-write gate passes.
- Disposable, explicitly non-production PostgreSQL fixtures and tests after the gate.
- Normal dependency installation.
- Test servers and synthetic provider fixtures.
- A new isolated Git branch.
- Intentional commits.
- Pushing that branch.
- Opening or updating one draft PR.

This task prohibits:

- Merging any PR.
- Deploying any branch or artifact.
- Running `railway up`, `railway deploy`, or an equivalent deployment command.
- Registering, updating, deleting, enabling, disabling, or replaying any provider webhook.
- Creating or modifying a provider object.
- Sending any email, WhatsApp message, internal alert, reply, test message, or canary.
- Calling a provider send API.
- Performing a live provider credential test.
- Retrieving a live inbound email body or attachment.
- Enabling provider-mode environment flags in Railway or any external environment.
- Mutating provider settings, API keys, domains, sending identities, receiving domains, MX records, DNS, suppression lists, contacts, templates, or destinations.
- Mutating a production database.
- Reading production contacts or messages.
- Copying production records into a test database.
- Exposing or recording secrets, tokens, raw provider IDs, raw webhook payloads, contacts, email addresses, phone numbers, message bodies, attachment bytes, class links, or private destinations.
- Creating a ZIP or unrelated package.
- Force-pushing or rewriting accepted history.
- Editing an existing migration.
- Working in another repository.

Use synthetic fixtures only. Examples and screenshots must use fictional values reserved for testing.


PRE-WRITE GATE

Do not create a branch, worktree, file, migration, evidence directory, commit, PR, database row, or provider object until every part of this gate passes.

The only pre-gate local mutation permitted is fetching Git objects/refs into an inspection checkout. All repository worktree files must remain untouched.

If any check cannot be proven, print a concise terminal report containing:

OT-67 RESULT: BLOCKED
FAILED GATE:
SAFE EVIDENCE:
REQUIRED CORRECTION:
NO FILES WRITTEN: true

Then stop.

Do not create an evidence-only branch for a failed pre-write gate.


GATE 1 — REPOSITORY IDENTITY AND CLEANLINESS

Verify all of the following:

- The repository remote resolves exactly to `webcraft-media/onetimev2`.
- The remote is the approved `origin`.
- The inspection worktree is clean:
  - no tracked modifications;
  - no staged changes;
  - no untracked files;
  - no active merge, rebase, cherry-pick, or bisect;
  - no sparse-checkout omission that would hide owned paths.
- Git object integrity is healthy.
- No local Git replace refs or grafts affect ancestry.
- No submodule or alternate object store changes the inspected source unexpectedly.

Use read-only or inspection-safe commands such as:

- `git remote get-url origin`
- `git status --porcelain=v1 --untracked-files=all`
- `git rev-parse --show-toplevel`
- `git fsck --no-reflogs`
- `git replace -l`
- `git fetch --prune --tags origin`

Never print a credential-bearing remote URL.


GATE 2 — EXACT COMMIT OBJECTS AND REMOTE ANCESTRY

For all three accepted SHAs:

- Validate the full SHA syntax.
- Verify the object exists and is a commit.
- Verify the commit is reachable from at least one current `origin/*` ref.
- Record the containing remote refs without assuming that `main` is the accepted integration ref.
- Verify the objects after a fresh fetch, not only from stale local objects.

Then require:

- `ACCEPTED_OT44_COMMUNICATIONS_V1A_SHA` is an ancestor of `ACCEPTED_OT60_CONVERGENCE_SHA`.
- `ACCEPTED_OT50_LIVE_DELIVERY_PROVIDER_SHA` is an ancestor of `ACCEPTED_OT60_CONVERGENCE_SHA`.
- The accepted OT-60 evidence identifies the exact remote integration ref containing `ACCEPTED_OT60_CONVERGENCE_SHA`.
- The remote integration ref still resolves to the expected accepted topology.
- There is no patch-equivalence exception. A cherry-picked or manually copied change whose original accepted SHA is not an ancestor does not satisfy this gate.
- There is no unreviewed descendant silently substituted for the accepted convergence SHA.

Use exact checks including:

- `git cat-file -e "$SHA^{commit}"`
- `git cat-file -t "$SHA"`
- `git branch -r --contains "$SHA"`
- `git merge-base --is-ancestor "$OT44_SHA" "$OT60_SHA"`
- `git merge-base --is-ancestor "$OT50_SHA" "$OT60_SHA"`

If either accepted source SHA is not an exact ancestor of OT-60, stop BLOCKED.


GATE 3 — ACCEPTED EVIDENCE INTEGRITY

For every provider-readiness reference:

- Verify the referenced file exists at the accepted OT-50 SHA.
- Verify it also exists unchanged or intentionally superseded at the accepted OT-60 SHA.
- Verify the exact supplied content digest.
- Verify the evidence is not merely a PR body, comment, mutable dashboard link, local filesystem path, screenshot without provenance, or uncommitted file.
- Verify each claimed provider capability is supported by actual code, migration, test, or official contract evidence.
- Verify the evidence distinguishes staging from production.
- Verify it contains no raw secret or PII.
- Verify it identifies whether each channel supports:
  - outbound API acknowledgement;
  - stable provider message identity;
  - request idempotency;
  - authenticated delivery events;
  - event IDs or equivalent deduplication identity;
  - timestamp verification;
  - retry/replay behavior;
  - event ordering or lack of ordering guarantees;
  - bounce/failure/suppression events;
  - complaint events;
  - unsubscribe or opt-out evidence;
  - inbound messages;
  - webhook authentication;
  - raw-body verification requirements;
  - provider account/environment binding;
  - safe staging isolation.

A capability marked “planned,” “assumed,” “dashboard configured later,” “sample only,” “not tested,” “integration pending,” or “provider docs suggest” is not ready evidence.

If exact WAPI/WhatsApp authentication, replay, event identity, state semantics, inbound contract, or provider-account binding is not proven, WAPI webhook and inbound capabilities must remain unavailable. Do not invent them.


GATE 4 — MIGRATION MANIFEST AND CHECKSUM CONVERGENCE

At the accepted OT-60 SHA:

- Enumerate every migration in `packages/db/migrations`.
- Compute the repository’s actual SHA-256 checksum for every migration exactly as the migration runner does.
- Inspect the migration runner and confirm ordering, transaction behavior, advisory locking, and checksum handling.
- Verify no accepted migration was edited after application.
- Verify no duplicate migration ID or namespace collision exists.
- Verify OT-44, OT-50, and convergence migrations are present in the exact accepted ordering.

Against the approved staging database, using a read-only connection and a read-only transaction:

- Verify the database fingerprint first.
- Read `onetime.schema_migrations`.
- Compare every applied migration ID and checksum to the accepted OT-60 repository manifest.
- Reject:
  - missing accepted migrations;
  - unknown applied migrations;
  - checksum drift;
  - out-of-order or partially applied migration state;
  - a staging schema ahead of or behind the accepted convergence head;
  - a database whose migration table cannot be read safely.

Do not apply or repair a migration during the gate.

Do not print the database URL, host, user, database name, or raw Railway IDs. Evidence may contain approved one-way fingerprints only.


GATE 5 — APPROVED STAGING FINGERPRINT

Compare the exact approved staging fingerprint with read-only observed staging metadata.

The fingerprint must cover, directly or through approved one-way fingerprints:

- Railway project;
- environment;
- web service;
- worker service;
- webhook ingress owner, if separate;
- database service;
- database/schema identity;
- deployment artifact commit for every runtime service;
- process type or start command;
- account/product configuration fingerprint;
- transport mode;
- migration-manifest fingerprint.

Require:

- The environment is explicitly staging/non-production.
- The database is isolated from production.
- Web and worker use the same approved staging database.
- No production hostname, database, provider account, receiving domain, webhook endpoint, or secret is shared.
- The deployed web and worker artifacts identify the exact accepted OT-60 convergence SHA.
- Staging uses sink mode.
- Real provider transport flags are disabled.
- Provider webhook registration is not required to prove this gate.
- No unapproved service can consume the same outbox or webhook source.

If any component differs from the exact approved fingerprint, stop BLOCKED.


GATE 6 — EXACT-SHA SINK STAGING GREEN

Prove through pre-existing, exact-SHA evidence and read-only checks that the approved staging deployment at `ACCEPTED_OT60_CONVERGENCE_SHA` is green in sink mode.

Require all of the following:

- Web health is green.
- Worker health is green.
- The web service runs the web entrypoint only.
- The worker service runs the canonical worker entrypoint only.
- Sink transport is active.
- Real Resend/WAPI/provider activation is disabled.
- Applied migrations match the accepted OT-60 manifest.
- The accepted staging sink smoke test passed against this exact SHA.
- Worker claims, lease behavior, retry behavior, and sink completion were proven without duplicate processing.
- No current stuck-claim, migration-drift, or duplicate-consumer blocker is recorded.
- Evidence is tied to the exact staging fingerprint and exact SHA, not to “latest staging.”
- No production data or provider send was used to make staging green.

Do not create a new sink row merely to satisfy the pre-write gate. Use accepted exact-SHA staging evidence and read-only state.


GATE 7 — NO PARALLEL WRITER OR PATH OWNER

Inspect current remote branches, open PRs, local worktrees, task evidence, and ownership manifests.

There must be no active parallel writer that owns or changes any of these domains:

- Communications contracts, domain logic, repository, APIs, or UI;
- delivery attempts or outbox state transitions;
- provider adapters;
- provider message bindings;
- Resend or WAPI webhooks;
- webhook receipt/deduplication tables;
- provider event projections;
- contact-local communication history;
- contact suppression/complaint/bounce projection;
- shared authenticated route registry used by Communications;
- Railway web/worker/webhook process ownership.

At minimum:

- List open PRs and their changed files.
- Inspect branches updated after accepted OT-60.
- Inspect local worktrees.
- Identify superseded OT-44/OT-50 branches.
- Confirm no branch named for OT-67 already exists locally or remotely.
- Confirm no draft PR for OT-67 already exists.
- Confirm no active task claims these paths.

An open PR that contains accepted commits but is explicitly closed, merged, or recorded as superseded is not automatically a parallel writer. An ambiguous or still-active overlapping PR is a blocker.

If ownership cannot be proven, stop BLOCKED.


GATE 8 — CANARY INPUT VALIDATION

If `CANARY_AUTHORIZATION_OR_NONE` is `NONE`:

- Record `canary_authorized=false`.
- Keep every live provider action prohibited.
- Implement and test provider boundaries using synthetic fixtures only.

If it is not `NONE`, verify that the reference is exact and contains all of:

- staging fingerprint;
- exact provider;
- exact channel;
- exact protected destination reference;
- maximum message count;
- time window;
- exact template or content digest;
- exact permitted operation;
- stop conditions;
- rollback authority;
- approving identity and immutable approval reference.

Even when valid, do not execute it in OT-67. This task does not deploy, register, send, replay, or activate. Implement the guardrails and record the authorization reference only.


PROMPT-GENERATION AUDIT SNAPSHOT

This section records the read-only repository findings available when this prompt was generated on July 14, 2026. It is orientation only. It is not a substitute for the exact execution gate or the required re-audit.

At prompt generation:

- The repository’s default branch was still near the initial standalone foundation.
- OT-44 existed as an open draft candidate:
  - candidate commit `76cae19be515ee896f22d0da976082a09d1d25d6`;
  - based on OT-40 candidate `571b18f36cdc645f757cc3be6b0519f1af3225f6`;
  - not accepted by this prompt;
  - not a substitute for `ACCEPTED_OT44_COMMUNICATIONS_V1A_SHA`.
- No OT-50 branch, PR, or commit was found by task-name, Resend/WAPI activation, or live-provider searches.
- No OT-60 convergence branch, PR, or commit was found.
- Several prerequisites were on divergent draft branches, including privileged MFA/security, CRM privacy/performance, CRM module/capability work, delivery worker work, and Communications.
- Exact OT-60 convergence is therefore mandatory.

The OT-44 candidate implemented:

- a read-only local-intent projection over `onetime.outbox_events`;
- owner/admin authorization;
- global and contact-local list hooks;
- sealed cursors;
- bounded dates and pagination;
- `private, no-store` responses;
- masked recipient labels;
- lazy feature descriptors;
- explicit unavailability for provider acceptance, provider delivery, inbound messages, replies, threads, body access, and attachments.

The OT-44 candidate truth mapping was:

- `pending` → `intent_queued` / `Queued locally`;
- `sink_delivered` → `sink_processed` / `Processed in test mode`;
- anything else → `status_unavailable` / `Status unavailable`.

Known OT-44 convergence issues found in actual candidate code:

1. Unknown event/channel pairs were normalized to the real intent type `internal_lead_alert` while displaying “Communication intent unavailable.” OT-67 must never map an unknown event to a real event kind.
2. The contact link was constructed from the internal `contact_key`. The privileged security/CRM branch separately added a random scoped `contacts.public_id`. OT-67 must use the canonical accepted public contact identifier and never expose `contact_key`.
3. The PostgreSQL adapter returned `sourceAvailable: true` unconditionally. Known source absence, provider unavailability, operational failure, and a genuinely empty result must be distinct.
4. The branch had no Communications-specific migration or real PostgreSQL plan proof.
5. Shared route, shell, CRM-tab, session-port, lazy-chunk, and integrated performance wiring were pending.
6. The candidate only modeled local intent rows, not provider attempts, authenticated provider events, or inbound sources.

The OT-36/OT-40 delivery candidate implemented:

- a sink-only worker;
- exact account/product/transport/event/channel claim predicates;
- `FOR UPDATE SKIP LOCKED`;
- claim leases;
- bounded batch and concurrency;
- provider timeout plumbing;
- deterministic retry jitter;
- retry and dead-letter behavior;
- sink completion;
- redacted audit metadata;
- explicit Family/School event kinds;
- dispatch-time contact, consent, suppression, archive, deadline, and signup checks.

The accepted future implementation must re-audit these areas because the snapshot worker had important limitations:

- transport was hard-coded to sink;
- provider types existed but live adapters did not;
- the outbox stored an attempts counter but no complete provider-event history;
- internal outcome naming used “delivered” for a generic provider receipt even though product truth must distinguish sink processing, API acceptance, and authenticated delivery;
- the old `processOutboxSink` path remained exported while the newer worker entrypoint also existed, creating a convergence-time duplicate-consumer risk;
- `onetime.outbox_events.status` had no database CHECK constraint;
- the sink claim index was partial to sink mode only.

The base schema contained:

- scoped contacts with consent, reminder preference, suppression state, archive/lead state, normalized destinations, and internal `contact_key`;
- signup rows;
- audit rows;
- outbox rows;
- account users and sessions;
- no basis for treating audit rows or signup rows as messages.

A separate security branch added:

- real privileged TOTP/MFA assurance;
- session-family versioning;
- random scoped contact `public_id`;
- durable CRM create idempotency.

A separate CRM module branch added a capability registry but did not yet contain Communications capabilities.

The Railway start script selected one of two entrypoints from a process-type variable:

- web entrypoint; or
- worker entrypoint.

The same image could therefore run web or worker. OT-67 must prove that each staging service owns exactly one runtime function and that no duplicate worker or webhook consumer exists.

Current provider documentation was reviewed only to shape conservative requirements. Recheck current official documentation at execution time. For Resend, inspect the official Send Email, Event Types, Verify Webhook Requests, Retries and Replays, Receiving Emails, and webhook-storage guidance. For WAPI/WhatsApp, no public contract should be assumed; exact accepted OT-50 evidence is mandatory.


POST-GATE WORKTREE AND BRANCH CREATION

Only after every pre-write gate passes:

1. Resolve the exact accepted remote integration ref containing `ACCEPTED_OT60_CONVERGENCE_SHA`.
2. Create a new isolated worktree directly from that SHA.
3. Create branch:

   `codex/ot67-communications-v1b`

4. Refuse to overwrite, reset, reuse, or force-push an existing branch of that name.
5. Verify the new worktree HEAD equals `ACCEPTED_OT60_CONVERGENCE_SHA`.
6. Verify the new worktree is clean.
7. Record the initial state in memory; do not create evidence files until the re-audit confirms the architecture.

Do not merge other branches into the OT-67 branch. OT-44 and OT-50 must already be present through OT-60 ancestry.


MANDATORY READ-ONLY RE-AUDIT AT THE ACCEPTED HEAD

Before editing product code, inspect the actual accepted OT-60 source and produce an implementation plan grounded in it.

Audit all of the following.

Repository and integration:

- exact OT-60 commit and containing remote ref;
- accepted OT-44 and OT-50 ancestry;
- all open PR/path collisions;
- all migration IDs and checksums;
- package scripts and dependency versions;
- build inputs and emitted chunks;
- test configuration;
- evidence conventions;
- Railway/Docker/start scripts;
- web and worker composition roots.

Communications V1A:

- contracts and capability schema;
- global API;
- contact-local API;
- route registration;
- session scope adapter;
- sealed cursor implementation;
- source availability behavior;
- recipient masking;
- event normalization;
- status normalization;
- global UI;
- contact tab;
- lazy route descriptors;
- cache and protected-state behavior;
- current tests and evidence;
- all known candidate defects listed above.

OT-50 provider implementation:

- provider adapter interfaces;
- concrete Resend adapter;
- concrete WAPI adapter, if accepted;
- transport-mode configuration;
- provider request idempotency;
- provider API acknowledgement persistence;
- provider message identity handling;
- delivery attempt schema;
- retry/deadline semantics;
- ambiguous timeout behavior;
- permanent/transient error classification;
- provider event schemas;
- webhook routes;
- raw-body handling;
- signature verification;
- event deduplication;
- timestamp validation;
- account/product/provider isolation;
- provider event projection;
- bounce/complaint/suppression handling;
- inbound sources;
- provider readiness evidence;
- staging-only guards;
- canary guards.

Outbox and worker:

- all producers;
- every worker entrypoint;
- every exported sink-processing function;
- all claim queries;
- all completion queries;
- lease-loss behavior;
- retry and dead-letter behavior;
- current indexes;
- transaction boundaries;
- current worker replicas/process ownership;
- whether provider acknowledgement and outbox completion can become inconsistent;
- whether retries can duplicate a provider send;
- whether provider idempotency expires before the local retry horizon;
- whether a second worker implementation can claim the same rows.

Contacts, consent, and privacy:

- canonical contact public identifier;
- archive semantics;
- account/product scope;
- contact access capabilities;
- email/WhatsApp consent semantics;
- current global or channel-specific suppression model;
- complaint, bounce, opt-out, and unsubscribe sources;
- privacy/erasure behavior;
- contact reactivation behavior;
- whether public signup can alter archived or suppressed contact state;
- any existing retention policy.

Authentication and authorization:

- exact session resolver;
- whether session resolution mutates `last_seen_at`, CSRF, or another record;
- privileged MFA assurance requirements;
- capability model;
- role model;
- logout behavior;
- browser cache behavior;
- 401/403 protected-state clearing;
- cross-account not-found behavior.

Frontend and bundles:

- authenticated shell route registry;
- CRM contact tab registry;
- Communications lazy import boundary;
- public/login/authenticated/CRM chunks;
- current performance marks;
- current request pattern;
- RTL and responsive conventions;
- accessibility test conventions.

Provider documentation:

- Recheck exact current official documentation.
- Record only page title, access date, and safe contract conclusions.
- Do not copy example secrets, addresses, provider IDs, message bodies, or payloads into evidence.
- Where official documentation and accepted OT-50 evidence differ, fail closed and record the mismatch.

Before coding, construct a private implementation matrix with these columns:

- product capability;
- channel;
- direction;
- local source;
- provider source;
- authoritative evidence;
- accepted schema location;
- accepted code owner;
- OT-67 change needed;
- public state;
- source availability;
- privacy classification;
- retention behavior;
- test proof.

Do not create a second message collection from audit events or signup rows.


NON-NEGOTIABLE PRODUCT TRUTH MODEL

OT-67 must preserve these exact meanings.

`intent_queued`

- A local communication intent was durably persisted.
- It proves only local intent.
- It does not prove a provider API call, provider acceptance, transmission, receipt, or delivery.
- The user-facing label is `Queued locally`.

`sink_processed`

- The sink/test worker durably processed the local intent.
- It proves only test-mode processing.
- It must never be labeled Sent or Delivered.
- The user-facing label is `Processed in test mode`.

`provider_accepted`

- A verified provider API acknowledgement was durably persisted and bound to the correct local communication, account, product, provider account/environment, channel, and attempt.
- It does not prove recipient-server delivery, recipient-device delivery, opening, reading, or a human seeing the message.
- A timeout, network error, local worker status, or provider-shaped fixture in a non-provider environment is not acceptance.
- The user-facing copy must say accepted by the provider, not delivered.

`provider_delivered`

- An authenticated provider delivery event was durably persisted, deduplicated, matched to the correct provider message binding, and reduced into the communication state.
- The event’s provider semantics must explicitly support a delivery claim for that channel.
- It must not be inferred from API success, `email.sent`, local completion, retry exhaustion, a dashboard screenshot, or absence of failure.
- The user-facing label may say `Delivered by provider` only when this requirement is met.

`retrying`

- A durable local retry is scheduled after a persisted transient failure and remains within the allowed deadline/attempt policy.
- It does not prove a provider accepted or delivered anything.

`delayed`

- A verified provider event or another accepted authoritative source explicitly reports delayed delivery.
- A merely future `next_attempt_at`, active lease, or slow UI request is not provider delay.

`failed`

- A persisted authoritative provider failure or accepted permanent API rejection proves failure.
- A local ambiguous timeout is not automatically provider failure.
- Local retry exhaustion without provider failure proof is `dead_lettered`, not `failed`.

`bounced`

- A persisted authenticated provider bounce event proves the channel-specific bounce.

`complained`

- A persisted authenticated provider complaint/spam event proves the complaint.

`suppressed`

- A persisted authoritative local or provider suppression source proves suppression.
- The source and channel must be retained internally.
- Do not infer suppression from an empty provider result.

`expired`

- A persisted authoritative local deadline/expiration decision proves the intent expired before successful provider acceptance under the accepted policy.
- Do not infer expiration merely from age.

`dead_lettered`

- The canonical worker durably exhausted its accepted retry policy or encountered an accepted terminal local processing condition.
- It describes local processing truth.
- It does not prove the provider rejected or never accepted an ambiguous request.

`inbound_received`

- An authenticated inbound provider event was durably persisted, deduplicated, bound to the approved provider account/environment, and safely correlated to the correct account/product/contact or route.
- It proves the provider received an inbound communication.
- It does not automatically prove the sender’s real-world identity.
- It does not imply that body or attachment bytes are locally available.

`status_unavailable`

- The required source is missing, disabled, unproven, contradictory, operationally unavailable, or incapable of supporting the requested claim.
- It must not be represented as an empty inbox, no messages, successful delivery, or successful synchronization.

Source availability must be a separate dimension:

- `available`: all sources needed for the displayed claim are proven and queryable.
- `partial`: some proven sources are available but at least one relevant source is missing, delayed, disabled, or unsupported.
- `unavailable`: no authoritative source supports the requested provider/inbound claim.

`partial` is not a delivery state. It is a source-coverage state.

A successful query returning zero real communication records is an empty result. A missing source is unavailable. They are not interchangeable.


EVENT AND CURRENT-STATE MODEL

Do not force all provider and local events into a simplistic total-order enum.

Implement two layers:

1. Immutable or append-only communication timeline events.
2. A deterministic current-state projection.

Timeline requirements:

- Preserve each authoritative event once.
- Retain event occurrence time and local receipt time separately.
- Retain the normalized source kind.
- Retain whether the event is local, provider API acknowledgement, authenticated webhook, or privacy/suppression projection.
- Do not expose raw provider event names when unsupported.
- Do not expose provider IDs or raw payloads.
- Never rewrite historical delivery into complaint/bounce without preserving both events.

Reducer requirements:

- Ingestion order must not determine truth.
- A replayed older event must not downgrade a newer authoritative state.
- Provider acceptance arriving after delivery due to reordering must not downgrade delivery.
- A delayed event older than an already persisted delivery event must not downgrade delivery.
- A later authenticated complaint or suppression may supersede delivery as the current actionable state while the timeline still retains the earlier delivery.
- Contradictory authenticated events that cannot be resolved under the accepted provider contract must produce `status_unavailable` or partial source coverage rather than a fabricated confident state.
- Local dead-letter or expiration must not overwrite a later authenticated provider event.
- Inbound communications are separate communication records, not state transitions on an outbound communication.
- If a provider supports multiple recipients in one request, either prohibit that mode for One Time or model per-recipient state. Never display one recipient’s delivery as delivery for all recipients.
- Unknown event kinds must normalize to an explicit unavailable/unknown event kind. They must never map to `internal_lead_alert` or any other real event kind.


SOURCE-OF-TRUTH BOUNDARIES

Permitted communication sources:

- transactional outbox rows that are actual communication intents;
- canonical delivery-attempt rows;
- verified provider API acknowledgement records;
- authenticated provider webhook event records;
- authenticated and deduplicated inbound event records;
- authoritative channel-specific suppression, complaint, bounce, unsubscribe, or opt-out records;
- canonical privacy/redaction records affecting visibility.

Supporting context only:

- contacts;
- account/product configuration;
- consent records;
- canonical CRM public identifiers;
- signup classification when needed to label an actual selected communication intent.

Never treat these as messages:

- generic audit events;
- auth audit events;
- signup rows by themselves;
- contact activity timestamps;
- CRM notes;
- task rows;
- provider configuration rows;
- health checks;
- log lines;
- analytics counts.

Do not union audit events or signup rows into Communications and call the result a message list.

Every record shown in Communications must identify its real source category internally and satisfy an explicit source-to-public-state mapping.


DATA MODEL REQUIREMENTS

First reuse the accepted OT-50 schema. Do not create duplicate shadow tables for concepts that OT-50 already owns.

The following are logical invariants, not mandatory table names. Map them to accepted tables where possible and add only the missing schema.

A. Canonical communication record

Each logical communication needs:

- internal primary key;
- random local public identifier that is not derived from PII, provider identity, outbox identity, email, phone, or contact key;
- account key;
- product key;
- nullable internal contact key;
- canonical direction;
- canonical channel;
- canonical intent/event kind;
- source category;
- outbound origin reference or inbound origin reference;
- created/occurred timestamp;
- current truthful state;
- current state timestamp;
- source availability;
- privacy/redaction status;
- retention expiration, if approved;
- version or deterministic projection guard if updates are mutable.

For an outbound intent, the origin must reference the actual outbox intent exactly once.

For an inbound communication, the origin must reference one verified inbound provider event exactly once.

B. Delivery attempts

Each attempt needs:

- communication/outbox identity;
- account/product;
- attempt number;
- transport mode;
- canonical provider/channel;
- start and completion timestamps;
- outcome category;
- sanitized failure code;
- retry schedule;
- deadline;
- lease or worker identity only where operationally required;
- provider acknowledgement binding when present.

Do not expose attempt internals to the browser beyond safe normalized timeline states.

C. Provider message binding

Provider message identity must be scoped by:

- account;
- product;
- provider;
- provider account/environment fingerprint;
- channel;
- communication;
- attempt.

Do not expose or log raw provider message IDs.

Prefer:

- a versioned keyed HMAC for indexed equality/correlation;
- optional authenticated encryption only if an accepted workflow requires recovering the exact provider ID;
- no plaintext provider ID in browser DTOs, logs, screenshots, evidence, or generic audit metadata.

A provider ID supplied by a webhook must be normalized and HMACed under the same versioned scheme before lookup.

D. Webhook receipt identity

Each webhook receipt needs:

- provider;
- protected endpoint/config identity;
- account/product derived from server configuration;
- provider event ID HMAC or equivalent accepted deduplication key;
- signature timestamp;
- provider event occurrence time;
- local receipt time;
- normalized event kind;
- keyed body digest;
- verification algorithm/key version;
- duplicate/replay disposition;
- projection disposition;
- safe error category where needed.

Require a database uniqueness constraint that makes duplicate ingestion idempotent across web replicas.

If the same external event identity arrives with a different body digest:

- do not project it;
- record a safe security anomaly;
- return an appropriate non-success or conflict response according to the accepted provider retry contract;
- do not reveal the mismatched values.

E. Communication timeline events

Each normalized timeline event needs:

- communication identity;
- source receipt/attempt identity;
- account/product;
- normalized event kind;
- normalized truthful state, when the event establishes one;
- authoritative-source category;
- event occurrence time;
- receipt/persistence time;
- safe, strictly allowlisted metadata only.

Do not use an unrestricted provider payload JSON document as the public event model.

F. Contact/channel suppression

Reuse accepted suppression entities when valid. If the accepted model only has a single ambiguous global text field and OT-67 requires channel-specific authoritative projection, add the minimum channel-specific model.

A suppression record must identify:

- account/product/contact;
- channel;
- normalized reason;
- source category;
- authoritative event reference;
- effective time;
- active/cleared state under an explicit policy;
- audit-safe versioning.

Never automatically clear a complaint, hard bounce, unsubscribe, or opt-out because a later delivery event appears.

G. Inbound route/correlation

Inbound contact history may only use an accepted, secure correlation mechanism, such as:

- an opaque local reply-route token;
- an accepted provider conversation binding;
- another exact OT-50 mechanism.

Do not correlate an inbound email to a contact solely because the untrusted sender address resembles a contact email.

Do not correlate a WhatsApp inbound event solely from an unscoped client-supplied provider or account field.

Unmatched verified inbound events must not appear under an arbitrary contact. Use a bounded, privacy-safe unmatched/quarantine disposition only if accepted policy permits it.

H. Scope on every sensitive table

Every provider, event, attempt, communication, route, and suppression query must enforce account and product scope.

Where practical, use composite uniqueness and foreign-key constraints to prevent cross-scope joins.

Do not rely on globally unique internal keys alone when account/product predicates are available.


MIGRATION RULES

- Add new forward-only migration files only.
- Never edit an accepted migration.
- Discover the accepted migration namespace and collision rules at OT-60.
- Do not guess that an old reserved range remains available.
- Use deterministic names and checksummed content.
- Respect the current migration runner’s transaction behavior.
- Do not use `CREATE INDEX CONCURRENTLY` inside a transaction-wrapped migration unless the accepted migration framework explicitly supports nontransactional migrations.
- Make schema changes additive.
- Do not drop existing columns, states, indexes, or tables in OT-67.
- Do not perform a production-sized destructive backfill.
- If a backfill is needed, make it bounded, idempotent, scoped, and proven on disposable PostgreSQL.
- Do not add a no-op migration merely to satisfy a checklist.
- If the accepted OT-50 schema already satisfies every required invariant and no database change is needed, document that finding. Because OT-67 is expected to include provider history and indexed contact-local reads, treat an unexplained no-migration outcome as NOT_READY unless accepted evidence proves all required schema already exists.

Minimum index proof must cover:

- global communication list by account/product/time/stable tiebreaker;
- contact-local history by account/product/contact/time/stable tiebreaker;
- communication detail timeline;
- provider message HMAC lookup;
- webhook event deduplication;
- active channel suppression;
- any state/channel/direction filter used by the UI.

Avoid a combinatorial index explosion. Select indexes from real query plans.


OUTBOUND PROVIDER AND WORKER RECONCILIATION

OT-67 must not create a second delivery worker.

Reconcile the accepted worker so there is one canonical owner for:

- outbox claims;
- attempt creation;
- provider API calls;
- retries;
- deadlines;
- provider acknowledgement persistence;
- sink completion;
- dead-letter completion.

Inspect and resolve any coexistence between:

- legacy `processOutboxSink`;
- the newer polling worker;
- accepted OT-50 provider worker code;
- scheduled jobs;
- web-process polling;
- Railway worker replicas.

Do not leave two runnable code paths that can claim the same row.

Provider API acknowledgement persistence must be transactionally safe:

- The provider call occurs outside a long database transaction.
- On successful provider acknowledgement, persist the provider binding and accepted event before or atomically with the canonical local completion state.
- A crash after provider acknowledgement must not silently cause an unbounded duplicate send.
- Use the accepted provider idempotency mechanism.
- Use a stable, non-PII idempotency key derived from the logical communication/attempt policy.
- Do not expose that key.
- Model the provider’s idempotency retention window. A local retry scheduled beyond that window must not automatically reuse assumptions that no longer hold.
- An ambiguous timeout must remain ambiguous unless reconciliation or authenticated provider evidence resolves it.
- Do not label ambiguous timeout as failed or not sent.
- Preserve local deadline and dead-letter truth separately from provider truth.

Sink behavior must remain:

- default;
- independently testable;
- incapable of producing `provider_accepted` or `provider_delivered`;
- visibly labeled test mode;
- isolated from provider adapters.

Provider-mode configuration must fail closed:

- exact environment allowlist;
- exact account/product;
- exact provider account/environment fingerprint;
- explicit channel enablement;
- no default enablement;
- no provider path selected by a browser value;
- no provider path selected merely because credentials exist;
- no production activation in OT-67.


WEBHOOK INGESTION SECURITY

Implement provider webhook ingestion only for channels whose exact accepted OT-50 evidence proves a secure contract.

Use a provider-specific adapter boundary. Do not create one generic “trust any JSON provider” endpoint.

1. Raw request bytes

- Mount the webhook route so signature verification receives the exact raw bytes.
- Do not allow the global JSON parser to consume or reserialize the body first.
- Verify before parsing into the provider schema.
- Add an integration test using the actual Express composition order.
- Do not log the raw bytes.

2. Content type and encoding

- Allow only the exact accepted media type.
- Reject unsupported content encoding unless the verified provider contract explicitly requires it.
- Reject malformed charset/encoding.
- Return bounded generic errors.

3. Request size

- Enforce a strict route-specific maximum.
- Enforce both declared `Content-Length` and actual streamed-byte limits.
- Reject oversized fixed-length and chunked requests with 413.
- Choose the limit from accepted provider evidence plus a small documented margin.
- Do not accept an arbitrarily large body because attachments may exist elsewhere.

4. Signature verification

- Use the accepted provider SDK or reviewed cryptographic implementation already selected by OT-50.
- Verify all required signature headers.
- Reject missing, duplicated, malformed, unsupported-version, or invalid signatures.
- Select the secret from protected server configuration tied to the endpoint/provider account.
- Never select a secret from provider/account IDs in the body.
- Use constant-time comparison where manual verification is unavoidable.
- Support explicit secret versioning/rotation without accepting an unbounded set of secrets.

5. Timestamp freshness

- Verify the provider-signed timestamp.
- Reject stale and implausibly future timestamps using the exact accepted tolerance.
- Test both boundaries.
- Do not use only local receipt time as replay protection.

6. Replay and idempotency

- Signature verification alone is insufficient.
- Deduplicate through a database uniqueness constraint using the authenticated provider event identity or exact accepted equivalent.
- Bind deduplication to provider and protected endpoint/account context.
- Persist a keyed body digest.
- Make concurrent duplicate deliveries converge to one receipt and one projection.
- A normal duplicate must return a provider-compatible success without reapplying side effects.
- Same event identity with a different digest is a security anomaly, not a normal duplicate.

7. Parsing and schema validation

- Parse only after signature verification.
- Use a strict bounded schema.
- Bound arrays, strings, nesting, timestamp formats, and field counts where the library permits.
- Ignore or safely classify unknown extra fields; do not persist them wholesale.
- Reject malformed required fields.
- Do not echo malformed values in responses or logs.

8. Account/product/provider isolation

- Derive account, product, provider, provider account/environment, and channel from protected endpoint configuration.
- Ignore client-supplied scope.
- Match provider message identity only within that scope.
- An event for an unmatched message must not attach to a contact based on destination PII.
- If the provider account receives unrelated traffic, safely quarantine or ignore unmatched verified events under a bounded policy.
- Do not create a cross-account record-existence oracle.

9. Transactional persistence

Within one transaction:

- insert or identify the webhook receipt;
- classify duplicate/replay disposition;
- resolve the provider message binding;
- append a normalized communication event;
- update the current-state projection;
- project suppression/complaint/bounce/opt-out when authoritative;
- commit before returning success.

If the database fails before commit, return a retryable provider-compatible response. Do not acknowledge successful processing before durable persistence.

10. Out-of-order handling

- Store provider occurrence time and local receipt time.
- Use accepted provider sequence information only when documented.
- Apply a deterministic channel-specific reducer.
- Do not assume arrival order.
- Do not discard a valid historical event solely because it is older.
- Do not allow an older event to overwrite a newer authoritative projection.

11. Unknown event types

- Authenticate and safely classify them.
- Do not expose the raw event name in the UI.
- Do not map them to a real event kind.
- Do not trigger a retry storm if the accepted provider contract expects acknowledgement of unsupported but valid events.
- Record safe counts/fingerprints for evidence and operations.

12. Logging

Allowed log fields include:

- safe event category;
- provider name;
- channel;
- verification result category;
- HTTP status category;
- truncated one-way communication/event fingerprint;
- duplicate boolean;
- projection result;
- duration;
- request trace fingerprint.

Prohibited log fields include:

- raw provider ID;
- raw webhook event ID;
- raw body;
- signature;
- secret;
- email;
- phone;
- name;
- subject;
- message body;
- attachment metadata that contains user filenames;
- class link;
- contact key;
- route token;
- database URL.

13. Response behavior

Use exact provider-compatible semantics, with tests for:

- success;
- duplicate success;
- invalid signature;
- stale timestamp;
- malformed body;
- unsupported content type;
- oversize body;
- database transient failure;
- conflicting replay identity.

Responses must be generic and must not reveal whether a provider message, contact, account, or product exists.


RESEND BOUNDARY

Recheck current official Resend documentation and accepted OT-50 evidence before implementation.

At minimum, verify:

- outbound API response identity;
- request idempotency behavior and retention;
- authenticated webhook headers and raw-body requirements;
- event identity;
- retry and manual replay behavior;
- exact semantics of send/accepted, delivered, delayed, failed, bounced, complained, suppressed, and received events;
- inbound receiving-domain requirements;
- whether inbound webhook events contain content or only metadata;
- whether body/header/attachment retrieval requires separate API calls;
- provider event timestamps and any ordering guarantees;
- suppression and unsubscribe sources.

Required conservative mapping:

- A successful Resend API acknowledgement may establish `provider_accepted` after durable persistence.
- A Resend event meaning “API request successful” must not be mapped to `provider_delivered`.
- Only the authenticated event whose official semantics establish recipient-mail-server delivery may establish `provider_delivered`.
- Authenticated bounce, complaint, suppression, delayed, and failed events map only to their proven normalized meanings.
- Open/click analytics are not required OT-67 communication truth and must not be surfaced unless separately accepted.
- An authenticated inbound received event may establish `inbound_received` only after safe persistence, deduplication, staging/provider-account binding, and contact/route correlation.
- Do not retrieve live inbound bodies or attachment bytes in OT-67.
- Do not present a subject, body, header, attachment, reply, or thread capability merely because the provider exposes a separate API.

Use an accepted outbound provider message binding, not recipient email, to correlate outbound events.


WAPI / WHATSAPP BOUNDARY

Use only exact accepted OT-50 evidence and official vendor documentation tied to the actual provider.

Do not assume:

- a signature algorithm;
- a secret header;
- a timestamp header;
- an event ID;
- a provider account field;
- a delivery state;
- a read receipt;
- an inbound message schema;
- retry behavior;
- ordering;
- phone normalization behavior;
- attachment behavior;
- conversation/thread identity.

For each claimed WAPI capability, require exact proof of:

- authenticated origin;
- replay protection;
- stable event identity;
- provider account/environment binding;
- outbound message identity;
- exact delivery-state semantics;
- inbound semantics;
- request limits;
- retry behavior;
- event order behavior.

If the provider contract cannot satisfy the required signature, timestamp, replay, or isolation controls:

- do not register the endpoint in application composition;
- keep the WAPI provider-event source unavailable;
- keep inbound unavailable;
- keep outbound-provider status limited to whatever exact accepted OT-50 acknowledgement evidence supports;
- display partial/unavailable source coverage truthfully;
- record the blocker.

Do not weaken OT-67 webhook security merely to accommodate an undocumented provider.


INBOUND EMAIL AND WHATSAPP TRUTH

Inbound visibility is metadata/history visibility, not a generic mailbox.

Email inbound requirements:

- exact approved receiving source;
- exact provider account/environment;
- authenticated webhook;
- deduplicated event;
- accepted receiving domain or route evidence;
- server-derived account/product;
- secure contact correlation;
- local persistence;
- privacy and retention handling.

Do not correlate solely from an email sender address.

Prefer an opaque local reply route or exact accepted provider binding. If an event cannot be safely correlated:

- do not show it under a contact;
- do not reveal it in the global list as belonging to One Time;
- retain only the minimum safe unmatched-event record if approved;
- otherwise discard after safe receipt accounting.

WhatsApp inbound requirements:

- exact authenticated inbound event contract;
- accepted provider account/environment binding;
- deduplication;
- safe contact correlation;
- channel consent/privacy handling.

A provider receiving an inbound message does not prove the sender’s real-world identity. Use copy such as `Inbound message received`, not `Contact replied`, unless the accepted correlation contract establishes that claim.

No OT-67 UI or API may expose:

- inbound body;
- subject;
- attachment bytes;
- raw attachment names;
- raw sender/recipient;
- provider IDs;
- thread headers;
- provider dashboard links.

If body or attachment availability is not implemented, state that explicitly. Missing content is not an empty message.


BOUNCE, COMPLAINT, UNSUBSCRIBE, OPT-OUT, AND SUPPRESSION PROJECTION

Project only authoritative persisted evidence.

Email:

- A verified hard bounce may suppress the email channel under the accepted policy.
- A verified complaint must suppress the email channel under the accepted policy.
- A verified provider suppression event may suppress the email channel.
- An unsubscribe may suppress only when an accepted local or provider source proves it.
- Do not invent a Resend unsubscribe webhook if the exact contract does not provide one.

WhatsApp:

- Apply opt-out/suppression only from an exact accepted WAPI or local consent source.
- Do not interpret an arbitrary inbound word as opt-out unless an accepted parser/policy exists and is separately tested.
- Do not clear suppression through later delivery receipts.

Projection requirements:

- account/product/contact/channel predicates;
- idempotent under replay;
- same transaction as the authoritative event projection;
- source provenance;
- effective timestamp;
- no raw provider reason body;
- no send or override control in Communications;
- archived contacts remain ineligible for outbound dispatch;
- privacy redaction does not silently reactivate consent.

If the existing contact has only one global `suppression_state`, do not overwrite it with a channel-specific event without an explicit convergence design. Add or reuse a channel-specific source of truth and derive any aggregate state safely.


RETENTION AND PRIVACY

Do not invent a legal retention period.

Search accepted OT-60/OT-50 evidence for approved retention durations. Apply the exact approved policy.

If no nonzero raw-payload retention is approved:

- retain no raw webhook payload after verification and projection;
- retain only a keyed body digest and strict normalized fields.

If an accepted policy explicitly requires temporary raw retention:

- store it encrypted with authenticated encryption;
- use a versioned key;
- separate it from normal read tables;
- set an explicit short expiration;
- deny all Communications UI/API access;
- omit it from generic logs, backups/evidence where controllable, and error reports;
- implement and test purge behavior;
- never expose it through bulk export.

Normalized event retention must support:

- approved metadata lifetime;
- privacy redaction;
- contact erasure/tombstoning where applicable;
- preservation of minimal non-PII operational/audit truth when approved;
- removal of provider-identifying or contact-identifying material when no longer required.

Archive behavior:

- An archived contact is never re-enabled for outbound messaging by Communications.
- Owner/admin history visibility follows the accepted CRM archive policy.
- The UI must clearly identify archived contact context.
- No send/reply controls appear.
- If privacy redaction removes the canonical contact association, the communication history must not retain a working contact link.
- Public signup behavior must not silently reopen an archived/suppressed contact through OT-67.

Browser privacy:

- no localStorage;
- no sessionStorage;
- no IndexedDB;
- no CacheStorage;
- no service-worker persistence;
- no URL parameters containing recipient data, provider IDs, message IDs, subjects, bodies, or cursors;
- all protected responses use `Cache-Control: private, no-store`;
- use `Vary: Cookie` where cookie authentication applies;
- clear all protected Communications state on 401, 403, logout, session expiry, and account/product change;
- abort in-flight protected requests during clearing;
- revalidate on browser history restoration where needed.

Evidence privacy:

- synthetic contacts only;
- fictional example domains only;
- fictional phone numbers only;
- no raw provider fixture copied from a live event;
- no live screenshot;
- no production logs;
- no class links;
- no message body;
- no provider ID.


AUTHORIZATION AND SCOPE

Authorized readers:

- Rabbi owner;
- Shloimie administrator.

Server roles:

- `owner` may read One Time Communications.
- `admin` may read One Time Communications.
- Every other role denies by default unless a later explicit accepted capability exists.
- Do not grant Communications read because a user has generic CRM contact-read access.
- Do not grant Communications read to `crm_agent`, `viewer`, `member`, `public`, unknown, or malformed roles in OT-67.

Session requirements:

- derive account, product, user, role, session assurance, and capabilities from the authenticated server session;
- honor accepted privileged MFA/session-assurance requirements;
- do not accept browser-supplied account, workspace, product, role, user, provider, or provider-account IDs;
- do not create a second authentication system;
- bind OT-44’s read-only scope port to the accepted non-mutating session/capability resolver;
- do not use a resolver that rotates CSRF or writes session state merely to perform a Communications read unless that mutation is an accepted global invariant and the OT-44 read-only contract has been explicitly converged;
- deny malformed roles before repository access.

Cross-scope behavior:

- A global list is scoped entirely by the session.
- A contact-local route resolves the canonical scoped public contact identifier.
- Missing and cross-account contacts return the same non-oracular not-found behavior.
- A communication public ID is resolved with account/product predicates.
- Provider message identity is never accepted from the client.
- No response reveals whether a provider event, contact, communication, or provider ID exists outside the session scope.

Prohibited capabilities:

- bulk export;
- raw payload access;
- provider dashboard links;
- provider configuration access;
- integration secret access;
- destination reveal;
- message body access;
- attachment download;
- compose;
- reply;
- resend;
- campaign send;
- template send;
- webhook replay;
- suppression override.


API CONTRACT

Preserve accepted OT-44 API compatibility where possible. Make changes additive and typed.

Required logical routes:

- owner/admin global Communications list;
- owner/admin communication detail with safe provider-state timeline;
- owner/admin contact-local communication history;
- provider-specific authenticated webhook ingestion for proven providers only;
- authenticated Communications page route;
- accepted CRM contact tab integration.

Reuse exact accepted route names if OT-60 already defines them. Do not create duplicate routes with competing contracts.

Global/contact list requirements:

- bounded default date range;
- maximum date range no greater than the accepted OT-44 bound unless an accepted requirement changes it;
- limit capped at 25 unless accepted evidence sets a lower bound;
- stable cursor pagination;
- sealed/authenticated cursor;
- cursor bound to account, product, mode, contact, filters, sort, limit, version, and expiration;
- cursor carried outside the URL if accepted OT-44 uses the protected header;
- channel filter;
- direction filter;
- event-kind filter;
- truthful-state filter;
- bounded from/to instants;
- deterministic ordering by event/communication time and a stable internal tiebreaker;
- no N+1 contact/provider queries.

Contact identifier:

- use the canonical accepted public contact identifier;
- resolve it server-side to the internal contact key;
- never expose internal `contact_key`.

Communication identifier:

- use a random local public communication identifier;
- do not expose outbox UUID, delivery key, provider message ID, provider event ID, route token, or attempt key.

List response should retain or add safe fields equivalent to:

- success;
- availability;
- per-source availability/capability summary;
- source scope;
- `mailbox_complete: false`;
- applied filters;
- bounded items;
- next cursor.

A list item may expose only fields needed for the product, such as:

- local public communication ID;
- canonical contact path or null;
- channel;
- direction;
- safe event kind;
- safe event label;
- truthful state;
- safe state label;
- occurrence/queue time;
- current-state time;
- source availability;
- generic destination label if needed.

It must not expose:

- raw recipient;
- email domain;
- complete phone digits;
- provider ID;
- outbox ID;
- delivery key;
- contact key;
- signup key;
- body;
- subject;
- HTML;
- attachment;
- provider error response;
- raw event type;
- retry internals;
- lease internals;
- integration config.

Detail timeline may expose:

- safe normalized event kind;
- safe source category;
- truthful state established by the event;
- event occurrence time;
- local receipt time when useful;
- safe description;
- authoritative/availability indicator.

Do not expose raw metadata.

Error behavior:

- 401 for unauthenticated API access;
- 403 for authenticated but unauthorized global access;
- non-oracular 404 for cross-scope contact/communication identifiers;
- 400 for invalid filters/cursor format;
- 404 or 400 for cursor binding mismatch according to the accepted anti-oracle policy;
- 500/503 for operational source failures, with generic public copy;
- do not convert an operational database error into an empty result.

Source absence behavior:

- known unconfigured provider source → partial/unavailable;
- known unsupported inbound source → partial/unavailable;
- query succeeds with zero records → empty;
- database outage → error;
- migration/schema mismatch → startup/readiness failure, not empty.


FRONTEND PRODUCT SCOPE

Implement owner/admin Communications V1B as a separate lazy feature.

Required surfaces:

1. Global Communications list.
2. Safe communication detail/provider-state timeline.
3. Contact-local chronological communication history in the canonical CRM contact view.

Required filters:

- channel;
- direction;
- event kind;
- truthful state;
- bounded date range.

Required visible state handling:

- loading;
- ready;
- truly empty;
- source unavailable;
- partial source coverage;
- delayed;
- retrying;
- failed;
- bounced;
- complained;
- suppressed;
- expired;
- dead-lettered;
- inbound received;
- operational error;
- unauthenticated;
- forbidden;
- contact/communication not found.

Copy requirements:

- `Queued locally` for `intent_queued`.
- `Processed in test mode` for `sink_processed`.
- Provider acceptance copy must say accepted by provider.
- Delivery copy must appear only for `provider_delivered`.
- Missing source copy must say status/source unavailable and must explicitly avoid implying an empty inbox.
- Partial copy must identify that only some sources are available without naming secrets or provider account details.
- Inbound copy must not imply a verified human identity.
- Do not use a generic mailbox, inbox, thread, reply, or attachment metaphor unless the accepted source actually supports it.

Canonical CRM linking:

- Link only to the canonical scoped contact route.
- Use the accepted public contact ID.
- Do not display internal IDs.
- Archived contact context must be explicit.
- Missing/redacted contact association must show unavailable rather than a broken or guessed link.

No mutation controls:

- no Send;
- no Compose;
- no Reply;
- no Resend;
- no Retry now;
- no Campaign;
- no Template;
- no Provider settings;
- no Webhook replay;
- no Suppression override;
- no Export.

Lazy-loading requirements:

- Public landing/signup bundles must not contain authenticated, CRM, Communications, provider, or webhook UI code.
- Login/auth bootstrap must not preload Communications.
- Authenticated shell may contain only the small route descriptor needed for navigation.
- CRM overview must not import, prefetch, mount, or request Communications.
- Contact Communications code loads only when the tab is selected.
- Global Communications code loads only on its route.
- Provider timeline detail code/data loads only when detail is opened if splitting it improves the accepted architecture.
- Avoid duplicate React/runtime chunks.

State clearing:

- clear list, detail, timeline, cursors, filters containing protected context, and in-memory cache on 401/403/logout/session change;
- abort in-flight requests;
- prevent stale protected rows from flashing after logout;
- test browser back/forward cache behavior.

Date handling:

- Backend accepts exact instants.
- UI local dates must convert to bounded instants without UTC off-by-one errors.
- Use the accepted authenticated user/session timezone where available.
- Test DST boundaries and Asia/Jerusalem behavior without hard-coding all users to that timezone.

Accessibility:

- semantic headings;
- semantic table or list;
- mobile cards with equivalent information;
- accessible filter labels;
- keyboard navigation;
- visible focus;
- status announcements;
- error focus management;
- no color-only states;
- contrast compliance;
- 44 by 44 CSS-pixel touch targets or documented exceptions;
- correct RTL reading/order;
- no inaccessible tooltip-only truth.

Responsive/reflow:

- 360x800;
- 390x844;
- tablet;
- desktop;
- 320 CSS-pixel reflow where practical;
- 200% and 400% zoom;
- no horizontal page overflow;
- long translated labels wrap;
- provider-state timelines reflow without clipping;
- use logical CSS properties for RTL.


RAILWAY AND RUNTIME OWNERSHIP

Do not deploy, but prove the intended runtime topology.

Required ownership:

- one web service owns authenticated APIs and any accepted webhook HTTP ingress;
- one canonical worker service owns outbox claims/provider sends;
- no web process polls the outbox;
- no second worker implementation claims the same rows;
- no separate webhook ingester duplicates application ingestion unless OT-60 explicitly converged it as the one canonical owner;
- multiple web replicas are safe because database idempotency, not process memory, controls webhook replay;
- multiple worker replicas are safe only through the canonical claim/lease transaction.

Inspect:

- `scripts/railway-start.mjs`;
- Dockerfile;
- package scripts;
- process-type configuration;
- Railway service evidence;
- web and worker health/readiness;
- migration ownership;
- startup migration behavior;
- webhook route registration.

Prove:

- web cannot accidentally start worker mode because of a missing/incorrect variable;
- worker cannot accidentally start web mode;
- provider activation cannot occur solely because a credential exists;
- migrations are not independently racing in every production web replica;
- webhook route body parsing is correct in the real web composition;
- horizontal web scaling does not duplicate projection;
- horizontal worker scaling does not duplicate claims;
- no current OT-67 code requires a third service without an accepted topology change.

Create a repository-relative OT-67 topology document, but do not mutate Railway.


REAL POSTGRESQL REQUIREMENT

pg-mem is not sufficient proof.

Use an explicitly disposable, non-production PostgreSQL 16 or the exact accepted assurance version.

Use a dedicated environment variable such as `OT67_TEST_DATABASE_URL`. Never print its value.

Before connecting, prove:

- it is not the approved production database;
- it is not the approved staging database unless the test is explicitly read-only;
- it contains only synthetic fixtures;
- the database/schema may be destroyed safely.

Required PostgreSQL proof:

1. Fresh migration application from zero.
2. Second migration run reports already-applied without drift.
3. Checksum mismatch detection.
4. Existing accepted migrations remain unchanged.
5. New constraints and indexes exist in `pg_catalog`.
6. Concurrent webhook duplicates converge to one receipt/event/projection.
7. Same event identity with different digest is rejected safely.
8. Out-of-order events converge deterministically.
9. Concurrent worker claims do not duplicate ownership.
10. Lease-loss completion cannot overwrite a newer claim.
11. Provider message IDs cannot correlate across account/product/provider account.
12. Contact-local queries cannot cross scope.
13. Archive/privacy behavior is correct.
14. Suppression projection is idempotent.
15. Cursor/filter tampering does not alter scope.
16. Query plans use the intended indexes at realistic scale.
17. Pagination has no duplicate or missing rows under stable fixture conditions.
18. Additive backfill, if any, is idempotent.

Seed at least:

- 10,000 synthetic communications for required proof;
- enough provider events/attempts to exercise cardinality;
- multiple accounts/products;
- multiple contacts;
- all supported states;
- unmatched provider events;
- archived/redacted contacts;
- duplicate and out-of-order events.

For primary list/history queries, capture:

- `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`;
- execution-time samples;
- index names;
- returned row counts;
- filter selectivity;
- p50/p75/p95 database timings after warmup.

Sanitize all plans and evidence. Do not include database host, database name, user, raw contact values, provider IDs, or SQL parameters containing PII.

Avoid claiming an index requirement merely because a tiny test table used a sequential scan. Prove behavior at scale.


REQUIRED PROVIDER AND WEBHOOK TESTS

Implement focused unit and real integration tests for every proven provider adapter.

Signature/authentication negatives:

- missing signature header;
- missing timestamp;
- missing event identity;
- duplicated security header;
- malformed signature encoding;
- unsupported signature version;
- wrong secret;
- secret from another provider endpoint;
- modified raw body;
- parsed-and-reserialized body mismatch;
- stale signed timestamp;
- future signed timestamp;
- exact tolerance boundary;
- wrong provider route;
- wrong content type;
- unsupported content encoding;
- invalid UTF-8 or accepted encoding equivalent;
- oversized declared body;
- oversized chunked body;
- empty body;
- malformed JSON;
- valid JSON with malformed schema;
- excessive arrays/strings/nesting;
- unknown event type;
- no database/projection call before authentication succeeds.

Replay/idempotency:

- same verified event repeated sequentially;
- same verified event delivered concurrently;
- provider retry after a transient application failure;
- provider manual replay equivalent;
- same event identity with different body digest;
- duplicate event across web replicas/process instances;
- duplicate inbound event;
- duplicate suppression event;
- duplicate provider acceptance.

Out-of-order convergence:

- provider acceptance before delivery;
- delivery before acceptance arrival;
- delayed before delivery;
- delayed arriving after an older delivery;
- failure before acceptance arrival;
- bounce after acceptance;
- complaint after delivery;
- suppression after delivery;
- replayed older accepted event after a later terminal state;
- local dead-letter followed by later authenticated provider event;
- contradictory authoritative events producing unavailable/partial rather than false certainty;
- inbound event replay;
- equal timestamps with deterministic tie behavior.

Isolation:

- same provider message HMAC under different accounts;
- same provider message HMAC under different products;
- same external event ID under different protected provider endpoints;
- forged account/product/provider fields in the payload;
- event for an unmatched provider message;
- contact public ID from another account;
- communication public ID from another account;
- client-supplied role/provider ID ignored;
- no record-existence oracle.

Status truth:

- pending local intent is never Sent or Delivered;
- sink completion is never Sent or Delivered;
- API acknowledgement is never Delivered;
- provider “sent/accepted” event is never Delivered unless its official semantics prove delivery;
- delivery requires authenticated provider evidence;
- missing provider source is unavailable, not empty;
- missing inbound source is unavailable, not no replies;
- dead letter is not provider failure;
- ambiguous timeout is not provider failure;
- inbound received does not expose body or claim verified sender identity.

Suppression:

- authenticated bounce projection;
- authenticated complaint projection;
- authenticated provider suppression projection;
- exact unsubscribe/opt-out projection if proven;
- replay idempotency;
- channel specificity;
- archive remains blocked;
- later delivery does not clear suppression;
- cross-account event cannot suppress another contact;
- unavailable unsubscribe source does not fabricate an unsubscribe.

Privacy:

- raw payload absent from normal database tables;
- encrypted raw retention only if explicitly approved;
- purge expiration behavior;
- provider ID absent from DTO/log/evidence;
- message body absent;
- attachment bytes absent;
- raw destination absent;
- route token absent;
- contact key absent;
- class link absent;
- synthetic-only screenshots and fixtures.

Request limits:

- body size boundaries;
- slow/chunked request termination;
- bounded processing time;
- bounded parser allocations where testable;
- generic error responses;
- no stack trace or verification detail leakage.


REQUIRED API AND AUTHORIZATION TESTS

Test:

- owner succeeds;
- admin succeeds;
- unauthenticated returns 401 before repository access;
- crm_agent denied;
- viewer denied;
- member denied;
- public denied;
- unknown/malformed role denied;
- privileged session without required assurance denied according to accepted auth policy;
- forged browser account/product/workspace/provider values ignored;
- contact cross-scope returns non-oracular not found;
- communication cross-scope returns non-oracular not found;
- raw provider ID is never accepted as a browser route identifier;
- global list is bounded;
- contact history is bounded;
- detail timeline is bounded;
- date range reversed;
- date range too large;
- invalid channel;
- invalid direction;
- invalid event kind;
- invalid state;
- invalid limit;
- cursor malformed;
- cursor tampered;
- cursor expired;
- cursor wrong account/product;
- cursor wrong contact;
- cursor wrong filters;
- cursor wrong mode;
- cursor wrong sort;
- cursor not accepted from an unapproved URL location;
- operational database failure is not returned as empty;
- known provider-source absence is partial/unavailable;
- true zero-row result is empty;
- all protected success and error responses are private/no-store;
- response DTO excludes every prohibited field.


REQUIRED CLIENT AND SESSION TESTS

In Chromium, test:

- direct global Communications navigation;
- direct contact Communications navigation;
- opening detail;
- filters;
- load more;
- back/forward;
- truly empty;
- unavailable;
- partial;
- delayed;
- retrying;
- failed;
- bounced;
- complained;
- suppressed;
- expired;
- dead-lettered;
- inbound received;
- error/retry;
- archive context.

Protected-state clearing:

- 401 from initial list;
- 401 from load more;
- 401 from detail;
- 403 from any protected request;
- explicit logout;
- session expiry;
- role/capability removal;
- account/product session change;
- in-flight request completes after logout;
- browser back after logout;
- bfcache restoration after logout.

After clearing, assert:

- no protected rows remain;
- no timeline remains;
- no cursor remains;
- no protected data flashes;
- no protected cache entry is reused;
- no browser persistent storage contains Communications data;
- subsequent access requires a fresh authorized session.


REQUIRED ACCESSIBILITY, RTL, AND REFLOW TESTS

Use Chromium and axe plus direct assertions.

Test all key states at:

- 360x800;
- 390x844;
- tablet;
- desktop;
- 200% zoom;
- 400% zoom;
- forced RTL/Hebrew fixture;
- long translated labels.

Verify:

- zero serious/critical axe violations;
- one H1 per page/surface as accepted;
- logical heading hierarchy;
- table headers and mobile card labels;
- keyboard-only filter and row/detail navigation;
- visible focus;
- focus return after closing detail;
- status/error announcements;
- no focus trap outside a deliberate modal/drawer;
- touch targets meet both required dimensions;
- no horizontal page overflow;
- timeline content reflows;
- state is not conveyed by color alone;
- time elements have understandable labels;
- RTL order and icons are correct;
- provider/source badges remain readable;
- unavailable/partial copy is explicit.


REQUIRED PERFORMANCE AND REQUEST-COUNT PROOF

Use a reproducible throttled-mobile profile.

For each key route/state:

- 3 or more warmups;
- at least 30 measured runs;
- raw samples retained;
- p50;
- p75;
- p95.

Measure:

- global Communications first usable/actionable state;
- contact-local Communications first usable/actionable state;
- detail/provider timeline open;
- filter apply;
- load more.

The usable mark must occur only after the visible, actionable UI has committed and painted. Do not mark immediately after fetch or before content is usable.

Record:

- CPU/network throttle;
- viewport;
- browser version;
- exact commit;
- build mode;
- request count;
- transfer size;
- emitted chunk size;
- cache state;
- warmup count;
- all sample values;
- percentile method.

Request bounds:

- no request per row;
- no provider request from the browser;
- direct global route performs only accepted session/bootstrap requests plus one initial Communications list request;
- contact tab selection performs one contact-history request;
- opening a detail performs at most one detail/timeline request unless an accepted pagination request is user-triggered;
- load-more performs exactly one page request;
- CRM overview performs zero Communications API requests;
- public pages perform zero authenticated/CRM/Communications requests;
- no hidden prefetch of protected data.

Set explicit performance budgets before measurement using accepted shell baselines. At minimum, do not regress the accepted authenticated-shell route-transition budget. Record failures honestly.


REQUIRED BUNDLE ISOLATION PROOF

Build production assets and inspect the Vite manifest/module graph.

Prove:

- public landing/signup JS contains no React, CRM, Communications, provider, webhook, or authenticated code;
- login/auth bootstrap does not include Communications implementation;
- authenticated shell does not eagerly include the full Communications feature;
- CRM overview does not load the Communications chunk;
- contact Communications chunk loads only after tab selection;
- global Communications chunk loads only on its route;
- provider detail code is lazy if separately split;
- no duplicate provider SDK/client code is shipped to the browser;
- webhook/server modules are never included in browser chunks;
- no secrets or provider environment names are embedded in client assets.

Record exact raw/gzip or accepted bundle measurements and request matrices.


LEAKAGE SCANS

Scan source, built assets, test artifacts, Playwright reports, screenshots, evidence, logs, and Git diff for:

- test contact names;
- test email values;
- test phone values;
- raw provider fixture IDs;
- raw webhook payload fragments;
- signature headers;
- webhook secrets;
- API-key patterns;
- database URLs;
- provider account IDs;
- internal contact keys;
- delivery keys;
- signup keys;
- outbox UUIDs;
- subjects;
- bodies;
- attachment bytes or filenames;
- class links;
- private owner destinations;
- cursor plaintext.

Use synthetic fixture values designed to make leakage detection reliable.

A fixture value appearing only in a fixture source file or a negative assertion may be acceptable. It must not appear in built client assets, public API snapshots, screenshots, logs, or final evidence.

Run the repository secret scan and targeted OT-67 leakage scan.


IMPLEMENTATION SEQUENCE

After the re-audit, implement in this order unless the accepted architecture demands a documented safer order.

1. Write the source-of-truth and schema mapping privately.
2. Correct accepted OT-44 normalization defects:
   - explicit unknown/unavailable event kind;
   - canonical public contact ID;
   - real source availability handling.
3. Add or adapt typed communication/provider-event contracts.
4. Add forward-only migrations for missing canonical event/history/dedup/index invariants.
5. Implement provider identity HMAC/encryption helpers using accepted security infrastructure.
6. Implement provider-specific webhook verification adapters.
7. Implement transactional webhook receipt and projection repositories.
8. Implement deterministic event reducers.
9. Implement bounce/complaint/suppression projection.
10. Implement verified inbound metadata projection only for proven sources.
11. Reconcile the canonical delivery worker/provider acknowledgement history.
12. Remove or make unreachable any duplicate consumer path only where accepted architecture proves it is obsolete; do not perform unrelated deletion.
13. Extend Communications read repository and service.
14. Extend typed APIs and safe source-availability DTOs.
15. Bind to the accepted non-mutating session/capability resolver.
16. Wire global route and contact tab into the accepted registries.
17. Implement detail/provider-state timeline.
18. Implement no-store/protected-state clearing.
19. Implement responsive, accessible, RTL-safe UI.
20. Add focused unit and integration tests.
21. Run real PostgreSQL proof.
22. Run browser, accessibility, bundle, and performance proof.
23. Run leakage scans.
24. Create evidence from sanitized results.
25. Commit intentionally.
26. Push and open one draft PR.

Do not make broad stylistic refactors, unrelated CRM changes, landing-page changes, provider activation changes, or package upgrades.


DEPENDENCIES

Prefer accepted OT-50 provider/security dependencies.

Before adding a dependency:

- prove the accepted code does not already provide the function;
- pin an intentional compatible version through the existing package policy;
- inspect license and maintained status;
- ensure it is server-only;
- ensure it does not enter browser bundles;
- update the lockfile intentionally;
- add tests for its security-sensitive behavior.

Do not add a generic webhook framework or provider SDK merely for convenience if the accepted adapter already exists.

Do not run a dependency command that triggers provider login, telemetry containing secrets, or external configuration.


EVIDENCE

Create repository-relative evidence under:

`ops/evidence/ot-67/`

At minimum include:

- `ACCEPTED-INPUTS.md`
- `PREFLIGHT.md`
- `BASELINE-AUDIT.md`
- `SOURCE-OF-TRUTH-MATRIX.md`
- `STATUS-MAPPING.md`
- `PROVIDER-READINESS.md`
- `PROVIDER-CONTRACT-MATRIX.md`
- `WEBHOOK-SECURITY.md`
- `REPLAY-AND-ORDERING.md`
- `AUTHORIZATION-AND-SCOPE.md`
- `PRIVACY-AND-RETENTION.md`
- `SUPPRESSION-PROJECTION.md`
- `RAILWAY-OWNERSHIP.md`
- `MIGRATION-CHECKSUMS.txt`
- `POSTGRES-PROOF.md`
- sanitized PostgreSQL plan JSON files;
- sanitized concurrency result JSON;
- `API-CONTRACT.md`
- `BUNDLE-AND-REQUEST-MATRIX.md`
- machine-readable bundle/request results;
- `PERFORMANCE-30-RUN.json`
- `PERFORMANCE-SUMMARY.md`
- `ACCESSIBILITY-RESULTS.json`
- `RTL-REFLOW.md`
- synthetic screenshots for 360, 390, tablet, desktop, and RTL states;
- `LEAKAGE-SCAN.md`
- `CHANGED-FILES.txt`
- `COMMANDS.txt`
- `FINAL-REPORT.md`

Evidence rules:

- Every evidence file identifies the exact OT-60 base SHA and OT-67 head SHA where applicable.
- Record accepted OT-44 and OT-50 SHAs.
- Record exact migration IDs/checksums.
- Record the safe staging fingerprint comparison result without raw identifiers.
- Record provider-readiness evidence references and digest verification.
- Record `CANARY_AUTHORIZATION_OR_NONE` safely.
- Do not copy credentials or raw provider values.
- Do not include raw webhook requests.
- Do not include real message content.
- Do not include contacts.
- Do not include provider IDs.
- Do not include class links.
- Do not include database URLs.
- Do not include production or staging PII.
- Commands must redact secret-bearing arguments.
- Screenshots must use synthetic fixtures.
- Results must distinguish passed, failed, blocked, unavailable, and not run.
- “Integration pending” is not a pass.
- pg-mem is not real PostgreSQL proof.
- One fast local sample is not throttled-mobile percentile proof.

The source-of-truth matrix must state for every public state:

- exact persisted evidence;
- source table/entity;
- producer;
- authentication status;
- deduplication identity;
- account/product binding;
- event ordering rule;
- public label;
- unavailable behavior;
- retention behavior.

The status mapping must explicitly prohibit:

- sink → Sent;
- sink → Delivered;
- API acknowledgement → Delivered;
- empty source → no messages;
- audit row → message;
- signup row → message;
- provider timeout → provider failure;
- unknown event → internal lead alert;
- inbound metadata → body available;
- unmatched inbound → arbitrary contact reply.


GIT REQUIREMENTS

After all code and verification work:

- work only on `codex/ot67-communications-v1b`;
- keep the worktree clean between intentional commits;
- do not merge another branch;
- do not rewrite accepted commits;
- do not force-push;
- use additive migrations only;
- include only OT-67-relevant changes;
- inspect `git diff --check`;
- inspect the full changed-file list;
- ensure no generated secret or local environment file is tracked.

Use intentional commits. A reasonable structure is:

1. provider event/history schema and secure ingestion;
2. truthful Communications read model/API/UI integration;
3. tests and sanitized evidence.

Use a different split if the actual dependency graph requires it, but avoid one opaque unrelated mega-commit.

Run all accepted repository gates, including:

- dependency installation;
- formatting;
- lint;
- typecheck;
- unit;
- integration;
- build;
- e2e;
- accessibility;
- performance;
- bundle checks;
- secret scan;
- OT-67 focused PostgreSQL/security tests;
- leakage scan;
- `git diff --check`.

Do not hide a repo-wide failure by running only focused tests. Focused tests supplement the accepted full gates.

Push the branch.

Open one draft PR against the exact accepted OT-60 integration ref.

The draft PR body must include:

- OT-67 scope;
- exact base SHA;
- exact accepted OT-44 SHA;
- exact accepted OT-50 SHA;
- OT-67 head SHA;
- migration IDs/checksums;
- source-of-truth summary;
- provider capability matrix;
- inbound availability;
- webhook security summary;
- PostgreSQL proof;
- browser/accessibility/performance proof;
- bundle isolation;
- privacy/retention summary;
- Railway ownership result;
- canary authorization state;
- known blockers;
- exact final result;
- explicit statement that no merge, deployment, provider mutation, webhook registration, provider send, DNS change, or production database access occurred.

Do not merge the PR.


RESULT CLASSIFICATION

Use exactly one of these results.

READY_FOR_STAGING_REVIEW

Use only when:

- every pre-write gate passed;
- implementation is complete;
- all required source truth is explicit;
- no false delivery/inbound claim exists;
- webhook authentication/replay/order protections pass;
- real PostgreSQL proof passes;
- migration checksums pass;
- account/product/provider isolation passes;
- privacy/retention behavior passes;
- required provider capabilities are either proven or explicitly unavailable;
- UI/API states are truthful;
- full repository tests pass;
- accessibility/RTL/reflow pass;
- throttled-mobile p50/p75/p95 evidence exists;
- bundle/request isolation passes;
- leakage scans pass;
- branch is pushed;
- draft PR is open;
- no external mutation occurred.

A `NONE` canary authorization does not prevent READY_FOR_STAGING_REVIEW because OT-67 does not execute a canary. It requires all live actions to remain disabled.

BLOCKED

Use only when the pre-write gate fails or the exact accepted inputs are unavailable. In this case:

- make no worktree/file/branch/commit/PR/database/provider write;
- report the failed gate safely;
- stop.

NOT_READY

Use when the pre-write gate passed and work began, but any implementation, security, migration, PostgreSQL, provider-truth, privacy, accessibility, performance, bundle, evidence, push, or PR requirement remains failed or incomplete.

Do not call a partially proven provider source ready.

A truthful partial provider matrix can still be READY_FOR_STAGING_REVIEW when unsupported capabilities are explicitly unavailable and all required product behavior is correct. A fabricated capability cannot.


FINAL REPORT REQUIREMENTS

`ops/evidence/ot-67/FINAL-REPORT.md` must contain:

- result;
- exact accepted input SHAs;
- OT-67 head SHA;
- exact remote base ref;
- exact branch;
- draft PR reference;
- migration IDs and checksums;
- changed files;
- source-of-truth matrix summary;
- provider capability summary;
- source availability summary;
- inbound source summary;
- webhook security result;
- duplicate/out-of-order result;
- suppression projection result;
- authorization/isolation result;
- privacy/retention result;
- PostgreSQL result;
- browser/accessibility/RTL result;
- p50/p75/p95 performance result;
- request-count result;
- bundle isolation result;
- leakage scan result;
- Railway ownership result;
- canary authorization state;
- known blockers;
- external mutations: `NONE`.

The report must not contain raw PII, provider IDs, payloads, secrets, message bodies, attachments, class links, or database identifiers.


FINAL CODEX RESPONSE

After completing or stopping, return a concise execution summary in this exact structure:

OT-67 RESULT: READY_FOR_STAGING_REVIEW | BLOCKED | NOT_READY
BASE OT-60 SHA: <full SHA>
ACCEPTED OT-44 SHA: <full SHA>
ACCEPTED OT-50 SHA: <full SHA>
OT-67 HEAD SHA: <full SHA or NONE>
BRANCH: <branch or NONE>
DRAFT PR: <reference or NONE>
MIGRATIONS: <IDs or NONE>
POSTGRESQL PROOF: PASS | FAIL | NOT_RUN
WEBHOOK SECURITY: PASS | FAIL | UNAVAILABLE | NOT_RUN
PROVIDER SOURCES: <safe capability summary>
INBOUND SOURCES: <safe capability summary>
BUNDLE/PERFORMANCE/A11Y: <safe summary>
CANARY AUTHORIZATION: NONE | VALIDATED_NOT_EXECUTED | INVALID
EXTERNAL MUTATIONS: NONE
EVIDENCE: ops/evidence/ot-67/FINAL-REPORT.md | NONE
BLOCKERS: <safe concise blockers or NONE>

Do not include contacts, emails, phone numbers, provider IDs, webhook payloads, message bodies, attachment data, class links, credentials, or tokens in the final response.
