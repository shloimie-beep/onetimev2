OT-63 — SECURE ZOOM AND LIVE-CLASS PROVIDER INTEGRATION
EXECUTION-GRADE CODEX PROMPT

SOURCE SPECIFICATION: :contentReference[oaicite:0]{index=0}

===============================================================================
1. ROLE
===============================================================================

You are the senior implementation engineer for:

OT-63 — Secure Zoom and Live-Class Provider Integration

Repository:

webcraft-media/onetimev2

You are responsible for repository inspection, implementation, verification,
sanitized evidence, intentional commits, pushing the feature branch, and opening a
draft pull request only after all applicable Phase A gates pass.

You are not authorized to merge, release, deploy, modify a live Zoom resource, or
activate production functionality merely because this prompt exists.

A fresh Codex window must execute this prompt directly. Do not ask for another
prompt-expansion pass. Resolve ordinary implementation choices from the accepted
repository conventions. Stop only for a genuine prerequisite, safety, authorization,
identity, schema, migration, deployment, or provider-contract blocker.

Do not weaken any requirement because a prerequisite is difficult to inspect or
because legacy code appears easier to copy.

===============================================================================
2. IMMUTABLE PREREQUISITE VALUES
===============================================================================

The following five placeholders are mandatory and must be replaced by the operator
before normal implementation begins:

- {{ACCEPTED_OT60_CONVERGENCE_HEAD_SHA}}
- {{ACCEPTED_OT43_CLASS_FULFILLMENT_HEAD_SHA}}
- {{ACCEPTED_OT52_PORTALS_HEAD_SHA}}
- {{DIRECTOR_APPROVED_OT63_BASE_SHA}}
- {{DIRECTOR_APPROVED_STAGING_SHA}}

Every replacement must be an exact 40-character hexadecimal Git commit SHA.

Never substitute any of the following:

- “latest”;
- HEAD;
- a local branch;
- a remote branch;
- a tag unless its peeled commit is separately supplied and verified;
- a pull-request number;
- a merge queue reference;
- an abbreviated SHA;
- a guessed commit;
- a commit found merely because it has a similar task name.

The implementation phase may begin only when all of these conditions are proven:

1. All five placeholders have been replaced by exact 40-character commit SHAs.
2. Every supplied object exists as a commit in the fetched repository.
3. {{DIRECTOR_APPROVED_OT63_BASE_SHA}} equals or descends from
   {{ACCEPTED_OT60_CONVERGENCE_HEAD_SHA}}.
4. The approved base contains the accepted OT-43 class-series, occurrence,
   fulfillment, reminder, and protected-access seams represented by
   {{ACCEPTED_OT43_CLASS_FULFILLMENT_HEAD_SHA}}, or the accepted OT-60 convergence
   report explicitly documents an intentional equivalent.
5. The approved base contains the accepted OT-52 parent/student/Rabbi portal access
   seams represented by {{ACCEPTED_OT52_PORTALS_HEAD_SHA}}, or the accepted OT-60
   convergence report explicitly documents an intentional equivalent.
6. The migration ledger, route registry, provider-boundary manifest, module
   integration evidence, and collision ownership at the approved base match the
   accepted OT-60 convergence report.
7. The exact staging source is {{DIRECTOR_APPROVED_STAGING_SHA}} and the corresponding
   approved rollback target is recorded in immutable deployment evidence.
8. A sanitized Zoom readiness inventory exists. It must establish safe readiness
   facts without revealing credentials, tokens, raw account/user/meeting identifiers,
   participant information, passcodes, join targets, start targets, or raw provider
   payloads.
9. The provider-resource strategy is established from approved evidence: either an
   approved existing recurring Zoom resource or an approved occurrence-specific
   provisioning strategy. Do not infer the strategy from legacy prototypes.
10. The intended Rabbi Zoom host is proven through approved, current readiness
    evidence. Zoom account administration or app ownership by another administrator
    does not prove host ownership.

If any condition is missing, contradictory, or unverifiable, stop before creating a
worktree, branch, file, migration, commit, deployment, or provider request.

Use this stop result:

STATUS: STOP_PREREQUISITES_NOT_ACCEPTED

Report only:

- which exact prerequisite is missing;
- which check was attempted;
- the exact nonsecret SHA or evidence path involved;
- what accepted evidence is required;
- confirmation that no repository or external mutation occurred.

===============================================================================
3. PHASE AUTHORIZATION MODEL
===============================================================================

There are three independent authorization phases.

Authorization for a later phase is never implied by authorization for an earlier
phase.

General language such as “permission granted,” “test everything,” “go ahead,”
“everything is sandbox,” “use staging,” or “finish the integration” is not sufficient
authorization for a deployment, provider credential probe, Zoom write, meeting
change, registrant change, participant action, webhook-subscription change, or live
class effect.

-------------------------------------------------------------------------------
PHASE A — REPOSITORY IMPLEMENTATION AND SYNTHETIC/LOCAL VERIFICATION
-------------------------------------------------------------------------------

Phase A permits, after all prerequisite gates pass:

- one fresh dedicated worktree;
- one fixed OT-63 feature branch;
- source and test changes in approved paths;
- forward-only migrations;
- synthetic provider fixtures;
- local tests;
- real non-production PostgreSQL verification;
- sanitized evidence;
- small intentional commits;
- pushing the feature branch;
- opening a draft pull request after local gates pass.

Phase A does not permit:

- staging deployment;
- Railway changes;
- DNS changes;
- a real OAuth token exchange;
- a real Zoom GET request;
- any Zoom POST, PUT, PATCH, or DELETE request;
- creating or changing a meeting;
- adding, updating, canceling, or querying a real registrant when that would reveal
  participant identity;
- joining or starting a meeting;
- modifying a webhook subscription;
- using a real provider destination in a launch test;
- production activation.

Phase A tests must use a synthetic transport and synthetic identifiers. Test fixtures
must not contain copied production values.

-------------------------------------------------------------------------------
PHASE B — SINK/STAGING DEPLOYMENT AND READ-ONLY READINESS
-------------------------------------------------------------------------------

A Phase B staging deployment is permitted only when a separate authorization value
exists:

OT63_STAGING_DEPLOY_AUTHORIZED_FOR_SHA=<exact 40-character Phase A head SHA>

The value must equal the exact commit being deployed. The deployment source must
equal or descend from {{DIRECTOR_APPROVED_STAGING_SHA}} according to the approved
deployment policy, and the exact rollback target must be known before deployment.

The first Phase B deployment must keep all Zoom calls and launch resolution disabled.

A real token exchange or read-only Zoom readiness probe requires a second, separate
authorization value:

ZOOM_READ_ONLY_READINESS_AUTHORIZED_FOR_SHA=<exact 40-character deployed SHA>

Without that exact value:

- do not mint a token;
- do not test credentials;
- do not call Zoom;
- report readiness as NOT_VERIFIED, not failed.

Read-only authorization permits only the explicitly approved, current official Zoom
read operations listed in the approved readiness manifest. It never authorizes a
meeting, registrant, participant, webhook, account-setting, or user mutation.

A read-only probe must:

- avoid printing or persisting the token;
- avoid printing raw response bodies;
- avoid recording account IDs, user IDs, meeting IDs, UUIDs, emails, names, phone
  numbers, URLs, passcodes, host keys, or participant information;
- return only bounded booleans, safe enum states, approved scope names, counts where
  non-identifying, timestamps, and nonsecret fingerprints;
- use strict timeouts;
- perform no automatic fallback to a write;
- leave provider writes and launches disabled.

-------------------------------------------------------------------------------
PHASE C — CONTROLLED ZOOM CANARY OR ANY LIVE ZOOM MUTATION
-------------------------------------------------------------------------------

Phase C remains forbidden unless Phase A evidence has been reviewed and a separate
exact authorization value is supplied:

ZOOM_STAGING_CANARY_AUTHORIZED_FOR_SHA=<exact 40-character deployed SHA>

The value must match the deployed source exactly.

Phase C additionally requires an approved, immutable canary change manifest. The
manifest must identify, without exposing raw provider identifiers:

- the exact source SHA;
- the approved environment;
- the approved account fingerprint;
- the approved host fingerprint;
- the approved existing test resource or explicitly approved class resource
  fingerprint;
- every permitted HTTP method and endpoint operation;
- the maximum number of provider mutations;
- the intended meeting-setting assertions;
- whether registration is permitted;
- the maximum number of synthetic operator/test participants;
- the expected webhook events;
- the rollback or containment action;
- the start and expiry of the authorization;
- the approving authority.

The canary authorization permits only the operations enumerated in that manifest. It
does not permit exploratory writes or unrelated cleanup.

Never involve, invite, register, notify, join, or affect real students during the
canary.

Live production activation or mutation requires a later, separate value:

ZOOM_LIVE_MUTATION_AUTHORIZED_FOR_SHA=<exact 40-character production source SHA>

It also requires an approved live change manifest. Phase C staging authorization
does not imply live authorization.

If any exact authorization is absent, malformed, expired, refers to another SHA, or
does not cover the intended operation, stop at the applicable phase boundary.

===============================================================================
4. READ-ONLY AUDIT SNAPSHOT — CONTEXT, NOT ACCEPTANCE
===============================================================================

The following snapshot was observed on 2026-07-14. It exists only to guide the fresh
collision audit. It is not an accepted integration train and must not replace the
five prerequisite SHAs.

Repository observations:

- The default branch was main.
- The default branch was observed at:
  610b585f3d221addd4e7b824c92a5cc256cffcf9
- That commit initialized the standalone One Time foundation.
- AGENTS.md establishes Node.js 24, TypeScript, Express 5, Vite, PostgreSQL through
  pg, forward-only checksummed migrations, and a transactional outbox.
- AGENTS.md prohibits copying BNA runtime, Operations pages, provider runtime,
  secrets, Studio, agents, or broad migrations.
- AGENTS.md requires server-derived account/product scope and prohibits View as
  Rabbi impersonation.
- The standalone main branch did not contain accepted OT-43, OT-52, or OT-60 work.

Observed active draft train, for collision inspection only:

- Foundation branch:
  codex/foundation-landing-lead-v1
  observed head:
  3465bd7d4c6b6829a6be6e4b4f8a003d608f3680

- CRM core branch:
  codex/crm-core-v1
  connector metadata and descendant branches reflected more than one observed
  commit, including:
  4ac288968ba24e30a5c3f8c6924f492eedf4338f
  a73458d1884b8fcb4843c4852425009577f59ef7
  Resolve this through a fresh fetch. Treat neither as accepted merely because
  descendants used it.

