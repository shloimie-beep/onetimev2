# W13-102 — Production operational activation, real CRM onboarding, and bounded provider closeout

Paste this entire prompt into one fresh Codex session running with Full Access and network access. This continues W13-101. It is not a new architecture, convergence train, or staging-only audit.

## Exact verified starting state

- Repository: `webcraft-media/onetimev2`
- Draft PR: `https://github.com/webcraft-media/onetimev2/pull/91`
- Branch/worktree: `release/w13-100-controlled-day-one-20260717T182046Z` at `C:\Users\User\OneTimeOneTime-w13-100-final-launch`
- Verified PR checkpoint/evidence head: `36c20fb62c7097b896a31c57e50860eb9f2339ef`
- Exact production runtime source: `466d8489bb8c7a3a57f7590929b58e7857420e86`
- Production URL: `https://join.onetimeonetime.com`
- Production release tag: `w13-101-production-safe-core-20260718`, pointing to the runtime source above
- Production web deployment: `243b614a-bd51-49fe-9aae-b17b99a6fe22`
- Production worker deployment: `52226afb-5b5c-4e79-8982-8b26115dfaba`
- Latest production migration: `2203_w13_100_student_gamification`
- W13-101 records: `ops/codex-runs/W13-101/**`
- Existing protected local files:
  - `C:\Users\User\.onetime-w13-101-private\staging-identity-handoff.private.json`
  - `C:\Users\User\.onetime-w13-101-private\production-runtime-env.private.json`
- Current truth: core is live and healthy; production role-login handoff is incomplete because the prior activation expired; optional provider transports are off; the real CRM import has not been applied.

Verified Railway identities from W13-101, all requiring fresh readback before use:

- staging project `7c8eee26-7a6a-4684-826d-9f4377d67d46`, environment `11edf8a2-0160-45b4-a039-b15b4beb4c10`;
- production project `ce55ef20-1418-4ad3-aafa-f877fb992dc8`, environment `f911acfc-e206-44df-a569-9d69d709b94b`;
- production web `one-time-web`, worker `one-time-delivery-cron`, historical PostgreSQL service `db590e4a-7dc5-40cb-a243-5206ce21b746`.

Never use a target whose live identity/readback differs from this lineage until the discrepancy is safely resolved and recorded.

Fetch and verify the remote state before writing. If PR #91 advanced, record the new evidence head and prove its relationship to the deployed runtime. Never reset, clean, overwrite, or stage another dirty checkout. Never use the dirty BNA checkout or run BNA control-tower commands for this One Time task.

## Mission and mandatory order

Finish the operational work in this order:

1. preserve the healthy live core and checkpoint W13-102;
2. create a secure, production-authorized one-shot identity activation/recovery path;
3. deliver a natural email-to-set-password flow and prove separate administrator, parent, and student sessions;
4. fix defects found in authenticated production journeys;
5. back up, rehearse, and apply the approved real Rabbi CRM import with all delivery suppressed;
6. enable transactional email after a bounded canary;
7. test WhatsApp lead capture and BNA subscriber support independently;
8. test every other configured provider with strict canary budgets;
9. stage and production-deploy only changes that pass all relevant gates;
10. finish GitHub governance and produce a usable private operator handoff.

Do not return another preflight-only report. Missing configuration blocks only the affected optional lane. Continue every independent lane. The already-live core must stay live unless a real data-integrity, security, migration, or rollback emergency requires rollback.

Execution order after Phase 2 is Phase 5 (transactional email), Phase 3 (role acceptance), Phase 4 (CRM), Phase 6, Phase 7, Phase 8, Phase 9, then Phase 10. The email section appears later only to keep provider controls together; run it before authenticated role acceptance.

## Written operator authorization and limits

This prompt authorizes:

- read-only discovery of GitHub, Railway, database, provider-mode, queue, and existing-account state;
- creation of one explicit, one-shot, audited production identity authorization mechanism described below;
- at most one controlled owner, one administrator, one parent, and one student/learner access subject;
- bounded activation/reset delivery to destinations already stored in protected configuration;
- real CRM import from only the accepted Rabbi source manifest after dry-run, restore rehearsal, and backup gates pass;
- bounded provider canaries to protected operator-controlled destinations;
- additive code/migration/config fixes, exact-SHA staging deployment, rollback/roll-forward, production backup, and production deployment;
- commits, pushes, PR updates, protected merges, and release tags after validation.

Not authorized:

- live Stripe mode or live charges;
- broad email/WhatsApp campaigns, audience blasts, or messages to imported contacts;
- Buffer scheduling or public publishing;
- DNS changes;
- destructive data replacement, deletes, password-hash copying, or ambiguous contact merges;
- weakening authentication, authorization, MFA policy, webhook verification, consent, suppression, role isolation, or the strict support contract;
- force pushes, destructive Git history, branch-protection bypasses, or secret/PII disclosure.

## Anti-stall and checkpoint rules

Create `ops/codex-runs/W13-102/` immediately with:

- `ORIGINAL-PROMPT.md`
- `STATE.json`
- `INPUTS-STATUS.json`
- `RESUME.md`
- `LIVE-BASELINE.json`
- `IDENTITY-ACTIVATION.json`
- `ROLE-ACCEPTANCE.json`
- `CRM-IMPORT.json`
- `PROVIDER-CANARIES.json`
- `EXTERNAL-EFFECTS.json`
- `DEPLOYMENT.json`
- `OPERATOR-HANDOFF.md`
- `FINAL-REPORT.md`
- `CHANGED-FILES.txt`

Create private runtime material only under `C:\Users\User\.onetime-w13-102-private\`; never commit it. At every phase boundary update state, commit/push coherent task-owned work, and record the exact resume command. If interrupted, the next Codex window must be able to continue from Git plus the protected private directory without needing this chat.

Do not invent refs, emails, phone numbers, account IDs, credentials, source-file approval, or provider readiness. First discover them from verified Railway variables, W13 records, accepted manifests, or protected private files. Never print values. If a required private input is absent, write a sanitized template and exact missing-field list, mark only that lane blocked, and continue.

The private identity authorization manifest must authorize each recipient separately with role, destination hash, whether the operator controls the destination, `send_now`, expiry, and message budget. A destination merely existing in Railway or the database is not permission to contact it. Administrator/parent sends may target operator-controlled inboxes when explicitly marked. The Rabbi owner receives nothing unless his exact private manifest entry has `send_now=true` and current operator authorization.

Pre-run private inputs to discover or request by field name only are: administrator destination; separately authorized Rabbi owner destination; controlled parent destination; student username/learner display identity; accepted CRM source hashes/paths and tag-map approval; WhatsApp canary destination; Telegram chat/user mapping; and each provider's protected credentials. Missing items block only their lane.

Global stopping is permitted only for probable data corruption, secret exposure, destructive ambiguity, inability to back up or restore production before a planned production write, live financial effects, broad unbounded sends, or a critical auth/role-isolation failure. A missing optional credential is never a global stop.

# Phase 1 — Preserve and inventory the live system

1. Fetch PR #91 and validate the worktree, deployed runtime/evidence-head distinction, release tag, and current protected checks.
2. Verify production `/version`, `/health`, `/ready`, web/worker deployment IDs, database version/migration ledger, worker heartbeat, and provider modes without exposing private configuration.
3. Run a native production backup and disposable restore proof before any production data or identity write. If local clients are unavailable, use an ephemeral compatible Railway task/container.
4. Snapshot counts only for accounts, identities, sessions, households, learners, contacts, tags, import runs, audit events, outbox states, suppressions, tickets, and dead letters.
5. Audit all pending queues. Preserve existing rows. No external transport may be enabled while uncontrolled eligible backlog exists.
6. Confirm public landing/signup and production login/reset pages still work before changing anything.

# Phase 2 — Secure one-shot production identity activation

The current production provisioning helper correctly refuses production. Do not weaken, delete, or bypass that safety default.

Implement a separate task-scoped production identity command that uses existing auth/domain/repository services rather than raw SQL. It must:

- default to dry-run;
- require the exact verified Railway project/environment/service identity;
- require expected runtime SHA `466d8489bb8c7a3a57f7590929b58e7857420e86`, or the later exact candidate if W13-102 legitimately deploys a replacement;
- require `--apply`, an ephemeral production-authorization gate, and a protected private authorization manifest with a short expiry;
- accept only exact allowlisted destinations loaded from the private manifest/runtime configuration;
- enforce a hard budget of at most one owner, one administrator, one parent, and one student/learner access subject;
- acquire a database advisory lock and run transactionally/idempotently;
- emit durable audit events with run ID, actor, role, and redacted identity hash;
- refuse unrelated accounts, products, roles, or recipients;
- leave no permanent production bypass or broadly reusable flag.

Identity rules:

1. Existing active identity: use the normal password-reset path; never overwrite its password or email.
2. Expired activation: revoke/expire the old token and issue one new activation.
3. New approved identity: create through normal domain services and issue one activation.
4. Tokens must be CSPRNG, single-use, short-lived, stored hashed only, invalidate older outstanding tokens, and never appear in stdout, logs, commits, screenshots, or evidence.
5. Never generate or print a permanent plaintext password.
6. Natural flow is email link → set password → ordinary login.
7. The operator-approved policy is email/password for routine owner/admin/parent/student login, with verified step-up protection for dangerous privileged operations. Parent/student routine login must never require authenticator MFA. Do not silently remove privileged safeguards: implement and negative-test step-up boundaries, session rotation, recovery, and audit events.
8. Owner, administrator, and parent are distinct product identities and must be tested in separate browser contexts. A student login resolves to exactly one learner. Never use admin impersonation as a substitute.
9. Parent can create/reset/suspend/restore the student's access but cannot retrieve the existing student secret.

Phase 2 builds and proves the mechanism but must not issue a production activation/reset until Phase 5 has proven transactional email or explicitly recorded that lane blocked. Prefer a bounded activation/reset email. If transactional email is unavailable, a one-time operator-owned admin/parent fallback link may be written only to a protected local private handoff file; never commit or print it. Do not create a private fallback link for the Rabbi owner—his destination must receive the approved activation naturally.

Before any production apply, commit the command and tests, obtain relevant green checks, prove dry-run and apply behavior against staging/disposable PostgreSQL, and verify audit/idempotency/rollback. Execute the production operation only from that exact tested candidate as a bounded one-off task. Do not expose a permanent public provisioning endpoint.

# Phase 3 — Role acceptance and product UX

Do not begin this phase until Phase 5 has either delivered the bounded activation/reset flow or recorded the email lane blocked and created only the permitted operator-owned private fallback.

Use genuinely separate browser contexts and prove on staging first, then production after deployment:

- administrator activation/reset/login/logout/session revocation and CRM authorization;
- owner/admin dashboard and allowed settings/actions;
- CRM list, private search, filters, tags, sorting, pagination, cards, contact detail, notes, communications, tasks, archive, conflict and duplicate states;
- parent activation/login, household view, learner setup, student access reset/suspend/restore, class/content access, progress, billing-safe state, and support;
- student login, one-learner isolation, classroom, content/video, questions, review materials, progress, streaks, badges, milestones, accomplishments, rewards, and helper boundaries;
- wrong-role, sibling, cross-household, cross-account, archived, expired-session, and replayed-token denial;
- mobile 360×800 and 390×844, tablet, desktop, keyboard, focus, screen-reader semantics, reduced motion, RTL safety, loading/empty/error/offline states, and performance budgets;
- consistent One Time brand shell, typography, buttons, filters, headers, footers, drawers, and visible states across public, administrator, parent, and student surfaces.

Fix concrete defects found. Do not merely record broken buttons, placeholder setup text, dead routes, unreadable filters, duplicate assets, or fake-success states. Hide only an optional action whose backend/provider genuinely remains unavailable, and label the reason truthfully.

# Phase 4 — Real CRM import with zero sends

The user has authorized loading the real Rabbi CRM data, but only through a bounded, reversible manifest.

1. Locate the accepted source manifest and authoritative files by exact hash, not filename alone. Expected candidate scope is `Rabbi Scheller Followers.xlsx` plus the five accepted email-audience exports. Read-only inspection of approved BNA evidence is allowed, but do not edit, stage, or run control commands in the dirty BNA checkout. Any BNA implementation requires a separate clean isolated worktree.
2. Never commit source rows, raw PII, email bodies, attachments, or private paths. Commit only hashes, schemas, sanitized counts, tag mappings, and results.
3. Take a fresh production backup and prove restore before apply.
4. Snapshot the exact worker/transport state, then pause outbound workers/transports and force delivery off/sink inside a guaranteed cleanup/finally procedure. After success or failure, restore the intended prior worker state only after proving zero unintended eligible queue rows; otherwise keep delivery safely paused and report the critical queue blocker.
5. Rehearse against a disposable current production restore.
6. Normalize email/phone conservatively; preserve provenance; map old-system, old lead, legacy active, legacy lead, current signup, school/family, source, consent, suppression, and review-required tags.
7. Current production values win. Import may fill blanks but may not overwrite newer data, entitlements, household relationships, credentials, consent, or suppressions.
8. Never auto-merge ambiguous identities. Quarantine conflicts with reason codes and redacted review evidence.
9. Imported contactability never implies marketing consent. Channel consent remains separate.
10. Apply transactionally/idempotently under a run ID. Abort and roll back if row totals differ from the accepted plan, account/product scope fails, uniqueness breaks, or any outbox/delivery/campaign row is created.
11. Rerun must create zero additional contacts/tags/history rows.
12. Historical communication bodies/attachments remain off unless a separate accepted communication-history manifest already exists with exact ownership/privacy gates. Metadata/provenance may be imported when approved.
13. Verify real CRM list/cards/detail/search/filter/tag flows privately. Screenshots/evidence must mask PII.

Any new importer or import repair must be committed, checked, and rehearsed on staging/disposable PostgreSQL before it may touch production. A local one-off production apply must use the exact tested source and protected Railway database context; it may not depend on an uncommitted script.

If the accepted manifest or exact source files are absent or ambiguous, create a sanitized source inventory and acceptance manifest, mark only CRM apply blocked, and continue provider/identity work. Never guess import scope.

# Phase 5 — Execute immediately after Phase 2: transactional email activation

1. Discover existing protected Resend/email configuration and runtime flags without printing values.
2. Verify sender/domain readiness, HTTPS callback path, signature verification, idempotency, retry behavior, and suppression handling. No webhook endpoint may rely on HTTP→HTTPS or root-path redirects.
3. Prove sink mode first.
4. Global real-send budget: at most one administrator activation/reset, one owner activation/reset, and one parent activation/reset to approved protected destinations. Student receives no direct email.
5. Verify link host, expiry, single use, replay rejection, and successful password setup/login.
6. Exercise signed synthetic delivery, bounce, complaint, and suppression events only in staging/disposable data. Never inject fake bounce/complaint events into production or poison a real recipient's suppression state. Production receives only the authorized allowlisted normal-delivery canary.
7. Enable only approved transactional event types and exact recipient allowlists. Campaigns, imported-contact sends, broadcasts, and reminders remain off until separately authorized.

If email configuration is missing or canary fails, keep email disabled, preserve any operator-owned private fallback permitted above, and continue every other lane.

# Phase 6 — WhatsApp lead assistant and subscriber boundary

1. Discover protected WAPI/WhatsApp configuration, webhook secret, and allowlisted canary destination without printing them.
2. Verify signed inbound webhook, update deduplication, rate limiting, redacted logs, opt-out, channel consent, suppression, and kill switch.
3. Run at most one fixed harmless outbound canary and one controlled inbound exchange with the configured operator-owned number.
4. Anonymous/non-subscriber users may use only public lead capture and general signup help. They may not create subscriber technical tickets or access CRM/private/account actions.
5. Verified subscribers may open appropriately scoped support tickets after entitlement and identity checks.
6. Prove natural bounded conversation, explicit human escalation, and no invented class/payment/account facts.
7. Enable only if the canary and queue audit pass; otherwise keep provider-off/hidden and continue.

# Phase 7 — One Time to BNA subscriber support

1. Use the strict versioned support contract already converged. Never weaken strict v1; use the accepted v2 endpoint/schema when present.
2. Verify HMAC, timestamp/replay window, event-ID idempotency, product/account scope, subscriber entitlement, minimal payload, redaction, and receipt/status round trip.
3. Run synthetic staging proof first.
4. If the exact current BNA receiver/key and controlled entitled identity are available, create at most one production canary ticket labeled `W13-102 CANARY — DO NOT ACTION`.
5. Prove anonymous/non-subscriber rejection.
6. Telegram notification is separately gated; its absence must not prevent safe ticket persistence.
7. If BNA readiness is not provable, leave the bridge disabled and continue.

# Phase 8 — Remaining bounded provider canaries

Run sequentially. Missing credentials block only that provider. Never print secrets or private provider links.

1. **Stripe TEST only:** one test Checkout Session, signed webhook projection/reconciliation, $67/month and three-seat contract, every object `livemode=false`, zero live charges.
2. **Zoom:** one private canary meeting/occurrence, at most two protected registrants, secure learner launch/SDK role/attendance proof, cleanup after test.
3. **Vimeo/content:** one owned private item; prove metadata/playback/transcript/content/knowledge-base pipeline. Upload at most one only when the existing protected upload-canary flag is explicitly enabled.
4. **Telegram:** verify mapped administrator and Rabbi identities; allow safe status/read commands and at most one confirmed harmless write to an operator-owned allowlisted chat. No deploy, export, payment, provider-config, secret, or destructive commands.
5. **OpenAI/student helper:** one approved Rabbi content item, at most three grounded questions, source/role/learner boundaries, no unrelated or private-data answers.
6. **Buffer:** read-only account/destination proof. Create one unpublished draft only if the API genuinely supports a draft. Never schedule or publish.

After each canary record mode, environment, budget, exact runtime, result, idempotent readback, cleanup/disable state, queue diff, and external effects. Enable only a lane whose staging/production canary, allowlist, suppression, and kill switch pass.

# Phase 9 — Staging and production deployment of W13-102 changes

If W13-102 changes runtime source, migrations, dependencies, or deployment configuration:

1. commit/push a coherent candidate to PR #91 and obtain all applicable green checks;
2. run database verification against disposable/current staging PostgreSQL;
3. deploy the exact candidate to staging with all external transports off;
4. run full role/product acceptance plus rollback and roll-forward;
5. take and validate a fresh production native backup;
6. audit queues/outboxes again;
7. deploy the exact staging-proven source/artifact to production;
8. apply only additive migrations and verify the ledger;
9. smoke health/readiness/version, landing/signup/auth, administrator CRM, parent/student portals, classes/content/gamification/support, worker and database;
10. enable only provider lanes that passed their bounded production canaries; leave every other lane off.

If no runtime code/config/migration changed, do not redeploy merely to produce evidence. Record configuration/canary changes against the existing runtime and prove the resulting mode readback.

Roll back immediately on migration/database failure, signup/auth failure, role isolation breach, worker runaway, unbounded queue eligibility, or critical journey regression. Do not roll back the healthy core merely because an optional provider fails.

# Phase 10 — Governance and handoff

1. Track `RUNTIME_SOURCE_SHA` separately from later evidence-only `EVIDENCE_HEAD_SHA`.
2. Update PR #91 body and W13 records to remove stale pre-deployment statements.
3. Obtain protected checks on runtime changes.
4. When production and tests are green, make PR #91 ready and merge normally into its existing integration base. Then use one explicit canonical release PR to the actual default branch; verify ancestry/tree equality and never force-push or bypass protection.
5. Tag the exact production runtime source with a W13-102 release tag if runtime changed; otherwise preserve the W13-101 runtime tag and add only an operational evidence tag when policy permits.
6. Create a protected private handoff with login URLs, delivery IDs, recovery instructions, exact role status, and provider setup locations. Never include passwords, raw activation/reset links, TOTP seeds, tokens, or secrets in committed evidence or final chat output.
7. Leave production with every enabled provider's kill switch documented and tested.

## Terminal statuses

- `READY_FOR_CONTROLLED_DAY_ONE_OPERATIONS`: administrator/parent/student access works, the accepted real CRM import is applied and verified, required transactional email works, production journeys are green, and all configured enabled providers passed bounded canaries.
- `CORE_LIVE_IDENTITY_ACTIVE_OPTIONAL_LANES_PENDING`: live core and usable operator login are green, while one or more optional provider/import lanes remain safely off.
- `CORE_LIVE_IDENTITY_ACTIVE_CRM_PENDING`: live core and role access are green, but the accepted real CRM import could not yet be safely applied.
- `CORE_LIVE_IDENTITY_HANDOFF_BLOCKED`: core remains healthy but no safe administrator login handoff could be completed.
- `BLOCKED_CRITICAL_DATA_INTEGRITY`: use only for a verified critical database/privacy/auth/role-isolation issue requiring halt or rollback.

Do not call the whole run blocked merely because Buffer, BNA, WhatsApp, Telegram, Zoom, Vimeo, Stripe TEST, OpenAI, or the CRM source manifest is unavailable.

## Required final response

Begin with exactly one terminal status. Then report:

- production and staging URLs;
- PR, branch, `RUNTIME_SOURCE_SHA`, `EVIDENCE_HEAD_SHA`, release tag, and deploy IDs;
- health/readiness/version and migration/backup/restore/rollback results;
- activation/reset delivery status and usable login URL;
- administrator, owner, parent, and student acceptance separately;
- authenticated CRM/card/filter/detail/communications result;
- CRM source manifest status and sanitized create/update/duplicate/quarantine/tag totals;
- each provider's exact mode, canary result, budget consumed, kill switch, and remaining human input;
- exact external-effect counts;
- all tests actually run;
- private handoff path;
- committed `FINAL-REPORT.md` and `RESUME.md` paths.

Do not end with “the next step is to activate/login/import/deploy” when the required gates are green. Perform the authorized work and return the working handoff.
