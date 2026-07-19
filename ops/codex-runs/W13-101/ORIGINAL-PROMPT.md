# W13-101 — Resume PR #91, close external gates, deploy the safe core, and create the login handoff

Paste this entire prompt into a fresh Codex session. This is a continuation of W13-100, not a new architecture or feature train.

## Exact starting state

- Repository: `webcraft-media/onetimev2`
- Draft PR: `https://github.com/webcraft-media/onetimev2/pull/91`
- Branch: `release/w13-100-controlled-day-one-20260717T182046Z`
- Verified remote head at prompt creation: `466d8489bb8c7a3a57f7590929b58e7857420e86`
- PR base: `integration/w12-final-convergence-20260717T123715Z`
- Existing worktree: `C:\Users\User\OneTimeOneTime-w13-100-final-launch`
- Existing run records: `ops/codex-runs/W13-100/**`
- Current GitHub truth: PR #91 is open, draft, mergeable, and the Node 24, OPS-06, PostgreSQL 16, PostgreSQL 16 learner-seat, and PostgreSQL 18 restore-clone checks are green.

Use the existing clean W13-100 worktree if it remains intact and clean. Otherwise create a new isolated worktree from the exact remote PR #91 head. Never reset, clean, overwrite, or stage another dirty checkout.

## Role and goal

You are the external-closeout release engineer for One Time. W13-100 already completed semantic convergence and gamification. Your job is to finish the work that it incorrectly left blocked:

1. preserve W13-100 as historical evidence and record its stale-head discrepancy in W13-101;
2. validate the exact Railway staging and production identities from existing evidence and live read-only Railway discovery;
3. obtain/use a safe non-production PostgreSQL target without printing its URL;
4. run database verification;
5. deploy the exact candidate to isolated staging;
6. prove backup, restore, rollback, roll-forward, and separate owner/admin/parent/student journeys;
7. deploy the strongest safe core to production even if optional providers remain off;
8. run every configured bounded provider canary sequentially after the core is live;
9. rehearse/apply the approved real CRM manifest only if its exact data gates pass;
10. deliver the controlled admin activation/reset email and create the protected operator handoff;
11. update and push PR #91 with exact final truth.

Do not return another preflight-only report. Do not stop the whole task because Buffer, BNA bridge, a provider credential, the real import sources, or another optional capability is unavailable. Mark only that sub-lane blocked, keep it provider-off/hidden, and continue to safe core deployment.

The mandatory execution order is Phase 1, Phase 2, Phase 3, Phase 4, Phase 7, Phase 5, Phase 6, then Phase 8. In other words: deploy the verified core before spending hours on optional provider or import lanes.

## Written operator authorization

This prompt authorizes:

- read-only discovery of GitHub and Railway identities;
- linking an isolated worktree to the exact existing One Time staging/production Railway targets after identity verification;
- creating/using a disposable non-production PostgreSQL database or restored clone for verification;
- Git commits, pushes, PR updates, and normal protected-branch merge/readiness operations;
- exact-SHA staging deployment, migrations, backup/restore, rollback, and roll-forward;
- exact tested production deployment and additive migrations after fresh backup;
- the narrowly approved CRM import only when the final exact manifest/hash/count/rollback gates pass;
- bounded provider canaries described below;
- controlled activation/reset email to protected operator-owned destinations;
- production enablement only for provider modes whose staging canaries pass and whose kill switches are verified.

Not authorized:

- live Stripe charges or Stripe live mode;
- broad email/WhatsApp campaigns or messages to imported historical contacts;
- Buffer public scheduling/publishing;
- DNS/domain changes;
- deleting or replacing databases, services, projects, environments, or volumes;
- destructive Git history rewrites or bypassing branch protection;
- importing excluded legacy CRM/pipeline groups, communication bodies, or ambiguous identities;
- exposing secrets, recipients, private data, tokens, links, provider payloads, or database URLs.

## Operator inputs contract

Do not invent values and do not ask the operator to paste secrets into chat or Git. Before external work, verify only presence/access, never secret values:

