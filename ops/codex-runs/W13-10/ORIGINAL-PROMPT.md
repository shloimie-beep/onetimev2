# W13-10 — Complete Supplemental Launch Foundations

You are executing one additional One Time Codex lane that is intentionally designed to run simultaneously with the existing W13-01 through W13-09 feature/QA lanes. This prompt is complete and self-contained. Do not require a shared header, another prompt file, or chat memory.

## Exact repository, source, branch, and worktree

- Repository: `webcraft-media/onetimev2`
- Authoritative base PR: `https://github.com/webcraft-media/onetimev2/pull/73`
- Authoritative base branch: `integration/w12-final-convergence-20260717T123715Z`
- Authoritative exact base SHA: `0d8d7168f066668f035176d777bdaaa4dcc5accd`
- Task ID: `W13-10`
- Branch: `codex/w13-10-complete-launch-foundations`
- Use a new clean isolated worktree, suggested Windows path:
  `C:\Users\User\OneTimeOneTime-w13-10-launch-foundations`
- Draft PR target: `integration/w12-final-convergence-20260717T123715Z`

Before changing anything:

1. Run `git status --short --branch` and refuse to work in a dirty or ambiguous checkout.
2. Run `git fetch --all --prune`.
3. Verify that commit `0d8d7168f066668f035176d777bdaaa4dcc5accd` exists and is the expected PR #73 head. If PR #73 has moved, record the current head and compare ancestry, but still branch from the exact SHA above unless a later accepted repository decision explicitly supersedes it. Do not substitute `main`, PR #61, production HEAD, PR #71, PR #72, or any individual feature branch.
4. If the exact SHA is not available through normal refs, fetch PR #73 directly. Stop only if the exact authoritative commit cannot be obtained safely.
5. Search for current `w13` branches and PRs. Their absence is not a blocker. Their presence must be recorded with exact heads, but this lane must not merge them.
6. Refresh PR #72 and PR #71. Expected historical pins are:
   - OPS-13A PR #72: `d4f58801ebbb5fe8a41ef33621c7594f0ff6b2b4`
   - W12-09 PR #71: `fc075bb688c69d8a03681633df8e6ea32ff685a9`
   If either has moved, record the new exact head. Do not cherry-pick either PR in this lane.

## Required first reads

Read these before editing:

1. `AGENTS.md`
2. `package.json`
3. `.env.example`
4. `ops/director/START-HERE.md`
5. `ops/director/CURRENT-STATE.json`
6. `ops/director/CAPABILITY-MATRIX.json`
7. `ops/director/DEPLOYMENTS.json`
8. `ops/director/WORKSTREAMS.json`
9. `ops/director/BRANCH-FLEET.json`
10. `ops/director/PRODUCT-INVARIANTS.md`
11. `ops/director/DECISION-REGISTER.md`
12. `ops/codex-runs/W12-99/FINAL-REPORT.md`
13. `ops/codex-runs/W12-99/STATE.json`
14. `ops/codex-runs/W12-99/CAPABILITY-MATRIX.json`
15. `ops/codex-runs/W12-99/CANARY-REPORT.json`
16. `ops/codex-runs/W12-99/IMPORT-PREVIEW.json`
17. `ops/codex-runs/W12-99/ROLLBACK.md`
18. Existing delivery, auth-email, lifecycle-email, config, migration, public-page, readiness, worker, and workflow code relevant to this task.

If a `W13-NEXT-PARALLEL-WAVE*.zip` packet is locally available, you may validate its path safety and checksums and read its W13 prompts to improve the collision map. The packet is optional; this prompt contains all binding instructions and must remain executable without it.

## Parallel-lane ownership and collision contract

This lane fills cross-cutting foundations omitted or under-specified by the existing W13 feature wave. It must not become a competing CRM, portal, classroom, content, messaging, billing, gamification, or BNA feature branch.

This lane may own and modify:

- `ops/director/**`
- `ops/codex-runs/W13-10/**`
- existing shared delivery-platform files under:
  - `apps/worker/src/delivery/**`
  - `packages/contracts/src/delivery/**`
  - `packages/domain/src/delivery/**`
- narrowly required shared configuration in:
  - `packages/config/src/index.ts`
  - `.env.example`