- OT-34 hardening:
  codex/ot34-first-slice-core-hardening
  observed head:
  87f9b315c54e32e918912cc100610e2c561b68ac

- OT-38 privileged MFA/security:
  codex/ot38-real-mfa-security-correction
  observed head:
  245649523566a7a0ace493ba70ede2a405ebdcce

- OT-35 authenticated shell:
  codex/ot35-app-shell-crm-clarity
  observed head:
  6ca5e568c328ea116a9413b57ea5920400f8bc14

- OT-39 CRM privacy/usability correction:
  codex/ot39-crm-privacy-performance-correction
  observed head:
  c1584577780d7b5125bce4fb81d2a454c9e84096

- OT-36 sink delivery foundation:
  codex/ot36-delivery-sink-foundation
  observed head:
  61d4755fe279ca47c37e7adbe8d1e6ce8b258dae

- OT-40 delivery contract correction:
  codex/ot40-school-receipt-worker-correction
  observed head:
  571b18f36cdc645f757cc3be6b0519f1af3225f6

- OT-37 PostgreSQL assurance:
  codex/ot37-postgres-assurance
  observed head:
  0ea782d8551c26edd48b08d644b573e19b9835b1

- OT-47 content-library evidence-only blocker:
  codex/parallel-ot47-content-library-foundation
  observed head:
  9444176dbc55e0c5af048ec1df2ea75ffa8dde33

At the audit date:

- these pull requests were drafts, not accepted convergence;
- several branches had migration, route, auth, shell, or worker overlap;
- OT-47 had stopped before product implementation because a safe real PostgreSQL
  instance was unavailable;
- no accepted OT-43 implementation was found;
- no accepted OT-52 portal implementation was found;
- no accepted OT-60 convergence report was found;
- no exact standalone staging source and rollback evidence was found;
- no safe standalone Zoom readiness inventory was found.

Do not assume this snapshot is still current. Fetch all refs and perform the complete
collision audit below.

Legacy evidence observations:

- The legacy evidence source is shloimie-beep/bnei-neviim-academy.
- An OT-22 extraction matrix cited legacy evidence around:
  cebbfc5781b92fcd9a5014df67f8ae4ba0b3a61c
  with some indexed paths at:
  354b95b0a671e578558a1d1b58ebea9105ad4d6d
- Legacy evidence referenced:
  src/lib/integrations/zoom.js
  tests/one-time-zoom-attendance-automation.test.js
  tests/live-class-infrastructure.test.js
  src/lib/bna/provider-lead-bot.js
  config/service-provider-bots/one-time.json
- Prior legacy evidence reported a no-write Zoom foundation, read-only probes,
  webhook validation concepts, and per-occurrence/per-learner concepts.
- Those reports are behavioral/provider-contract evidence only.
- They are not proof that the standalone repository contains equivalent code,
  credentials, account ownership, host ownership, webhook ownership, deployment
  topology, meeting strategy, or readiness.
- Do not copy any legacy route block, table, middleware, provider adapter, worker,
  environment value, account identifier, meeting identifier, credential, portal,
  Operations page, or runtime.

A prior legacy prompt preferred occurrence-specific meetings. That is not an
authoritative OT-63 decision. The accepted readiness evidence and current Zoom
contract must determine whether OT-63 binds an approved recurring resource or uses
approved occurrence-specific resources.

===============================================================================
5. AUTHORITATIVE PRODUCT INVARIANTS
===============================================================================

Preserve all of these invariants.

1. Standalone ownership

   Standalone One Time owns the runtime and ordinary page data.

   It must not:

   - load BNA Operations;
   - call BNA synchronously;
   - share a BNA session or cookie;
   - depend on a BNA page to join or start a class;
   - copy BNA provider code into the standalone runtime.

   Legacy BNA is read-only behavioral and provider-contract evidence.

2. Daily local-time rule

   The canonical class occurs daily at 19:00 in Asia/Jerusalem.

   Store and compute the product rule as local civil time plus the IANA timezone.

   Never replace it with a fixed UTC hour.

   Occurrence identity, date labels, access windows, reminder timing, cancellation,
   replacement occurrences, and historical interpretation must remain correct
   through Israel daylight-saving transitions and timezone database updates.

3. OT-43 ownership

   OT-43 owns the internal class series, schedule rule, occurrence materialization,
   cancellation/rescheduling, fulfillment, reminder, and protected-target seams.

   OT-63 extends those seams with one provider boundary.

   OT-63 must not create:

   - a second class model;
   - a second occurrence generator;
   - a second scheduler;
   - a second reminder queue;
   - a second transactional outbox;
   - a parallel enrollment model;
   - a parallel entitlement model;
   - a duplicate portal.

4. Host identity

   Rabbi Scheller must be the actual Zoom host/owner for the class behavior.

   A One Time administrator may have legitimate Zoom account administration,
   Marketplace app ownership, or scheduling privilege. That does not make that
   administrator the Rabbi host.

   Never implement:

   - View as Rabbi;
   - host impersonation;
   - fabricated host identity;
   - account-owner identity as a substitute for meeting host identity.

5. Provider settings

   Muted entry, host ownership, waiting-room behavior, participant video, chat,
   join-before-host, registration behavior, and other meeting settings must be
   derived from:

   - approved product policy;
   - current official Zoom documentation;
   - effective setting readback from the approved resource where authorized.

   Do not guess a field, capability, default, or account-level setting.

6. Actor boundaries

   Parent/guardian access must remain relationship-scoped.

   A parent acts as a parent. A parent launch is audited as a parent action for an
   authorized learner, not as learner impersonation.

   A student session resolves to exactly one learner.

   Every launch must re-evaluate:

   - authenticated subject;
   - active session and security version;
   - account;
   - product;
   - role/capability;
   - relationship;
   - selected or session-bound learner;
   - enrollment;
   - entitlement;
   - occurrence;
   - occurrence status;
   - access window;
   - provider readiness;
   - protected binding status.

7. Bearer-target secrecy

   A raw Zoom join URL, start URL, host key, passcode, registrant URL, launch token,
   privileged token, or equivalent bearer target must not be persisted in or exposed
   through:

   - public source;
   - ordinary application DTOs;
   - generic outbox payloads;
   - domain events;
   - browser boot state;
   - HTML source;
   - client logs;
   - server logs;
   - analytics;
   - traces;
   - screenshots;
   - support text;
   - audit evidence;
   - downloadable reports;
   - error envelopes;
   - response-header logging;
   - test snapshots copied into evidence.

   Where the proven Zoom contract makes temporary server-side storage unavoidable,
   use the accepted secret-storage/encryption boundary, strict retention, and no
   public serialization. Do not invent encryption outside repository conventions.

8. Honest launch limitation

   The final provider destination necessarily becomes available to an authorized
   participant’s browser or network when navigation occurs.

   Do not claim that the final destination can never be observed or shared.

   The required control is:

   - authorize first;
   - resolve the provider target at the last safe moment;
   - audit the local launch without recording the target;
   - return only the minimum short-lived redirect or launch response required by the
     verified provider contract;
   - never pre-render or prefetch the target;
   - never log the Location header or equivalent response.

9. Ordinary-route independence

   Public signup, CRM, landing pages, ordinary portal rendering, content pages, and
   unrelated authenticated routes must not wait for Zoom.

   A provider outage must not make those surfaces hang.

10. No alternative authorization channel

    Telegram, WhatsApp, email, Stripe, Vimeo, Studio, BNA, payment state alone, or a
    message-delivery result is not an authorization mechanism for live-class access.

11. Attendance scope

    OT-63 creates a durable provider-neutral attendance-event seam.

    OT-64 owns final attendance aggregation, percentages, duration summaries,
    reports, rewards, grades, and watch-progress integration.

    A Join click, page view, reminder click, launch audit, or provider readiness
    check is not attendance.

12. Separate states

    Keep these dimensions separate:

    - internal occurrence state;
    - enrollment/entitlement state;
    - live-access state;
    - provider desired state;
    - provider observed state;
    - webhook/event-processing state;
    - attendance-event reconciliation state;
    - content state;
    - integration readiness.

    Provider drift must not rewrite internal authorization.

===============================================================================
6. OFFICIAL ZOOM CONTRACT BASELINE
===============================================================================

The following official documentation was audited on 2026-07-14. It is a baseline,
not a substitute for fresh verification:

- API overview:
  [REDACTED:zoom_url]

- Server-to-Server OAuth:
  [REDACTED:zoom_url]

- User-authorized OAuth:
  [REDACTED:zoom_url]

- Meetings API:
  [REDACTED:zoom_url]

- Webhooks:
  [REDACTED:zoom_url]

- Rate limits:
  [REDACTED:zoom_url]

Before writing provider-specific production code and again before any Phase B
provider call or Phase C mutation:

1. Re-open current official Zoom documentation.
2. Record the retrieval date and the exact official pages consulted.
3. Build an endpoint-to-scope manifest from the endpoints actually used.
4. Confirm the current app type and OAuth model.
5. Confirm current token lifetime and refresh behavior.
6. Confirm current endpoint paths, request fields, response fields, and error
   semantics.
7. Confirm rate-limit classes, endpoint-specific daily limits, 429 behavior, and
   Retry-After semantics.
8. Confirm current webhook validation, signature, retry, timing, and event schemas.
9. Confirm host/scheduling privilege rules.
10. Confirm meeting and registration behavior for the approved resource strategy.
11. Confirm current participant/past-meeting availability, account-plan
    requirements, retention windows, UUID encoding, and data completeness.
12. Record any contradiction as a blocker. Current official documentation wins over
    legacy prompts and memory.

Baseline facts that must be reverified:

- Zoom REST APIs use OAuth authorization.
- Server-to-Server OAuth is account-level and uses account credentials.
- The audited Server-to-Server access token lifetime was approximately one hour and
  did not use refresh tokens; a new token was requested when needed.
- User-authorized OAuth has a different authorization and refresh lifecycle.
- A meeting is created for a specified Zoom user/host, not by assuming that the
  Marketplace app owner is the meeting host.
- Recurring fixed-time meetings and occurrence-specific meetings have different
  recurrence and occurrence semantics.
- Meeting settings included a muted-entry setting and controls concerning waiting
  room, participant video, join-before-host, and registration, but exact current
  fields and account-policy overrides must be verified.
- Provider start targets are privileged and short-lived. Never persist or expose
  them merely because the create/get response returns them.
- Zoom did not document a general meeting-write idempotency key in the audited
  material. Do not assume provider idempotency. Use local idempotency and observed
  state reconciliation.
