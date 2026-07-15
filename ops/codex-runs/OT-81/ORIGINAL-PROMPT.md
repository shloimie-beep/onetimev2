# OT-81 — Codex Day-One Certification and Isolated Staging Execution Prompt

## OT-81 operating mode

You are Codex executing OT-81 for the standalone One Time product. This is an implementation, verification, publication, and isolated-staging task—not a read-only audit and not a prompt-generation task.

Complete all safe work autonomously. Do not stop merely because the current Codex window opened in the wrong repository, because a legacy control file is stale, because a provider credential is absent, or because staging access is unavailable. Work around nonessential blockers, persist progress in the repository, and leave a clean reusable checkpoint.

Task-produced standalone reports, PR titles, evidence folders, and user-facing handoffs must clearly begin with `OT-81`. Standard state files inside an `OT-81` folder may keep their conventional names.

## OT-81 repository and verified starting truth

Repository:

`webcraft-media/onetimev2`

Canonical source branch:

`origin/codex/ot80-one-shot-final-convergence`

Draft PR:

`https://github.com/webcraft-media/onetimev2/pull/23`

Verified when this prompt was regenerated:

- PR #23 is open, draft, mergeable, and unmerged.
- PR #23 metadata head is `741af0c08ee1d43be4e220b7c6e4c77a2330adc2`.
- The OT-80 product/source evidence anchor is `b753d50ca562c01cfa8619762254e70c90b0105f`.
- CI is green: Node verification, PostgreSQL 16 assurance, and OT-75 static readiness.
- Candidate status is `NOT_READY`.
- Strict Day-One certification reports 13 gates: 3 pass and 10 blockers.
- Isolated staging has not started.
- No OT-81 branch, PR, or commit existed when this prompt was regenerated.

Do not blindly pin implementation to the remembered metadata SHA. Fetch the named remote branch and resolve its current head at execution time. Confirm that the fetched history contains the evidence anchor and still represents PR #23. Record the resolved branch and exact 40-character SHA in OT-81 inputs and reports.

If the remote branch moved for legitimate OT-80 follow-up commits, use its current verified head. If it no longer contains the anchor or PR #23 points elsewhere, record the discrepancy, choose the newest unambiguous PR #23 head, and continue only after preserving that evidence. Do not substitute BNA HEAD, local dirty HEAD, `main`, or an unrelated branch.

## OT-81 worktree and branch

The current Codex working directory may be `C:\Users\User\BNA v2.0` or another repository. That is not a blocker.

1. Locate an existing checkout whose `origin` is `webcraft-media/onetimev2`, or clone the repository.
2. Fetch `origin` and prune stale refs.
3. Do not reset, clean, stage, commit, or overwrite any existing dirty worktree.
4. Create a clean external worktree:

   `C:\Users\User\OneTimeOneTime-ot81-dayone-certification-and-staging`

5. Create branch:

   `codex/ot81-dayone-certification-and-staging`

6. Base it on the dynamically resolved `origin/codex/ot80-one-shot-final-convergence` head.

7. The stacked draft PR title must be:

   `[OT-81] Day-One certification and isolated staging`

Do not run BNA control-tower commands and do not modify BNA product or protocol files in this task.

## OT-81 persistence-before-work requirement

Before product edits, create:

```text
ops/codex-runs/OT-81/ORIGINAL-PROMPT.md
ops/codex-runs/OT-81/INPUTS.json
ops/codex-runs/OT-81/STATE.json
ops/codex-runs/OT-81/RESUME.md
ops/codex-runs/OT-81/FINAL-REPORT.md
ops/evidence/ot-81/
```

Requirements:

- Copy this entire prompt into `ORIGINAL-PROMPT.md` without silently compressing it.
- Record source repository, source branch, resolved base SHA, PR #23 URL/head, evidence anchor, task branch, worktree, permissions, provider modes, and start time in `INPUTS.json`.
- `STATE.json` must use an explicit phase/status vocabulary and list each Day-One gate independently.
- Update `STATE.json` and `RESUME.md` after every material phase and before any external action.
- A fresh Codex window must be able to resume from repository files without the original chat or attachment.
- If blocked later, commit and push all safe work and evidence before stopping whenever possible.

