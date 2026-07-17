# W13-100 — Final recovery, canonical convergence, controlled production launch, and operator handoff

Paste this entire prompt into one fresh Codex session **after every other prompt in the current W13 sequence has finished or reached a durable checkpoint**. This is the last conductor. It is intentionally idempotent: if an earlier final-launch prompt already succeeded, verify and close gaps without duplicating imports, sends, provider objects, migrations, or deployments.

## Role and terminal outcome

You are the senior release director, recovery engineer, product-completeness lead, security/privacy reviewer, database migration owner, Railway operator, provider-canary conductor, and owner/admin acceptance tester for standalone One Time One Time with Rabbi Eli Scheller.

Do not return a plan-only or preflight-only response. Inspect the durable state left by the entire chain, continue incomplete work, repair failed gates, semantically converge accepted changes, establish one canonical repository release, deploy the exact accepted build, perform the explicitly bounded data/provider actions below, verify the real human journeys, and leave a clean, documented, reversible system.

Terminal outcomes are:

- `READY_FOR_CONTROLLED_DAY_ONE_USE` only when every mandatory Day-One gate below is proven; or
- `CORE_DEPLOYED_OPTIONAL_CAPABILITIES_PENDING` when the safe core product is pushed and live but one or more optional provider, import, or enhancement lanes remain truthfully disabled; or
- `PARTIALLY_READY_WITH_EXTERNAL_BLOCKERS` only when even the safe core cannot be deployed because a genuine core release blocker remains.

Never stop the whole task merely because one lane, test, credential, provider, PR, worktree, or older prompt is incomplete. Block only that capability, continue every independent phase, and preserve exact resume state. Do not ask the operator questions whose answers are already fixed below.

## Ship-the-safe-core rule

This rule is binding:

- Deploy the strongest verified core even when Buffer is not connected, BNA bridge is not ready, Stripe live mode is disabled, a provider credential is absent, the broad CRM import cannot yet run, or an optional enhancement lane is incomplete.
- An unfinished optional capability must be feature-flagged/provider-off and presented truthfully, or removed from visible Day-One navigation. It must not leave a dead button, fake-success state, placeholder screen, or runtime failure.
- Continue implementing, testing, and checkpointing optional capabilities after the safe core deployment whenever time and access permit.
- Core deployment may be blocked only by a concrete critical/high security or privacy defect, unsafe migration/data-integrity condition, broken signup/auth/session path, nonfunctional required database/worker path, inability to identify the exact build, or absence of a viable tested rollback.
- A cosmetic imperfection, missing optional account, provider-off integration, counsel-review note, unconfigured Buffer destination, BNA separation delay, or unavailable broad-send capability is never by itself a core deployment blocker.
- Never lower a real safety or data-integrity gate merely to deploy. Instead isolate the affected capability and ship the verified remainder.

## Repositories and separation

Primary target:

- Repository: `webcraft-media/onetimev2`
- Historical accepted anchor: W12-99 PR #73, branch `integration/w12-final-convergence-20260717T123715Z`, commit `0d8d7168f066668f035176d777bdaaa4dcc5accd`.

Related evidence sources:

- OPS-13A PR #72 historical evidence head: `d4f58801ebbb5fe8a41ef33621c7594f0ff6b2b4`; use its artifacts, never replace newer ancestry with this older base.
- W12-09 gamification source PR #71 historical head: `fc075bb688c69d8a03681633df8e6ea32ff685a9`.
- BNA repository `shloimie-beep/bnei-neviim-academy` and BNA PR #137 are a separate deployment/session/data train. Do not merge or copy BNA application code into One Time.

Use a new clean isolated worktree. Suggested path:

`C:\Users\User\OneTimeOneTime-w13-100-final-launch`

Create branch:

`release/w13-100-controlled-day-one-<UTC timestamp>`

Never clean, reset, stage, or overwrite an existing dirty checkout. Fetch all refs. Never substitute old `main`, PR #61, production HEAD, or a single feature branch for the newest semantically accepted candidate.

## Binding operator decisions and authorization

Treat these as the operator's written decisions for this controlled launch:

1. Include the safe W12-09/W13 gamification vertical slice for controlled Day One, with no public child rankings, shame mechanics, random rewards, loot boxes, click-farming, or cross-child exposure.
2. Accepted family plan definition: `$67 USD per month`, up to `3` active learner seats. Stripe remains TEST-only in this launch; live Stripe charges are not authorized.
3. Parent owns learner-login setup/reset/suspension. A student session resolves to one learner and cannot inspect siblings.
4. Routine parent/student login must not require an authenticator app. Owner/admin step-up security may be required only for sensitive/destructive/provider-changing actions.
5. One Time content/Vimeo/transcript/knowledge/helper/social-draft functionality belongs to the Rabbi's One Time product, not the Academy.
6. The real Rabbi CRM should be loaded only from the exact approved six-source OPS-13A primary manifest after successful rehearsal, backup, count reconciliation, dedupe, and rollback proof. Ambiguous rows are quarantined. Import-triggered sends are forbidden.
7. Transactional activation/reset email may be enabled after a green bounded canary. Broad campaigns and migration blasts are not authorized.
8. Telegram admin operations may be enabled only for protected mapped owner/admin chats after a green canary. No payment, broad-send, export, role-grant, deployment, credential-change, or destructive-delete commands.
9. WhatsApp public lead assistance may be enabled after webhook, consent, suppression, and bounded canary proof. Technical support remains subscriber-only. No outbound campaign.
10. Zoom may create and use learner-specific protected class access only after the real bounded canary passes. Never expose raw host/start URLs, passcodes, ZAK, access tokens, or reusable raw learner links.
11. Vimeo may operate only on owned One Time/Rabbi content after the owned-video canary passes. Never expose private file/provider URLs.
12. The OpenAI/helper capability may run only on approved Rabbi class content, grounded to the authorized corpus, with no CRM, payment, household, support, or provider-secret access.
13. Buffer remains provider-off unless an account and exact destination aliases are connected. Even when connected, this launch authorizes at most one draft canary—not public scheduling or publishing.
14. The One Time-to-BNA support bridge remains provider-off unless strict support-event v2 compatibility, isolated BNA staging, protected HMAC configuration, and one staging canary are proven. Never weaken frozen v1 to accept v2.
15. Production deployment of the exact fully tested candidate is authorized by this prompt once all deployment gates pass.
16. Production application of the exact sanitized approved CRM manifest is authorized once all import gates pass. No excluded files, private message bodies, or guessed identities may be included.
17. GitHub branch/commit/push/PR operations, semantic convergence, merging the final accepted release through normal protected-branch rules, release tagging, Railway staging/production deployment, production migrations after backup, and tested rollback are authorized by this prompt.
18. Not authorized: live Stripe charges, broad email/WhatsApp campaigns, Buffer public publishing, DNS/domain changes, deleting databases/services/volumes, destructive history rewrites, importing excluded legacy lists, sending to historical CRM contacts, or bypassing branch protection.
19. The safe core should be deployed even when an optional provider/import/enhancement is blocked. Record the limitation, keep it off, and continue.

## Required durable records from the first write

Create `ops/codex-runs/W13-100/` immediately with:

- `ORIGINAL-PROMPT.md` — exact prompt;
- `STATE.json`;
- `RESUME.md` — executable from any new Codex chat;
- `SOURCE-PINS.json`;
- `LANE-RECOVERY-MATRIX.json`;
- `COLLISION-LEDGER.json`;
- `PRODUCT-DECISIONS.json`;
- `CAPABILITY-MATRIX.json`;
- `VISIBLE-ACTION-AUDIT.json`;
- `VALIDATION.json`;
- `STAGING-ACCEPTANCE.json`;
- `PROVIDER-CANARIES.json`;
- `IMPORT-MANIFEST.json`;
- `PRODUCTION-DEPLOYMENT.json`;
- `PRODUCTION-ACCEPTANCE.json`;
- `EXTERNAL-EFFECTS.json`;
- `ROLLBACK.md`;
- `OPERATOR-HANDOFF.md`;
- `FINAL-REPORT.md`;
- `CHANGED-FILES.txt`.

Update `STATE.json` after every material phase, before every external mutation, before long tests, and before exit. Record exact repository, worktree, branch, base/head, phase, completed objectives, blocked sub-lanes, tests, deployments, database changes, sends, provider changes, and next action.

If interrupted, commit and push a coherent checkpoint whenever safe. A chat response is never the sole state record.

# Phase 1 — Recover the entire chain and select one canonical candidate

## 1A. Dynamic branch/run discovery

Fetch all refs and inspect, at minimum:

- W13-01 through W13-10;
- W13-90;
- OPS-13B-R;
- W13-99 or any replacement final-launch branch/prompt generated by W13-10;
- PRs #71, #72, #73;
- all branches/PRs whose names contain `w13`, `ops13`, `final`, `launch`, `convergence`, or `release`;
- repository `ops/director/**`;
- every available `ops/codex-runs/<task>/STATE.json`, `FINAL-REPORT.md`, `RESUME.md`, `CHANGED-FILES.txt`, migration report, and provider/import result.

For each lane record:

- exact base/head and ancestry;
- branch/PR/check state;
- whether its claimed work is actually present at head;
- whether it is complete, checkpointed, superseded, conflicting, unsafe, evidence-only, or absent;
- tests actually run;
- migrations and shared hotspots;
- external effects;
- exact work still required.

Do not assume a chat-reported success equals committed code. Do not assume a failed older PR means its work is absent from a newer convergence head.

## 1B. Recovery rule

For every missing or partial mandatory lane:

1. If it has a safe committed checkpoint, continue from that exact checkpoint in an isolated worktree or semantically port it onto the final recovery branch.
2. If only a durable resume prompt exists, execute its safe remaining implementation rather than reporting the blocker again.
3. If it was superseded, prove containment and use the containing branch.
4. If it is absent but mandatory for controlled Day One, implement the smallest complete production-quality version directly in W13-100 with tests and evidence.
5. If an optional provider is unconfigured, finish provider-off UI/adapters/readiness and block only the external canary.
6. If an optional feature cannot be made reliable in this run, disable it behind the canonical capability flag, remove its broken visible actions, preserve its durable resume state, and continue to core release.

Do not merge every draft PR. Integrate only accepted semantic changes. Never merge both conflicting implementations of the same domain/provider/consumer.

## 1C. Canonical semantic convergence

Select the newest candidate that contains the accepted W13 ancestry. Reconcile, in dependency order:

1. brand/design/public landing and authentication;
2. canonical contacts, identities, tags, provenance, households, learners, and import model;
3. communications and support references using canonical public identifiers;
4. identity/session/role lifecycle and parent/student portals;
5. billing/entitlement truth and three-seat contract;
6. classes/occurrences/Zoom access/attendance/questions;
7. content/Vimeo/transcript/knowledge/helper/social drafts;
8. Telegram/WhatsApp/support-v2 contracts;
9. gamification;
10. shared delivery authorization, legal/consent, security, SRE, migrations, package scripts, CI, exports, navigation, visible-action registry, and lockfile.

Resolve migration numbers dynamically. Never edit a checked production migration. Use additive forward migrations. Reject duplicate prefixes and near-duplicate domain tables/services.

# Phase 2 — Finish the real product, not only the infrastructure

## 2A. Owner/admin experience

Using a separately controlled owner/admin session, prove and repair the complete journey:

1. activation or set-password email;
2. login, appropriate assurance, recovery, logout, cache clearing;
3. useful dashboard with business truth and next actions—not internal API jargon;
4. fast CRM list with branded filters/search/sort/pagination;
5. contact opens into a polished detail route/drawer and returns without losing filters, scroll, or focus;
6. contact summary, tags/provenance, household/learners, lifecycle, consent/suppression, communications, notes, tasks, classes, progress, billing/entitlement, support, and audit;
7. safe contact create/edit/archive, duplicate/conflict handling;
8. communications history and truthful draft/reply/provider state;
9. class schedule, occurrences, learner access, reminders, attendance, questions;
10. content ingestion, transcript/version review, derivatives, knowledge publication, social drafts;
11. billing/product/seat/webhook/reconciliation truth;
12. support/ticket status without loading or impersonating BNA;
13. Telegram, WhatsApp, email, Zoom, Vimeo, Buffer, Stripe, helper, worker, backup, and readiness shown in human language, with technical diagnostics behind explicit disclosure.

Every visible button must work, truthfully show a provider-off/permission state, or be removed from Day-One navigation. No dead controls, placeholder screens, “Cannot GET,” fake success, faded unreadable contacts, duplicated categories, or broad Operations-shell loading.

## 2B. Parent and student experience

Use genuinely separate browser contexts/sessions. Do not impersonate from admin.

Parent must be able to:

- see household and up to three learners;
- set/reset/suspend/restore learner access without retrieving current secrets;
- see schedule, protected class launch, attendance/progress/review, updates, billing/seat truth, and subscriber support.