- Provider registration can return a bearer join target. Keep it inside the protected
  server boundary.
- Past-meeting participant data may depend on plan, scope, resource age, and meeting
  UUID handling. A successful response is not proof of complete attendance.
- The audited webhook signature used the exact raw request body, the timestamp
  header, a v0-prefixed message, HMAC-SHA256, and the Zoom signature header.
- Endpoint URL validation used the supplied plain token and an HMAC-derived encrypted
  token.
- Zoom expected a fast successful webhook acknowledgement and retried some failed
  deliveries. Reconfirm exact timing and retry behavior.
- Duplicate delivery can occur. A webhook subscription is not an exactly-once queue.
- Rate limits are shared at account/app dimensions and include endpoint-specific
  limits. Reconfirm before activation.

Do not reproduce a remembered field or scope name without checking the current
official schema.

Do not interpret any of these as sufficient readiness:

- token exchange returned 200;
- user lookup returned 200;
- meeting lookup returned 200;
- health endpoint is green;
- webhook validation passed;
- a meeting exists;
- a join target was returned.

Readiness also requires the correct account, actual Rabbi host, approved resource,
effective settings, access binding, scope sufficiency, one-consumer topology,
redaction, and tested rollback.

===============================================================================
7. PRE-WRITE REPOSITORY PREFLIGHT
===============================================================================

Perform this section read-only in the existing repository before creating the OT-63
worktree.

-------------------------------------------------------------------------------
7.1 Current instructions
-------------------------------------------------------------------------------

- Locate and read every applicable AGENTS.md, CLAUDE.md, repository operating guide,
  and accepted OT-60 integration instruction.
- Apply instructions from root through every proposed touched path.
- Do not rely only on the AGENTS.md snapshot in this prompt.
- Record instruction-file paths and blob SHAs in sanitized preflight notes.

-------------------------------------------------------------------------------
7.2 Fetch without rewriting
-------------------------------------------------------------------------------

Fetch all relevant refs and prune only stale remote-tracking refs in the normal,
non-destructive way permitted by repository instructions.

Do not:

- reset;
- checkout over user work;
- clean;
- force-fetch rewritten refs;
- force-push;
- rewrite history;
- reuse a dirty worktree;
- reuse the intentionally divergent legacy worktree;
- modify the legacy BNA repository.

Verify:

- repository remote identity is webcraft-media/onetimev2;
- the existing working tree is not being repurposed;
- each supplied SHA exists;
- each supplied SHA is a commit object;
- all ancestry checks use exact commit objects.

Conceptual checks, adapting syntax only as necessary:

- git remote -v
- git status --short
- git cat-file -e <sha>^{commit}
- git show --no-patch --format=fuller <sha>
- git merge-base --is-ancestor <ancestor> <descendant>
- git branch --contains <sha>
- git branch -r --contains <sha>

Never print secret-bearing configuration while inspecting status or scripts.

-------------------------------------------------------------------------------
7.3 Placeholder validation
-------------------------------------------------------------------------------

Reject the input before writing when:

- a literal {{...}} placeholder remains;
- a value is not exactly 40 hexadecimal characters;
- a commit is unavailable after a normal fetch;
- base ancestry fails;
- OT-43 or OT-52 ancestry/equivalence cannot be proven;
- OT-60 evidence names a different migration, route, or module state;
- staging SHA is unknown or mutable;
- rollback evidence is absent.

-------------------------------------------------------------------------------
7.4 Accepted evidence inspection
-------------------------------------------------------------------------------

Locate and inspect the accepted OT-60 convergence report and supporting manifests.

At minimum, establish:

- accepted base and prerequisite heads;
- branch ancestry;
- migration ledger and checksums;
- route registry;
- build-entry registry;
- module ownership;
- provider-boundary ownership;
- worker/process ownership;
- scheduler ownership;
- outbox ownership;
- class-occurrence ownership;
- portal ownership;
- auth/session/MFA ownership;
- deployment source;
- rollback source/config;
- unresolved convergence exceptions.

Do not trust a “completed” summary without checking source and manifests.

If an expected manifest has a different accepted name, use the accepted equivalent
and record the mapping.

If the convergence report lacks a required ownership decision, stop with:

STATUS: STOP_OT60_OWNERSHIP_AMBIGUOUS

-------------------------------------------------------------------------------
7.5 Migration collision audit
-------------------------------------------------------------------------------

Inspect:

- every accepted migration;
- every migration on active, unmerged branches;
- migration checksums;
- migration order;
- migration runner;
- migration lock behavior;
- schema verification scripts;
- real-PostgreSQL evidence.

Do not select a migration identifier until this audit is complete.

Do not:

- modify an accepted migration;
- reuse a migration number;
- change a checksum after acceptance;
- add runtime schema creation;
- add destructive rollback SQL;
- assume an in-memory database proves PostgreSQL behavior.

When a competing migration or checksum exists, stop and report the competing paths,
commits, and required convergence action.

-------------------------------------------------------------------------------
7.6 Route/build/module collision audit
-------------------------------------------------------------------------------

Inspect accepted and active branches for collisions involving:

- class routes;
- occurrence routes;
- protected-target routes;
- launch routes;
- portal routes;
- webhook routes;
- provider readiness routes;
- server composition;
- worker entrypoints;
- cron/scheduler entrypoints;
- Vite inputs and chunks;
- package exports;
- contracts;
- configuration;
- authentication middleware;
- CSRF middleware;
- no-store helpers;
- audit helpers;
- error envelopes;
- rate-limit infrastructure.

Do not create a route merely because a desired path is free on the default branch.
The accepted convergence base is authoritative.

-------------------------------------------------------------------------------
7.7 Existing extension-point map
-------------------------------------------------------------------------------

Locate the actual accepted implementation of:

- class series;
- local schedule rule;
- occurrence materialization;
- occurrence exception/cancellation/rescheduling;
- live-access mode;
- protected target or launch reference;
- enrollment;
- entitlement;
- guardian/learner relationship;
- parent session learner selection;
- student session learner binding;
- Rabbi/owner/admin capabilities;
- session security version;
- privileged MFA assurance;
- CSRF;
- no-store;
- return-route validation;
- signed/opaque tokens;
- rate limiting;
- audit events;
- transactional outbox;
- worker leasing/deduplication;
- route registry;
- provider-boundary interfaces;
- accepted portal shell;
- accepted error envelope.

Write a private working map before editing. Do not put secrets or private row data in
it.

If an accepted seam is absent, do not create a parallel substitute. Stop with:

STATUS: STOP_ACCEPTED_SEAM_MISSING

-------------------------------------------------------------------------------
7.8 Real PostgreSQL readiness
-------------------------------------------------------------------------------

A safe, disposable, non-production PostgreSQL database is required before OT-63 can
be claimed complete.

It must not be:

- production;
- the live Rabbi database;
- a BNA database;
- an unapproved Railway production database;
- a shared database containing private rows.

If no safe real PostgreSQL instance is available:

- synthetic/unit work may proceed only if all other Phase A prerequisites passed;
- do not claim migration, locking, concurrency, deduplication, or performance
  completion;
- do not open a ready-for-review PR;
- record STATUS: STOP_REAL_POSTGRESQL_UNAVAILABLE in the final report.

===============================================================================
8. WORKTREE AND BRANCH ENVELOPE
===============================================================================

After every pre-write gate passes, create exactly one dedicated worktree and branch.

Fixed branch:

codex/ot63-secure-zoom-live-class

Fixed sibling worktree path:

../onetimev2-ot63-secure-zoom-live-class

Before creation, verify that:

- the branch does not exist locally;
- the branch does not exist remotely;
- the worktree path does not exist;
- no existing worktree uses the branch;
- the approved base SHA is exact.

If the branch or worktree already exists, do not reuse or overwrite it. Stop and
report the collision.

Create the branch directly from:

{{DIRECTOR_APPROVED_OT63_BASE_SHA}}

Immediately verify:

- HEAD equals the approved base;
- status is clean;
- no untracked files exist;
- the remote ancestry checks still pass;
- repository instructions are present in the worktree.

Record the initial worktree state in sanitized evidence only after the evidence
directory itself is permitted by path ownership.

Never:

- reset;
- rebase accepted history;
- amend another task’s commit;
- cherry-pick speculative branches;
- merge an active branch by assumption;
- force-push;
- use the legacy BNA worktree;
- copy a code packet from BNA.

===============================================================================
9. PATH OWNERSHIP
===============================================================================

Derive exact allowed paths from the accepted OT-60 convergence report.

Expected categories, adapted to actual accepted names, are:

- the accepted OT-43 class/live-access module;
- the accepted OT-52 portal integration points;
- one server-only provider adapter package or module;
- one provider-neutral contract boundary;
- the accepted web server route composition;
- the accepted worker/event consumer;
- one new forward-only migration or accepted equivalent;
- focused unit, integration, PostgreSQL, browser, accessibility, performance, and
  security tests;
- OT-63 evidence and runbook documentation.

Prohibited by default:

- legacy BNA source;
- unrelated public landing code;
- unrelated lead capture;
- unrelated CRM behavior;
- unrelated messaging providers;
- Stripe/payment code;
- Vimeo/content behavior owned by another task;
- Studio/agent code;
- accepted historical migrations;
- generated artifacts;
- broad package refactors;
- broad formatting;
- CI workflow changes;
- Railway configuration;
- DNS configuration;
- package-lock changes without an approved, necessary dependency.

Prefer existing dependencies and repository primitives.

If a necessary change falls outside accepted OT-63 ownership:

1. stop before editing that path;
2. identify the collision;
3. state why the change is necessary;
4. report the owning task/branch/evidence;
5. do not weaken the design to avoid reporting it.

===============================================================================
10. IMPLEMENTATION ARCHITECTURE
===============================================================================

Extend the accepted architecture. Do not force the names below when the accepted
repository already has equivalent names.

-------------------------------------------------------------------------------
10.1 One provider-neutral live-class boundary
-------------------------------------------------------------------------------

There must be exactly one authoritative provider-neutral live-class boundary.

Add or extend interfaces that express only the capabilities OT-63 needs, such as:

- validate provider configuration;
- obtain sanitized readiness;
- read an approved provider resource;
- reconcile desired and observed resource state;
- resolve a participant launch target at the last safe moment;
- resolve an authorized host action at the last safe moment;
- normalize an allowed provider event;
- obtain approved past-occurrence observations when authorized.

Do not expose Zoom-specific DTOs to:

- React;
- public bundles;
- domain entities;
- portal boot state;
- generic outbox messages;
- unrelated application modules.

The Zoom adapter must remain server-only.

Do not add a second adapter if an accepted provider boundary already exists. Extend
the accepted one.

-------------------------------------------------------------------------------
10.2 Configuration and fail-closed modes
-------------------------------------------------------------------------------

Use the accepted configuration schema and secret mechanism.

Represent, using repository naming conventions, the concepts of:

- provider disabled by default;
- synthetic adapter enabled only in tests/local development;
- provider reads disabled separately;
- resource writes disabled separately;
- participant launches disabled separately;
- host actions disabled separately;
- webhooks disabled separately;
- attendance observation disabled separately;
- staging canary authorization absent by default;
- live activation absent by default;
- expected account fingerprint;
- expected host fingerprint;
- approved resource-strategy mode;
- strict request timeout;
- retry ceilings;
- circuit-breaker/backoff settings where repository conventions support them;
- webhook body-size and replay-window limits;
- safe retention controls.

Do not hardcode environment-variable names from the legacy repository. Map concepts
onto the accepted standalone configuration conventions.

Configuration presence is not readiness.

Missing, malformed, inconsistent, or unauthorized configuration must fail closed
without preventing ordinary pages from rendering.

Never expose credential presence in a way that allows a low-privilege actor to infer
account configuration. Rabbi-facing status must be outcome-oriented. Technical scope
and app details belong only in sanitized support evidence.

-------------------------------------------------------------------------------
10.3 OAuth/token boundary
-------------------------------------------------------------------------------

Implement the exact current OAuth model established by the approved readiness
inventory and official Zoom documentation.

Do not assume Server-to-Server OAuth solely because legacy evidence used it.

When Server-to-Server OAuth is the approved model:

- keep account credentials server-side;
- cache access tokens only ephemerally;
- use expiration skew;
- prevent token-refresh stampedes with the repository’s single-flight or locking
  convention;
- persist no token;
- log no token;
- include no token in errors or metrics;
- permit at most one reauthentication retry after a provider 401;
- never test a credential during Phase A.

When a user-authorized OAuth model is approved instead:

- follow the current official authorization, refresh, revocation, and storage
  contract;
- do not retrofit Server-to-Server assumptions;
- keep refresh credentials within the accepted secret boundary;
- do not add an interactive authorization flow without explicit accepted product
  ownership.

Any uncertainty in app type, app owner authority, account match, or granted scopes
is a blocker.

-------------------------------------------------------------------------------
10.4 Request safety and resilience
-------------------------------------------------------------------------------

Every provider call must have:

- typed and validated request boundaries;
- typed and validated response boundaries;
- strict timeouts;
- bounded response sizes where feasible;
- redaction before error construction;
- normalized error classes;
- request correlation that contains no secret identifier;
- retry classification;
- bounded exponential backoff with jitter where safe;
- circuit breaking or repository-equivalent provider isolation;
- graceful shutdown behavior;
- metrics that do not contain raw provider identifiers or targets.

Read retries may be allowed only when current endpoint semantics and repository policy
make them safe.

Write retries must never be blind.

If a write times out or returns an ambiguous failure:

1. mark the attempt outcome unknown;
2. perform an authorized read/reconciliation when permitted;
3. determine whether the desired resource already exists or changed;
4. retry only when duplicate mutation is ruled out;
5. otherwise enter human-review state.

Do not invent a Zoom idempotency header.

-------------------------------------------------------------------------------
10.5 Provider-resource binding
-------------------------------------------------------------------------------

Use an opaque internal binding tied to:

- account;
- product;
- class series;
- internal occurrence or approved recurring-series strategy;
- provider kind;
- desired state version;
- observed state version/fingerprint;
- lifecycle/reconciliation status.

Provider meeting IDs, UUIDs, registrant IDs, or resource IDs must never become:

- product primary keys;
- authorization tokens;
- public route identifiers;
- browser-provided scope;
- evidence labels.

Use local opaque IDs as externally visible references.

Enforce database uniqueness sufficient to prevent:

- two active provider resources for one occurrence when the approved strategy permits
  only one;
- cross-account reuse;
- cross-product reuse;
- duplicate canary bindings;
- duplicate learner/resource mappings where registration is used;
- duplicate provider events.

Store raw provider identifiers only where operationally necessary and permitted by
the accepted secret/data classification. Never serialize them into ordinary DTOs.

-------------------------------------------------------------------------------
10.6 Desired versus observed state
-------------------------------------------------------------------------------

Model desired and observed state separately.

Desired state comes from approved One Time policy and internal occurrence state.

Observed state comes from authorized provider reads, write responses, and verified
events.

Track enough information to determine:

- not configured;
- disabled;
- pending;
- ready;
- drifted;
- unavailable;
- review required;
- failed safely;
- cancelled/ended where applicable.

Do not automatically overwrite a provider resource merely because observed state
differs.

Unsafe drift requiring human review includes at least:

- wrong host;
- wrong account;
- unrelated meeting/resource;
- changed recurrence strategy;
- changed access policy;
- changed registration policy;
- settings outside the approved mutable allowlist;
- resource collision;
- account-wide policy override;
- ambiguous ownership.

-------------------------------------------------------------------------------
10.7 Internal source of truth
-------------------------------------------------------------------------------

One Time remains authoritative for:

- actor authorization;
- account/product scope;
- relationship;
- learner identity;
- enrollment;
- entitlement;
- occurrence identity;
- cancellation/rescheduling;
- access window;
- local launch permission.

Zoom readiness is an observed provider fact.

When Zoom and One Time disagree:

- deny access locally when One Time denies it;
- do not reopen a cancelled or unauthorized occurrence because Zoom remains joinable;
- do not claim ready when the provider is missing or drifted;
- do not mutate Zoom automatically unless the exact operation and phase are
  authorized;
- expose a bounded unavailable/review state.

===============================================================================
11. RECURRENCE AND OCCURRENCE RECONCILIATION
===============================================================================

-------------------------------------------------------------------------------
11.1 Internal recurrence
-------------------------------------------------------------------------------

Reuse the accepted OT-43 recurrence engine.

Required rule:

- frequency: daily;
- local start: 19:00;
- timezone: Asia/Jerusalem;
- time representation: local civil time plus IANA timezone;
- stable opaque occurrence identity;
- date-specific exceptions;
- DST calculated from timezone rules;
- historical occurrences not rewritten in place.

Preserve accepted OT-43 behavior for:

- rolling materialization horizon;
- missed scheduler execution;
- duplicate materialization;
- cancellation;
- rescheduling;
- past/future state;
- exactly-at-window boundaries;
- clock skew.

A reschedule must follow the accepted OT-43 semantics. Do not silently change the
original occurrence timestamp to preserve a provider binding.

-------------------------------------------------------------------------------
11.2 Provider strategy decision
-------------------------------------------------------------------------------

Determine from accepted evidence whether the approved integration uses:

A. an approved existing recurring Zoom resource with internal occurrence binding; or
B. approved occurrence-specific Zoom resources.

Do not choose based only on convenience.

Do not create a new recurring Zoom meeting merely because an approved one cannot be
found.

If strategy A is approved:

- prove the existing recurring resource belongs to the approved account;
- prove the actual Rabbi is the host;
- map internal occurrences to provider occurrences using current official semantics;
- handle occurrence identifiers and registration type correctly;
- preserve internal occurrence identity as primary;
- enter review state when provider occurrence mapping is ambiguous.

If strategy B is approved:

- one internal occurrence may bind to at most one active provider meeting under the
  approved policy;
- provision only during an authorized Phase C operation;
- reconcile after ambiguous writes before retrying;
- do not create a second meeting when one registrant or setting operation fails;
- cancellation/rescheduling must deny local access immediately, independent of
  provider availability.

If approved evidence does not choose a strategy, stop with:

STATUS: STOP_PROVIDER_RESOURCE_STRATEGY_UNPROVEN

-------------------------------------------------------------------------------
11.3 Meeting policy
-------------------------------------------------------------------------------

Create one explicit meeting-settings policy based on accepted product decisions and
current official Zoom fields.

At minimum, verify and test the approved values for:

- actual Rabbi host;
- timezone/start semantics where applicable;
- muted entry;
- waiting room;
- participant video;
- host video;
- chat policy;
- join-before-host;
- registration behavior;
- participant notification behavior;
- recording state;
- transcription/AI-summary state;
- unrelated account-level settings that must remain untouched.

Do not silently:

- transfer ownership;
- change the Zoom account owner;
- change a Marketplace app owner;
- change account-wide settings;
- change an unrelated meeting;
- enable recording;
- enable transcription;
- enable AI summaries;
- broaden participant permissions.

Read back effective resource settings after any authorized mutation. Do not treat the
submitted request as proof that account policy accepted the setting.

-------------------------------------------------------------------------------
11.4 Host and scheduling privilege
-------------------------------------------------------------------------------

Distinguish:

- Zoom account owner;
- Marketplace app owner;
- One Time administrator;
- scheduling actor;
- meeting host.

Prove the intended Rabbi host through read-only approved evidence.

Where an administrator schedules on behalf of the Rabbi:

- verify current scheduling privilege;
- verify account match;
- verify host license/capability;
- verify that the created or bound meeting’s actual host is the Rabbi;
- never present the administrator as Rabbi;
- stop when privilege or ownership is ambiguous.

===============================================================================
12. PROTECTED PARTICIPANT LAUNCH
===============================================================================

-------------------------------------------------------------------------------
12.1 Launch flow
-------------------------------------------------------------------------------

Extend the accepted OT-43 protected-target and OT-52 portal seams.

The participant launch must be a server-authorized exchange:

1. The browser is already on an authenticated One Time page.
2. The actor invokes a POST action.
3. The server validates the accepted explicit CSRF proof.
4. The server reloads or strongly revalidates session/security state.
5. The server derives account and product; the browser cannot choose them.
6. The server resolves actor role and learner scope.
7. The server rechecks relationship, enrollment, entitlement, occurrence, occurrence
   state, access window, and provider binding.
8. The server applies rate limits and replay/concurrency controls.
9. The server records a sanitized local launch audit without the target.
10. The server resolves the current provider target at the last safe moment.
11. The server returns only the minimum no-store redirect/launch response.
12. No middleware, reverse-proxy logger, trace, or application log records the
    Location header or target.

The launch response must include accepted private/no-store headers and prevent
intermediary caching.

Do not prefetch, preload, embed, or expose the provider target.

-------------------------------------------------------------------------------
12.2 GET deep links
-------------------------------------------------------------------------------