- GitHub authentication with write, workflow, PR, protected-merge, and tag rights for `webcraft-media/onetimev2`;
- Railway authentication with access to both exact project IDs listed below;
- one protected operator-controlled administrator email destination for activation/reset handoff;
- required core auth/session/encryption secrets already present in protected Railway variables;
- provider credentials, canary destinations, and real CRM source files only when those optional lanes are attempted, stored in Railway protected variables or a local private file outside Git.

Missing GitHub/Railway access, an inaccessible production database, a failed backup/restore proof, a critical core defect, or no usable administrator access path may block core deployment. Missing Buffer, BNA, Telegram, WhatsApp, Zoom, Vimeo, OpenAI, Stripe TEST, or CRM import inputs must not block it.

## Source and evidence identity model

Track two identities explicitly:

- `RUNTIME_SOURCE_SHA`: the exact source/config/migration tree deployed to staging and production.
- `EVIDENCE_HEAD_SHA`: a descendant allowed after deployment only when its audited diff contains documentation/evidence/run records and no runtime source, build inputs, migrations, dependencies, or deployment configuration.

Production `/version` and the release tag must identify `RUNTIME_SOURCE_SHA`. The PR may end at `EVIDENCE_HEAD_SHA` when containment and the non-runtime-only diff are proven. Do not create a redeploy loop merely because evidence was committed after deployment.

## Known Railway identities to verify, never guess

These are historical repository-evidence candidates. Validate them read-only against the authenticated Railway account before use. If an ID has changed, discover the current identity through exact project lineage and record the replacement; do not select a similarly named unrelated project.

### Isolated staging

- Project name: `one-time-ot99-staging-96b42905`
- Project ID: `7c8eee26-7a6a-4684-826d-9f4377d67d46`
- Environment: `staging`
- Environment ID: `11edf8a2-0160-45b4-a039-b15b4beb4c10`
- Public web URL: `https://ot99-web-staging.up.railway.app`
- Historical web service: `ot99-web`
- Historical worker service: `ot99-worker`
- Historical PG16 service: `ot99-pg16`
- Historical PG16 service ID: `7dc5b2ec-03ff-4c22-821d-8df925fe63ee`

### Production

- Project name: `one-time-production`
- Project ID: `ce55ef20-1418-4ad3-aafa-f877fb992dc8`
- Environment: `production`
- Environment ID: `f911acfc-e206-44df-a569-9d69d709b94b`
- Public URL: `https://join.onetimeonetime.com`
- Web service: `one-time-web`
- Worker service: `one-time-delivery-cron`
- Historical production PostgreSQL service ID: `db590e4a-7dc5-40cb-a243-5206ce21b746`

First run Railway authentication/profile and project/environment/service inventory commands that print names, IDs, regions, status, and deployment/source fingerprints only. Never print environment values. If the authenticated Railway identity cannot access the exact staging or production project IDs, record `BLOCKED_RAILWAY_ACCOUNT_ACCESS` and finish every non-deployment task; that is one of the few genuine external blockers.

## Durable continuation records

Continue using `ops/codex-runs/W13-100/**` and create `ops/codex-runs/W13-101/**` with:

- `ORIGINAL-PROMPT.md`
- `STATE.json`
- `RESUME.md`
- `RAILWAY-IDENTITIES.json`
- `DATABASE-ASSURANCE.json`
- `STAGING-DEPLOYMENT.json`
- `STAGING-ACCEPTANCE.json`
- `ROLLBACK-ROLLFORWARD.md`
- `PROVIDER-CANARIES.json`
- `IMPORT-RESULT.json`
- `PRODUCTION-DEPLOYMENT.json`
- `PRODUCTION-ACCEPTANCE.json`
- `EXTERNAL-EFFECTS.json`
- `OPERATOR-HANDOFF.md`
- `FINAL-REPORT.md`
- `CHANGED-FILES.txt`

At the first write, preserve W13-100 unchanged as historical evidence. Record its stale-head discrepancy and the corrected mapping in W13-101; only add an explicit superseding/correction field to W13-100 if its existing schema supports that without rewriting history. Update W13-101 state after every phase, before external effects, before long tests, and before exit. Commit/push coherent checkpoints during long work.