Use a schema such as:

```text
initialized
baseline_verified
certification_repairs_in_progress
local_certified
ci_verified
ready_for_staging
staging_in_progress
staging_accepted
ready_for_ot82
waiting_for_staging_access
blocked_safety_boundary
```

## OT-81 goal

Turn the OT-80 convergence candidate into an honestly Day-One-certified candidate and, when the certification and isolated-environment gates permit, deploy the exact OT-81 SHA to isolated One Time staging so Shloimie can open it and test real owner/admin login journeys.

OT-81 must not implement the broad provider/product work already assigned to OT-82 through OT-88. It may repair the existing Day-One implementations and prove provider-default-off behavior, but it must not build full Zoom, Stripe, Vimeo, Telegram, WhatsApp, Buffer, BNA ticketing, or final brand-system expansions here.

## OT-81 binding Day-One product promise

Day One includes:

1. Fast public landing page.
2. Family signup committed atomically to CRM before provider delivery.
3. School signup remains lead-only.
4. Rabbi Scheller owner login and Shloimie administrator login with MFA and role denials.
5. Fast authenticated CRM with search, cards/list, tags, contact detail, and truthful read-only communications.
6. Existing class/reminder boundaries with a protected provider-off launch state and no raw provider link.
7. Existing content review/publish and entitled-library capability where already implemented.
8. Parent household scope and separate student exactly-one-learner scope where already implemented.
9. Honest provider-default-off/unavailable UI with no dead visible actions.
10. A complete visible-action-to-handler-to-authorization-to-audit-to-test registry.
11. Responsive, accessible, keyboard-usable, RTL-safe, reflow-safe, reduced-motion behavior.
12. Thirty-sample performance and bundle/request evidence.
13. Exact source, migration, readiness, worker-isolation, backup/restore, and rollback evidence.

Day One does not require live Stripe billing, managed Zoom links, live Vimeo ingestion, live Telegram actions, broad WhatsApp/email sends, Buffer publishing, or production DNS. Those remain later numbered tasks.

## OT-81 authoritative inputs

Inspect at minimum:

```text
ops/evidence/ot-76/ot80-final-candidate/day-one-audit-report.json
ops/evidence/ot-76/ot80-final-candidate/day-one-certify-report.json
ops/day-one/day-one-capability-registry.json
ops/day-one/release-manifest.example.json
ops/execution/ot-80/RELEASE-MANIFEST.json
ops/execution/ot-80/BLOCKERS.json
ops/execution/ot-80/REMAINING.md
ops/execution/ot-80/RESUME.md
ops/release/ot75/**
ops/evidence/ot-52/**
apps/web/**
apps/worker/**
packages/**
tests/**
```

Search the repository for each capability’s actual routes, services, database objects, UI controls, tests, and evidence. Do not accept a task report, registry status, or existing test filename as proof by itself.

## OT-81 current strict-certification blockers

The existing strict report shows these ten blocker gates. Close each honestly.

### OT-81 / DAYONE-02 — School signup remains lead-only

Required outcome:

- The School journey displays the approved acknowledgement, including `School` and `Thank you.` as required by the current harness/copy contract.
- School submission creates/reconciles only the canonical school lead/contact and internal alert intent allowed by current product policy.
- It must not create household access, learner profiles, portal accounts, class entitlement, protected class launch, reminder enrollment, billing subscription, or public email/WhatsApp class-link send.
- Add browser, integration, database, outbox, and negative authorization evidence.
- Only after actual proof may `school_signup_lead_only` become an allowed present status.

### OT-81 / DAYONE-04 — CRM and Communications

Required outcome:

- Prove the mounted authenticated CRM route, POST/body search, filters/sort/cards or responsive list, durable tags, contact detail, safe create/edit/note/archive/task/relationship capabilities actually promised by the current UI, and truthful read-only communications.
- Ensure communications labels distinguish intent queued, sink processed, provider accepted/delivered, failed, and inbound truthfully; never label sink processing as Sent or Delivered.
- Prove owner/admin allow and all unrelated roles/account scopes deny.
- Prove no PII in query URLs/browser persistence and no synchronous BNA/Operations request.
- Only then update `crm_search_cards_tags_detail_communications`.

### OT-81 / DAYONE-05 — Class/reminder/provider-off launch

Required outcome:

- Verify daily-class and reminder state machines already present in OT-80.
- Provider-off mode must be the default unless explicitly configured.
- A protected One Time launch route may show an unavailable/test/sink state, but it must never expose a raw Zoom/provider URL, passcode, registrant token, SDK secret, or shared family link.
- Reminder intents must be idempotent, scoped, and skipped when protected launch readiness is absent.
- No school reminder or class access.
- No dead Join/Reminder button: functional safe state, disabled with explanation, or hidden.
- Only then update `class_reminder_provider_off_launch`.

### OT-81 / DAYONE-06 — Content review/publish/entitled library

Required outcome:

- Inspect and prove the current content lifecycle, review/publish boundary, entitled library route/API, and role/learner access.
- Only approved/published entitled content may appear.
- Draft, failed, retired, cross-account, sibling, or unentitled content must deny or remain hidden.
- Provider/Vimeo absence must produce an honest local/manual/provider-off state, not a dead action or false success.
- Add mounted-route and negative tests.
- Only then update `content_review_publish_entitled_library`.

### OT-81 / DAYONE-07 — Parent household and exactly-one-learner student scope

Required outcome:

- Prove a parent sees only the parent’s household and linked learners.
- Prove each student login resolves directly to exactly one learner and cannot list, infer, switch to, or access siblings.
- Prove the maximum-three-active-learners constraint and concurrency evidence already claimed.
- Prove parent create/reset/suspend semantics where current implementation exposes them; passwords must never be retrievable and reset must revoke relevant prior sessions.
- Prove wrong role, wrong household, archived learner, revoked session, and deep-link denial.
- Only then update `parent_household_student_exactly_one_learner`.

### OT-81 / DAYONE-08 — Provider-default-off and no dead action

Required outcome:

- Inventory every visible provider-dependent action on public, CRM, parent, and student routes.
- Each action must map to a real safe handler/test state or be disabled/hidden with truthful readiness text.
- No provider outage may prevent landing, signup commit, login, CRM, or local portal reads.
- Preserve global send-disable/network guard behavior.
- Prove zero provider calls during default-off test suites.
- Only then update `provider_default_off_no_dead_action`.

### OT-81 / DAYONE-09 — Visible action registry

Create a machine-readable OT-81 visible-action registry that covers every visible interactive control on Day-One routes.

Each entry must include:

- stable action ID;
- route/surface and role;
- visible label or component identifier;
- handler/service/API;
- authorization capability and data scope;
- audit event;
- idempotency/confirmation rule;
- provider readiness requirement;
- loading/success/empty/error/disabled state;
- test/evidence reference;
- implemented/read-only/disabled/hidden readiness status.

Add automated drift validation that fails when a visible control lacks a registered action or when the registry points to a missing handler/test. Do not register decorative links as functioning actions. Only then update `visible_action_registry_handler_audit`.

### OT-81 / DAYONE-10 — Responsive/accessibility proof

Produce actual evidence for:

- 360x800;
- 390x844;
- tablet;
- desktop;
- keyboard-only navigation and visible focus;
- screen-reader names/roles/state;
- dialogs/drawers/focus trapping and restoration;
- RTL layout and direction-aware controls;
- 200% zoom/reflow without horizontal page loss;
- reduced motion;
- virtual keyboard/safe-area behavior where relevant;
- loading, empty, error, offline, expired-session, forbidden, and disabled-provider states;
- no serious/critical automated accessibility violations.