- versioned public legal/consent content and its focused rendering/tests, preferably under:
  - `packages/domain/src/legal/**`
  - narrowly required landing/public-page content files
  - `scripts/build-public-pages.ts`
- new W13-10-only scripts, tests, fixtures, and runbooks under:
  - `scripts/w13-10/**`
  - `tests/unit/w13-10/**`
  - `tests/integration/w13-10/**`
  - `tests/e2e/w13-10/**`
  - `tests/accessibility/w13-10/**`
  - `ops/runbooks/w13-10/**`

Treat these as shared hotspots and avoid editing them unless strictly necessary:

- `apps/web/src/server/app.ts`
- `packages/domain/src/index.ts`
- `packages/contracts/src/index.ts`
- `apps/web/src/client/features/portals/PortalFeatures.tsx`
- CRM/contact UI files
- classroom/content/billing/provider feature modules
- `ops/day-one/visible-action-registry.json`
- package lockfiles
- existing checked migrations
- CI workflows

When a required integration belongs in one of those hotspots, prefer a tested export, adapter, contract, or exact convergence instruction over an unrelated broad edit. Record every unavoidable overlap in `COLLISIONS.json` with the expected owner lane and semantic resolution.

Use this ownership split when building the lane matrix:

- W13-01: gamification implementation only; final inclusion remains decision-gated.
- W13-02: source inventory, import reconciliation, provenance, dedupe, quarantine, and import rehearsal.
- W13-07: CRM/contact and communications presentation/interaction; it must consume canonical W13-02 data contracts rather than create a second import model.
- W13-03: identity lifecycle and parent/student portal identity boundaries.
- W13-05: class occurrence and learner class-access contracts; it must consume entitlement truth rather than invent billing truth.
- W13-08: billing and entitlement truth; price and seat values remain decision-gated unless accepted evidence exists.
- W13-04: content, approved knowledge, helper grounding, Vimeo, and Buffer provider-off behavior.
- W13-06: Telegram, WhatsApp, and One Time support-v2 producer behavior; BNA remains a separate repository.
- W13-09: independent QA evidence and test harnesses, not broad feature redesign.
- W13-10: canonical governance, shared delivery activation policy, public legal/consent truth, migration assurance, security assurance, SRE tooling, and supply-chain evidence.

## Non-negotiable safety and privacy rules

- Do not deploy staging or production.
- Do not call Railway, Resend, Meta/WhatsApp, Telegram, Stripe, Zoom, Vimeo, Buffer, OpenAI, BNA, DNS, or any other provider in a mutating mode.
- Do not connect to or read private rows from the production database.
- Do not import real contacts or process real spreadsheet rows in this lane.
- Do not send email, WhatsApp, Telegram, webhooks, support events, payments, Zoom invitations, posts, or helper queries to an external provider.
- Do not create, update, delete, publish, upload, schedule, or mutate provider resources.
- Never print, copy, screenshot, serialize, or commit secrets, database URLs, tokens, passwords, private destinations, private links, source rows, raw message bodies, webhook payloads, student-sensitive data, or customer identifiers.
- Use hashes, counts, booleans, statuses, opaque identifiers, synthetic fixtures, and redacted summaries.
- Do not copy BNA code, sessions, cookies, workspace keys, provider runtime, or data into One Time.
- Do not mass-format unrelated files and do not run broad `prettier --write .`.
- Do not weaken a test, authorization check, migration safety check, signature check, or privacy assertion merely to obtain green output.
- Git branch creation, commits, push, and a draft PR are the only permitted external mutations. Read-only repository/package metadata checks are allowed when they do not expose secrets or private data.
- Do not merge PRs, mark PRs ready, modify repository settings, change branch protection, or rewrite history.
- Do not perform live penetration testing, port scanning, credential testing, or traffic generation against production or provider systems.

## Durable execution records

At the first safe write, create:

- `ops/codex-runs/W13-10/ORIGINAL-PROMPT.md` — this exact prompt.
- `ops/codex-runs/W13-10/STATE.json`
- `ops/codex-runs/W13-10/RESUME.md`
- `ops/codex-runs/W13-10/COLLISIONS.json`
- `ops/codex-runs/W13-10/CHANGED-FILES.txt`
- `ops/codex-runs/W13-10/FINAL-REPORT.md`