# Phase 1 — Refresh PR #91 and repair remaining product blockers

1. Fetch all refs and verify PR #91 remote head/checks/worktree cleanliness.
2. Read `AGENTS.md`, `.env.example`, parsed config, deployment scripts/runbooks, all `ops/director/**`, W13-100 state/final/resume/handoff, and relevant W13-90/OPS-13B-R/W13-10 records.
3. Reconcile the discrepancy between the stale committed W13-100 state head and the current PR head.
4. Run the full local suite again only if source changed after the green head. Otherwise preserve the exact green GitHub check evidence and run focused sanity checks.
5. Inspect the production-visible action registry and core routes. Any unfinished optional capability must be provider-off/feature-flagged or hidden; it may not leave a dead button or fake success.
6. Fix any concrete core defect found. Do not redesign completed domains or mechanically merge superseded branches.

# Phase 2 — Non-production PostgreSQL verification

Do not block because the isolated worktree lacks a local `DATABASE_URL`.

1. Validate the existing staging PG16 service or provision a task-scoped disposable non-production PostgreSQL service/clone inside the verified isolated staging project.
2. Inject its private connection into the verification subprocess/environment without printing, committing, or persisting the URL in evidence.
3. Run `npm run db:verify`, migration fresh apply, upgrade, checksum/idempotency, PostgreSQL 16 assurance, current production-version restore-clone assurance, learner-seat concurrency, gamification migration `2203`, and duplicate-prefix checks.
4. Create a native backup and disposable restore proof. If compatible `pg_dump`/`psql` clients are unavailable locally, run the matching client version in an ephemeral Railway task/container without exposing credentials.
5. If a migration defect exists, repair it with a new additive forward migration; never alter an already-applied migration.
6. Destroy only a disposable task-created clone when proof is complete. Never delete the shared staging or production database.

# Phase 3 — Exact staging deployment and rollback

1. If code changed, commit/push it and use the new exact branch head. Otherwise candidate is PR #91 head `466d8489bb8c7a3a57f7590929b58e7857420e86`.
2. Record `RUNTIME_SOURCE_SHA` and the built image digest when Railway exposes it. Prefer native exact-image promotion. If Railway cannot promote or expose a retained identical digest, permit a deterministic rebuild only from the same `RUNTIME_SOURCE_SHA`, locked dependency graph, build command, runtime manifest, and verified source/config fingerprint; never use a different checkout.
3. Take/read the staging backup and current deployment identities.
4. Deploy web and worker to the verified isolated staging environment with provider transports, real import, and broad sends off.
5. Apply migrations once and verify the ledger.
6. Require `/version` to report the exact candidate, `/health` and `/ready` green, worker heartbeat healthy, queues bounded, and truthful provider modes.
7. Run public landing/signup, login/activation/reset, owner/admin dashboard, CRM list/detail, communications, classes, content, billing, parent portal, student portal, gamification, support, mobile, accessibility, and performance smoke journeys.
8. Roll staging back to the exact prior deployment, smoke it, roll forward to the candidate, and smoke again. If native rollback is unavailable, prove the exact-source rebuild fallback.
9. Capture screenshots/evidence without private values.

# Phase 4 — Controlled identities and login handoff

Use protected runtime/local configuration only; never print destinations or tokens.

1. Resolve/create separately controlled staging owner/admin, parent, and student identities.
2. Parent/student routine login must not require owner/admin TOTP. Sensitive owner/admin operations may use step-up verification.
3. Global email budget: staging may send at most one activation and one reset; production may send at most one activation and one reset. All later email checks must reuse/read back those messages rather than sending duplicates. Destinations must come only from protected runtime/private handoff configuration.
4. Prove activation/set-password, login, recovery, logout, session revocation/cache clearing, and separate role journeys.
5. Never set or know another adult's permanent password. Rabbi owner uses a one-time activation flow only when his protected destination is configured.
6. Create a protected local handoff outside Git with private setup material. Commit only public URLs, safe procedures, status, and the protected file location.