Cover landing, signup, login, CRM list/detail, parent, and student Day-One routes. Preserve the mobile landing invariant: logo/header and primary Sign Up Now CTA are visible on initial load. Only then update `responsive_a11y_rtl_reflow_reduced_motion`.

### OT-81 / DAYONE-11 — Thirty-sample performance evidence

Run fresh integrated 30-sample measurements for at least:

- landing usable;
- signup form usable;
- login usable;
- CRM list usable;
- CRM detail usable;
- CRM warm return;
- parent portal usable;
- student portal usable.

Capture p50/p75/p95, failures/timeouts, request count, API count, transferred bytes, route bundle sizes, LCP/CLS where supported, server timing/query count where available, and exact environment/throttling.

Requirements:

- Use current declared budgets unless they are clearly invalid. Do not weaken budgets merely to pass.
- The standalone routes must make zero synchronous BNA/Operations requests.
- Initial route must not fetch unrelated CRM/provider/agent/content/portal modules.
- Useful/actionable UI marks must occur after actionable content is painted, not on request start or placeholder render.
- If local Chromium is unavailable, use the repository’s CI/browser infrastructure and record the limitation; never fabricate percentiles.
- Add regression tests tied to the evidence.

Only then update `performance_30_sample_budgets`.

### OT-81 / DAYONE-13 — Source/migrations/readiness/worker/rollback

Create exact OT-81 release evidence for:

- resolved source branch and SHA;
- complete additive migration ledger and SHA-256 checksums;
- migration ordering, fresh apply, repeated/no-op behavior, and downgrade/rollback policy;
- PostgreSQL 16 assurance and concurrency tests;
- separate web/worker process definitions;
- exactly one consumer owner per queue/token;
- worker/service isolation and graceful shutdown;
- provider-default-off state and global outbound stop switch;
- staging database identity distinct from production by safe reference/fingerprint only;
- backup/PITR status;
- restore drill or exact unresolved staging blocker;
- duplicate contact/lead audit using counts/synthetic or staging-safe data only;
- exact deployed SHA readback if staging occurs;
- application rollback to prior image/SHA;
- owner/admin bootstrap status without credentials;
- no secret values in evidence.

Only then update `source_migrations_readiness_worker_rollback`.

## OT-81 capability-status integrity rule

Most current blockers are capability-status blockers even though some underlying files/tests exist. Do not solve this by mechanically changing `partial` to `present`.

For each capability:

1. Trace requirement to route/UI/domain/API/database/worker.
2. Run positive, negative, privacy, and failure-state tests.
3. Produce evidence tied to the current OT-81 SHA.
4. Fix missing implementation or tests.
5. Update the capability registry/manifest only after the evidence exists.
6. Make the certification harness validate the evidence reference and current SHA.

If a capability is deliberately excluded from Day One, exclusion is permitted only when the product promise and certification policy genuinely allow it. Do not exclude one of the thirteen required gates merely to make the number green.

## OT-81 release-manifest correction

Do not certify against `release-manifest.example.json` as the final release truth.

Create a real OT-81 candidate release manifest in an OT-81-owned path, with:

- exact source/base/head SHA;
- branch and PR;
- candidate status;
- capability statuses and evidence references;
- test/CI results;
- bundle/performance/a11y reports;
- migration ledger checksum;
- provider modes;
- external mutation counters;
- staging status and deployed SHA when real;
- rollback/backup/worker evidence;
- remaining blockers.

Update OT-76/OT-81 harness invocation to accept this explicit manifest and current OT-81 scope without weakening forbidden-file, secret, privacy, provider, accessibility, or performance protections.

Strict local certification must pass before staging mutation. If a harness defect rejects truthful current-SHA evidence, fix the harness and add regression coverage. Do not hard-code a successful result.

## OT-81 verification phases

### Phase 1 — baseline