Student must be able to:

- see only their learner profile;
- access next class, protected join, schedule, library/replay, review materials, progress, accomplishments/gamification, private-question submission, and the grounded class helper;
- never see siblings, billing, provider URLs, other learners, parent-private data, or system internals.

## 2C. Public landing and brand acceptance

Verify and repair the actual current requested One Time presentation:

- one canonical black/yellow One Time design system across public/authenticated/portal surfaces, with restrained ice-blue status accents;
- consistent typography, buttons, fields, cards, headers, footers, spacing, focus, loading/error/empty states, and responsive behavior;
- larger clean One Time logo without an unnecessary border;
- working member login when authentication is live;
- thin moving promotional ticker/countdown: “Join now — free until Rosh Hashanah”; do not place the `$67/month afterward` sales sentence in the hero;
- hero copy and imagery must not cover Rabbi Scheller's face;
- “Worldwide Mishnah learning” and “Live from Eretz Yisrael” use intentional line hierarchy;
- offer/result sections use polished cards and clear yellow bullet treatments;
- no duplicated boy-with-headphones image;
- accomplishment/clarity/retention assets use the approved source images and sensible uncropped framing;
- “Seen across the Jewish world” is a centered, color, edge-to-edge-feeling slider with clean place labels and no partially broken adjacent image;
- accessible WhatsApp launcher connected to the real lead-assistant readiness state;
- excellent 360x800, 390x844, tablet, desktop, 200% zoom, keyboard, reduced-motion, slow-network, and RTL behavior;
- no uneven orphan cards, horizontal overflow, duplicate mobile filters, or layout shift.

Use visual-regression evidence and actual screenshots. Do not substitute unrelated stock images merely to make a test pass.

# Phase 3 — Security, privacy, legal, delivery, migration, and operations closeout

Consume and finish W13-10's outputs. Verify or repair:

- canonical provider-activation policy with explicit environment, provider, mode, authorization, allowlist, budget, idempotency, consent/suppression, timeout, lease, redaction, and kill-switch gates;
- failed provider calls never masquerade as successful sink delivery;
- versioned privacy, terms, communication consent, guardian/student notice, and data-lifecycle matrix with unresolved legal judgments clearly marked for counsel rather than invented;
- session/cookie/CSRF/return-path/rate-limit/token-replay/security-version/object-authorization/cross-household/cross-workspace protections;
- public/authenticated bundle separation, CSP, cache controls, browser-storage privacy, webhook signatures/replay/dedupe, import/archive/formula-injection safety, helper grounding/prompt-injection resistance;
- PostgreSQL 16 and current production-version fresh apply, upgrade, checksums, locks, partial failure, old/new compatibility, native backup, disposable restore, and forward-migration plan;
- worker claims, retries, dead letters, draining, idempotency, queue observability;
- SLO/readiness/alerts/runbooks, immutable source/image provenance, exact deployment target refusal, staging and production rollback;
- dependency/lockfile/Node 24/CI permissions/action pinning/env-contract/SBOM/secret-scan/reproducibility truth.

Fix concrete critical/high issues. Do not weaken tests or security checks. Record non-blocking counsel/product decisions separately.

# Phase 4 — Full validation and repair loop

Run the complete applicable suite on the integrated candidate:

- deterministic install and secret scan;
- brand check and visible-action audit;
- scoped formatting, lint, typecheck;
- unit and integration suites;
- build and bundle budgets;
- E2E, accessibility, performance, privacy, security, provider-off, portal, CRM, content, classroom, billing, bot, support, worker, migration, and PostgreSQL assurance suites;
- real browser journeys at all required viewports;
- duplicate migration/domain/event/route/visible-control checks;
- `git diff --check` and private-data/secret review.

When a check fails:

1. determine whether it is a product defect, test defect, environment problem, stale baseline, or external blocker;
2. repair the correct layer without weakening the contract;
3. rerun the focused test and then its parent gate;
4. repeat until green or until three evidence-backed repair cycles prove a genuine external blocker;
5. preserve state before any long rerun.

Do not mass-format unrelated files. Do not claim unrun tests.

# Phase 5 — Exact isolated staging, rollback, and controlled acceptance

Deploy the exact final candidate source/image to the isolated One Time staging environment. Do this even when optional providers remain off, provided the core release blockers defined above are clear.

Required proof:

- exact Railway project/environment/web/worker/database identities;
- exact source SHA and image digest;
- `/version`, `/health`, and `/ready` readback;
- migrations applied once and verified;
- worker heartbeat/queue truth;
- native backup and disposable restore;
- rollback to exact pre-deploy staging build, smoke, roll forward to candidate, smoke again;
- owner/admin/parent/student separate-session journeys;
- no production mutation during staging acceptance.

Then run bounded provider canaries one at a time, recording sanitized proof and cleanup/disable state:

1. one activation email and one reset email to protected controlled destinations;
2. one Stripe TEST checkout and required test webhook/entitlement projections; reject every live-mode object;
3. one Zoom canary meeting/occurrence, at most two controlled registrants, protected learner launch/SDK-role/attendance proof;
4. one owned Vimeo item inspection/playback/content/knowledge projection; no upload unless protected one-upload authorization exists;
5. one approved content item and at most three grounded helper queries with zero private-data queries;
6. one Telegram allowlisted chat, at most three reads and one confirmed safe staging write;
7. one WhatsApp allowlisted recipient, one controlled outbound canary, counts-only status/webhook readback;
8. Buffer: at most one draft if connected, otherwise exact blocker; never publish/schedule;
9. BNA support v2: synthetic test first; at most one isolated staging event only when the BNA v2 consumer and protected staging/HMAC proof are green.

If a provider is unconfigured, finish all code/readiness/UI and continue. Never broaden a canary because another provider passed.

# Phase 6 — Real audience rehearsal and production apply manifest

Use the OPS-13A sanitized inventory and exact hashes. Dynamically locate the authorized files. Approved scope is limited to:

- `Rabbi Scheller Followers.xlsx`; and
- the five approved email-audience exports;
- expected naive combined scale approximately 2,509 rows before deduplication, but actual verified counts control.

Excluded:

- 29 large legacy CRM/pipeline exports unless a later separately approved exact canonical group exists;
- communication bodies;
- unknown/external lead lists;
- rows whose ownership, identity, consent, household, learner, school/family, or subscriber state is ambiguous.

On an isolated staging restore/clone with all delivery disabled:

1. verify source hashes;
2. produce counts-only preview;
3. run the import;
4. prove provenance, canonical tags, consent/suppression precedence, conservative identity matching, household/learner quarantine, conflict handling, and exact dispositions;
5. run a second pass proving idempotency;
6. prove rollback;
7. generate an exact sanitized production apply manifest with source hashes, safe/new/matched/quarantined/conflict counts, schema/migration/source SHA, backup requirement, rollback plan, and zero-send invariant.

# Phase 7 — Canonical GitHub release and production launch

Before production mutation, require the **core deployment gates** green and record an immutable authorization fingerprint tied to the exact candidate SHA/image. Treat CRM import and provider activation as independent post-deploy sub-lanes: their blockers must not prevent safe core deployment.

## 7A. Repository governance

- Push the final branch and open/update the canonical final PR.
- Prove containment of accepted lane heads.
- Obtain green protected checks.
- Merge through normal branch protection without bypassing it or rewriting history.
- Make the default branch contain the deployed product source.
- Create an annotated release tag tied to the exact deployment source.
- Mark superseded draft PRs clearly only after ancestry/semantic containment proof. Do not delete branches destructively.

## 7B. Production deployment

1. Record exact current production identities/source/image/migration state.
2. Create a fresh native production backup and validate it before writes.
3. Deploy the exact staging-tested source/image; do not rebuild from an unverified checkout.
4. Apply additive migrations once and verify.
5. Smoke `/version`, `/health`, `/ready`, landing/signup, login/activation/reset, dashboard, CRM, communications, content, classes, billing, portals, support, workers, and truthful provider modes.
6. Preserve and test the rollback procedure. Roll back immediately on migration integrity, authentication, public signup, worker, or critical journey failure.
7. If an optional feature is not accepted, deploy with its provider/capability flag off and confirm its routes/actions fail gracefully or are hidden.

## 7C. Production CRM import

Apply only the exact approved manifest after verifying fresh backup, source hashes, expected counts, zero-send mode, and rollback. Import only safe/new/matched dispositions. Quarantine conflicts and ambiguities. Do not guess or broaden scope.

Run a second idempotency pass and verify real contacts appear in the fast CRM list/detail with correct tags/provenance. Do not print private rows in evidence.

## 7D. Production provider modes

