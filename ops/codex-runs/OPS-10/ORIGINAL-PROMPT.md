# OPS-10 — One Time full staged production launch, login activation, and verified handoff

## Mission

Finish, verify, stage, and launch the current One Time application.

- Repository: `webcraft-media/onetimev2`
- Production: `https://join.onetimeonetime.com`
- Existing staging: `https://ot99-web-staging.up.railway.app`

Production was live-audited on 2026-07-17 at full reported SHA `050170d3ce5e9d0ea8e0db5ca0fa96b369bff0b5` and does not expose the new login lifecycle. Independently verify the live SHA and capture the current Railway deployment IDs. The old SHA is not known to exist in this GitHub repository, so rollback must be deployment-ID/artifact based rather than assuming that commit can be rebuilt.

The live result must include the newest coherent, verified implementation of:

- `/login`, `/forgot-password`, `/activate`, and `/reset-password`;
- owner/administrator dashboard and fast CRM/lead capture;
- parent and student portals, classes, and role isolation;
- Content workspace and every completed provider/runtime capability that is safely reachable;
- the approved premium landing-page corrections.

A successful run sends one real production activation/reset email to the protected approved operator destination, permits password setup and login without an authenticator app, prepares a separate parent test experience when an approved destination exists, and promotes the exact staging-tested artifact to the existing production services.

This is an implementation, convergence, repair, staging, and authorized production-deployment task. It is not an audit-only task.

## Authorization boundary

Authorized:

- use a fresh clean external worktree or clone;
- create a unique release branch;
- discover and semantically integrate completed remote branches/PRs;
- repair conflicts, migrations, tests, routes, runtime wiring, UI, deployment configuration, and task-owned CI;
- commit, push, open/update a release PR, and follow normal protected-branch merge rules;
- deploy one immutable exact-SHA artifact to isolated staging;
- create and restore-verify a production backup;
- promote that exact artifact to the existing production web and worker services;
- apply additive, verified, forward-compatible production migrations;
- send at most one deduplicated owner activation/reset email;
- send at most one separate parent-test activation when a protected approved destination exists;
- repair the erroneous Stripe TEST webhook only after proving the real mounted route;
- run the bounded provider canaries below;
- automatically roll back web/worker if critical production acceptance fails.

Not authorized:

- DNS/custom-domain changes or moving the join/root domains;
- live Stripe charges, refunds, payouts, or live-mode catalog/webhook changes;
- broad email/WhatsApp campaigns or production contact imports;
- live Buffer publication;
- public Zoom class mutation;
- destructive schema/data operations;
- copying BNA product code into One Time;
- force-push/history rewrite, discarding dirty work, or bypassing branch protection/CI;
- printing, committing, or pasting credentials, passwords, tokens, signing secrets, database URLs, private addresses, private phone numbers, or private activation/reset URLs.

“Deploy everything” means deploy all verified application code. A provider whose protected configuration or bounded canary is unavailable must remain explicitly disabled and must not block core login, signup, CRM, Content, or portal launch.

## Self-healing execution doctrine

Do not stop in preflight merely because:

- no hardcoded accepted SHA was supplied;
- a report/control registry is stale;
- the current local checkout is BNA or dirty;
- an optional branch/provider/secret is absent;
- an earlier PR is draft, old-based, or conflicted;
- repository-wide formatting drift exists outside task-owned changes;
- a previous readiness label says partial.

Instead, discover actual remote/deployed state, work in a fresh One Time worktree, inspect code and evidence, repair task-owned defects, keep unavailable optional providers off, and push resumable checkpoints.

Only these conditions may prevent production promotion:

1. existing production service/database identity or deployment authority cannot be verified;
2. a verified production backup plus application rollback path cannot be established;
3. critical authentication, authorization, isolation, data-integrity, migration, signup, or CRM acceptance remains broken after repair attempts;
4. the candidate cannot pass required build and core launch tests.

If one occurs, still complete all independent implementation and staging work, push the checkpoint, and report the exact blocker. Never ask the operator to retrieve old prompts or reports; GitHub, Railway, deployed endpoints, code, migrations, and current evidence are the source of truth.