- Install deterministically.
- Verify clean worktree/base.
- Run current build, format/touched-format, lint, typecheck, unit, integration, e2e, accessibility, performance, bundle, secret-scan, PostgreSQL assurance, and Day-One audit/certify commands.
- Store baseline reports under `ops/evidence/ot-81/` with `OT-81-` filenames/titles.
- Confirm the expected 3-pass/10-blocker starting state or document drift.

### Phase 2 — implementation and evidence closure

- Close DAYONE-02, 04, 05, 06, 07, 08, 09, 10, 11, and 13.
- Keep scope centered on Day-One completion and proof.
- Commit coherent phases with `[OT-81]` in commit subjects.
- Update state/resume after each phase.

### Phase 3 — strict local certification

Run the complete suite again from a clean build and fresh disposable database.

Required final local results:

- build pass;
- formatting pass for the actual branch or an explicitly scoped pre-existing-baseline policy that does not ignore OT-81 files;
- lint/typecheck pass;
- unit/integration/e2e pass;
- accessibility pass;
- 30-sample performance and bundle budgets pass;
- secret/PII/provider-link/BNA leakage scans pass;
- PostgreSQL 16 assurance pass;
- migration ledger/checksum verification pass;
- strict Day-One certification 13/13 pass;
- external mutation counts truthful.

If any gate still fails, continue repairing safe code. Do not attempt staging merely because ordinary tests are green.

### Phase 4 — publication and CI

- Push `codex/ot81-dayone-certification-and-staging`.
- Open a stacked draft PR against `codex/ot80-one-shot-final-convergence` titled `[OT-81] Day-One certification and isolated staging`.
- Include the ten-gate disposition table in the PR body.
- Wait/read back CI.
- Fix branch-owned CI failures.
- Do not merge PR #23 or OT-81 to `main` in this task.

## OT-81 isolated-staging authorization

After strict local certification and required CI are green, isolated One Time staging actions are authorized within this task.

Allowed external mutations:

- GitHub branch push and draft PR.
- Read-only Railway inventory.
- Creation or configuration of clearly isolated One Time staging web/worker/PostgreSQL resources when the correct separate One Time project is unambiguous.
- Railway-generated staging domain or already approved One Time staging domain.
- Staging database migrations for the exact OT-81 SHA.
- Synthetic staging fixtures.
- Protected staging bootstrap for Rabbi Scheller as `one_time_owner` and Shloimie as `one_time_admin`.
- Staging-only session/MFA/activation verification.
- Staging sink/test-mode canaries that make no broad external send or live charge.
- Backup/PITR and safe staging restore/rollback verification.

Not authorized:

- production or root-domain DNS changes;
- mutation of the BNA Railway project or BNA production service;
- production database reads/writes or legacy contact import;
- live Stripe charges, refunds, or production product creation;
- broad or real-audience email/WhatsApp/Telegram sends;
- real managed Zoom link distribution;
- Vimeo upload/publication;
- Buffer/social publication;
- access grants to real customers beyond the two protected staging operator accounts;
- merging to `main`;
- exposing credentials, activation URLs, personal recovery values, phone numbers, tokens, or database URLs in source/logs/evidence.

## OT-81 staging predeploy gates

The current OT-75 predeploy evidence shows missing activation facts for:

- staging web service;
- delivery worker service;
- provider worker service;
- Telegram worker service;
- staging domain;
- backup/PITR evidence;
- restore-drill evidence;
- expected/active source SHA;
- migration-ledger checksum;
- staging versus production DB references;
- duplicate-data audit;
- worker isolation approval;
- provider-state report;
- owner/admin bootstrap report.

Resolve these from actual isolated staging configuration. Do not merely fill environment variables with guessed strings.

Before mutation:

1. Confirm the Railway project is the separate One Time project by safe project/service names and IDs/fingerprints, without printing secrets.
2. Prove it is not `skillful-motivation` or another BNA production project.
3. Prove staging and production DB references differ.
4. Prove web and workers use the exact OT-81 SHA/image.
5. Prove every external provider is default-off/sink/test.
6. Prove one worker owner per queue/token and a global outbound-disable control.
7. Prove a rollback target exists.