`STATE.json` must include repository, exact base, branch, worktree, current phase, completed objectives, test results, blockers, external effects, production mutations, and next action. Classify each objective only as:

- `done`
- `already_satisfied`
- `blocked`
- `needs_operator_decision`

Update `STATE.json` after every material phase, before long-running tests, before any possible external command, and before exit. If an optional tool such as Docker, PostgreSQL 16, PostgreSQL 18, or a package-audit service is unavailable, block only that sub-phase, complete the harness and independent work, commit a reusable checkpoint, and write exact resume instructions. Do not return only a preflight report.

# Phase 1 — Canonical state, decision governance, and release authorization

## 1A. Refresh canonical director truth

Update the canonical director records so they truthfully distinguish:

- current default-branch state;
- current production runtime/source/version;
- W12-99 exact source `0d8d7168f066668f035176d777bdaaa4dcc5accd`;
- PR #73 state and checks;
- OPS-13A PR #72 as planning evidence, not W12-99 ancestry and not acceptance proof;
- W12-09 PR #71 as an optional source branch that was explicitly excluded from W12-99;
- W13 planned/running branches discovered dynamically;
- no exact W12-99 staging deployment yet unless new verified evidence now exists;
- no real import, broad send, live Stripe charge, production provider activation, or production W13 mutation;
- BNA as a separate convergence and deployment train.

Repair stale statements such as “do not run W12-99” or placeholder candidate heads when exact immutable values are now known. Do not overwrite production runtime truth with a repository candidate SHA.

## 1B. Create explicit product and authorization gates

Create `ops/codex-runs/W13-10/PRODUCT-DECISION-GATES.json`. For each item record status, evidence, accepted value if any, decision owner, dependent lanes, and safe default:

1. Include or defer W12-09 gamification.
2. Family subscription price, including whether `$67/month` is accepted, proposed, superseded, or unproven.
3. Family learner-seat limit, including whether three seats is accepted, proposed, superseded, or unproven.
4. Production deployment authorization for one exact candidate SHA/image.
5. Production real-audience import authorization for one exact manifest hash and count set.
6. Production provider activation authorization, separately for email, WhatsApp, Telegram, Zoom, Vimeo, helper/OpenAI, Buffer, Stripe live mode, and BNA support bridge.
7. Public legal/privacy/terms approval.
8. Data-retention, deletion/export, and guardian/minor policy decisions.

Do not infer acceptance from repeated wording in a feature prompt, from a branch existing, from tests being green, or from the general desire to launch. When no accepted repository evidence exists, use `needs_operator_decision` and the safest provider-off/non-import/non-billing default.

## 1C. Create lane ownership and convergence rules

Create `ops/codex-runs/W13-10/LANE-OWNERSHIP-MATRIX.json` with exact primary owner, allowed shared interfaces, forbidden duplicate models, expected hotspots, and convergence order for W13-01 through W13-10.

Create `ops/codex-runs/W13-10/RELEASE-AUTHORIZATION-MODEL.md` that makes these separate gates:

1. code integration authorization;
2. isolated staging deployment authorization;
3. bounded staging provider-canary authorization per provider;
4. production deployment authorization for an exact immutable build;
5. production data-import authorization for an exact manifest;
6. production provider activation authorization per provider and budget;
7. broad campaign/publication authorization, which remains out of scope.

A staging canary must never be described as production activation approval. A successful code test must never be described as external-provider acceptance.

Create three self-contained replacement prompts under `ops/codex-runs/W13-10/`:

- `W13-90-REPLACEMENT-PROMPT.md`
- `OPS-13B-R-REPLACEMENT-PROMPT.md`
- `W13-99-REPLACEMENT-PROMPT.md`

Each replacement prompt must contain its complete repository/source/safety/test/publication instructions inline and must not depend on a shared header. The W13-99 replacement must not claim that production CRM import is already authorized. It must stop only the affected production sub-lane when deployment, import, or provider authorization is absent.

# Phase 2 — Shared delivery-platform foundation, externally disabled

Audit the known starting condition on the exact base:

- the general delivery worker is expected to be sink-only and fail closed on provider activation;
- account-lifecycle and authentication email paths may have separate canary/provider logic;
- provider-specific W13 lanes may otherwise create incompatible activation gates.

Verify those facts from source before changing anything.

Implement or extend one canonical provider-activation and dispatch policy using the existing delivery architecture rather than creating a near-duplicate system.

Required properties:

1. Sink/provider-off remains the default in every environment.
2. Add an explicit runtime environment classification such as `local`, `test`, `isolated_staging`, and `production`; do not rely on `NODE_ENV` alone to authorize external effects.
3. Every provider invocation path must require all applicable gates:
   - exact provider identifier;
   - explicit provider mode;
   - exact environment gate;
   - isolated-staging proof for staging canaries;
   - provider-specific authorization flag;
   - allowlisted destination/resource or opaque protected reference;
   - bounded per-run and per-provider budget;
   - idempotency key;
   - consent and suppression eligibility for communication channels;
   - timeout and lease safety;
   - redacted audit context.
4. Production mode must remain fail-closed without a separate exact authorization artifact. Do not enable production provider delivery in this lane.
5. A failed provider call must not silently fall back to a successful sink receipt.
6. Unsupported channels and incomplete configuration must return typed blocked/unavailable results before provider invocation.
7. Provider destinations, payloads, receipts, and errors must be redacted in logs and evidence.
8. Retries must preserve idempotency and must not duplicate a provider action.
9. Budget exhaustion must prevent additional calls before the provider adapter is invoked.
10. Suppression, complaint, hard bounce, STOP, unsubscribe, and missing channel consent must prevent outbound eligibility.
11. Readiness output may report only presence/absence, mode, blocker codes, and budgets; never secret values or private targets.
12. Provide a deterministic in-memory/mock provider adapter and fake clock for tests.
13. Reconcile lifecycle email and authentication email with the shared activation policy where safe. If a full merge would create unsafe parallel conflicts, keep existing code functional and publish an exact tested integration contract for W13-90.
14. A real Resend adapter may remain behind the interface only if it is impossible to invoke under this lane’s environment and tests. Do not call Resend.
15. Do not implement WhatsApp, Telegram, Stripe, Zoom, Vimeo, Buffer, or OpenAI feature behavior here; define the shared authorization/budget/redaction contract those lanes must consume.

Create:

- `ops/codex-runs/W13-10/DELIVERY-PLATFORM-CONTRACT.md`
- `ops/codex-runs/W13-10/PROVIDER-ACTIVATION-MATRIX.json`
- `ops/codex-runs/W13-10/DELIVERY-INTEGRATION-INSTRUCTIONS.md`

Add focused tests proving default sink behavior, staging gate enforcement, production rejection, allowlist enforcement, budget exhaustion, idempotency, suppression, typed blockers, timeout/lease safety, redacted logging, and zero adapter calls when any gate is missing.

# Phase 3 — Public legal truth, consent, privacy operations, and SEO

The current public privacy/terms pages and signup consent must be audited against actual system capabilities. Build counsel-review-ready, versioned content without inventing legal conclusions or compliance claims.

Required public content:

1. A versioned Privacy Notice.
2. Versioned Terms of Use.
3. A Communication and Reminder Consent notice.
4. A Parent/Guardian and Student Data notice.
5. Conditional billing/cancellation language that appears only when the accepted billing capability and product decision support it.
6. Policy version, effective-date, review status, and contact metadata without private values.

The privacy notice must truthfully cover the categories the system can process, including public signup, account/security, contact/CRM, household/guardian/learner, class/enrollment/attendance/progress, content/questions/helper, communications/support, provider events, billing/test billing, audit, rate-limit, and operational records. Do not publish internal secrets, detailed security architecture, or retention periods that have not been approved.

The terms must not falsely say that the system never grants accounts if owner/admin/parent/student accounts exist. It must not claim paid production checkout, broad messaging, live providers, or a specific price/seat limit unless accepted decision evidence exists.

Signup and communication consent must:

- separate required service communication from optional reminders/marketing;
- use channel-specific email and WhatsApp choices;
- avoid inferring opt-in from a preselected channel;
- avoid prechecked optional consent;
- record policy version, purpose, source, channel, timestamp, and withdrawal/suppression state;
- make STOP, unsubscribe, opt-out, and suppression behavior clear;
- avoid collecting student-sensitive information on the public form;
- preserve generic duplicate/existence responses.