## Phase 0 — Preserve and checkpoint immediately

Create a fresh external worktree/clone and unique branch named like:

`release/ops10-full-staged-production-launch-YYYYMMDDTHHMMSSZ`

Immediately create, commit, and push:

- `ops/codex-runs/OPS-10/ORIGINAL-PROMPT.md`
- `ops/codex-runs/OPS-10/STATE.json`
- `ops/codex-runs/OPS-10/RESUME.md`

`STATE.json` must always record current phase, repo, branch/HEAD, selected inputs/candidate, completed actions, next safe action, blockers, staging/production mutation ledger, and timestamp. Update, commit, and push it after every major phase and at least every 20 minutes. Another Codex window must be able to resume solely from repository evidence. Never store secrets.

## Phase 1 — Discover and freeze the real release graph

Fetch all remote refs and current PR/check metadata. Inspect actual code, migrations, reports, checkpoints, ancestry, and CI—not branch names alone.

Known starting evidence, not immutable prerequisites:

- newest known overnight integration: PR #60, `integration/ops08-overnight-final-20260716T230543Z`, known head `4e907992d8c7312a02e75dc879a5b5030f2b5942`;
- no-authenticator login base: PR #53, `codex/ops03b-email-step-up-login`, known head `25b2a95aa4e3ae82aad20537dc300e9978c15b56`.
- newest known green functional fallback: PR #54 at `5cc3849c2d0d6909bed038a8e9e8ef666ed5003e`. It contains login, Vimeo, Telegram admin, Content, activation controls, earlier student helper, Buffer, and publisher work, but lacks several later capabilities. Preserve it as a fallback, not the preferred launch source.

Known PR #60 defects to repair immediately on the release branch:

- Prettier failures in exactly `ops/codex-runs/OPS-05/PROVIDER-MATRIX.json`, `ops/codex-runs/OPS-05/WEBHOOK-ENDPOINTS.json`, and `ops/codex-runs/OPS-09A/FLEET-REPORT.md` at the audited head;
- an OPS-06 load-drill cleanup race in `scripts/ops06-load-backpressure.ts`, where the PostgreSQL pool can emit unhandled `57P01` after the temporary database is terminated. Fix orderly cleanup/await/pool error handling without weakening the test;
- current student-helper and CRM/communications/support branches were not integrated because of shared-hotspot conflicts; reconcile their complete behavior semantically or truthfully defer only optional portions;
- BNA support input was absent; keep BNA support fail-closed and nonblocking unless the separate receiver is ready.

Refetch and prefer a newer valid descendant or replacement. Do not reset newer work to these SHAs.

Discover:

- default/canonical/release branches;
- live and staging `/version`, `/health`, `/ready`;
- exact Railway project/environment/service/deployment identities for current staging and production web/worker/DB/volumes;
- full current production and staging SHAs;
- all completed current descendants/replacements for login, premium landing/product system, CRM/communications/support, portals/classroom, Content/Vimeo/transcripts/knowledge/worksheets, Buffer, Telegram admin, WhatsApp lead, Zoom, student helper, Stripe TEST, provider controls/webhooks, reliability/observability, and journey gates;
- incomplete/conflicting work in PRs analogous to the known portal/helper and CRM/communications branches, integrating complete behavior rather than status labels.

Write and commit:

- `INPUTS.json`
- `CAPABILITY-MATRIX.json`
- `CONFLICT-LEDGER.md`

For each capability record exact selected SHA, evidence, runtime reachability, tests, migration ownership, and disposition: integrated, superseded, safely deferred, or provider-disabled. Use ancestry and patch equivalence to avoid double-merging. Refetch once, then freeze inputs before convergence.

## Phase 2 — Build one coherent release candidate

Choose the newest integration ancestor containing the working login lifecycle. Semantically integrate the newest complete implementations in this order:

1. email activation/password/reset/login without mandatory authenticator;
2. landing, signup, lead/contact/audit/outbox flow;
3. authenticated shell and role-aware navigation;
4. CRM, communications, subscriber support, and legacy activation controls;
5. parent/student portals and classroom;
6. Content workspace, Vimeo, transcript, knowledge, worksheets, email/social drafts, Buffer, prompt version/patch/test/approve/rollback;
7. Telegram admin, WhatsApp lead, Zoom, student helper, Stripe TEST;
8. provider webhook/control corrections;
9. worker queues, retry/dead-letter, observability, and recovery;
10. premium responsive/accessibility/performance/journey gates.

