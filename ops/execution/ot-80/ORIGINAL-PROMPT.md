# DIRECT CODEX EXECUTION — OT-80 ONE-SHOT FINAL CONVERGENCE

Execute this task. Do not generate another prompt or package.

## Mission and authority

You are the sole final integration, completion, certification, and isolated
staging engineer for the standalone One Time Mishnayos product.

- Repository: `webcraft-media/onetimev2`
- Accepted ancestor: `dfef7de2035e08f1ee72e0133ccf656fe7a74444`
- Target branch: `codex/ot80-one-shot-final-convergence`
- PR base: `codex/ot60r-recovery-convergence`
- Binding machine input: `INPUT-MANIFEST.json` from this pack
- Binding communications decisions:
  `COMMUNICATIONS-INTEGRATION-DECISIONS.md`
- Communications archive:
  `inputs/OT-DAYONE-COMMUNICATIONS-COPY-PACK.zip`

This is one execution lane. Do not wait for old Codex windows, ask for generated
mega-prompts, or make the operator route another package. Resolve what can be
resolved from Git, the repository, this pack, and provider-safe test state.

The manifest explicitly authorizes GitHub branch/PR writes and an isolated One
Time **staging** provision/deploy/migration/synthetic seed. It authorizes at most
one staging-admin activation email to `<PRIVATE_ADMIN_DESTINATION_REDACTED>`, after recipient,
environment, sender, and test/sink safeguards are verified. It does not authorize
production, root DNS, live billing, bulk/audience sends, real lead/family/school
messages, or real legacy-data mutation.

## Prime directive: make progress instead of stopping

Earlier runs failed because placeholders, stale registry SHAs, dirty BNA state,
or missing optional infrastructure were treated as whole-task stop gates. Do not
repeat that behavior.

1. There are **no operator-fill placeholders** in this task.
2. The fetched remote Git head is authoritative. `STATE.json`, registry files,
   PR descriptions, checklists, and recorded self-SHAs are evidence, not gates.
   Normalize stale metadata in OT-80; never stop merely because they disagree.
3. Treat cwd as untrusted. Never operate in BNA. Locate or clone the exact target
   repository and create a fresh clean worktree. A dirty unrelated worktree is
   not a blocker.
4. A source lane without a PR is still usable when its remote branch descends
   from the accepted ancestor. OT-71 currently falls into this category.
5. A partial source lane is not a whole-task blocker. Integrate its safe product
   commits and finish its remaining work on OT-80. Never mutate the source lane.
6. A missing optional credential blocks only that adapter/canary. Keep the
   provider default-off or sink-backed, finish the rest, and record the exact
   activation requirement.
7. An unavailable browser, Docker daemon, `psql`, or provider blocks only the
   corresponding proof. Use CI or isolated Railway staging where authorized;
   continue all independent work.
8. On every interruption, error, credit limit, or genuine safety stop, first
   write the current phase, exact SHAs, commands/results, changed files,
   remaining work, and a direct executable continuation to the OT-80 packet;
   commit and push it. The repository—not this chat—is the handoff.
9. Never hide a failure, weaken a test, claim unrun evidence, or replace a real
   blocker with prose. Scope the blocker to the affected feature and continue.

Only these conditions may prevent all product work: target repository cannot be
read at all; the accepted base object cannot be fetched; or no authorized Git
identity can create any remote checkpoint. Even then, create a local clean
worktree if possible, persist the packet, complete safe read-only analysis, and
return one exact recovery action.

## Phase 0 — Extract, validate, persist, and freeze inputs

1. Extract this whole pack to a temporary directory. Verify:
   - `INPUT-MANIFEST.json` parses;
   - the communications ZIP SHA-256 equals
     `ba1ffe027c4f89e93133fdb3a1a4511b971e52d4441b06b758022cbd1876440d`;
   - its internal `SHA256SUMS.txt` passes;
   - it has no symlink/path traversal, secret, real recipient, raw provider URL,
     double-brace placeholder, or price.
2. Locate or clone `webcraft-media/onetimev2`; verify `origin` identity before
   writes. Do not use `C:\Users\User\BNA v2.0` for product work.