Create an internal `DATA-LIFECYCLE-MATRIX.json` that lists category, source, purpose, authorized roles, storage boundary, retention decision status, deletion/export decision status, suppression behavior, and evidence path. Unknown retention or data-rights decisions must be `needs_operator_decision`, not guessed.

Audit cookies, browser storage, analytics, and third-party resources. If nonessential tracking is absent, record that fact based on code evidence. If present, document the exact consent implication without adding a banner unless the actual implementation requires it.

Preserve public/authenticated bundle separation, CSP, mobile behavior, no-JavaScript form truth, semantic headings, canonical metadata, robots behavior, accessible errors, keyboard use, 200% zoom, and privacy/terms links at every collection surface.

Do not redesign the W13-06 WhatsApp launcher. Produce a consent integration contract for that lane and edit only narrowly shared public consent surfaces.

Create:

- `ops/codex-runs/W13-10/LEGAL-CONTENT-STATUS.json`
- `ops/codex-runs/W13-10/DATA-LIFECYCLE-MATRIX.json`
- `ops/codex-runs/W13-10/CONSENT-CONTRACT.md`
- `ops/codex-runs/W13-10/COUNSEL-DECISIONS.md`

Add focused unit, browser, accessibility, and no-JavaScript tests.

# Phase 4 — PostgreSQL 16/18 migration, lock, restore, and rolling-compatibility assurance

Do not connect to production. Use disposable local/container databases only.

Rehearse the exact W12 transition from a schema ending at `2190_ot109_rabbi_content_publisher` through:

- `2200_w12_02_communication_history.sql`
- `2201_w12_01_crm_audience_import.sql`
- `2202_w12_05_telegram_operations.sql`

Required assurance on PostgreSQL 16 and PostgreSQL 18 where available:

1. Fresh database apply.
2. Upgrade from a realistic schema ending at migration 2190.
3. Checksum verification.
4. Repeated verification/idempotence behavior.
5. Transactional failure and partial-apply behavior.
6. Foreign-key and migration ordering.
7. Existing-row compatibility for the Telegram constraint replacement.
8. Communication-history uniqueness and nullable-key behavior.
9. Audience-import ledger constraints and the fact that real apply is not yet authorized by the W12 schema.
10. Lock acquisition, duration, and estimated blocking under representative synthetic row counts.
11. Web-old/worker-old against new schema and web-new/worker-new against old/pre-migration schema where rolling deployment requires compatibility.
12. Native backup and disposable restore clone.
13. Duplicate migration-prefix detection including concurrently planned W13 branches.
14. Forward-correction procedure when a post-merge defect is found.

Do not edit existing checked migrations merely to make the rehearsal pass. If a real defect exists, produce a reproducible failing test and `FORWARD-MIGRATION-REQUIREMENT.json` with exact semantic correction, affected versions, lock risk, and proposed order. Leave final migration numbering to W13-90 unless this lane is the only branch adding the correction and the next number is provably conflict-free.

Create:

- `ops/codex-runs/W13-10/MIGRATION-ASSURANCE.json`
- `ops/codex-runs/W13-10/LOCK-REPORT.json`
- `ops/codex-runs/W13-10/BACKUP-RESTORE-PROOF.md`
- `ops/codex-runs/W13-10/ROLLING-COMPATIBILITY.md`
- `ops/codex-runs/W13-10/STAGING-MIGRATION-RUNBOOK.md`

Record timings, schema hashes, migration names, row counts, lock classes, statuses, and redacted errors only.

# Phase 5 — Dedicated security, authentication, privacy-boundary, and abuse assurance

Create a threat model covering assets, actors, trust boundaries, attack paths, existing controls, residual risks, severity, evidence, and owner lane.

At minimum test or audit:

- server-derived account/product scope;
- owner/admin, parent, student, support, and anonymous object-level authorization;
- sibling and cross-household isolation;
- session creation, rotation, expiration, revocation, fixation resistance, and cache clearing;
- cookie flags and trusted-device binding/expiry;
- owner/admin assurance and MFA without leaking requirements to parents/students;
- CSRF on every state-changing browser route;
- safe `return_to` handling and open-redirect resistance;
- activation/reset/email-challenge expiry, replay, supersession, and security-version invalidation;
- login, signup, support, helper, and webhook rate limiting;
- SQL parameterization, mass assignment, pagination enumeration, and private search semantics;
- XSS, HTML escaping, CSP, clickjacking, MIME sniffing, and sensitive error bodies;
- SSRF and provider URL handling;
- webhook raw-body signature verification, timestamp/nonce/replay handling, payload limits, and dedupe;
- HMAC separation for support contracts;
- import hash enforcement, path traversal, archive safety, spreadsheet formula injection, and private-row logging;
- provider secret/config presence handling;
- encrypted payload key requirements and failure modes;
- browser storage, service workers, caches, screenshots, logs, metrics, and analytics for PII leakage;
- helper grounding and prompt-injection resistance using synthetic approved content only;
- minor/student privacy and avoidance of public ranking, shame, or cross-learner exposure;
- denial-of-service and queue/backpressure boundaries using local synthetic load only.

Do not attack live systems. Add adversarial automated tests. A narrow proven defect may be fixed only when the fix belongs to this lane’s shared foundation or public legal/consent ownership. Otherwise create exact owner-lane correction instructions with a failing test. Do not make speculative findings release blockers.

Create:

- `ops/codex-runs/W13-10/THREAT-MODEL.md`
- `ops/codex-runs/W13-10/SECURITY-PRIVACY-FINDINGS.json`
- `ops/codex-runs/W13-10/RELEASE-BLOCKERS.json`

Every finding needs severity, exploit preconditions, exact route/module, reproduction, expected/observed behavior, evidence, affected data, owner lane, and release disposition.

# Phase 6 — SRE, observability, incident response, immutable deployment, and rollback tooling

Build fail-closed scripts and runbooks; do not deploy and do not invoke mutating Railway commands.

Required deployment-tool behavior:

1. Require exact project, environment, web service, worker service, and database identity.
2. Reject ambiguous, unlinked, or production targets during staging commands.
3. Require an exact immutable source SHA and expected image digest.
4. Record `/version` before and after deployment and require exact candidate readback.
5. Run migrations as a separate controlled operation.
6. Verify `/health`, `/ready`, worker heartbeat, migration ledger, queue state, and backup freshness.
7. Record deployment IDs/digests/statuses without environment values.
8. Support staging rollback to the exact pre-deploy source and roll-forward to the candidate.
9. Preserve source-rebuild fallback when native rollback is unavailable.
10. Refuse database deletion/replacement and treat database restore as a separately authorized last resort.
11. Keep every provider transport, real import, broad send, and live billing mode off by default.
12. Provide dry-run output and fixture-driven tests for every refusal path.

Define SLOs and alert/readiness checks for:

- web health/readiness/version;
- worker heartbeat and draining/stopped states;
- queue depth, oldest age, claim leases, retry rate, and dead letters;
- database connectivity, saturation, locks, and migration drift;
- backup age and restore-proof age;
- login/activation/reset failure and rate-limit spikes;
- webhook verification/replay failures;
- provider canary budget violations;
- class launch and attendance projection failures;
- billing webhook/reconciliation failures;
- support bridge failures;
- public signup errors and latency.

Create:

- `ops/codex-runs/W13-10/SRE-READINESS.json`
- `ops/runbooks/w13-10/STAGING-DEPLOY.md`
- `ops/runbooks/w13-10/STAGING-ROLLBACK-ROLLFORWARD.md`
- `ops/runbooks/w13-10/PRODUCTION-PROMOTION.md`
- `ops/runbooks/w13-10/INCIDENT-RESPONSE.md`
- `ops/runbooks/w13-10/PROVIDER-KILL-SWITCHES.md`
- `ops/runbooks/w13-10/SLOS-AND-ALERTS.md`

No runbook may say “latest,” “current branch,” or “the staging project” where an exact immutable identifier is required.

# Phase 7 — Supply chain, CI, dependency, environment-contract, and reproducibility audit

Do not upgrade dependencies, rewrite the lockfile, or modify repository settings in this lane.