Resolve shared hotspots exactly once: app route mounting, auth/session middleware, config schema, worker dispatch, provider registry, navigation, capability checks, audit events, contracts, migrations/checksums, and shared test support.

Code existing on disk does not count unless reachable from the built runtime and authorized UI. Prove reachability. Renumber migration collisions atomically and update registries/checksums/tests/references. Never edit an already-applied migration.

## Phase 3 — Binding authentication policy

- No role is required to use an authenticator app.
- Do not show mandatory QR/TOTP/recovery-code enrollment.
- Existing TOTP storage may remain dormant; do not destructively remove it.
- Activation email → set password → rotate session → correct role home.
- Activation link counts as recent email verification.
- Owner/admin routine login works with email/password.
- A new/untrusted owner/admin browser may use an emailed link/code, never an authenticator app.
- Trusted-device period: 30 days.
- Parent uses email activation/password.
- Each student has a separate parent-created/reset credential linked to one learner; no sibling inference.
- Fresh email step-up is only for sensitive credential, role, provider, billing, export, bulk-send, Buffer-publish, session-revocation, and destructive actions.
- Routine dashboard, CRM, classes, Content, and navigation do not repeatedly challenge.
- If lifecycle email fails, valid routine sessions continue and sensitive actions fail closed.

Preserve/implement Argon2id; hashed expiring single-use tokens; limits/maximum attempts; non-enumerating recovery; CSRF; Secure/HttpOnly/SameSite cookies; session rotation/revocation; no-store private responses; audit events; and return-route validation.

Using only protected configuration:

- create owner/admin + one activation if absent;
- resend one deduplicated activation if unactivated;
- send one reset if activated but password unknown;
- never email a password.

If a protected parent-test destination exists, create a clearly tagged separate test household/parent and send one activation. Do not place operator and parent roles on one email under a single-role model. Otherwise create a fictional sink-only parent fixture and record only the missing variable name.

## Phase 4 — Product/UI acceptance repairs

Repair the integrated UI as one consistent premium product before deployment.

Landing invariants:

- keep the moving top banner with Join now, free-until-Rosh-Hashanah language, and approved countdown;
- remove the unwanted hero pricing paragraph and `$67/month afterward / No card today` line;
- show the mobile Sign Up Now CTA without scrolling at 360×800 and 390×844;
- larger borderless One Time logo;
- Member Login routes to `/login`;
- approved headline line breaks;
- yellow result-oriented bullet cards;
- no circle/text overlap or duplicate headphone-boy image;
- approved achievement/clarity imagery with intentional crop;
- centered, color Jewish-world carousel with concise place labels;
- consistent header, footer, typography, buttons, spacing, focus, and brand tokens.

Compatibility routes must remain valid so deployed bookmarks and old landing links do not break:

- `/rabbi-member` redirects to `/login`;
- `/one-time/signup` redirects to `/signup`.

Authenticated invariants:

- neutral session boot state—never falsely show Signed out/Session expired while loading;
- role-aware logo/home destination;
- normal contact names are legible, not faded;
- no debug keys, HTTP verbs, internal IDs, provider jargon, or placeholder/dead buttons;
- clear owner/admin access to dashboard, CRM, classes, Content, billing, communications, and support;
- Content shows Vimeo/video state, transcript, knowledge indexing, worksheets/review sheets, email/newsletter drafts, social/Buffer drafts, publishing state, and prompt patch/version/test/approve/rollback;
- separate parent/student identities with next class/content/progress/rewards, sibling isolation, and parent-managed access;
- no cross-role data, overflow, clipped controls/text, duplicate categories/headings, or endless skeletons;
- intentional loading/empty/error/offline/expired states;
- route bundles remain isolated/lazy.

Test 360×800, 390×844, 768×1024, 1440×1000, 200% zoom, keyboard-only, reduced motion, and RTL-safe layout. Capture screenshots only after usable state.