If Railway authorization or unambiguous isolated resources are unavailable, this blocks only deployment. Finish certification, CI, branch, PR, manifests, commands, and reports. Set state to `waiting_for_staging_access` and provide an exact short operator checklist. Do not mark OT-81 complete and do not fabricate a staging URL.

## OT-81 staging bootstrap and acceptance

If the isolated environment is available:

1. Deploy the exact final OT-81 commit.
2. Read back the active SHA from the running service.
3. Apply/verify migrations as a one-shot release operation.
4. Seed only synthetic test data plus protected staging operator identities.
5. Bootstrap:
   - Rabbi Scheller — `one_time_owner`.
   - Shloimie — `one_time_admin`.
6. Each identity acts as itself. No impersonation and no `View as Rabbi`.
7. Use protected activation/MFA. Do not record credentials or secret activation links.

Run these staging journeys:

- landing loads fast at mobile and desktop;
- Family signup atomically appears in CRM;
- School signup appears as lead-only and receives the correct on-page acknowledgement;
- owner login + MFA;
- admin login + MFA;
- wrong-role and cross-account denials;
- CRM list/search/filter/sort/detail/create/edit/note/archive/tags and truthful communications;
- parent household and maximum-three-learner behavior;
- separate student login with no sibling discovery;
- protected class provider-off state with no raw provider link;
- entitled content/library and unauthorized denial;
- every visible action behaves or is honestly disabled;
- logout/session invalidation;
- 360/390/tablet/desktop, keyboard, RTL, reduced motion, 200% reflow;
- staging 30-sample performance and request-fanout readback;
- backup/restore and application rollback drill where safe.

Do not require a live external provider send for staging acceptance.

## OT-81 failure and blocker behavior

Do not abandon the job at the first missing item.

- Missing provider credentials: finish provider-off code/tests and mark the provider canary for its later numbered task.
- Missing browser locally: run CI/browser jobs and preserve honest limitation.
- Missing PostgreSQL locally: use the repository’s PostgreSQL CI assurance; do not substitute fake pg-mem proof for concurrency.
- Missing Railway access: finish local certification/CI/PR and checkpoint `waiting_for_staging_access`.
- Stale OT-60R/OT-80 control metadata: reconcile it to verified remote truth; do not stop solely because metadata disagrees.
- Existing dirty unrelated worktree: create a clean external worktree; do not reset it.
- Genuine production/safety ambiguity: stop only the external mutation, preserve safe work, and write the exact unblock.

## OT-81 final publication requirements

Keep the OT-81 worktree clean after publication.

`ops/codex-runs/OT-81/FINAL-REPORT.md` must begin:

`# OT-81 — Final Report`

It must include:

- repository;
- resolved base branch/SHA;
- task branch and final head SHA;
- draft PR URL/base/head;
- worktree status;
- disposition of all ten original blocker gates;
- final 13-gate certification summary;
- real release-manifest path;
- migrations and checksums;
- test/CI results;
- performance p50/p75/p95 and request/bundle results;
- accessibility/responsive results;
- visible-action registry path/count;
- staging URL only if actually deployed;
- deployed SHA readback;
- owner/admin activation status without credentials;
- provider modes;
- backup/restore/rollback results;
- every external mutation actually performed;
- every remaining blocker and exact owner/action;
- whether OT-82 may now start;
- exact repository-backed resume path.

The final user-facing response title must be:

`OT-81 — Day-One Certification and Isolated Staging Result`

It must state plainly one of:

- `OT-81 COMPLETE — OT-82 MAY START`, or
- `OT-81 CODE/CERTIFICATION COMPLETE — WAITING FOR ISOLATED STAGING`, or
- `OT-81 BLOCKED`, with the exact unresolved gates.

Do not say “done,” “live,” “deployed,” “configured,” or “ready” without the corresponding exact SHA and evidence.