Audit and record:

- Node 24 engine consistency;
- npm lockfile integrity and deterministic `npm ci`;
- direct and transitive dependency inventory;
- vulnerability results with severity, exploitability, affected runtime path, and available remediation;
- licenses and policy exceptions;
- install/build lifecycle scripts and unexpected network/code-execution behavior;
- GitHub Actions permissions, event triggers, fork/pull-request safety, secret exposure, action-version pinning, artifact retention, and environment protection assumptions;
- workflow coverage for the exact W13 paths;
- package scripts versus actual release gates;
- `.env.example` names versus parsed config names, defaults, validation, runtime consumers, and stale/unused variables;
- build reproducibility and source/image provenance;
- SBOM generation and hashing;
- secret-scan scope and known test-secret handling;
- committed binary/evidence growth and retention risk;
- dependency duplication or abandoned packages;
- production dependency minimization.

Use read-only audit commands. Do not run automatic-fix commands. If a critical/high issue is confirmed, record it as a release blocker with a minimal isolated remediation plan and affected test set.

Create:

- `ops/codex-runs/W13-10/SUPPLY-CHAIN-REPORT.json`
- `ops/codex-runs/W13-10/DEPENDENCY-INVENTORY.json`
- `ops/codex-runs/W13-10/ENV-CONTRACT-DRIFT.json`
- `ops/codex-runs/W13-10/CI-THREAT-MODEL.md`
- `ops/codex-runs/W13-10/SBOM-RECORD.json`
- `ops/codex-runs/W13-10/UPGRADE-PLAN.md`

Do not commit a huge generated SBOM if it would create unnecessary repository weight; storing a sanitized summary, format, generation command, hash, and protected artifact location is acceptable.

# Required validation

Run focused tests immediately after each implementation phase. Before completion, run as much of the following as is applicable and truthful:

1. `npm ci`
2. `npm run secret:scan`
3. `npm run brand:check` when visible/public files changed
4. scoped Prettier checks over every touched text file
5. `npm run lint`
6. `npm run typecheck`
7. focused delivery, legal/consent, security, migration, deployment-tool, and supply-chain tests
8. `npm run unit`
9. `npm run integration`
10. `npm run build`
11. affected E2E tests
12. affected accessibility tests
13. affected performance/bundle tests
14. PostgreSQL 16 and 18 disposable assurance where tools are available
15. duplicate migration-prefix check
16. JSON parsing/schema checks for every generated JSON artifact
17. `git diff --check`

Do not claim a command passed unless it ran successfully. If repo-wide `npm run format` remains blocked by inherited baseline drift, do not mass-format; record the baseline and prove every W13-10 touched file is formatted.

# Completion and publication

Before exit:

1. Re-fetch and refresh PR #73, PR #72, PR #71, and any W13 branches/PRs that appeared while this parallel lane was running; update only factual state records, never merge them.
2. Review `git diff` for secrets, private data, accidental provider values, duplicate domain models, and unrelated formatting.
3. Update `CHANGED-FILES.txt`, `COLLISIONS.json`, `STATE.json`, `RESUME.md`, and `FINAL-REPORT.md` with exact final state.
4. Confirm external provider actions, Railway mutations, production database reads/writes, real source-row processing, sends, charges, uploads, posts, meetings, and DNS changes are all zero.
5. Commit coherent changes with an intentional message.
6. Push `codex/w13-10-complete-launch-foundations`.
7. Open a draft PR against `integration/w12-final-convergence-20260717T123715Z`.
8. The PR body must state exact base/head SHAs, owned paths, migrations changed or not changed, tests actually run, blockers, decision gates, external effects count, production mutation count, and the durable report path.
9. Keep the worktree clean after commit.
10. Do not merge, deploy, mark ready, enable providers, apply real data, or make a production go/no-go decision.

Your final response must include:

- task ID `W13-10`;
- branch and exact base/head SHAs;
- draft PR URL;
- implemented foundations;
- tests and their actual results;
- decision gates still open;
- release blockers;
- external effects and production mutations, both expected to be zero;
- exact durable paths for `FINAL-REPORT.md`, `RESUME.md`, the three replacement run-later prompts, and the collision/ownership records.