3. Fetch and prune origin. Verify the accepted base object exactly. Fetch each
   source branch listed in the manifest.
   Also search all fetched remote refs and execution packets for the exact
   communications ZIP hash or `MESSAGE-CATALOG.json` hash from the manifest.
   If a Codex communications implementation branch was pushed, verify that it
   descends from OT-60R and classify its actual code/tests like every other lane.
   Do not depend on its branch name and do not integrate a spec-only branch as
   working runtime.
4. For every source lane, record:
   - exact fetched head;
   - merge-base and ancestor result against OT-60R;
   - commit range and changed files;
   - PR/CI state if available;
   - implementation, tests, migrations, central hotspots, and honest remaining
     work from repository evidence.
5. Do not require a recorded self-SHA to equal its containing commit. Record any
   mismatch as `STALE_SOURCE_METADATA_RECONCILED`.
6. Create a new clean worktree and target branch from exact OT-60R. If the remote
   target already exists, inspect its OT-80 packet and resume rather than create
   competing branches. Never reset or overwrite another dirty tree.
7. Before integrating code, copy this exact execution prompt, manifest,
   communications decisions, and immutable communications archive into:

   - `ops/execution/ot-80/ORIGINAL-PROMPT.md`
   - `ops/execution/ot-80/INPUT-MANIFEST.json`
   - `ops/execution/ot-80/COMMUNICATIONS-INTEGRATION-DECISIONS.md`
   - `ops/execution/ot-80/audit-inputs/OT-DAYONE-COMMUNICATIONS-COPY-PACK.zip`

8. Initialize/update:

   - `STATE.json`
   - `SOURCE-HEADS.json`
   - `CHECKPOINT.md`
   - `IMPLEMENTED.md`
   - `REMAINING.md`
   - `DECISIONS.md`
   - `BLOCKERS.json`
   - `CONFLICT-LEDGER.md`
   - `MIGRATION-LEDGER.json`
   - `TEST-RESULTS.md`
   - `ACTION-AND-ROUTE-REGISTRY.json`
   - `RELEASE-MANIFEST.json`
   - `STAGING-RESULT.json`
   - `RESUME.md`

9. Update `ops/execution/registry.json` semantically. Commit and push this first
   checkpoint before broad integration.

## Phase 1 — Freeze and integrate source lanes

Integrate these remote lanes in this semantic order:

1. OT-71 product core;
2. OT-74 audience reconciliation;
3. OT-72 provider sandbox/default-off infrastructure;
4. any verified communications implementation lane, limited to its safe
   feature-owned commits;
5. OT-73 corrected landing;
6. OT-75 release/observability tooling;
7. OT-76 strict Day-One certification harness.

Use ordinary merge commits or carefully bounded cherry-picks so provenance
remains auditable. Do not squash source history. Do not blindly choose entire
`ours`/`theirs` versions of central files. The conductor owns and reconciles:

- `apps/web/src/server/app.ts` and central route mounting;
- public-page build entries;
- authenticated AppShell/navigation;
- shared contracts/config/domain/db barrel exports;
- package manifest, lockfile, scripts, and CI wiring;
- worker startup/shutdown and event allowlists;
- execution registry/control files;
- migration numbers, checksums, and upgrade ledger;
- route/action/readiness registry;
- communications event/template/outbox integration.

After each lane:

- update `SOURCE-HEADS.json`, `CONFLICT-LEDGER.md`, and implemented/deferred
  matrices;
- run focused compile/type/test/migration checks;
- commit and push a named checkpoint;
- continue even if a different feature's environmental proof remains pending.

### Known collisions that must be solved deliberately

1. OT-71 and OT-72 both use migration prefix `1700`. Preserve dependency order,
   scan the integrated ledger for the next free stable prefix, renumber the
   provider-truth migration and all references/checksums/tests, and prove both
   fresh and upgrade application. Never ship duplicate order keys.
2. OT-74 contains two parallel audience/reconciliation implementations and two
   migrations. Compare contracts, schemas, routes, tests, and dry-run evidence;
   choose one canonical model or consolidate additively. Do not mount both and do
   not retain duplicate write paths. Preserve provenance and document the
   rejected duplicate.
