# W13-104 — Final Day-One production operations conductor

Execute this entire prompt in one fresh Codex session with Full Access and network enabled. This is the final operational conductor for the current One Time release. Continue from the live W13-103 system; do not restart architecture, create parallel deployment branches, or return another broad audit while executable work remains.

## Exact verified starting state

- Repository: `webcraft-media/onetimev2`
- PR: `https://github.com/webcraft-media/onetimev2/pull/91`
- Branch: `release/w13-100-controlled-day-one-20260717T182046Z`
- Worktree: `C:\Users\User\OneTimeOneTime-w13-100-final-launch`
- Current PR/evidence head: `2a6b3a58167dd99a35b925062b0127fcf7660946`
- Exact deployed runtime source: `007e0215d1186ca51163dea3b1c15303bf52a860`
- Production URL: `https://join.onetimeonetime.com`
- Production login: `https://join.onetimeonetime.com/login`
- Production web deployment: `9334b362-f00d-4170-9713-ecee0d22b85c`
- Production worker deployment: `f81e56ba-cf4d-4f92-99e5-f5f6be360494`
- Latest migration: `2203_w13_100_student_gamification`
- Current role status: administrator, parent, and student production browser acceptance passed.
- Protected login handoff: `C:\Users\User\.onetime-w13-103-private\LOGIN-HANDOFF.private.json`
- Current email status: Resend disabled/unavailable; no external email sent.
- Current CRM status: six approved source hashes found exactly once; import not applied.
- Current provider status: email, WhatsApp, Telegram, Zoom, Vimeo, Buffer, OpenAI/helper, BNA support, and Stripe TEST canaries not completed.

Fetch and verify live truth before writing. If PR #91 advanced, record the descendant head. Keep deployed runtime and later evidence commits distinct. Never reset or stage another dirty checkout. Do not use the dirty BNA checkout for One Time product work.

If the fetched PR #91 head is not a descendant of the stated head, do not merge, rebase, or overwrite it blindly. Pause only the release-governance lane, preserve a semantic ancestry/diff report, and continue safe independent inspection and implementation in an isolated descendant worktree. The final merge candidate must contain the exact deployed runtime commits and pass checks as merged.

## Definition of done

The system is Day-One ready only when all essential lanes are green:

1. administrator receives a secure one-time set-password/reset email and can log in;
2. parent and student logins remain usable and role-isolated;
3. public signup creates the correct contact/lead/tags/audit/outbox state;
4. approved real CRM contacts are imported, deduplicated, tagged, searchable, and visible in usable contact cards/detail views with zero automatic outreach;
5. transactional signup/access/reminder email works with suppression and webhook processing;
6. owner/admin can use CRM, communications, classes, content, support, and provider status surfaces without dead buttons or fake success;
7. parent/student portals, classroom/content, progress, questions, gamification, and support boundaries work;
8. every configured external provider has a bounded green canary and kill switch, or remains explicitly disabled with one exact missing-input record;
9. staging, backup/restore, rollback/roll-forward, production deployment, observability, and the final role/product journey pass on the exact runtime;
10. a private operator handoff and concise Rabbi handoff are ready.

A secure application does not email passwords. It emails a single-use HTTPS set-password/reset link. Never create or send a plaintext permanent password.

## Written authorization and non-authorization

This prompt authorizes:

- protected configuration discovery without printing values;
- bounded transactional email to operator-controlled administrator/parent destinations and the Rabbi only when his private entry explicitly authorizes `send_now=true`;
- the accepted real CRM import from the six already-discovered approved files after backup/rehearsal gates pass;
- one canary per provider to protected controlled destinations;
- additive implementation fixes, migrations, tests, staging deployment, production backup, production deployment, rollback/roll-forward, commits, pushes, PR updates, protected merges, and release tags;
- creation of one controlled Zoom test meeting, one Stripe TEST Checkout Session, one private Vimeo content item/readback, one Telegram safe command/write, one WhatsApp exchange, one BNA support canary, one Buffer draft when supported, and up to three grounded helper questions.

Not authorized:

- emailing or displaying permanent passwords;
- broad email/WhatsApp campaigns, audience blasts, or automatic outreach to imported contacts;
- live Stripe charges or live payment-mode activation; live financial activation requires the properly authorized adult/business representative outside this run;
- Buffer public scheduling/publishing;
- DNS changes;
- destructive deletes, password-hash copying, ambiguous identity merges, weakening consent/suppression, or importing unapproved legacy exports/message bodies;
- contacting any third party whose private authorization entry does not explicitly permit the exact canary;
- force pushes, branch-protection bypasses, secrets/PII in logs/evidence, or permanent provisioning/provider bypasses.

## Self-driving and checkpoint rules

Create `ops/codex-runs/W13-104/` immediately with:

- `ORIGINAL-PROMPT.md`
- `STATE.json`
- `INPUTS-STATUS.json`
- `RESUME.md`
- `BASELINE.json`
- `EMAIL.json`
- `CRM-IMPORT.json`
- `SIGNUP-JOURNEY.json`
- `PORTAL-ACCEPTANCE.json`
- `PROVIDER-CANARIES.json`
- `UI-QUALITY.json`
- `EXTERNAL-EFFECTS.json`
- `DEPLOYMENT.json`
- `OPERATOR-HANDOFF.md`
- `RABBI-HANDOFF.md`
- `FINAL-REPORT.md`
- `CHANGED-FILES.txt`