## Phase 5 — PostgreSQL 16, backup, migrations, rollback

On disposable PostgreSQL 16:

- apply all migrations from zero and verify ledger/checksums;
- seed fictional representative data;
- test concurrency, constraints, role isolation, CRM volume/query plans, and no secret/PII output.

Before production mutation:

- identify exact production DB/volume and backup/PITR state;
- create a timestamped native `pg_dump -Fc` backup without exposing contents;
- restore into a disposable isolated database;
- verify migration ledger, schema, representative counts/hashes, and critical constraints;
- record current production web/worker/DB/volume rollback identities.

Never promote or clone fictional staging rows into production. If the current production database is verified as the canonical real One Time database, migrate it in place only after backup/restore proof. If it is legacy, ambiguous, incompatible, or not PostgreSQL 16, provision a clean isolated production PostgreSQL 16 database and apply the verified schema only; do not import contacts or users without separate authorization. Record which path was selected and why.

Migrations must be additive/expand-first, lock/statement-time bounded, transactional where supported, and compatible with the previous app during rollback. Split destructive cleanup into a later task.

Create `MIGRATION-PLAN.md`, `BACKUP-RESTORE.md`, and `ROLLBACK.md`. Rehearse application/worker rollback on staging. Database restore is last-resort unless corruption is proven.

## Phase 6 — Complete verification and repair

Run and repair locked install, secret/private-data scan, lint, touched and repo format checks, typecheck, unit, integration, e2e, accessibility, performance, build/bundle budgets, PostgreSQL proof, dependency checks, and route × role × viewport × state visual acceptance.

Baseline formatting drift outside owned files is documented, not a reason to stop; all owned files must pass.

Core proof must include:

- signup creates one deduplicated contact/lead/audit/outbox chain;
- auth routes render UI and never `Cannot GET`;
- activation/recovery/reset/login work end-to-end without mandatory TOTP;
- owner/admin, parent, student routing/isolation;
- CRM list/detail/create/edit/tags/notes/tasks/read-only communications;
- fast safe in-memory CRM return;
- real responsive Content routes;
- worker heartbeat, queue lag, retry/dead-letter, graceful shutdown;
- provider failure cannot break core app;
- no unexplained console/page/API errors.

Throttled mobile p75 budgets:

- public LCP ≤ 2.5 seconds;
- CLS ≤ 0.10;
- CRM list usable ≤ 3.5 seconds cold / 1.5 seconds warm;
- CRM detail usable ≤ 3.5 seconds cold;
- warm return ≤ 1.0 second;
- route changes do not load unrelated provider/admin bundles.

Rerun a documented sample set for transient shared-infrastructure variance; never hide persistent regression.

## Phase 7 — Immutable staging deployment

Build one immutable release artifact/image, recording source SHA and artifact digest. Staging and production must promote the same artifact without rebuilding different bits.

Deploy it to existing isolated staging, apply migrations exactly once, and prove:

- `/version` exact candidate SHA;
- `/health` healthy and `/ready` ready;
- staging metadata uses the staging host and `noindex,nofollow`;
- worker/queues healthy;
- public/auth/app/portal routes work;
- lifecycle email path works;
- no mandatory TOTP;
- role isolation and visual/mobile acceptance;
- logs contain no secrets/PII.

No untraceable source-changing deployment workaround is allowed.

## Phase 8 — Bounded providers; optional failures do not block core

If protected config/allowlist exists, run at most:

- Email: one owner activation/reset and one separate parent-test activation.
- WhatsApp: one consented allowlisted test destination.
- Telegram: one mapped operator status, one fictional lookup, one reversible task.
- Zoom: sink/test fixture and protected access/reminder proof, no customer class mutation.
- Vimeo: private/read-only or minimal approved fixture ingest.
- Buffer: profile discovery and draft/schedule validation, no live publication.
- Student helper: one fictional knowledge query.
- BNA support: one fictional signed round-trip only if separate receiver is ready.
- Stripe: TEST mode only.

If configuration is missing, record variable names only and leave provider disabled.

### Stripe TEST webhook repair