# Phase 5 — Post-core bounded provider canaries, sequentially

Inspect presence/status of protected variables; never print values. Missing config blocks only that provider.

1. **Email** — reuse the Phase 4 global per-environment activation/reset budget; no additional duplicates and no audience/broad send.
2. **Stripe TEST** — one test Checkout Session, test webhook receipt/projection/reconciliation, $67/month and three-seat contract, every object `livemode=false`; zero live charges.
3. **Zoom** — one canary meeting/occurrence, at most two protected controlled registrants, secure learner launch/SDK-role/attendance proof; no raw private links or host secrets in evidence.
4. **Vimeo** — one owned private item metadata/playback/content/knowledge proof; upload zero unless an explicit protected one-upload canary flag is enabled.
5. **OpenAI/helper** — one approved Rabbi content item, at most three grounded queries, zero private-data queries.
6. **Telegram** — one mapped operator-owned allowlisted chat, at most three reads and one confirmed `/status` or help-style staging write; no provider/config/payment/export/deploy commands.
7. **WhatsApp** — one allowlisted controlled recipient, one fixed harmless canary message, counts-only webhook/status proof.
8. **Buffer** — if no account is connected, mark `BLOCKED_BUFFER_ACCOUNT_NOT_CONNECTED`, keep provider-off, and continue. If connected and its API genuinely supports a non-publishing draft, create one draft only; otherwise perform read-only connectivity proof. Never publish or schedule.
9. **BNA support** — synthetic v2 proof first; live staging event only if exact isolated BNA v2 receiver/HMAC proof exists. Otherwise keep off and continue.

After each canary record budget, environment, exact candidate, result, idempotency/readback, cleanup/disable state, and unexpected effects. A failed provider never silently becomes a successful sink delivery. For a provider that passes and is authorized for production, re-audit production queue eligibility, require zero uncontrolled backlog, enforce the exact canary allowlist and budget, perform one bounded production canary, and only then explicitly enable it. Otherwise leave it off.

# Phase 6 — Real CRM rehearsal and bounded production manifest

Locate approved sources by an accepted OPS-13A manifest/hash, not filename alone. Approved scope remains only `Rabbi Scheller Followers.xlsx` plus the five approved email-audience exports. Exclude the 29 large legacy CRM/pipeline exports, communication bodies, unknown lists, and ambiguous ownership.

1. Run counts-only preview.
2. Rehearse on a disposable staging restore with all delivery off.
3. Prove provenance, tags, consent/suppression, conservative identity matching, quarantine categories, household/learner safety, conflict handling, and idempotent second pass.
4. Prove rollback.
5. Produce an exact sanitized production apply manifest.

If no usable accepted OPS-13A manifest exists or the exact files/inventory cannot be located, create a sanitized read-only source inventory and proposed manifest for later operator acceptance. Do not import. Do not block core deployment. Keep the CRM application live and mark only the import sub-lane blocked with exact required source hash/path instructions.

# Phase 7 — Deploy the safe core to production

Core deployment requires:

- exact source provenance and either exact-image promotion or the deterministic same-source rebuild proof defined above;
- green CI and relevant staging journeys;
- PostgreSQL verification;
- fresh native production backup/validation;
- additive migration plan;
- tested rollback;
- working landing/signup, auth/session, admin dashboard/CRM, parent/student isolation, web/worker/database health;
- no unresolved critical/high security, privacy, migration, or data-integrity defect.

Buffer, BNA bridge, live Stripe, broad campaigns, a missing optional provider, or a blocked real import are not core deployment blockers. Keep them off/hidden and deploy the verified remainder.

Core-required capabilities are: web/worker/database health, landing/signup, auth/session/password recovery, a usable protected administrator access path, administrator dashboard/CRM shell, and parent/student role isolation. Stripe TEST, Zoom, Vimeo, Telegram, WhatsApp, OpenAI/helper, Buffer, BNA support, real CRM import, campaigns, and public provider publishing are optional closeout lanes for this run.