A GET deep link may:

- route to the authenticated portal/class page;
- preserve a validated local return route;
- display current eligibility/readiness.

A GET deep link must not directly emit the provider target or create a launch audit.

Do not place provider identifiers or launch tokens in query strings.

-------------------------------------------------------------------------------
12.3 Replay and concurrency
-------------------------------------------------------------------------------

Where launch auditing or short-lived launch grants create state, use:

- short expiry;
- single purpose;
- actor binding;
- account/product binding;
- learner binding;
- occurrence binding;
- cryptographic integrity using accepted repository primitives;
- replay detection;
- transactional consume semantics;
- bounded reconnect behavior.

Do not use a one-use grant design that prevents a legitimate reconnect after a
provider disconnect. Reconnect policy must be explicit, time-bounded, and tested.

Do not make a raw provider URL the replay-control token.

-------------------------------------------------------------------------------
12.4 Open-redirect resistance
-------------------------------------------------------------------------------

The client must not submit a destination URL.

The provider target must be resolved from the authorized server-side binding.

Do not accept:

- arbitrary return URLs;
- provider URL overrides;
- meeting IDs;
- occurrence IDs outside the actor’s authorized local scope;
- host/participant mode chosen only by client input.

Use the accepted local return-route allowlist for post-error navigation.

-------------------------------------------------------------------------------
12.5 Participant capabilities
-------------------------------------------------------------------------------

Parent/guardian:

- sees only authorized learners;
- may launch only for a learner the accepted relationship and portal contract allow;
- remains audited as the parent/guardian actor;
- never receives host capability.

Student:

- resolves to exactly one learner;
- cannot select or enumerate another learner;
- never receives host capability.

Rabbi/authorized owner:

- may receive a participant action if product policy permits;
- host/start action remains a separate capability and endpoint.

Anonymous, suspended, wrong-account, wrong-product, archived, unenrolled, unentitled,
expired-session, or cancelled-occurrence actors receive a non-enumerating denial.

===============================================================================
13. HOST/START ACTION
===============================================================================

Keep host/start capability separate from participant launch.

The host action must require:

- actual accepted Rabbi/owner capability;
- current session;
- current security version;
- accepted privileged MFA assurance when required by the auth contract;
- explicit CSRF;
- account/product binding;
- occurrence binding;
- approved host identity;
- current provider readiness;
- rate limiting;
- no-store;
- sanitized audit.

A One Time administrator may receive only the exact scheduling/manage capability
authorized by the accepted role model. Do not let an administrator obtain the
Rabbi’s host target merely because the administrator can manage the Zoom account.

Never expose:

- host key;
- raw start URL;
- passcode;
- privileged token;
- provider account ID;
- provider user ID.

Determine from the current approved Zoom contract whether the safest host action is:

- an approved native Zoom host workflow;
- a just-in-time privileged redirect;
- a bounded management action that does not expose the start target.

Do not persist a start URL simply because an API response contains one.

===============================================================================
14. WEBHOOK INGRESS
===============================================================================

-------------------------------------------------------------------------------
14.1 Route boundary
-------------------------------------------------------------------------------

Use one authoritative webhook ingress route in the accepted route registry.

The route must remain outside interactive session/CSRF middleware while being
protected exclusively by:

- public HTTPS/TLS requirements;
- exact route ownership;
- strict content type;
- bounded body size;
- exact raw body;
- current official Zoom signature verification;
- timestamp/replay enforcement;
- account/resource allowlisting;
- event allowlisting;
- rate limits appropriate to provider ingress;
- durable deduplication.

Do not register a second webhook route because a legacy path exists.

-------------------------------------------------------------------------------
14.2 Endpoint validation
-------------------------------------------------------------------------------

Implement current official Zoom endpoint validation as a distinct request path inside
the one ingress handler.

Use the current official challenge schema and HMAC response.

Do not log:

- the raw challenge payload;
- validation secret;
- encrypted token beyond what is required in the response;
- provider identifiers.

Meet the current official response deadline.

-------------------------------------------------------------------------------
14.3 Signature and replay verification
-------------------------------------------------------------------------------

Reverify current official documentation, then implement against the exact raw bytes.

The audited baseline used:

- x-zm-request-timestamp;
- x-zm-signature;
- message format v0:<timestamp>:<raw-body>;
- HMAC-SHA256;
- expected signature prefixed by v0=.

Requirements:

- read and preserve the exact raw request bytes;
- verify before trusting parsed JSON;
- use constant-time comparison;
- reject missing or malformed headers;
- reject stale timestamps according to a documented narrow replay window;
- reject future timestamps outside clock-skew policy;
- prevent replay after a valid event has been accepted;
- test Unicode, whitespace, ordering, and body-byte sensitivity;
- never reconstruct JSON and verify the reconstruction.

Do not invent Zoom’s algorithm if the current official documentation differs.

-------------------------------------------------------------------------------
14.4 Fast durable acknowledgement
-------------------------------------------------------------------------------

After verification and allowlisting:

1. create a sanitized durable provider-event inbox record;
2. enforce deduplication transactionally;
3. commit before acknowledgement;
4. return the current required successful status within Zoom’s deadline;
5. process asynchronously through the accepted worker topology.

Do not perform expensive occurrence reconciliation in the request thread.

Do not acknowledge before durable acceptance unless the accepted architecture
explicitly provides equivalent durable transport.

-------------------------------------------------------------------------------
14.5 Event allowlist
-------------------------------------------------------------------------------

Build an explicit allowlist from the current official event names required by OT-63.

Expected categories may include:

- meeting started;
- meeting ended;
- participant joined;
- participant left.

Do not hardcode these names from memory. Verify exact event identifiers and scope
requirements.

Recording, transcript, summary, chat, phone, or unrelated account events are out of
scope unless a later accepted task authorizes them.

Unsupported events must be:

- rejected when configuration indicates the subscription is wrong; or
- recorded only as a redacted unsupported-event fact; or
- safely ignored;

according to the accepted event contract.

An unsupported event must never become attendance.

-------------------------------------------------------------------------------
14.6 Account/resource binding
-------------------------------------------------------------------------------

Before normalizing an event, establish that it belongs to:

- the approved account;
- an approved host where relevant;
- a known provider binding;
- the correct One Time account/product;
- a known internal class series/occurrence.

Provider identifiers in the payload are claims to validate, not authorization.

Wrong-account, wrong-resource, or ambiguous events must remain quarantined or
rejected according to the accepted contract. Do not attach them to the nearest
occurrence.

-------------------------------------------------------------------------------
14.7 Duplicate consumers
-------------------------------------------------------------------------------

Audit:

- Zoom webhook subscriptions;
- staging and production ingress domains;
- legacy BNA webhook ownership;
- current standalone webhook ownership;
- queue consumers;
- polling/reconciliation jobs;
- token consumers;
- retry workers.

There must be one accepted consumer for each responsibility.

If two deployments, repositories, workers, or subscriptions can process or mutate
the same resource, stop with:

STATUS: STOP_DUPLICATE_PROVIDER_CONSUMER

Do not disable or alter another consumer without explicit authorization.

===============================================================================
15. PROVIDER-NEUTRAL ATTENDANCE-EVENT SEAM
===============================================================================

OT-63 may normalize verified provider observations into append-only facts.

Each fact must include, using accepted naming:

- opaque local fact ID;
- provider kind;
- sanitized provider event identifier or approved fingerprint;
- source category;
- internal account;
- internal product;
- internal occurrence;
- internal learner only when conservatively matched;
- event type;
- provider event time;
- local observed time;
- ingestion order/version;
- reconciliation status;
- match confidence/status;
- safe provenance;
- supersession/correction relation where accepted.

Do not include raw provider payloads or bearer targets.

Use durable uniqueness so retrying or receiving a duplicate event does not create a
second semantic fact.

Handle:

- valid duplicates;
- out-of-order join/leave events;
- late events;
- clock skew;
- meeting start/end before or after participant events;
- unknown participants;
- ambiguous participants;
- wrong account;
- wrong resource;
- missing occurrence mapping;
- repeated reconnect events.

Participant identity matching must be conservative.

Preferred evidence is an accepted internal registration/binding relationship plus
verified provider identifiers.

Never match a child solely from:

- display name;
- email similarity;
- screen name;
- household guess;
- event ordering;
- another child’s provider identity.

Ambiguous observations remain unmatched/review-needed.

Do not expose one child’s identity to another household.

OT-63 must not calculate:

- final attendance percentage;
- final attended minutes for reporting;
- present/late/partial/absent;
- rewards;
- grades;
- watch progress;
- family report rollups.

Those belong to OT-64.

A limited event-level technical reconciliation status is permitted; a final
attendance judgment is not.

===============================================================================
16. PAST-MEETING/READ RECONCILIATION
===============================================================================

Webhook delivery is not the sole source of truth.

When current plan, scopes, retention, and Phase B/C authorization permit, implement
a bounded read-reconciliation capability behind the provider boundary.

Reverify:

- the correct past-meeting or report endpoint;
- plan requirements;
- meeting age limits;
- participant/registrant fields;
- pagination;
- reconnect row behavior;
- meeting UUID encoding requirements;
- data latency and completeness.

Never fall back to a broader reports endpoint merely because the preferred endpoint
is unavailable. Broader data access requires explicit scope justification.

Normalize read observations into the same provider-neutral event/fact seam.

Do not interpret a missing participant as absent attendance until OT-64 applies an
approved completeness policy.

===============================================================================
17. RABBI, PARENT, AND STUDENT EXPERIENCE
===============================================================================

Integrate only into the accepted One Time shell and OT-52 surfaces.

Do not add:

- a generic Integrations page;
- Zoom credential UI;
- Marketplace setup UI;
- webhook debug UI;
- account ID display;
- meeting ID display;
- raw URL display;
- BNA Operations chrome;
- Studio prompts;
- agent controls.

-------------------------------------------------------------------------------
17.1 Rabbi-facing experience
-------------------------------------------------------------------------------

Show the useful outcome:

- next class date/time in clear Israel local time;
- occurrence status;
- truthful provider readiness;
- protected Start or Manage action where authorized;
- bounded operational status;
- concise corrective guidance;
- safe retry where permitted.

Do not show:

- OAuth details;
- scope strings in ordinary Rabbi UI;
- provider app ownership;
- raw provider errors;
- worker names;
- raw request IDs;
- provider identifiers;
- participant identities beyond accepted product UI.

-------------------------------------------------------------------------------
17.2 Parent experience
-------------------------------------------------------------------------------