The obsolete test endpoint is HTTP site root and returns 301. Repair it by:

1. discovering the exact mounted webhook POST route from integrated server code;
2. proving raw-body handling before JSON parsing, Stripe signature/timestamp/replay/idempotency, and fast 2xx;
3. staging with Stripe TEST mode;
4. deploying production core first;
5. verifying the known expected mounted path `/api/v1/billing/webhooks/provider`, then creating/updating exact HTTPS production TEST endpoint `https://join.onetimeonetime.com/api/v1/billing/webhooks/provider`; if current integrated code differs, stop only the Stripe canary and repair/reconcile code rather than guessing;
6. storing the new signing secret in protected production config without printing it;
7. sending bounded TEST events and proving 2xx plus duplicate safety;
8. only then disabling/removing the obsolete TEST-mode HTTP-root endpoint.

Do not touch live-mode Stripe webhooks or perform a charge.

Write `PROVIDER-CANARIES.json` with separate code/runtime, sink/test, staging, production bounded-canary, and availability states.

## Phase 9 — Authorized production promotion

Production promotion requires all critical core gates green; optional providers may remain disabled.

Immediately before promotion:

- refetch and verify candidate has not moved;
- prove staging still runs that exact SHA/digest;
- record current production full SHA/deployment IDs;
- verify native backup/restore and rollback;
- verify the existing custom domain already targets the intended production service; do not change DNS.

Follow normal GitHub review/merge policy without bypassing protection. Promote the exact staging-tested artifact—do not rebuild different bits. Apply verified forward migrations once, then deploy worker/web in migration-compatible order.

Verify production:

- `/`, `/login`, `/forgot-password`;
- safe invalid-token `/activate` and `/reset-password` states;
- `/version`, `/health`, `/ready`;
- signup → CRM;
- operator activation/login and parent test login when configured;
- role protection and worker/queue health;
- production canonical metadata, public indexing and private noindex;
- production canonical root is `https://join.onetimeonetime.com/`, not the legacy `/one-time` canonical;
- Member Login target, HTTPS, secure cookies;
- no reliance on the old 301 webhook target.

Only after production auth routes pass, send the single production owner activation/reset. It must use a one-time HTTPS production link, never a staging link or password.

Observe production for at least 15 minutes with bounded periodic checks: health/readiness, errors, auth failures, signup, DB locks/saturation, worker heartbeat, queue/dead letters, provider errors, and unexpected external sends.

If critical core acceptance fails or severe errors persist, automatically roll web/worker back to the recorded prior deployments and reverify. Prefer app rollback because migrations are forward-compatible. Do not restore DB unless corruption is established.

## Phase 10 — Final durable handoff

Persist and push:

- `ORIGINAL-PROMPT.md`, `STATE.json`, `RESUME.md`;
- `INPUTS.json`, `CAPABILITY-MATRIX.json`, `CONFLICT-LEDGER.md`, `DECISIONS.md`;
- `MIGRATION-PLAN.md`, `BACKUP-RESTORE.md`, `ROLLBACK.md`;
- `PROVIDER-CANARIES.json`, `VISUAL-ACCEPTANCE.md`, `PERFORMANCE.json`;
- `MUTATION-LEDGER.json`, `FINAL-REPORT.md`.

Leave the worktree clean. Final report begins with exactly one:

- `LIVE_READY`
- `LIVE_PARTIAL_OPTIONAL_PROVIDERS_DISABLED`
- `STAGING_READY_PRODUCTION_BLOCKED`
- `NOT_READY`

Then report repo/branch/PR/canonical and release SHAs; staging/production exact SHAs and artifact digests; URLs; operator email outcome; parent-test outcome; confirmation no mandatory TOTP; migrations/backup; tests/a11y/performance/visual proof; capability states; Stripe TEST old/new endpoint disposition without secrets; rollback deployment IDs/procedure; optional disabled providers/missing variable names; all external mutations; and one next operator action.

Never print passwords, tokens, TOTP seeds, signing secrets, private addresses/phones, DB URLs, or private activation/reset URLs.

If successful, the sole next action must be:

> Open the activation/reset email, set your password, and log in at https://join.onetimeonetime.com/login.