1. Record current production `/version`, `/health`, `/ready`, deployments, migration ledger, worker, DB, and backup state.
2. Create and validate a fresh production backup before writes. Use an ephemeral compatible client task if the workstation lacks the correct PostgreSQL client.
3. Audit all pending queues/outboxes before deployment. Keep every external transport OFF during deploy. No provider may be enabled unless its eligible backlog is zero or every eligible row is constrained to the protected canary allowlist.
4. Deploy the exact staging-tested source/image, or the deterministic same-`RUNTIME_SOURCE_SHA` rebuild allowed above; never rebuild from a different checkout.
5. Apply additive migrations once and verify.
6. Smoke every core route and separate role journey.
7. Keep optional transports off through the core deployment. Phase 5 runs afterward and is the only lane allowed to enable a provider following its queue audit and bounded canary. Keep all others off.
8. Roll back immediately on auth/signup/migration/database/worker/critical-journey failure.
9. If the exact CRM production manifest is green, apply only safe/matched/new rows with delivery disabled, quarantine conflicts, run an idempotent second pass, and verify CRM counts/detail privately. Otherwise leave import pending without rolling back the safe app deployment.

# Phase 8 — GitHub/release governance and final acceptance

1. Push runtime changes to PR #91 and obtain green protected checks before selecting `RUNTIME_SOURCE_SHA`.
2. PR #91 targets the W12 integration branch, not the default branch. Merge PR #91 normally into its current integration base only after review/checks. Then create or update one explicit canonical release PR from that resulting integration head to the repository's actual default branch. Verify full ancestry, migration order, semantic diff, and checks; never force-push, silently retarget #91, or bypass protection.
3. Merge the canonical release PR normally. The default branch must contain `RUNTIME_SOURCE_SHA` by ancestry, or have a merge commit whose tree is proven identical to the deployed runtime tree. Do not redefine or redeploy `RUNTIME_SOURCE_SHA` merely because normal merge history creates a different commit identity; record both SHAs and their exact tree relationship.
4. Commit post-deploy run records only as `EVIDENCE_HEAD_SHA` under the identity model above. Obtain applicable checks and prove the audited non-runtime-only diff; no redeploy is required for evidence-only descendants.
5. Create an annotated release tag that identifies the exact production `RUNTIME_SOURCE_SHA`.
6. Mark superseded PRs only after ancestry/semantic containment proof; do not destructively delete branches.
7. Verify production `/version` matches `RUNTIME_SOURCE_SHA` and the tag resolves to it.
8. Complete real controlled admin, parent, and student read/write journeys and capture sanitized evidence.
9. Ensure the administrator receives/has the protected setup email and a usable production login URL.

## Terminal statuses

- `READY_FOR_CONTROLLED_DAY_ONE_USE`: core-required capabilities live, controlled identities green, and every explicitly required Day-One optional lane selected by protected configuration is green.
- `CORE_DEPLOYED_OPTIONAL_CAPABILITIES_PENDING`: core safely live, but one or more optional provider/import capabilities remain off.
- `PARTIALLY_READY_WITH_EXTERNAL_BLOCKERS`: use only when a genuine core blocker prevented production deployment.

Do not describe the result as “nothing deployed” merely because one optional provider is missing. Conversely, never hide a failed core gate.

## Required final response

Begin with exactly one terminal status. Then provide:

- staging and production URLs;
- branch, PR(s), `RUNTIME_SOURCE_SHA`, `EVIDENCE_HEAD_SHA`, image digest or deterministic rebuild fingerprint, default-branch SHA, and release tag;
- local/GitHub/database tests actually run;
- staging deployment and rollback/roll-forward result;
- production deployment and rollback readiness;
- database version/migrations/backup/restore result;
- activation/login/admin/parent/student acceptance;
- CRM import status and sanitized counts;
- every provider's mode, canary effects, and kill-switch status;
- exact external effects counts;
- remaining optional blockers and exact resume instruction;
- committed `FINAL-REPORT.md`, `RESUME.md`, `OPERATOR-HANDOFF.md`, and protected local handoff location.

Do not end with “the next step is to deploy” if core gates are green. This prompt authorizes the safe core deployment described above.