Enable only capabilities whose exact staging canary passed and whose protected production config, budget, kill switch, and failure behavior are proven:

- transactional activation/reset email;
- mapped Telegram owner/admin operations;
- public WhatsApp lead assistant and subscriber-only support handoff;
- learner-specific Zoom class access;
- owned Vimeo content integration;
- grounded One Time helper.

Keep these disabled:

- Stripe live mode/live charges;
- broad email/WhatsApp campaigns;
- Buffer public scheduling/publishing;
- BNA live bridge unless its separate v2 production gate exists;
- any provider without a green canary or protected production configuration.

# Phase 8 — Final human acceptance and handoff

Using separately controlled real sessions and protected destinations:

- deliver one admin activation/set-password or reset email when needed;
- prove the administrator can reach the real production login and complete the full admin journey;
- prove controlled parent and student journeys without impersonation;
- prove the Rabbi owner role readiness without setting or knowing his permanent password; use a one-time activation flow when his protected destination is available;
- verify imported real CRM counts/tags/contact opening;
- verify provider status and kill switches;
- verify logout/recovery/cache clearing;
- capture sanitized desktop/mobile evidence.

Create a protected local handoff outside Git containing only private operator login/setup material. Do not print its contents. In committed `OPERATOR-HANDOFF.md`, include public URLs, the safe procedure, capability status, and the protected local file location without private values.

## Core deployment gates versus full Day-One gates

The following are mandatory for **any production core deployment**:

1. canonical repository head and deployed production source/image agree;
2. full required CI/test suite green or every skipped test has a non-release-blocking evidence-backed reason;
3. backup/restore and deployment rollback proven;
4. public signup and natural login/activation/reset work;
5. administrator can use dashboard, CRM, contact detail, communications, classes, content, billing/readiness, and support;
6. controlled parent and student sessions work with correct isolation;
7. every incomplete optional capability is safely feature-flagged/provider-off or hidden with no broken navigation;
8. provider UI is truthful and only green-canary modes are enabled;
9. no critical/high security, privacy, migration, entitlement, data-integrity, or visible-action defect in the deployed core;
10. production `/version`, `/health`, `/ready`, web, worker, migrations, and queues are green;
11. tested rollback and kill switches remain available.

These additional gates are required for `READY_FOR_CONTROLLED_DAY_ONE_USE`, but their absence does **not** prevent `CORE_DEPLOYED_OPTIONAL_CAPABILITIES_PENDING`:

12. gamification works safely or is intentionally deferred behind a clean feature flag;
13. the real approved CRM manifest was applied idempotently with conflicts quarantined and zero sends;
14. the desired transactional/provider canaries passed and their exact accepted production modes are enabled;
15. content/Vimeo/Zoom/helper/Telegram/WhatsApp experiences required for the first real class are operational;
16. final operator design/copy corrections are accepted beyond non-blocking polish.

## Publication and final response

Before exit:

- ensure the worktree is clean;
- update all W13-100 records with exact final truth;
- commit and push all task-owned code/evidence;
- publish/update the canonical final PR and release records;
- never expose credentials or PII.

The final Codex response must begin with one exact status:

- `READY_FOR_CONTROLLED_DAY_ONE_USE`, or
- `CORE_DEPLOYED_OPTIONAL_CAPABILITIES_PENDING`, or
- `PARTIALLY_READY_WITH_EXTERNAL_BLOCKERS`.

Then report in plain language:

- production and staging URLs;
- canonical GitHub branch/PR/tag and exact source/image SHAs;
- whether production was deployed;
- whether the real CRM import ran, its sanitized disposition counts, and whether sends remained zero;
- owner/admin/parent/student acceptance results;
- each provider's mode and actual canary/production effect;
- tests actually run and failures;
- backup/rollback proof;
- remaining blockers with exact owner and resume command;
- location of `FINAL-REPORT.md`, `RESUME.md`, `OPERATOR-HANDOFF.md`, and protected local login handoff;
- exact external effects: emails, WhatsApp messages, Telegram actions, Zoom meetings/registrants, Vimeo operations, helper queries, Buffer drafts/posts, Stripe TEST/live objects, BNA events, deployments, migrations, imports, and DNS changes.

Do not end with “the next step is to deploy” if all mandatory gates are green. This prompt authorizes the controlled deployment and narrow import described above. Conversely, never label the system ready by hiding a failed mandatory gate.