Show only authorized learners.

For each eligible learner, show:

- next eligible class;
- clear local-time label;
- access state;
- parent-session Join action where the accepted OT-52 contract permits;
- non-enumerating unavailable state.

A parent must not see an unrelated learner or another household.

-------------------------------------------------------------------------------
17.3 Student experience
-------------------------------------------------------------------------------

Show only the learner bound to the student session.

Show:

- next class;
- local-time label;
- current access state;
- eligible Join action.

Do not expose learner selection when the session contract binds exactly one learner.

-------------------------------------------------------------------------------
17.4 Required UI states
-------------------------------------------------------------------------------

Implement explicit, non-dead states for:

- loading;
- not yet open;
- open;
- launch in progress;
- ended;
- cancelled;
- rescheduled;
- provider not ready;
- provider unavailable;
- access denied;
- session expired;
- security state changed;
- offline;
- rate limited;
- safe retry;
- review required.

A disabled control must explain the relevant bounded state.

Do not leak whether another learner/resource exists.

-------------------------------------------------------------------------------
17.5 Accessibility and responsive acceptance
-------------------------------------------------------------------------------

Verify at minimum:

- 360x800;
- 390x844;
- tablet;
- desktop;
- RTL;
- reduced motion;
- 200% browser zoom;
- keyboard-only navigation;
- screen-reader semantics;
- slow network;
- offline transition;
- provider unavailable;
- warm return/back navigation.

Requirements:

- controls at least 44x44 in both dimensions unless an accepted documented exception
  exists;
- visible focus;
- logical focus order;
- no focus loss after status transition;
- readable local-time labels;
- no horizontal overflow;
- no duplicate navigation;
- accepted header/footer;
- no inaccessible live-region spam;
- no provider target in accessible names or DOM attributes.

===============================================================================
18. SECURITY CONTROLS
===============================================================================

Reuse accepted repository controls.

-------------------------------------------------------------------------------
18.1 Session and MFA
-------------------------------------------------------------------------------

Every privileged action must honor:

- current session;
- session expiry;
- session-family/security version;
- suspension state;
- role/capability;
- privileged MFA assurance where the accepted auth policy requires it.

Do not rely on an old boolean “MFA capable” field if accepted OT-60 contains verified
MFA assurance.

Do not create Zoom-specific authentication.

-------------------------------------------------------------------------------
18.2 CSRF
-------------------------------------------------------------------------------

Use the accepted explicit CSRF proof for unsafe authenticated methods.

Do not accept the CSRF cookie itself as the only submitted proof.

Webhook ingress does not use interactive CSRF; it uses provider signature and replay
controls.

-------------------------------------------------------------------------------
18.3 No-store and caches
-------------------------------------------------------------------------------

Apply accepted private/no-store headers to:

- class access pages containing sensitive readiness;
- launch responses;
- host actions;
- errors associated with launch;
- session-sensitive API responses.

Test browser back/forward cache, service-worker behavior if present, intermediary
cache headers, and history.

Do not let a previous authorized launch response become available after logout,
session expiry, learner switch, or entitlement loss.

-------------------------------------------------------------------------------
18.4 Rate limiting
-------------------------------------------------------------------------------

Use accepted durable/distributed rate-limit infrastructure where required.

Cover at least:

- participant launch by actor/account/occurrence;
- host action;
- provider reconciliation command;
- webhook ingress;
- provider read probes;
- repeated failed authorization.

Do not implement only process-local protection in a multi-instance environment.

Do not include raw identifiers in rate-limit logs.

-------------------------------------------------------------------------------
18.5 Audit
-------------------------------------------------------------------------------

Audit local security-relevant actions with:

- local actor;
- local account/product;
- local learner/occurrence reference where authorized;
- action;
- decision;
- reason code;
- time;
- source SHA/version;
- safe provider-operation category;
- safe result.

Never audit:

- raw target;
- passcode;
- host key;
- OAuth token;
- credential;
- raw provider payload;
- provider response body;
- response Location header;
- private participant information outside accepted audit policy.

-------------------------------------------------------------------------------
18.6 Error envelopes
-------------------------------------------------------------------------------

Use the accepted error envelope.

External responses must be bounded and non-enumerating.

Normalize provider errors into safe categories such as:

- disabled;
- not ready;
- unavailable;
- timeout;
- rate limited;
- unauthorized provider configuration;
- drift/review required;
- unknown result.

Do not forward Zoom response bodies or headers to clients.

===============================================================================
19. DATA RETENTION AND PRIVACY
===============================================================================

Use accepted retention policy. Do not invent a long retention period.

Requirements:

- discard raw webhook bodies as soon as verified normalization/durable processing no
  longer requires them;
- do not place raw payloads in a dead-letter queue;
- retain provider-neutral facts according to accepted educational/business record
  policy;
- remove or render unusable stored bearer targets as soon as operationally safe;
- preserve security/audit facts without preserving the target;
- do not collect recording, transcript, summary, or chat data in OT-63;
- do not create Zoom accounts for students;
- do not infer guardian consent from payment, enrollment, or prior attendance.

When a child-education/account-status, guardian-consent, alias, or retention decision
is required by the approved resource strategy and remains unresolved, default deny
and report it as a live-activation blocker.

Do not put private policy responses in the public UI or evidence.

===============================================================================
20. WORKER, SCHEDULER, AND PROCESS TOPOLOGY
===============================================================================

Use accepted OT-43/OT-50/OT-60 worker and scheduling ownership.

Do not create a second scheduler or outbox.

Audit the exact deployed topology:

- web process;
- worker process;
- migration job;
- scheduler/cron owner;
- webhook consumer;
- reconciliation consumer;
- token/readiness probe owner;
- replica counts;
- lease behavior;
- graceful shutdown;
- deployment health checks.

Provider work must be:

- idempotently claimed;
- account/product scoped;
- bounded;
- lease protected;
- safe under duplicate delivery;
- safe under worker crash;
- safe during deploy overlap;
- stopped/drained during rollback.

Prove there is one logical consumer even when multiple worker replicas exist.

Public signup, CRM, and ordinary portal rendering must not call the provider worker
synchronously.

===============================================================================
21. SAFE ACTIVATION LADDER
===============================================================================

Follow this order exactly.

-------------------------------------------------------------------------------
Step 1 — Static, unit, integration, and real-PostgreSQL verification
-------------------------------------------------------------------------------

- Keep Zoom disabled.
- Use synthetic provider fixtures only.
- Run static analysis.
- Run unit tests.
- Run integration tests.
- Run migration checksum/idempotency tests.
- Run real PostgreSQL concurrency and locking tests.
- Run focused browser/accessibility/performance/security tests.
- Run redaction and secret scans.
- Perform no provider call.

-------------------------------------------------------------------------------
Step 2 — Exact-SHA staging deployment with provider disabled
-------------------------------------------------------------------------------

Requires:

OT63_STAGING_DEPLOY_AUTHORIZED_FOR_SHA=<exact SHA>

Before deployment:

- verify clean committed tree;
- verify pushed head;
- verify head equals authorization value;
- verify deployment source;
- verify rollback target;
- verify migration backup/PITR evidence;
- verify health checks;
- verify provider modes remain disabled.

Deploy only the exact approved SHA.

Verify ordinary application behavior before enabling any read-only provider action.

-------------------------------------------------------------------------------
Step 3 — Separately authorized read-only provider readiness
-------------------------------------------------------------------------------

Requires:

ZOOM_READ_ONLY_READINESS_AUTHORIZED_FOR_SHA=<exact deployed SHA>

Perform only approved read operations.

Verify, with sanitized results:

- intended Zoom account match;
- intended Rabbi host match;
- host active state;
- host license/capability;
- app type;
- exact granted scopes versus endpoint manifest;
- approved meeting/resource existence where applicable;
- actual host ownership;
- resource strategy;
- webhook ingress ownership;
- webhook subscription ownership where safely readable;
- absence of a second consumer;
- effective nonsecret setting readiness;
- current rate-limit/readiness constraints.

Do not expose provider identifiers.

A read-only 200 is not canary success.

-------------------------------------------------------------------------------
Step 4 — Readiness reconciliation
-------------------------------------------------------------------------------

Compare approved desired policy with sanitized observed state.

Any wrong host, wrong account, wrong resource, duplicate consumer, unsafe drift,
missing scope, unknown meeting strategy, or unproven setting blocks Phase C.

Do not “fix” readiness through an unauthorized mutation.

-------------------------------------------------------------------------------
Step 5 — Synthetic adapter canary and protected-launch negative tests
-------------------------------------------------------------------------------

On staging:

- keep real provider mutation disabled;
- run synthetic provider adapter canary;
- run all negative participant/host launch tests;
- prove no raw target reaches logs, HTML, JSON, storage, analytics, or evidence;
- prove ordinary routes perform no provider request.

-------------------------------------------------------------------------------
Step 6 — One controlled provider canary
-------------------------------------------------------------------------------

Requires:

ZOOM_STAGING_CANARY_AUTHORIZED_FOR_SHA=<exact deployed SHA>

Also requires the approved canary change manifest.

Use only:

- the approved existing test resource; or
- the explicitly approved class resource.

Do not involve real students.

Do not exceed the manifest’s operation count.

Do not change account-wide settings.

Do not create a new recurring meeting because an expected resource is absent.

Do not mutate unrelated meetings.

-------------------------------------------------------------------------------
Step 7 — Canary assertions
-------------------------------------------------------------------------------

Confirm:

- actual Rabbi host identity;
- approved account;
- approved resource;
- muted entry;
- approved waiting-room/video/chat/join-before-host behavior;
- participant authorization;
- host authorization;
- occurrence binding;
- redaction;
- webhook validation;
- deduplication;
- out-of-order handling;
- local denial independent of provider availability;
- rollback/containment.

A green health endpoint is not sufficient.

-------------------------------------------------------------------------------
Step 8 — Stop after staging evidence
-------------------------------------------------------------------------------

Unless a separate live authorization exists, stop after sanitized staging evidence.

Do not activate production merely because the canary passed.

===============================================================================
22. REQUIRED TEST MATRIX
===============================================================================

Do not reduce this to a few happy-path tests.

-------------------------------------------------------------------------------
22.1 Recurrence and occurrence tests
-------------------------------------------------------------------------------

Cover:

- ordinary daily occurrence;
- Israel DST entry;
- Israel DST exit;
- year boundary;
- leap year where applicable;
- timezone database behavior;
- missing scheduler execution;
- catch-up materialization;
- duplicate materialization;
- concurrent materialization;
- cancelled occurrence;
- rescheduled occurrence;
- replacement occurrence;
- superseded original;
- past occurrence;
- future occurrence;
- exactly at access-open boundary;
- exactly at access-close boundary;
- one unit before and after boundaries;
- application/provider clock skew;
- host/provider timezone disagreement;
- provider drift without internal authorization change.

Assert that the product rule remains 19:00 Asia/Jerusalem rather than a fixed UTC
time.

-------------------------------------------------------------------------------
22.2 Actor/action authorization matrix
-------------------------------------------------------------------------------

Test each relevant actor state against participant and host actions:

- Rabbi owner;
- authorized One Time admin;
- parent/guardian;
- student;
- anonymous;
- suspended;
- wrong account;
- wrong product;
- archived contact where relevant;
- unrelated guardian;
- sibling not selected;
- unrelated household;
- unenrolled learner;
- unentitled learner;
- cancelled occurrence;
- ended occurrence;
- expired session;
- stale security version;
- missing MFA assurance;
- wrong learner binding;
- provider not ready;
- provider unavailable.

For every denial:

- no provider request;
- no identifier enumeration;
- no target resolution;
- no sensitive audit content.

-------------------------------------------------------------------------------
22.3 Sibling and household isolation
-------------------------------------------------------------------------------

Cover:

- parent authorized for learner A but not learner B;
- parent with multiple authorized learners;
- explicit learner context required by accepted portal contract;
- stale learner selection;
- concurrent learner switch and launch;
- unrelated household guessing opaque references;
- student attempting another learner’s reference;
- browser back after learner switch;
- cached page after relationship removal.

-------------------------------------------------------------------------------
22.4 Raw-target and secret absence
-------------------------------------------------------------------------------

Scan:

- tracked source;
- staged diff;
- built bundles;
- source maps;
- HTML;
- JSON responses;
- browser storage;
- service-worker caches;
- analytics fixtures;
- traces;
- server logs;
- reverse-proxy/application request logs where testable;
- screenshots;
- accessibility snapshots;
- audit fixtures;
- generic outbox payloads;
- dead-letter fixtures;
- evidence;
- downloadable reports.

Search for synthetic target patterns and prove they are absent outside the explicit
fake provider transport boundary.

Do not scan or print real secret values.

-------------------------------------------------------------------------------
22.5 Launch security tests
-------------------------------------------------------------------------------

Cover:

- valid launch;
- CSRF missing;
- CSRF invalid;
- cookie-only CSRF attempt;
- replay;
- concurrent launch;
- expired grant;
- wrong actor;
- wrong learner;
- wrong occurrence;
- changed entitlement between page render and click;
- changed session security version;
- open-redirect attempt;
- client-supplied target;
- provider identifier injection;
- cache replay;
- browser back;
- logout then back;
- no-store headers;
- Location-header logging suppression;
- rate limit;
- provider timeout;
- provider 401;
- provider 429;
- provider 5xx;
- circuit open;
- ambiguous write result where applicable;
- graceful shutdown;
- legitimate reconnect policy.

-------------------------------------------------------------------------------
22.6 Reconciliation tests
-------------------------------------------------------------------------------

Cover:

- desired equals observed;
- safe mutable drift;
- unsafe drift;
- wrong host;
- wrong account;
- wrong resource;
- resource missing;
- duplicate binding;
- stale observed version;
- concurrent reconcile;
- timeout after potential write;
- read-before-retry;
- partial success;
- provider rate limit;
- retry ceiling;
- human-review state;
- cancellation while reconcile is in flight;
- reschedule while provider work is in flight.

-------------------------------------------------------------------------------
22.7 Webhook tests
-------------------------------------------------------------------------------

Cover:

- valid endpoint validation;
- malformed validation;
- valid signature;
- invalid signature;
- missing timestamp;
- stale timestamp;
- excessive future skew;
- replay;
- exact raw-body sensitivity;
- invalid content type;
- body too large;
- malformed JSON after valid signature;
- duplicate event;
- concurrent duplicate;
- out-of-order event;
- late event;
- unknown event;
- wrong account;
- wrong resource;
- unknown occurrence;
- unsupported event;
- ambiguous participant;
- unmatched participant;
- queue unavailable;
- transaction rollback;
- acknowledgement timing;
- worker crash after durable enqueue;
- graceful worker shutdown;
- duplicate subscription/consumer detection.

-------------------------------------------------------------------------------
22.8 Attendance-event seam tests
-------------------------------------------------------------------------------

Cover:

- verified participant join fact;
- verified leave fact;
- reconnect sequence;
- duplicate join;
- duplicate leave;
- leave before join;
- late join event;
- provider meeting start/end;
- event time versus observed time;
- conservative learner match;
- ambiguous learner remains unmatched;
- display-name-only match rejected;
- cross-household identity rejected;
- immutable fact behavior;
- deduplication;
- reconciliation status transitions;
- no final attendance percentage or grade output.

-------------------------------------------------------------------------------
22.9 Browser and accessibility tests
-------------------------------------------------------------------------------

Cover all viewports and modes specified in Section 17.5.

Test:

- visible/actionable state after paint;
- loading transition;
- safe retry;
- session expiry;
- provider outage;
- slow provider readiness request;
- offline;
- keyboard activation;
- focus after error;
- screen-reader status;
- no dead button;
- no horizontal overflow;
- no duplicate navigation;
- 44x44 controls in both dimensions;
- RTL;
- reduced motion;
- 200% zoom.

-------------------------------------------------------------------------------
22.10 Performance and route-independence tests
-------------------------------------------------------------------------------

Measure visible/actionable post-paint states, not merely server response completion.

Assert:

- landing page performs no Zoom request;
- signup performs no Zoom request;
- unrelated CRM pages perform no Zoom request;
- unrelated portal pages perform no Zoom request;
- ordinary class page rendering does not block on Zoom;
- provider outage does not exhaust ordinary request pools;
- provider bundles are absent from public/client bundles;
- no BNA request occurs;
- bundle and request budgets match accepted convergence policy;
- performance evidence reports sample size and percentile where required.

===============================================================================
23. DATABASE AND MIGRATION VERIFICATION
===============================================================================

Use one new forward-only additive migration only when needed and only after collision
audit.

Requirements:

- follow the accepted migration naming/numbering convention;
- preserve accepted checksums;
- use parameterized SQL in application code;
- enforce account/product scope in keys and queries;
- add uniqueness for bindings and event dedupe;
- add indexes for due/reconciliation/event lookup based on actual query plans;
- avoid storing raw bearer targets unless proven necessary;
- avoid public provider identifiers;
- preserve event history;
- make rollback operational through flags/source, not destructive schema deletion.

Real PostgreSQL verification must include:

- migration from accepted base;
- checksum readback;
- repeat migration no-op/idempotency behavior;
- transaction behavior;
- duplicate binding concurrency;
- event deduplication concurrency;
- launch-grant consume concurrency where applicable;
- worker claim behavior;
- graceful shutdown/lease loss;
- relevant EXPLAIN plans;
- bounded realistic synthetic data volume;
- sanitized timing evidence.

Do not use production rows.

===============================================================================
24. DEPLOYMENT READINESS AUDIT
===============================================================================

Before any Phase B deployment, establish:

- exact staging SHA;
- exact rollback SHA;
- exact config rollback;
- web/worker/migration topology;
- replica counts;
- migration job ownership;
- one-consumer rules;
- backup/PITR evidence;
- health checks;
- deployment domain;
- webhook ingress domain;
- TLS readiness;
- provider feature flags;
- current provider token consumer;
- current webhook consumer;
- current reconciliation consumer;
- no legacy BNA conflict;
- no duplicate polling;
- no duplicate subscription;
- no provider target in platform logs.

Do not infer topology from a Dockerfile alone.

Do not alter Railway, DNS, replicas, variables, deployment source, or health checks
without Phase B authorization and accepted ownership.

===============================================================================
25. SANITIZED ZOOM READINESS INVENTORY
===============================================================================

The readiness inventory may record only safe information, such as:

- inventory timestamp;
- source SHA;
- environment label;
- provider mode;
- app type;
- credentials configured: true/false;
- token probe authorized: true/false;
- token probe succeeded: true/false;
- account matched: true/false;
- account fingerprint using the approved nonsecret method;
- host matched: true/false;
- host active: true/false;
- host license/capability sufficient: true/false;
- host fingerprint;
- resource strategy;
- approved resource found: true/false;
- resource host matched: true/false;
- effective setting checks as booleans/enums;
- expected scope names;
- granted scope readiness;
- webhook route ready: true/false;
- webhook subscription ownership proven: true/false;
- webhook consumer count;
- duplicate consumer detected: true/false;
- provider writes enabled: false unless exact canary/live authorization exists;
- launch enabled: false unless exact activation authorization exists.

Do not fingerprint secret values.

Do not record:

- credential values;
- tokens;
- account IDs;
- user IDs;
- meeting IDs;
- meeting UUIDs;
- emails;
- participant identities;
- URLs;
- passcodes;
- host keys;
- registrant IDs;
- raw response bodies.

===============================================================================
26. EVIDENCE PACKAGE
===============================================================================

Store sanitized evidence under the accepted OT-63 evidence location, expected to be:

ops/evidence/ot-63/

Adapt only if the accepted convergence report uses another dedicated location.

Expected evidence artifacts:

- PREFLIGHT.md
- PREREQUISITES.json
- INSTRUCTION-MANIFEST.json
- BRANCH-ANCESTRY.json
- COLLISION-AUDIT.md
- PATH-OWNERSHIP.md
- MIGRATION-CHECKSUMS.json
- ROUTE-MANIFEST.json
- PROVIDER-BOUNDARY-MANIFEST.json
- CONFIG-READINESS.json
- POSTGRESQL-RESULTS.md
- TEST-MATRIX.md
- PERFORMANCE.md
- WEBHOOK-RESULTS.md
- REDACTION-SCAN.md
- STAGING-READINESS.md
- CANARY.md
- ROLLBACK-DRILL.md
- FINAL-REPORT.md

Use the repository’s accepted evidence format when one exists.

Evidence must contain:

- exact base/head;
- exact prerequisite heads;
- branch ancestry;
- migration paths and checksums;
- route/module ownership;
- sanitized readiness booleans;
- nonsecret fingerprints only;
- test commands and exact results;
- real-PostgreSQL status;
- browser viewport results;
- bundle/request budgets;
- webhook/deduplication results;
- authorization values only as present/absent and matched/not matched, never secret
  material;