3. Preserve OT-72's PostgreSQL harness teardown guard when integrating OT-75;
   repair the known `terminating connection due to administrator command` flake.
4. Reconcile OT-71/OT-72 Telegram DB test overlap without weakening either
   product isolation or provider-truth assertions.
5. Reconcile OT-71 and OT-73 public-page build changes so Parent/Student pages
   and the corrected landing all build as isolated entries.
6. Merge OT-73/OT-74/OT-76 execution registry entries, never wholesale-select
   one branch's registry.
7. Retain one auth/session/CSRF/MFA/capability system, one CRM API, one outbox,
   one delivery worker, one class/content model, and one Parent/Student portal
   model. Remove or adapt duplicate runtimes rather than running them in parallel.

OT-71 may still say Phase 6 is pending or may lack a PR. This is not a stop gate.
Its known product phases through the owner/admin dashboard are real. Integrate
the frozen remote head, run the combined proof yourself in OT-80, and complete
any missing publication evidence here. Near final certification, fetch OT-71
once more. If it gained commits after the freeze, compare the delta:

- integrate safe product or proof fixes not already present;
- skip duplicate metadata-only changes already superseded by OT-80;
- document every disposition;
- never restart convergence from scratch.

## Phase 2 — Reconcile and implement Day-One communications

Preserve the submitted archive byte-for-byte as audit input. Never make runtime
code open a ZIP and never ship the archive to a browser bundle.

If Phase 0 found a pushed communications implementation lane, integrate and
audit it here. Reuse its safe code only where it fits the one canonical outbox,
worker, consent, suppression, and provider-truth architecture. Repair or replace
incorrect pieces on OT-80. If no lane exists, implement directly from the
bundled archive. Either path must produce the same acceptance behavior; absence
of the old Codex window is never a blocker.

1. Parse its 19-record catalog at build time and create a new server-owned,
   versioned, typed catalog compatible with the repository's existing event,
   outbox, worker, consent, suppression, audit, and provider-truth model.
2. Do not create a second worker, queue, outbox, delivery state machine, or
   competing event names. Add an explicit adapter/mapping where persisted names
   differ.
3. Enforce catalog validation:
   - unique key + version + audit event;
   - documented variables and strict allowlist;
   - known role/channel/purpose enums;
   - no secrets, PII fixture values, prices, raw URLs, or provider identifiers;
   - exact missing-variable, delayed, fallback, and no-send behavior.
4. Trigger delivery intent only after committed business state. Use deterministic
   idempotency across business event, recipient, channel, template version, and
   session/occurrence where relevant. Provider retry must reuse the same intent.
5. Preserve Family signup acknowledgement as a receipt. Add distinct reconciled
   secure-access events/templates `class.access.ready.email` and
   `class.access.ready.whatsapp`; adapt exact names to repository conventions
   without merging receipt and access semantics.
6. Secure access requires a committed Family lead/contact, active free-promotion
   eligibility, a protected One Time access route, and current access policy.
   WhatsApp also requires explicit purpose-matching consent and no suppression.
7. T-30 reminder requires all access conditions plus reminder opt-in, an active
   class occurrence, and exactly-once recipient/session/channel/version behavior.
   Schedule at 18:30 `Asia/Jerusalem`; render `Israel time` in English copy.
8. If the protected route/provider is not ready, keep receipt success and set
   access/reminder to durable delayed state. Never expose or send a raw Zoom or
   provider URL.
9. Family/School discrimination occurs before any fallback. School gets only a
   committed inquiry, generic acknowledgement, and protected owner/admin alert.
10. Use public brand `One Time Mishnayos`. Archive submitted copy unchanged;
    store reconciled copy as a new version. Do not include post-promotion price.
11. Internal lead/no-send alerts are visible to Rabbi owner and Shloimie admin in
    a protected inbox. Optional configured internal email contains no sensitive
    body or raw identifiers.
12. Keep reset, MFA, support, Parent/Student activation, and login templates
    dormant unless their real routes and state machines are mounted and tested.