Create secrets/private values only under `C:\Users\User\.onetime-w13-104-private\`. At each phase boundary update state and push a coherent task-owned checkpoint. If interrupted, resume from Git plus the protected directory without requiring chat history.

Before an external canary or real CRM apply, require these protected manifests under that private directory:

- `EMAIL-INPUTS.private.json`: operator administrator email, One Time-owned email provider identity, verified sender/domain, from/reply-to identities, exact HTTPS webhook endpoint, recipient allowlist, and provider ownership metadata. Secret values remain in Railway/private storage, not this manifest when avoidable.
- `CANARY-AUTHORIZATION.private.json`: one record per provider containing provider, exact controlled recipient/chat/account, ownership, `send_now`, expiration, maximum effect budget, cleanup behavior, and environment/mode.
- `CRM-IMPORT-AUTHORIZATION.private.json`: exact source path and SHA, One Time account/product ID, ownership/privacy basis, column mapping, stable dedupe keys, explicit tag rules, conflict policy, and `apply_to_production=true`.

Absence or expiry blocks only that lane. A configured address, number, token, source hash, or file membership is not consent or authorization.

Do not stop globally because one optional provider credential/account is absent. Record that lane's exact variable/account/input names, keep it off/hidden, and continue every independent phase. Stop globally only for probable data corruption, secret exposure, failed production backup/restore before a production write, unbounded external sends, live financial effects, or a critical auth/role-isolation failure.

Do not invent credentials, recipients, provider ownership, source approval, or consent. Search approved Railway variables, W13 private handoffs, accepted manifests, and current provider state first. A configured address/number alone is not authorization to contact it.

# Phase 1 — Preserve the healthy live baseline

1. Verify PR #91, production/staging Railway identities, `/version`, `/health`, `/ready`, web/worker deployments, database version/migration ledger, queues, dead letters, provider modes, and release tags.
2. Take a fresh native production PG18 backup and prove a disposable restore before writes.
3. Snapshot counts only for accounts, users, contacts, tags, households, learners, enrollments, classes, content, questions, rewards, sessions, outbox, suppressions, tickets, imports, and audit events.
4. Keep every external transport disabled until its lane passes a bounded canary and queue audit.
5. Verify the existing administrator/parent/student private handoff remains valid; issue fresh single-use operator-controlled reset links privately if expired.

# Phase 2 — Make transactional email real and deliver the login email

Inspect current code and protected configuration for the existing delivery provider. Prefer the existing Resend integration and mounted raw-body webhook at `/api/v1/delivery/resend/webhook`. Do not copy a credential from another product unless protected ownership metadata explicitly authorizes One Time use.

Required readiness:

- API credential present in protected One Time runtime configuration;
- verified sender/domain;
- from and reply-to identities;
- webhook signing secret;
- exact HTTPS webhook URL with no root-path or HTTP redirect;
- transactional enable flag and kill switch;
- recipient allowlist;
- retry/idempotency, bounce, complaint, suppression, and delivery-status handling.

If values exist, configure them without printing. If any are absent, generate an exact sanitized `EMAIL-INPUTS-NEEDED.md`, leave email off, and continue all non-email work. Do not claim an inbox delivery without provider readback.

When ready:

1. prove sink delivery in staging;
2. exercise signed synthetic delivery/bounce/complaint/suppression only against staging/disposable data;
3. send one production normal-delivery canary to the operator-controlled administrator allowlist;
4. issue one fresh administrator reset/set-password email;
5. issue at most one parent reset/set-password email if privately authorized;
6. issue a Rabbi owner activation only when his protected manifest entry is exact, current, and `send_now=true`;
7. verify provider delivery ID/status, HTTPS host, expiry, one-time use, replay rejection, suppression, and no queued historical audience release;
8. keep campaigns, broadcasts, imported-contact sends, and reminders disabled until their own approved segment/copy gates exist.

Never email a password. Final public evidence may say `email_delivered` with redacted provider IDs; raw links remain private.

Hard email canary budget: no more than three controlled transactional messages total in W13-104 (administrator delivery canary/set-password combined where possible, parent activation/reset, and an optional Rabbi activation only when explicitly authorized). Do not contact imported CRM records.

# Phase 3 — Rehearse the approved real CRM import safely

The six expected candidate source hashes were already located exactly once. Revalidate hashes without committing rows or PII. A hash match alone does not authorize ownership, mappings, tag inference, or production application; production apply requires the exact private CRM import authorization manifest.

Approved candidate scope:

- `Rabbi Scheller Followers.xlsx`;
- the five accepted Rabbi email-audience exports;
- no large legacy CRM/pipeline exports;
- no passwords, secrets, attachments, or unapproved message bodies.

Use only tag semantics explicitly approved in the private import manifest. The following are candidates for its author to accept, not facts Codex may infer:

- source/provenance;
- old system;
- legacy active;
- legacy lead;
- current signup;
- family interest;
- school interest;
- email/WhatsApp consent separately;
- channel suppression;
- invalid contact;
- ambiguous/review required.

Procedure:

1. snapshot worker/transport state and run the import inside guaranteed cleanup/finally handling;
2. force delivery/campaign/reminder automation off;
3. create an exact sanitized source/tag manifest and counts-only preview;
4. rehearse on a disposable current production restore;
5. normalize conservatively, preserve provenance, let current production values win, fill blanks only, and quarantine ambiguity;
6. never infer consent from possession of an email/phone;
7. rehearse transactionally/idempotently under one run ID on the disposable restored clone;
8. abort the rehearsal if totals differ, account/product scope fails, uniqueness breaks, or any outbox/campaign row is created;
9. rerun the rehearsal and require zero additional contacts/tags/history rows;
10. verify sanitized aggregate totals and CRM cards/detail/search/filter/tag UX against the clone/private environment;
11. produce a signed counts-only apply plan; defer the production apply until the exact runtime has passed Phase 13 staging certification and fresh production backup.

Historical communication metadata may be imported only from an already accepted ownership/privacy manifest. Bodies and attachments remain off. No imported person receives a message in W13-104. Committed screenshots, traces, HARs, videos, and reports must use controlled/synthetic identities or aggregate redacted counts; real-contact UI inspection and PII stay private and local.

# Phase 4 — Prove signup, lead capture, and transactional lifecycle

Test one operator-controlled family signup and one synthetic school inquiry through the real public form.

Require:

- idempotent contact and lead creation;
- correct family versus school classification;
- source, current-signup, consent/preference, and manual-review tags;
- audit event and bounded outbox intent;
- immediate access/acknowledgement email only to the controlled canary when email is green;
- optional reminder preference recorded independently;
- school inquiry routed for manual follow-up with no class-link promise;
- duplicate form replay creates no duplicate contact/lead/message;
- anonymous leads cannot create subscriber technical tickets or access private data.

Verify the new family signup appears immediately in administrator CRM cards and contact detail. Keep broad campaigns disabled. Produce preview-only legacy migration/audience segments for later operator approval.

# Phase 5 — Complete administrator, parent, and student product journeys

Use separate browser contexts and existing W13-103 controlled production identities.

Administrator/owner:

- dashboard, CRM, contact cards/detail, filters, tags, notes, tasks, read-only communications history, classes, content, reports, billing-safe status, support, rewards, and provider status;
- no placeholder setup text or dead controls;
- routine login by email/password; dangerous operations retain approved step-up protection.

Parent:

- household/learner, three-seat maximum, student access create/reset/suspend/restore, classes/content/progress, billing-safe state, support, and reward goals;
- no unrelated household, CRM, or administrator access.

Student:

- independent one-learner login, classroom, current/upcoming class, protected video/content, review materials, questions, progress, streaks, badges, milestones, accomplishments, rewards, and grounded helper entry;
- no sibling inference, raw provider URLs, parent/admin/CRM/billing/support-management access.

Gamification must be proven with one controlled learning/progress event that awards the intended progress/reward exactly once, remains scoped to the correct learner, survives an idempotent replay without a duplicate award, and renders correctly in the student portal.

Test expiry, logout, revocation, wrong-role, cross-account/household, offline/error states, and parent-managed student reset. Fix actual defects rather than recording them as later work.

# Phase 6 — Zoom classroom canary

If protected Zoom configuration exists:

1. create one private canary meeting/occurrence;
2. register at most one controlled family with up to three learner seats using secure per-learner/family access projections;
3. prove protected portal launch or SDK flow, host/learner role separation, attendance projection, expiry, and no raw join/host secrets in HTML, JSON, logs, analytics, or evidence;
4. test one student question path and Rabbi-side readback only when the controlled Telegram lane is ready;
5. clean up or disable the canary meeting after proof.

If credentials/account scopes are missing, keep Zoom off and record exact protected inputs needed. Do not invent meeting links.

# Phase 7 — Vimeo, content, knowledge, and social-draft pipeline

If protected Vimeo configuration exists, use one owned private test asset:

1. metadata/readback and protected playback;
2. transcript ingestion and deterministic content lifecycle;
3. Rabbi/admin content workspace visibility;
4. class association and student-safe knowledge-base indexing;
5. worksheet/review-question/email/newsletter/social-copy drafts with provenance;
6. grounded helper retrieval limited to approved Rabbi content;
7. candidate short-clip/social asset metadata for Buffer, without publishing.

Upload at most one asset only when the existing protected upload-canary gate is explicitly enabled. Never import unrelated Academy content or expose raw Vimeo credentials/URLs.

# Phase 8 — Telegram and WhatsApp operations

Telegram, when protected config exists:

- verify separate mapped One Time administrator and Rabbi identities;
- fixed One Time product/account scope;
- safe status, CRM lookup, class, content, task, support, and confirmation flows;
- at most three reads and one harmless confirmed write in an operator-owned allowlisted chat;
- no arbitrary SQL, secrets, exports, provider configuration, deployments, payments, or destructive commands;
- deduplication, audit, rate limit, webhook/polling exclusivity, and single token consumer.

WhatsApp, when protected config exists:

- one allowlisted operator canary and one controlled inbound exchange;
- public lead assistant for anonymous/non-subscribers only;
- subscriber support after identity/entitlement verification;
- consent, opt-out, suppression, rate limits, deduplication, natural bounded responses, and human escalation;
- no broad sends or private CRM/account actions for anonymous users.

Enable only a lane whose canary, queue audit, allowlist, webhook verification, and kill switch pass.

# Phase 9 — BNA support bridge

Use the already-converged strict versioned One Time support contract. Never weaken strict v1; use the accepted v2 receiver/schema where present.

1. prove HMAC, timestamp/replay window, event-ID idempotency, product/account scope, subscriber entitlement, minimal payload, redaction, and receipt/status round trip in staging;
2. default to a staging/sink canary. A production canary is permitted only when the private authorization manifest is current, downstream auto-action/CLI/agent/Telegram dispatch is disabled or dry-run, the recipient is controlled, and replay/idempotency plus zero task execution are proven; descriptive text alone is not a safety boundary;
3. prove anonymous/non-subscriber rejection;
4. Telegram notification is optional; ticket persistence must not depend on it;
5. perform any BNA code work only in a clean isolated BNA worktree—never stage the dirty checkout.

# Phase 10 — Grounded helper and Buffer readiness

OpenAI/helper, when protected configuration exists:

- index one approved Rabbi content item;
- ask at most three grounded questions;
- answer only from role-authorized One Time content;
- cite source item/time location internally;
- refuse unrelated/private/cross-learner requests;
- run prompt-injection, unsupported-answer, cross-learner, and cross-account negative tests and require a safe refusal with no private-data disclosure;
- record cost/latency/counts without logging private prompts or responses.

Buffer:

- verify account, organization, and destination read-only;
- create one unpublished draft only if the API truly supports draft state;
- never schedule or publish in W13-104;
- if no Buffer account/token exists, create the exact connection checklist and keep the action hidden/disabled.

# Phase 11 — Stripe TEST billing and entitlement proof

Use Stripe TEST mode only. Do not access or activate live payment mode.

1. verify the test account/product/price/customer-portal/webhook identities from protected config;
2. fix the webhook endpoint to the exact HTTPS application route, never the root domain and never an HTTP redirect;
3. create one test Checkout Session for the $67/month, three-learner-seat contract;
4. prove signed webhook receipt, idempotency, customer/subscription/invoice projection, entitlement activation, cancellation/failed-payment state, and portal readback;
5. use a controlled TEST customer/identity and explicit test namespace; require `livemode=false` at ingress and persistence and do not mutate a real production household's billing or entitlement state;
6. prefer the full end-to-end proof on staging, and change the Stripe Dashboard webhook only for the verified One Time TEST account;
7. assert every object `livemode=false` and external live-charge count zero;
8. hide/disable live purchase controls until an appropriately authorized adult/business representative separately completes live financial activation.

# Phase 12 — Million-dollar UI and usability acceptance

Audit and fix the actual production surfaces at 360×800, 390×844, 768×1024, and 1440×1000:

- consistent One Time typography, colors, spacing, logo scale, header, footer, buttons, cards, filters, drawers, modals, tables, and focus states;
- premium landing hero, correct moving promotional banner/countdown, no unwanted price sentence, no duplicated/broken images, correctly cropped Rabbi/retention assets, centered color world slider, readable bullet cards, and working WhatsApp entry only when the bot is ready;
- fast, clear CRM list/detail/cards, branded mobile filters, no public-bundle CRM leakage;
- consistent administrator/parent/student shell and navigation;
- skeleton, empty, partial-error, permission, offline, session-expiry, and retry states;
- keyboard, focus restoration, 200% reflow, screen-reader semantics, contrast, reduced motion, RTL safety, and virtual-keyboard handling;
- no dead buttons, placeholder setup copy, duplicate categories, raw provider links, PII in URLs/storage/logs, layout overlap, or uneven mobile grids;
- existing performance budgets and warm-return behavior.

Capture sanitized visual evidence and fix concrete failures. Do not perform an unrelated redesign when a targeted correction is sufficient.

Bind completion to the existing visible-action registry and the enumerated Day-One journeys in this prompt. Unsupported optional actions should be accurately hidden or disabled with useful copy, not force-built. After at most one focused remediation cycle for an optional lane, checkpoint its exact blocker and continue; critical auth, privacy, data-integrity, and unbounded-effects failures remain global stops.

# Phase 13 — Exact staging, production, and complete journey

For every runtime change:

1. commit/push the candidate and obtain all applicable green checks;
2. run full local/unit/integration/e2e/accessibility/performance/security/secret/migration/provider contract checks;
3. deploy the exact candidate to staging with transports off;
4. prove database upgrade, backup/restore, full acceptance, rollback, and roll-forward;
5. take a fresh production native backup;
6. audit queues/outboxes and require zero uncontrolled eligible backlog;
7. deploy the exact staging-tested source/artifact to production;
8. apply additive migrations once and verify;
9. with workers/transports still off, apply the privately authorized CRM import transactionally, rerun for idempotency, verify queue/outbox safety, and restore only the intended worker mode;
10. enable only canary-proven provider modes;
11. run one complete Day-One journey:
    - public family signup;
    - CRM visibility/tagging;
    - transactional email/set-password;
    - parent login and student access;
    - student class/content/progress/gamification;
    - administrator CRM/content/support readback;
    - one provider-safe support/content/class action where configured;
12. verify production `/version`, `/health`, `/ready`, worker, queues, alerts, audit, and role isolation.

Observability acceptance must include redacted correlation IDs across signup/delivery/provider jobs, worker heartbeat, queue depth and oldest-age, dead-letter count, provider enable/kill-switch state, current migration level, actionable failure logs, and audit-event readback. Never put PII, reset URLs, provider secrets, or message bodies into telemetry.

Batch runtime fixes before certification: perform one exact-image staging certification followed by one production deployment. Configuration-only activation may follow. Any code or image change after staging certification invalidates that certification and requires the staging, backup/restore, rollback, and roll-forward proof again.

Roll back immediately on database/migration failure, auth/signup failure, role/privacy breach, worker runaway, unbounded sends, or critical journey regression. Never roll back the healthy core merely because one optional provider lacks credentials.

# Phase 14 — Release governance and final handoff

1. Track exact `RUNTIME_SOURCE_SHA` separately from later evidence-only `EVIDENCE_HEAD_SHA`.
2. Update PR #91 body and records so they no longer describe already-completed production work as pending.
3. Obtain protected checks, make PR #91 ready, and merge normally into its integration base when green.
4. Create one canonical release PR from the resulting integration head to the actual default branch; verify ancestry/tree/migration order and merge normally without force/bypass.
5. Create a unique immutable tag for the exact production runtime source, never the later evidence head, and never overwrite an existing tag.
6. Produce a protected operator handoff with login/recovery links, provider configuration locations, kill switches, queue/runbook status, and private CRM/import details.
7. Produce a sanitized Rabbi handoff containing only his public/admin URLs, activation status, normal operating instructions, and support path—no secrets or other users' data.
8. Prepare but do not launch broad outreach: exact consent-safe segments, copy preview, suppression counts, estimated recipients, test delivery, and a separate explicit operator approval gate.

## Terminal statuses

- `READY_FOR_REAL_DAY_ONE_USE`: essential email, real CRM, signup, administrator/parent/student, portal, production, backup/rollback, and all configured enabled-provider journeys are green.
- `READY_FOR_USE_EXTERNAL_ACCOUNTS_PENDING`: essential web/login/CRM/portal/signup operations are green; one or more external provider accounts/credentials remain safely off.
- `LOGIN_READY_EMAIL_PROVIDER_INPUT_REQUIRED`: private login works but no secure inbox delivery can occur because email provider configuration is genuinely absent.
- `BLOCKED_CRITICAL_PRODUCTION_GATE`: use only for a verified critical data-integrity, auth/privacy, backup/rollback, or unbounded-effects failure.

Do not call the application fully ready solely from code/CI. Do not call the entire run blocked because Buffer, Zoom, Vimeo, Telegram, WhatsApp, helper, BNA, or Stripe TEST configuration is absent.

## Required final response

Begin with exactly one terminal status. Then provide:

- production/staging URLs and exact login URLs;
- administrator/parent/student/Rabbi activation status without private values;
- whether secure set-password emails were delivered and redacted provider status;
- `RUNTIME_SOURCE_SHA`, `EVIDENCE_HEAD_SHA`, deploy IDs, default-branch SHA, release tag;
- backup/restore/migrations/rollback/roll-forward results;
- real CRM imported create/update/duplicate/quarantine/tag totals with no PII;
- signup-to-CRM-to-email result;
- each provider's mode, canary result, budget, kill switch, and exact missing human input;
- complete portal/class/content/gamification/support/UI acceptance;
- exact external-effects counts, including live Stripe charges fixed at zero;
- private operator handoff and sanitized Rabbi handoff paths;
- `FINAL-REPORT.md`, `RESUME.md`, and remaining external-account checklist.

Do not finish by proposing another generic prompt while executable W13-104 work remains. Perform every authorized lane, checkpoint blockers locally, continue independent work, and leave the strongest safe production system actually usable.