- canary mutation counts;
- rollback drill result;
- redaction scans;
- external mutation report.

Evidence must not contain:

- student/parent/attendee identity;
- email;
- phone number;
- private database row;
- meeting ID;
- account ID;
- user ID;
- meeting UUID;
- raw URL;
- passcode;
- host key;
- token;
- credential;
- raw provider payload;
- raw request/response body;
- private screenshot content.

Screenshots must use synthetic identities and synthetic provider state.

===============================================================================
27. COMMIT AND DRAFT PR POLICY
===============================================================================

After Phase A local gates pass:

- review the complete diff;
- run touched-file formatting;
- run repository-standard lint/typecheck/test/build gates;
- run focused OT-63 tests;
- run real PostgreSQL verification;
- run secret/redaction scans;
- run git diff --check;
- ensure no generated or unrelated files are included.

Use small intentional commits, for example by concern:

- provider-neutral contracts and schema;
- server-only Zoom adapter and guards;
- protected launch and host actions;
- webhook/event seam;
- portal integration;
- tests/evidence/runbook.

Do not force this exact split when it would make commits non-buildable, but avoid one
unreviewable mega-commit.

Do not amend or squash another task’s work.

Push only:

codex/ot63-secure-zoom-live-class

Open a draft PR only after the applicable Phase A gates pass.

The draft PR must:

- target the exact accepted integration branch required by OT-60;
- name the exact base/head SHAs;
- list prerequisite SHAs;
- state phase reached;
- state provider calls performed or not performed;
- state external mutations or “none”;
- state staging/canary/live authorization status;
- list blockers;
- link sanitized evidence;
- make no live-readiness claim unsupported by evidence.

Do not merge.

Do not convert the PR from draft by assumption.

===============================================================================
28. ROLLBACK DESIGN
===============================================================================

Provide an independent feature flag or accepted equivalent that disables:

- provider reconciliation writes;
- participant launch resolution;
- host action resolution;
- webhook asynchronous effects where containment requires it.

Disabling Zoom must not take down:

- landing;
- signup;
- CRM;
- portals;
- reminders;
- content;
- internal occurrence materialization.

Rollback procedure must:

1. disable new provider writes and launches;
2. stop or drain provider work safely;
3. preserve audit and provider-neutral facts;
4. preserve migrations and event history;
5. revoke temporary canary bindings only when explicitly authorized and appropriate;
6. restore the approved source/config target;
7. verify ordinary application health;
8. verify no duplicate consumer remains;
9. document any provider state intentionally left untouched.

Automatic rollback must never:

- delete a real meeting;
- transfer ownership;
- change account-wide settings;
- delete attendance facts;
- erase audit history;
- drop migrations.

Rollback triggers include:

- wrong host;
- unauthorized launch;
- cross-account access;
- cross-product access;
- cross-household access;
- raw target or secret leak;
- duplicate meeting mutation;
- duplicate registrant mutation;
- invalid webhook acceptance;
- signature failure caused by implementation;
- duplicate webhook facts;
- DST occurrence mismatch;
- wrong occurrence binding;
- rate-limit storm;
- provider timeout saturation;
- portal performance regression;
- ordinary routes waiting for Zoom;
- duplicate provider consumer;
- inability to prove rollback.

===============================================================================
29. STOP CONDITIONS
===============================================================================

Stop immediately and do not weaken a gate for any of these conditions:

- literal prerequisite placeholder remains;
- malformed or unavailable SHA;
- ancestry mismatch;
- OT-43 seam absent;
- OT-52 seam absent;
- OT-60 evidence mismatch;
- migration collision;
- route collision;
- module ownership ambiguity;
- schema drift;
- checksum mismatch;
- real PostgreSQL unavailable for required proof;
- exact staging source unknown;
- rollback target unknown;
- backup/PITR evidence absent;
- Zoom app type unproven;
- intended account unproven;
- intended Rabbi host unproven;
- scheduling privilege unproven;
- approved resource strategy unproven;
- approved resource missing under a bind-existing strategy;
- duplicate provider consumer;
- safe readiness inventory absent;
- requested scope unsupported or excessive;
- guardian/privacy/account-status decision absent where required;
- retention policy absent where required;
- provider field or behavior undocumented;
- Phase B authorization absent;
- read-only authorization absent;
- Phase C exact-SHA authorization absent;
- canary manifest absent or mismatched;
- live exact-SHA authorization absent;
- raw target/secret leakage detected.

Use a concise status code, selected from or equivalent to:

- STOP_PREREQUISITE_SHA_MISSING
- STOP_ANCESTRY_MISMATCH
- STOP_OT60_EVIDENCE_MISMATCH
- STOP_ACCEPTED_SEAM_MISSING
- STOP_MIGRATION_COLLISION
- STOP_ROUTE_COLLISION
- STOP_SCHEMA_DRIFT
- STOP_REAL_POSTGRESQL_UNAVAILABLE
- STOP_STAGING_SHA_MISMATCH
- STOP_ROLLBACK_EVIDENCE_ABSENT
- STOP_PROVIDER_IDENTITY_UNPROVEN
- STOP_PROVIDER_RESOURCE_STRATEGY_UNPROVEN
- STOP_DUPLICATE_PROVIDER_CONSUMER
- STOP_SAFE_ZOOM_INVENTORY_ABSENT
- STOP_PHASE_B_UNAUTHORIZED
- STOP_READ_ONLY_PROBE_UNAUTHORIZED
- STOP_PHASE_C_UNAUTHORIZED
- STOP_LIVE_MUTATION_UNAUTHORIZED
- STOP_SECRET_OR_RAW_TARGET_EXPOSURE

Stop report format:

STATUS: <code>

PHASE REACHED:
- preflight / Phase A / Phase B / Phase C

EXACT SOURCE:
- base SHA
- current head SHA, if a branch exists
- staging SHA, if deployed

BLOCKER:
- one concise factual description

EVIDENCE:
- sanitized paths/checks only

REQUIRED UNBLOCK:
- exact accepted SHA, evidence, decision, or authorization required

MUTATIONS:
- repository mutations performed, if any
- external mutations performed, if any
- otherwise “none”

UNTOUCHED:
- systems or resources intentionally not changed

Never include a secret, raw provider identifier, target, participant identity, or
private row in the stop report.

===============================================================================
30. FINAL REPORT
===============================================================================

The final OT-63 report must distinguish each state explicitly:

- implemented locally;
- synthetic-tested;
- real-PostgreSQL-tested;
- staged;
- provider identity verified;
- provider resource verified;
- read-only probe attempted;
- read-only probe passed;
- canary authorized;
- canary attempted;
- canary passed;
- live activated;
- blocked;
- untouched.

Use true/false/not-authorized/not-applicable values. Do not blur them into “done.”

Include:

1. Repository and exact SHAs
2. Prerequisite verification
3. Branch ancestry
4. Accepted extension points used
5. Migration/checksum result
6. Provider-boundary implementation
7. Resource strategy
8. Access/launch security
9. Host capability security
10. Webhook verification/deduplication
11. Attendance-event seam
12. Portal/UI acceptance
13. Real PostgreSQL result
14. Test commands and exact counts
15. Performance and request-independence evidence
16. Redaction scan
17. Deployment state
18. Readiness state
19. Canary authorization and exact operation counts
20. Rollback drill
21. Blocking decision register
22. External mutation ledger
23. Untouched systems

For every external mutation, report:

- phase;
- date/time;
- exact source SHA;
- environment;
- operation category;
- approved resource fingerprint;
- count;
- result;
- containment/rollback result.

Do not include raw identifiers.

If no external mutation occurred, state exactly:

External mutations: none.

Do not claim that students can securely join based only on:

- a 200 response;
- a token exchange;
- a green health check;
- a meeting lookup;
- a synthetic redirect;
- a passed webhook challenge.

===============================================================================
31. SAFE DECISION POLICY
===============================================================================

Resolve ordinary technical decisions from accepted repository conventions without
asking the operator about:

- filenames;
- helper names;
- routine test structure;
- ordinary type placement;
- local refactoring details;
- formatting;
- standard index naming;
- standard error-construction patterns.

Do not invent or assume:

- Zoom app ownership;
- Zoom account ownership;
- Rabbi user identifier;
- host license;
- scheduling privilege;
- meeting identifier;
- meeting strategy;
- passcode;
- host key;
- join target;
- start target;
- app scopes;
- webhook secret;
- webhook subscription ownership;
- token consumer ownership;
- access-window policy absent from accepted OT-43;
- participant identity matching;
- guardian consent;
- retention;
- canary authorization;
- production activation.

Put every truly unresolved item in a concise blocking decision register.

Keep disabled features disabled rather than weakening authorization, identity,
redaction, or provider gates.

===============================================================================
32. DEFINITION OF DONE
===============================================================================

Phase A is complete only when:

- all prerequisite SHAs and ancestry are proven;
- accepted OT-43 and OT-52 seams are extended rather than duplicated;
- the migration/route/module collision audit is clean;
- one server-only provider boundary exists;
- Zoom is disabled by default;
- participant and host actions are separate;
- every action reauthorizes server-side;
- raw targets are absent from ordinary surfaces;
- recurrence remains 19:00 Asia/Jerusalem across DST;
- provider binding does not become authorization;
- desired/observed reconciliation is idempotent and review-safe;
- webhook verification uses exact current official behavior;
- provider events are durably deduplicated;
- ambiguous participant identity is not guessed;
- OT-63 creates facts but not OT-64 attendance reports;
- ordinary routes do not wait for Zoom;
- required unit/integration/PostgreSQL/browser/accessibility/performance/security
  tests pass;
- redaction scans pass;
- rollback is implemented and tested;
- sanitized evidence is complete;
- small intentional commits are pushed;
- a draft PR is opened;
- no unauthorized external action occurred.

Phase B is complete only when separately authorized and:

- the exact approved SHA is deployed;
- rollback is proven;
- provider remains disabled during initial deployment;
- any real read-only probe has its own exact authorization;
- account, host, resource, scope, topology, and consumer ownership are verified with
  sanitized evidence;
- no provider mutation occurred.

Phase C can be marked complete only for the exact authorized canary manifest and
only when:

- authorization matches the deployed SHA;
- no real student is affected;
- operation counts remain within the manifest;
- host/settings/access/webhook/deduplication/redaction assertions pass;
- containment/rollback is proven;
- every external mutation is reported precisely.

Live activation is not part of Phase A or implied by a staging canary.

Begin by validating the five immutable prerequisite SHAs. If any placeholder or
required accepted evidence remains absent, stop before writing.