13. SMS remains off. Telegram remains its own authenticated internal channel.
14. Add the complete positive/negative/idempotency/concurrency/privacy suite from
    `COMMUNICATIONS-INTEGRATION-DECISIONS.md`.

## Phase 3 — Final product composition

Build one coherent standalone application. BNA must not be loaded by browser or
server request path, and the full Operations shell must not load.

### Public landing and lead capture

- Preserve OT-73's corrected moving top ticker: `Join now — free until Rosh
  Hashanah` with live countdown.
- Remove the hero's small yellow `$67/month afterward` / `No card today` line.
- Keep `Sign Up Now` visible on initial 360x800 and 390x844 load.
- Use a larger borderless logo and the intended editorial display font.
- Keep the hero kicker on two lines: `Worldwide Mishnah Learning` and `Live from
  Eretz Yisrael`.
- `Member Login` routes to real authentication when usable. Only use the truthful
  holding state when account activation is genuinely unavailable.
- What You Receive uses icon, heading, a yellow result line, and concise yellow
  bullets; eliminate the overlapping/circular child treatment.
- Focus result copy on daily live Mishnayos, remembering/mastering learning,
  review sheets and digital class access.
- Who It's For includes Families and Schools; a School is a lead for a live Rabbi
  class/instructional solution, never automatic enrollment.
- Remove coverage claims.
- Center the across-the-Jewish-world image rail, show images in color, and use
  place-only captions.
- Public bundle must not contain CRM/portal/provider/admin code.
- Family and School forms commit atomically and respond quickly without waiting
  for external providers.

### Owner/admin product

Rabbi Eli Scheller is the real owner. Shloimie Dratler is a real administrator.
Both see the same allowed workspace administration experience. There is no
`View as Rabbi`, no impersonation, no BNA super-admin chrome, and no loading of
the BNA operations application.

Mount and prove:

- real login/session/MFA/account lifecycle;
- concise useful Rabbi dashboard;
- fast CRM list/search/filter/sort and clear mobile cards;
- contact detail, durable tags, lead source/status, notes, relationships, tasks,
  and truthful read-only communications timeline;
- Family/School distinction and old-system/active-old-app tag seams;
- classes, occurrences, schedule, protected access readiness and exceptions;
- content/library/review sheets/protected Vimeo/playback readiness;
- Products/Enrollments/Access/Payments with Stripe **test** truth only;
- owner/admin secure alerts and configured helper/Telegram readiness only when
  mappings are real;
- reports/attendance/progress with truthful unavailable states, never fabricated
  participation;
- email/WhatsApp status based on provider truth, not queue optimism.

Each visible control must have a real handler, capability check, loading state,
success/error state, audit behavior where applicable, keyboard behavior, and
mobile proof. Hide unfinished actions or show a non-actionable setup state; no
dead buttons.

### Parent and Student products

- separate Parent and Student identities;
- parent sees only linked learners, schedule, access/billing status, progress,
  resets/suspends student access, and support;
- parent cannot retrieve a student's secret or enter the student session;
- student session resolves directly to one learner and cannot select/infer a
  sibling;
- student sees own classes, published Rabbi content, review sheets, progress,
  rewards, questions/support, and protected join/playback routes;
- raw provider URLs never enter portal DTOs, HTML, logs, analytics, or support;
- portal assistants, if enabled, are server-scoped to allowed data and published
  Rabbi content; they cannot invoke Codex, shell, deployment, migrations, open
  web, arbitrary tools, or another role's data;
- preserve privacy, consent, loading/empty/error/offline/session-expiry states.

### Providers and BNA boundary

- provider adapters are server-side and default-off until their exact readiness
  check passes;
- Stripe is TEST/sandbox only and never authentication;
- Zoom/Vimeo/Telegram/email/WhatsApp may use sandbox/test/sink paths only;
- no production provider registration, public campaign send, or bulk action;
- One Time runtime never synchronously queries BNA;
- BNA oversight receives only versioned, redacted, async envelopes with retry and
  no effect on One Time request success;
- Studio, agent-prompt configuration, transcription production, social-media
  repurposing, and cross-workspace super-admin UI remain BNA-side concerns.

## Phase 4 — Migration, data, security, and performance repair

1. Build one monotonic additive migration ledger. Prove fresh install and upgrade
   from OT-60R/OT-71/OT-72-relevant states on disposable PostgreSQL 16.
2. Verify checksums, constraints, foreign keys, indexes, idempotent application,
   rollback/restore runbook, and concurrent delivery/audience/CRM behavior.
3. Generate at least 10,000 synthetic contacts and bounded pages; capture
   sanitized query plans and 30-sample timings without real PII.
4. Preserve Argon2id, secure product-scoped cookies, CSRF, session rotation and
   revoke, MFA for privileged users, rate limiting, no-store protected data,
   safe return URLs, optimistic concurrency, random public IDs, POST-body search,
   and DTO validation.
5. Prove tenant/product/account/role/learner isolation with negative tests. No
   BNA data or cross-sibling inference.
6. Keep public, authenticated shell, CRM, portals, and feature-heavy bundles
   isolated and lazy. Do not load the full app for the current route.
7. Enforce route-usable performance marks only when content is visible and
   actionable after paint. Test cold/warm list, detail, return, tab and portal
   journeys under throttled mobile.
8. Reconcile inherited formatting baseline intentionally: format owned/integrated
   files and set one honest repository rule. Do not leave `npm run verify`
   permanently failing on known drift and do not hide source files from checks
   merely to get green CI.

## Phase 5 — Route/action and Day-One journey certification

Update a machine-readable registry for every public, owner/admin, parent, and
student route/navigation item/card/button/link/form/filter/drawer/dialog/retry/
empty-state/helper action with:

- stable action ID and label;
- route, screen, component, and role/capability/scope;
- read/write classification and handler/API;
- confirmation, idempotency, concurrency and audit requirements;
- loading/success/error/offline/expired/forbidden/provider-unavailable states;
- mobile/keyboard/accessibility evidence;
- truthful readiness status.

Prove the whole synthetic journey:

1. corrected landing loads fast;
2. Family signup commits one contact/lead/audit/outbox set;
3. duplicate replay does not duplicate business state;
4. receipt succeeds independently of provider;
5. secure access is emitted only when eligible and protected;
6. optional T-30 reminder is exactly once and consented;
7. School signup remains a lead with no Family/access/portal side effects;
8. owner/admin login and MFA work;
9. dashboard, CRM, tags, details, tasks and Communications work;
10. classes/content/provider readiness work truthfully;
11. Parent activation, linked learner, Student activation and scoped portals
    work with synthetic fixtures;
12. report/reward/support/helper seams deny safely where unavailable;
13. logout/revoke clears protected state.

Click and keyboard-test every visible action in empty, populated, duplicate,
conflict, partial-error, offline, expired-session, forbidden, and provider-down
states. Eliminate duplicates and dead controls.

Require:

- all unit/integration/security/e2e/accessibility/performance suites;
- OT-37 PostgreSQL 16 assurance after collision repair;
- OT-76 strict certify mode, not audit mode;
- 360x800, 390x844, tablet and desktop visual evidence;
- WCAG 2.2 AA, focus, reflow, reduced motion and RTL-safe layout;
- public/authenticated/feature bundle and request budgets;
- 30 valid mobile samples with p50/p75/p95, LCP, CLS and request/API counts;
- secret/PII/raw-provider-URL/BNA-request scans;
- exact health/version/source-SHA readback;
- web/worker graceful startup/shutdown and provider-off noninterference;
- `git diff --check`, clean status and green GitHub CI.

Never turn a strict gate green by deleting a requirement, weakening a threshold,
using only mocks where PostgreSQL/browser evidence is required, or calling an
unexecuted check passed.

## Phase 6 — Publish one candidate

1. Re-fetch all source branches once. Record deltas since Phase 0 and reconcile
   safe late commits without restarting.
2. Finish OT-71's combined proof/publication work inside OT-80 if its source lane
   still lacks it.
3. Update all OT-80 evidence and `RESUME.md` so a fresh agent can continue using
   only the repository.
4. Commit and push a clean exact candidate.
5. Open one draft PR to `codex/ot60r-recovery-convergence`. Do not merge it and do
   not change the default branch.
6. Wait for CI, fix owned/integrated failures, and push until the candidate's
   required checks are green or an honest external blocker remains.

Candidate status must be exactly one of:

- `NOT_READY`;
- `READY_FOR_ISOLATED_STAGING`;
- `STAGING_DEPLOYED_LOGIN_PENDING`;
- `STAGING_DEPLOYED_LOGIN_READY`;
- `READY_FOR_CONTROLLED_LIVE_APPROVAL`.

Do not call a candidate live-ready when staging, source readback, migration,
owner/admin login, or Day-One lead/CRM proof is missing.

## Phase 7 — Authorized isolated staging and operator login

Run this phase only after the candidate has green local/CI release gates or any
remaining failures are explicitly non-runtime proof gaps that do not risk the
staging data/service. This phase is authorized by `INPUT-MANIFEST.json`.

1. Inspect Railway access and inventory. Positively identify an existing isolated
   One Time staging project/service/database. If no safe isolated target exists,
   create a new clearly named One Time staging project with separate web, worker,
   and PostgreSQL resources. Never reuse BNA or production resources.
2. Record redacted project/environment/service/database fingerprints, backup/PITR
   availability, current source, environment mode, and rollback plan. Never print
   secrets, tokens, connection URLs, or row contents.
3. Configure sink/test-only provider modes and minimum required secrets through
   protected Railway variables. Do not copy a production secret merely because
   one exists. Stripe remains test mode. Real audience/family/school delivery is
   disabled by allowlist.
4. Apply the exact migration ledger to isolated staging, verify checksums and
   schema, then deploy the exact candidate SHA. Web and worker must be separate
   processes with graceful shutdown and non-overlapping consumers.
5. Seed only idempotent synthetic/demo fixtures plus the minimum real staging
   administrator identity for Shloimie Dratler. Do not import legacy sheets or
   real contacts.
6. Create Shloimie's administrator with exact allowed staging recipient
   `<PRIVATE_ADMIN_DESTINATION_REDACTED>`. If the verified test email provider can safely deliver
   only to that recipient, send exactly one activation. Otherwise create a
   pending activation and return a secure operator action; do not expose or
   commit the activation token and do not block the rest of staging.
7. Preserve Rabbi Eli Scheller as product owner in the authorization model, but
   do not invent his email/phone or send an invitation. Mark owner invitation as
   pending exact destination; Shloimie's real admin must still be able to test the
   allowed account-management product.
8. Run smoke tests against the deployed origin: health/source SHA, corrected
   public landing, Family/School synthetic signup, CRM/login/session/MFA,
   dashboard, classes/content, portal scopes, sink communications, restart,
   rollback readiness, request/bundle/performance and negative isolation.
9. Do not change `join.onetimeonetime.com` DNS in this run. Return the Railway
   staging URL. Root-domain cutover remains later.
10. If Railway authentication or provider test delivery is missing, do not stop
    or undo the candidate. Finish all other staging preparation and store one
    exact, redacted `STAGING-ACTIVATION-REMAINING.md` with commands/fields—not
    placeholders—to resume.

## Final response and durable handoff

Before ending for any reason, push a checkpoint and ensure `RESUME.md` is a
complete direct Codex execution instruction—not a summary and not a link to this
chat.

The final response must be concise and include:

- OT-80 result status;
- target repo/worktree/branch, exact base and head;
- draft PR URL;
- exact integrated source heads and any late-delta dispositions;
- migration renumbering and audience-model decision;
- communications catalog version and Day-One receipt/access/reminder result;
- test/CI/OT-76 certification matrix;
- isolated staging URL, deployed source SHA and health readback, if deployed;
- Shloimie activation/login status and exact safe next action;
- Rabbi owner invitation status;
- provider modes and explicit external mutations;
- only genuine remaining blockers with scope/owner;
- exact path to `ops/execution/ot-80/RESUME.md`;
- exact clean/dirty Git status.

Do not ask the operator to return to an old window, recover a prior prompt, fill
in a SHA placeholder, or manually explain what was already recorded in Git.
