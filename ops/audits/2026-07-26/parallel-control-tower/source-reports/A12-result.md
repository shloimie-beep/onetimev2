# A12 — Cross-repository contamination and decomposition audit

**Result path:** `ops/audits/2026-07-26/parallel-control-tower/A12-result.md`  
**Audit date:** 2026-07-27  
**Mode:** read-only  
**Repository A:** `shloimie-beep/onetimev2`  
**Pinned commit A:** `e986b5e6502b1168b3eb28e200fd49ac8de46477`  
**Repository B:** `shloimie-beep/bnei-neviim-academy`  
**Pinned commit B:** `cebbfc5781b92fcd9a5014df67f8ae4ba0b3a61c`  
**Mutations performed:** none

---

## 1. Executive verdict

**CONFIRMED CURRENT TRUTH — One Time is now architecturally authoritative in `shloimie-beep/onetimev2`, not in the legacy BNA repository.** Its pinned control sources require a standalone runtime, standalone database, product-owned sessions/cookies, product-owned CRM and outbox, and no BNA Operations shell or BNA session reuse.

**CONFIRMED CURRENT TRUTH — The pinned BNA tree still contains a broad executable One Time application surface.** This is not limited to old reports. It includes instance configuration, authentication assumptions, CRM and communication code, delivery workers, public/provider browser bundles, route aliases, provider configuration, Railway provisioning, smoke tests, and package scripts.

**NEW FINDING — BNA's default One Time instance contract is more coupled than the label “separate instance” implies.** `src/platform/instances/one-time.js` defaults to `canonical_codebase: bna-platform` and `database_scope: shared_database_scoped_rows`. Its separate-deployment companion creates separate infrastructure but continues to launch the BNA repository, use BNA-flavored runtime variables, and seed `bna_*` tables. The legacy implementation therefore achieved infrastructure separation without achieving source, schema, authentication, or model separation.

**NEW FINDING — The highest-risk decomposition error would be to “move the old app” mechanically.** BNA and One Time now contain different CRM/contact/session/outbox models. A file copy or database dump would create duplicate identities, duplicate delivery authority, and possible replay of historical outbox work. The required extraction is contract-first and reconciliation-first: preserve evidence, freeze ownership and identifiers, map data, prove the One Time replacement, then disable legacy execution. It is not a directory move.

**NEW FINDING — The current One Time support seam is an allowed asynchronous exception, not evidence that ordinary product routes depend synchronously on BNA.** The pinned One Time support route persists a local request and returns `202`; the BNA delivery configuration is default-off/fail-closed and is designed for asynchronous delivery. Current real BNA consumer deployment and contract-version compatibility remain **UNPROVEN**.

**CONFIRMED CURRENT TRUTH — Destructive cleanup is not authorized.** No BNA file, route, database row, branch, deployment, credential, provider object, or historical record should be deleted by an A12 follow-up until preservation, traffic, data reconciliation, rollback, retention, and Board gates have all passed.

### Overall status

`P1_ACTION_REQUIRED`, but **not a One Time launch blocker**. The safe immediate work is source-of-truth repair, preservation, and contract/inventory preparation. Broad BNA decomposition remains ordered after the controlled One Time pilot and the accepted A07/A08 decomposition decisions.

---

## 2. Scope, precedence, and evidence method

### 2.1 Audit boundary

This audit inspected repository-visible evidence at the two immutable checkpoints. It did not authenticate to production, inspect protected Railway variables, query a production database, request private routes, submit forms, invoke workers, or mutate GitHub or providers.

Static Git evidence proves that code/configuration exists and what its defaults say. It does **not** prove that a particular route, variable, database, worker, or provider is currently live. Every live-state conclusion below is classified accordingly.

### 2.2 Current authority order

1. In One Time, `ops/goals/CURRENT.yaml` points to `ops/goals/OT-LAUNCH-01/BOARD.yaml`; the Board is the only current status map.
2. One Time `AGENTS.md`, `SPEC.yaml`, and `DECISIONS.yaml` define the product isolation boundary.
3. BNA `BNA-START-HERE.md`, `ops/execution-runs/latest.json`, the pointed run, and BNA `AGENTS.md` describe legacy/current BNA control state but cannot override the One Time Board.
4. Open PR descriptions and historical run reports are evidence, not current product authority.
5. A05/A06 preservation and security rules remain binding: preserve before closure or cleanup; do not expose protected values; do not infer live safety from repository fixtures.

### 2.3 Evidence register

| Evidence ID | Repository / artifact | Relevant evidence |
|---|---|---|
| `EV-OT-AGENTS` | `onetimev2/AGENTS.md` at `e986...` | Standalone product; do not copy BNA server, Operations shell/assets, provider runtime, broad migrations, sessions, cookies, secrets, or product records. |
| `EV-OT-CURRENT` | `onetimev2/ops/goals/CURRENT.yaml` | Current goal pointer. |
| `EV-OT-BOARD` | `onetimev2/ops/goals/OT-LAUNCH-01/BOARD.yaml` | Only current status map; One Time launch ordering and accepted-source distinctions. |
| `EV-OT-SPEC` | `onetimev2/ops/goals/OT-LAUNCH-01/SPEC.yaml` | Standalone application/database, provider gates, product/account authority, separate BNA control-plane track. |
| `EV-OT-DECISIONS` | `onetimev2/ops/goals/OT-LAUNCH-01/DECISIONS.yaml` | One Time app database authority; separate bot identities; provider ownership boundaries. |
| `EV-OT-PACKAGE` | `onetimev2/package.json` | Independent TypeScript web/worker/bot/migration/test surface. |
| `EV-OT-CONFIG` | `onetimev2/packages/config/src/index.ts` | Own database, account/product keys, CSRF, provider modes, One Time bot configuration, and default-off BNA support seam. |
| `EV-OT-APP` | `onetimev2/apps/web/src/server/app.ts` | Dedicated cookie names: `otcrm_session`, `otcrm_csrf`, `otcrm_trusted_device`, and event-session cookie. |
| `EV-OT-DB` | `onetimev2/packages/db/migrations/0002_crm_auth_core.sql` | `onetime.account_users`, `onetime.user_sessions`, `onetime.contacts`, product/account scoping. |
| `EV-OT-CRM` | `onetimev2/packages/domain/src/crm/service.ts` | Independent CRM identity, idempotency, optimistic versioning, audit, and `onetime.contacts` access. |
| `EV-OT-SUPPORT` | `onetimev2/apps/web/src/server/features/support/router.ts` | Local entitlement check, local persistence/projection, and `202` submission path; mock/internal BNA endpoints are separated. |
| `EV-BNA-PACKAGE` | `bnei-neviim-academy/package.json` at `cebb...` | Large One Time script/test/provisioning/worker surface in BNA package. |
| `EV-BNA-START` | `bnei-neviim-academy/BNA-START-HERE.md` | Stale June “current handoff” text plus instruction to inspect later pointers. |
| `EV-BNA-LATEST` | `bnei-neviim-academy/ops/execution-runs/latest.json` | Still points to the July 12 shared CRM/communication-agent run. |
| `EV-BNA-STATUS` | `bnei-neviim-academy/ops/execution-runs/2026-07-12-shared-crm-communication-agents-addendum/STATUS.md` | Historical same-repository/same-commit deployment to BNA and One Time, shared instrumentation, provider shell, CRM, and communication-agent claims. |
| `EV-BNA-AGENTS` | `bnei-neviim-academy/AGENTS.md` | Calls BNA the shared brain and permits shared primitives; does not establish current One Time implementation authority. |
| `EV-BNA-INSTANCE` | `bnei-neviim-academy/src/platform/instances/one-time.js` | Default `bna-platform` codebase and `shared_database_scoped_rows`; single-tenant override required for separate DB. |
| `EV-BNA-SEPARATE` | `bnei-neviim-academy/src/platform/instances/one-time-separate-deployment.js` | Separate Railway project/service, but BNA runtime variables, legacy branch/tag assumptions, and `bna_*` seed tables. |
| `EV-BNA-PROVISION` | `bnei-neviim-academy/scripts/provision-onetime-railway-instance.mjs` | Provisions the BNA source as a One Time service; rejects the shared BNA project but does not create an independent code/schema model. |
| `EV-BNA-ADR` | `bnei-neviim-academy/docs/architecture/one-time-app-shell-adr-2026-07-13.md` | Historical accepted same-repo shell sharing auth, CRM identity, outbox, communication agents, ticketing, and release tooling. |
| `EV-BNA-ENV` | `bnei-neviim-academy/.env.example` | One environment template contains BNA core auth plus extensive One Time auth/provider/delivery settings. Values are blank; actual sharing remains unproven. |
| `EV-BNA-SITE` | `bnei-neviim-academy/config/service-provider-sites/one-time.json` | Legacy One Time route aliases and review links rooted in the BNA application. |
| `EV-BNA-BUNDLE-1` | `bnei-neviim-academy/public/js/one-time-single-tenant.js` | Same-origin BNA shell suppression through CSS/selectors and BNA instance-config endpoint. |
| `EV-BNA-BUNDLE-2` | `bnei-neviim-academy/public/js/one-time-portal-shell.js` | Rewrites legacy BNA/One Time aliases in the browser and treats shared routes as one shell. |
| `EV-BNA-BUNDLE-3` | `bnei-neviim-academy/public/js/one-time-provider-crm-route.js` | One Time CRM route registered inside the BNA provider-shell runtime. |
| `EV-BNA-CRM` | `bnei-neviim-academy/src/lib/bna/crm/contact-service.js` | Contact references resolve to `bna_contacts` / `bna_parent_leads`; service identifies itself as `bna_crm_contact_service_v1`. |
| `EV-BNA-OUTBOX` | `bnei-neviim-academy/src/lib/bna/one-time-delivery-outbox.js` | Executable One Time email, WhatsApp, Telegram, and reminder delivery construction inside BNA. |
| `EV-PR36` | One Time PR #36, inspected as historical integration evidence | OT89A local durable support receipt/outbox and asynchronous default-off BNA delivery. |
| `EV-PR97` | One Time PR #97, inspected as current conductor context | Board remains authority; PR is an integration record, not external-action authorization. |
| `EV-PR141` | BNA PR #141, open draft and post-checkpoint | Proposed durable Agent Action/control-plane work; not merged authority; one real multi-process DB proof remained skipped in the inspected description. |
| `EV-PR142` | BNA PR #142, open draft and post-checkpoint | Proposed isolated read-only BNA control bot with explicit no-One-Time dependency; provider remained off and no live canary was proven. |
| `EV-A05` | `A05-result.md` | Preservation before closure; local dirty work and unpreserved history remain unsafe. |
| `EV-A06` | `A06-result.md` | Existing security/privacy exposure and architecture-isolation findings; destructive/current-file remediation not authorized by audit alone. |
| `EV-DECOMP` | `BNA-CONTROL-PLANE-DECOMPOSITION.md` | Three independent applications, contract-only reuse, async signed minimized events, One Time first, legacy BNA retirement last. |
| `EV-WRITERS` | `one-time-bna-parallel-execution-prompt-pack-2026-07-26.md` | Fixed writer slots and E09/E10 dependency order. |

---

## 3. What was already settled and is not a new A12 finding

| Classification | Settled conclusion | A12 treatment |
|---|---|---|
| **CONFIRMED CURRENT TRUTH** | One Time must remain a standalone product with its own repository, database, sessions/cookies, deployment, and failure domain. | Binding architecture; not re-litigated. |
| **CONFIRMED CURRENT TRUTH** | BNA must not render/embed One Time or become a synchronous dependency for ordinary product pages. | Binding stop condition. |
| **CONFIRMED CURRENT TRUTH** | The eventual topology is standalone One Time, standalone BNA control plane, standalone BNA School, with legacy BNA as migration/evidence source. | Used as target ownership model. |
| **CONFIRMED CURRENT TRUTH** | One Time launch proceeds first; BNA decomposition is not an implicit launch prerequisite. | Preserved in execution order. |
| **CONFIRMED CURRENT TRUTH** | History, current files, and local work must be preserved and scanned before closure or cleanup. | Applied to every `ARCHIVE` and `DELETE-LATER` row. |
| **CONFIRMED CURRENT TRUTH** | Live secret values, live database sharing, public review-route exposure, and local dirty-worktree state cannot be inferred safely from tracked files alone. | Left **UNPROVEN**; no speculative claims. |

A12 adds precision where the earlier audits had identified broad contamination: the exact BNA instance defaults, the actual shape of the “separate” deployment, the independently evolved One Time CRM/session schema, the asynchronous support exception, and the concrete source-of-truth contradiction that changes extraction order.

---

## 4. Findings

### A12-F01 — One Time has a product-owned runtime, cookie namespace, and database schema

**Classification:** CONFIRMED CURRENT TRUTH  
**Priority:** P1 boundary evidence, not a defect

The One Time checkpoint defines and implements its own application composition. `apps/web/src/server/app.ts` names dedicated `otcrm_*` cookies. `0002_crm_auth_core.sql` creates `onetime.account_users`, `onetime.user_sessions`, authentication audit, and CRM fields. `packages/domain/src/crm/service.ts` performs account/product-scoped reads and writes against `onetime.contacts` with independent idempotency, optimistic conflict handling, and audit.

**Execution consequence:** BNA authentication/session rows and BNA contact primary keys are not legitimate runtime dependencies of current One Time. Any legacy data transfer must target One Time's model through a reconciliation/import contract; it must not restore the old shared model.

---

### A12-F02 — Executable One Time code remains broad in the pinned BNA tree

**Classification:** CONFIRMED CURRENT TRUTH  
**Priority:** P1

The pinned BNA package includes One Time runtime and operational surfaces across these exact families:

- `src/platform/instances/one-time.js`
- `src/platform/instances/one-time-separate-deployment.js`
- `src/lib/bna/one-time-*.js`
- One Time-dependent portions of `src/lib/bna/crm/**`
- `config/service-provider-sites/one-time.json` and other One Time brand/bot/provider configuration
- `public/one-time*`, `public/js/one-time*`, and One Time-specific public assets
- `scripts/*one-time*`, Railway provisioning, release, smoke, and database bootstrap scripts
- `tests/*one-time*` and One Time-specific execution evidence
- One Time package scripts in BNA's root `package.json`

`src/lib/bna/one-time-delivery-outbox.js` is executable transport construction, not merely a historical report. Browser modules register One Time routes inside the BNA shell. The BNA checkpoint commit itself records a One Time activation proof.

**Execution consequence:** BNA cannot yet be treated as a clean control-plane or school-only source. It remains a legacy compatibility runtime until traffic and data readback prove otherwise.

---

### A12-F03 — The BNA default One Time contract still declares shared code and shared-row database scope

**Classification:** NEW FINDING  
**Priority:** P1

`src/platform/instances/one-time.js` does not default to independent One Time ownership. Its default contract uses:

- `canonical_codebase: bna-platform`
- `database_scope: shared_database_scoped_rows`
- a scoped-workspace mode unless a separate single-tenant flag is explicitly selected

The same module contains a guard for separate domain/database/secrets, but the guard does not change the default architecture by itself.

**What is proven:** the tracked default contract is coupled.  
**What is unproven:** whether the default is still selected in any current production service.

**Execution consequence:** before disabling or archiving BNA runtime code, a read-only service-variable/deployment readback must prove which mode each surviving BNA/legacy service actually uses.

---

### A12-F04 — “Separate One Time Railway” in BNA separated infrastructure, not the application model

**Classification:** NEW FINDING  
**Priority:** P1

`src/platform/instances/one-time-separate-deployment.js` and `scripts/provision-onetime-railway-instance.mjs` create or describe a separate Railway project, service, database service, and public domain. That is useful failure-domain separation. However, the tracked deployment package still:

- launches the BNA repository/server;
- uses BNA-flavored process and cookie configuration;
- exposes generic `DATABASE_URL` / `SESSION_SECRET` assumptions from the BNA app;
- carries historical BNA branch/tag identifiers;
- seeds `bna_projects`, `bna_students`, `bna_course_lessons`, `bna_support_tickets`, and other `bna_*` tables.

Therefore this is a legacy single-tenant **deployment profile of BNA**, not the current standalone One Time code/schema.

**Execution consequence:** do not “lift and shift” this deployment into the current One Time repository. Preserve it as migration evidence and reconcile only missing behavior/data into the current product model.

---

### A12-F05 — Direct BNA code imports were not found in the inspected One Time composition, but an exhaustive negative is unproven

**Classification:** CONFIRMED CURRENT TRUTH for inspected files; UNPROVEN for the entire tree  
**Priority:** P2 verification

The inspected One Time app entrypoint imports its own `apps/**` and `packages/**` modules. Searches for the BNA repository name and `BNA_` symbols did not return indexed One Time code hits. One Time `AGENTS.md` also expressly prohibits BNA session/runtime reuse.

Repository search coverage is not acceptance proof. Generated files, unindexed blobs, migrations, tests, scripts, or post-checkpoint descendants could still contain BNA assumptions.

**Required proof:** a pinned-tree dependency scan that parses imports, runtime URLs, environment names, browser assets, SQL references, and package dependencies; it must emit a machine-readable zero/exception report.

---

### A12-F06 — Shared session/cookie architecture is historical in BNA; a current cross-domain cookie collision is unproven

**Classification:** NEW FINDING / UNPROVEN split  
**Priority:** P1

**Proven:**

- Current One Time defines independent `otcrm_*` cookie names and `onetime.user_sessions`.
- The legacy BNA One Time profile uses BNA's generic `SESSION_SECRET` and `BNA_COOKIE_SECURE` configuration family and historically shared the BNA auth/runtime contracts.
- The BNA same-repo ADR explicitly chose shared auth and workspace-scoped CRM/runtime contracts.

**Not proven:**

- the exact current BNA cookie name, domain, path, SameSite value, or signing secret;
- whether any current One Time and BNA services share a signing key;
- whether a browser currently sends the same cookie to both products.

**Execution consequence:** no password hash, session row, cookie, token, CSRF value, trusted-device record, or signing secret may be migrated. Legacy users must be reconciled by identity and activated/reset under the target product's own credentials.

---

### A12-F07 — Database models are duplicated and semantically divergent

**Classification:** NEW FINDING  
**Priority:** P1

BNA's contact service parses references as `bna_contacts` or `bna_parent_leads` and returns `bna_crm_contact_service_v1`. Current One Time owns `onetime.contacts`, `onetime.account_users`, `onetime.user_sessions`, product/account scoping, UUID/public identifiers, version checks, idempotency records, and CRM audit.

The BNA “separate instance” seed also uses BNA school/control-style tables rather than the `onetime` schema.

**Execution consequence:**

1. create an immutable source-ID map (`source_system`, `source_table`, `source_id` -> target public/contact key);
2. deduplicate by explicit policy, not merely normalized email/phone;
3. preserve provenance and conflicts;
4. never copy password/session hashes;
5. never point One Time at the BNA database for convenience;
6. do not delete source rows until reconciliation, retention, rollback, and operator approval pass.

---

### A12-F08 — Delivery and communication authority is duplicated; replay is the central cutover hazard

**Classification:** NEW FINDING  
**Priority:** P1

BNA contains executable One Time email/WhatsApp/Telegram outbox construction and retry/dead-letter behavior. Current One Time has its own product outbox/provider/HighLevel control model. The two codebases therefore contain overlapping concepts even when their schemas are not identical.

A blind migration of pending or failed legacy rows could send duplicate confirmations, reminders, replies, or alerts. Historical “processed” rows may also be needed as audit evidence without being eligible for replay.

**Required cutover rule:** classify each legacy row as one of `AUDIT_ONLY`, `ALREADY_EFFECTED`, `PENDING_REVIEW`, `SAFE_TO_RECREATE_AS_NEW_INTENT`, or `DO_NOT_MIGRATE`. No row is replayable merely because its old status says pending/failed.

---

### A12-F09 — BNA still contains One Time browser bundles and route rewriting

**Classification:** CONFIRMED CURRENT TRUTH  
**Priority:** P1

`one-time-single-tenant.js` hides BNA UI selectors and fetches a BNA instance-config endpoint; it does not create independent bundle ownership. `one-time-portal-shell.js` recognizes and rewrites BNA/One Time aliases in the browser. `one-time-provider-crm-route.js` registers a One Time CRM route module in the BNA provider shell.

**What is proven:** tracked browser contamination.  
**What is unproven:** whether these exact assets are currently served by a live public service or cached at a CDN/browser.

**Execution consequence:** asset retirement needs both source removal acceptance and deployed-asset/cache proof. Removing HTML routes while old JS remains cacheable, or removing JS while aliases still serve old HTML, is not a complete cutover.

---

### A12-F10 — Historical dual deployment is confirmed; current shared production deployment is unproven

**Classification:** SUPERSEDED/HISTORICAL plus UNPROVEN  
**Priority:** P1 readback

The BNA July 12/13 run records the same BNA repository line being deployed and live-smoked for both BNA and One Time, including shared instrumentation and One Time provider/CRM/communications surfaces. That is reliable historical evidence of cross-product production coupling.

The current One Time Board instead treats the standalone repository as authoritative and records the BNA production service restored to the pinned BNA baseline after a transient change. This audit did not perform protected deployment readback for every current service.

**Execution consequence:** do not infer either “still shared” or “fully separated” from old deployment reports. A separate read-only topology artifact must record current repository URL, exact source SHA, service/process, database attachment fingerprint, domain, cookie namespace, and active worker set for each product without rendering protected values.

---

### A12-F11 — The BNA support seam is asynchronous in current One Time request handling

**Classification:** NEW FINDING  
**Priority:** P2 / optional integration

The One Time support POST route checks local authentication/entitlement, saves locally, and returns `202`. The historical OT89 producer design uses a local outbox, signed asynchronous delivery, retry/dead-letter, and BNA outage isolation. BNA support URL/HMAC configuration exists, but modes default disabled/fail-closed.

This is compatible with the target architecture if:

- no ordinary One Time request waits for BNA;
- BNA outage never removes the local receipt;
- contract version/hash is pinned;
- delivery is idempotent/replay-safe;
- reverse status is asynchronous or explicitly optional;
- BNA sees only minimized support payloads and opaque product/account references.

**UNPROVEN:** current real BNA consumer deployment, exact v1/v2 compatibility, and a successful outage/reconciliation canary.

**Execution consequence:** this lane may remain provider-off and must not block One Time core launch.

---

### A12-F12 — The BNA route/domain inventory mixes current public identity with stale ownership assumptions

**Classification:** SUPERSEDED/HISTORICAL / UNPROVEN split  
**Priority:** P2

The public One Time domain remains a current One Time configuration value and is not classified stale merely because it appears in BNA history. The stale elements are the BNA ownership and compatibility assumptions around it, including:

- `/one-time` and `/one-time/*` as BNA-hosted product routes;
- `/provider.html?admin_provider=one-time`;
- `/operations?...` as a One Time product fallback;
- `/rabbi-member`, `/member-library`, legacy classroom/parent/student review aliases;
- old BNA source branch/tag identifiers in the separate-deployment plan;
- BNA public/review pages that describe implementation truth after the standalone repository became authoritative.

Whether each route still resolves or receives traffic is **UNPROVEN**.

**Execution consequence:** create a route-by-route compatibility register with one terminal disposition: `OWNED_BY_ONETIME`, `REDIRECT_TEMPORARILY`, `GONE_AFTER_CUTOVER`, `INTERNAL_BNA_ONLY`, or `PRESERVE_AS_EVIDENCE`. Do not use a blanket redirect that could expose internal routes or hide unresolved traffic.

---

### A12-F13 — BNA's current pointer still elevates a shared-runtime run above the standalone One Time truth

**Classification:** NEW FINDING  
**Priority:** P1 control-plane correctness

At the BNA checkpoint:

- `BNA-START-HERE.md` contains a stale June “current handoff” section;
- `ops/execution-runs/latest.json` points to the July 12 shared CRM/communication-agent run;
- that run records same-repo One Time/BNA deployment and shared runtime work;
- BNA `AGENTS.md` calls the repository the shared brain;
- current One Time control files state that One Time implementation truth belongs to the standalone repository and Board.

The BNA run is valid historical evidence but invalid current One Time implementation authority.

**Execution consequence:** E09-style BNA pointer repair precedes decomposition work. The repair must preserve the old run and add precedence, not erase or rewrite history.

---

### A12-F14 — PR #141 and PR #142 are useful target-shape evidence, not accepted decomposition state

**Classification:** UNPROVEN / post-checkpoint

The inspected open BNA drafts move toward the correct architecture: durable control-plane jobs, result-only One Time handoff, and an isolated read-only BNA control bot with no One Time imports/sessions/database. They remain open, stacked, mutable, and not part of the pinned BNA baseline. The inspected PR descriptions also record missing or not-yet-run protected proofs.

**Execution consequence:** preserve and adjudicate them after pointer repair. Do not merge them mechanically, and do not make One Time launch depend on their integration.

---

## 5. Requested boundary matrix

| Requested category | Repository-visible truth | Live-state verdict | Required disposition |
|---|---|---|---|
| One Time runtime/code/config in BNA | Broad executable surface confirmed. | Current serving/worker use unproven. | Preserve; inventory; prove replacement; deactivate later; archive; delete only under separate approval. |
| BNA imports/assumptions in One Time | No direct import found in inspected composition; async BNA support URL/config is explicit. | Exhaustive absence unproven. | Run dependency/reference scan; keep only versioned async seams. |
| Shared sessions/cookies | Historical BNA shared auth model; current One Time has `otcrm_*` cookies and `onetime.user_sessions`. | Current cookie/key collision unproven. | Read back namespaces; never migrate tokens/hashes; activation/reset only. |
| Shared databases | BNA default says shared scoped rows; separate profile seeds `bna_*`; One Time owns `onetime.*`. | Actual current DB attachment/topology unproven. | Read-only topology plus data inventory; independent target DB; no cross-app queries. |
| Shared secrets | BNA template contains BNA and One Time configuration families; values blank. | Value equality/current reuse unproven. | Fingerprint-only readback; distinct secret namespaces; rotate only if active reuse/exposure is proven and separately authorized. |
| Shared browser bundles | BNA One Time bundles and route rewrites confirmed. | Current delivery/cache unproven. | Route/asset manifest, cache proof, replacement acceptance, then archive/deactivate. |
| Shared production deployments | Historically confirmed from BNA run. | Current shared deployment unproven. | Exact service/source/DB/domain/process readback before cutover claims. |
| Synchronous cross-product calls | No synchronous BNA call in inspected support submission path; intended support is async. | Exhaustive absence unproven. | Static/runtime call graph; outage tests; prohibit ordinary route dependency. |
| Stale domains/routes | Stale BNA ownership/alias assumptions confirmed; public One Time domain itself remains current. | Traffic/resolution per route unproven. | Route-by-route terminal disposition; no blanket deletion. |
| Duplicated CRM/contact/communication models | Confirmed and semantically divergent. | Production data overlap/counts unproven. | Reconciliation contract and no-replay delivery cutover. |
| Contradictory source-of-truth statements | Confirmed between BNA latest run and One Time Board. | N/A | BNA pointer repair; Board remains sole One Time status authority. |

---

## 6. Target ownership contract

### 6.1 One Time owns

- public One Time web and metadata;
- One Time authentication, sessions, cookies, trusted-device and recovery state;
- account, adult user, household, learner, access, class, content, CRM/contact, consent/suppression, communication intent, audit, and product outbox records;
- One Time browser bundles and product UI;
- One Time providers and provider configuration under product-specific authorization;
- One Time migrations, backups, restore, deployment, rollback, workers, and health;
- local support receipt/status and the producer side of any optional BNA support bridge.

### 6.2 Standalone BNA control plane owns

- internal-only application registry;
- minimized deployment/health/worker/provider-readiness projections;
- redacted support escalation index and opaque deep links;
- selected agent-governance and operator decision records;
- its own authentication, session, database, deployment, secrets, bot identity, and audit;
- asynchronous signed inboxes and optional typed command requests only when separately accepted.

It does not own One Time contacts, sessions, message bodies, learners, classes, billing instruments, provider credentials, or full product UI.

### 6.3 Standalone BNA School owns

School-specific people, families, staff, rosters, attendance, school goals/rewards, school communications, school billing/administration, parent/student school portals, school content, and its own auth/session/database/deployment. It must not absorb One Time records or runtime.

### 6.4 Legacy `bnei-neviim-academy` owns during migration

- source evidence and immutable historical reports;
- temporary compatibility runtime only where current traffic is proven;
- read-only export/reconciliation tooling;
- archival manifests and rollback evidence.

Its end state is read-only archive or retirement after all product/control-plane cutovers. It must not remain the canonical source for current One Time implementation truth.

---

## 7. Exact keep / move / copy / archive / delete-later matrix

### 7.1 Disposition definitions

- **KEEP:** remains authoritative in its current owner repository.
- **MOVE:** transfer ownership or data through a new reconciliation/cutover process. It never means blindly copying source files or database rows.
- **COPY:** copy only immutable, versioned contracts, schemas, fixtures, public assets with established rights, or proven stateless algorithms. No runtime dependency is created.
- **ARCHIVE:** preserve provenance and disable current-authority/execution claims. Git history alone is not a sufficient operational archive unless an accepted manifest records exact paths/commits/checksums.
- **DELETE-LATER:** candidate for a separately authorized destructive phase only. Every such row is currently `NOT AUTHORIZED`.

| ID | Current scope | Classification | Disposition | Target / retained owner | Dependency and stop condition | Required proof | Destructive status |
|---|---|---|---|---|---|---|---|
| `KM-01` | `onetimev2/AGENTS.md`, `ops/goals/**`, product control contracts | CONFIRMED CURRENT TRUTH | **KEEP** | One Time | Stop if any BNA document is treated as equal current status authority. | Board pointer/hash validators and conductor readback. | N/A |
| `KM-02` | One Time `apps/**`, `packages/**`, `onetime.*` migrations, `otcrm_*` cookie contract | CONFIRMED CURRENT TRUTH | **KEEP** | One Time | Stop on BNA import, BNA DB credential, shared cookie name, or Operations bundle. | Import/env/SQL/bundle scan; app works with BNA unreachable. | N/A |
| `KM-03` | BNA `src/platform/instances/one-time*.js` | CONFIRMED CURRENT TRUTH / NEW FINDING | **ARCHIVE**, then **DELETE-LATER** | Legacy BNA archive | Requires current service topology, zero required traffic, standalone replacement, rollback window, and archive manifest. | Exact source SHA/service readback; route smoke; archive checksums. | **NOT AUTHORIZED** |
| `KM-04` | BNA `src/lib/bna/one-time-*.js` product runtime | CONFIRMED CURRENT TRUTH | **MOVE semantics only**; **ARCHIVE** source; **DELETE-LATER** live copies | Current One Time for genuinely missing behavior | Stop if a module is copied wholesale or creates a cross-repo import. | Semantic diff against One Time; focused parity tests; no duplicate outbox/provider owner. | **NOT AUTHORIZED** |
| `KM-05` | BNA One Time CRM adapters and `bna_contacts` / `bna_parent_leads` references | NEW FINDING | **MOVE data ownership by reconciliation**; retain BNA source during rollback | One Time `onetime.contacts` | Requires identity/dedupe/consent/provenance contract and read-only counts. Stop on unresolved collision or consent ambiguity. | Source-target count, conflict, orphan, duplicate, and field-loss reports; sampled operator review. | Source deletion **NOT AUTHORIZED** |
| `KM-06` | BNA One Time outbox, reminders, provider-delivery code and rows | NEW FINDING | **MOVE only uneffected business intent**; **ARCHIVE** audit; **DO NOT REPLAY** by default | One Time canonical outbox / provider dispatcher | Requires provider authority matrix and row adjudication. Stop if old pending/failed status is treated as send authority. | No-double-send simulation; idempotency/replay tests; row-classification manifest. | Row/code deletion **NOT AUTHORIZED** |
| `KM-07` | BNA One Time public/provider browser assets: `public/one-time*`, `public/js/one-time*`, related CSS/assets | CONFIRMED CURRENT TRUTH | **ARCHIVE**, then **DELETE-LATER** | One Time owns current bundles; BNA retains manifest | Requires route traffic/cache/CDN readback and accepted One Time UI replacements. | Bundle inventory/hashes, deployed asset probes, cache expiry/purge plan, no BNA selectors in One Time. | **NOT AUTHORIZED** |
| `KM-08` | BNA legacy One Time routes and aliases | SUPERSEDED/HISTORICAL / UNPROVEN | **KEEP temporary compatibility only where proven**, then redirect/gone; **ARCHIVE** route contract | One Time owns product routes; BNA internal routes remain BNA-only | Requires per-route traffic/auth/privacy classification. Stop on blanket redirects or internal-route exposure. | Route matrix, 30-day or accepted observation window, browser/security smoke, rollback. | Route removal **NOT AUTHORIZED** |
| `KM-09` | BNA `.env.example` One Time auth/provider/delivery namespaces and provisioning configuration | CONFIRMED CURRENT TRUTH | **ARCHIVE documentation**; remove legacy variables **DELETE-LATER** | Product secrets remain in each product's protected configuration only | Requires fingerprint-only live inventory and service-owner mapping. Stop before rendering values. | Variable-name/readiness matrix, service identity, no value equality, revocation plan if reuse proven. | Secret change/removal **NOT AUTHORIZED** |
| `KM-10` | BNA historical ADRs, execution runs, smokes, audit reports, raw prompts, review evidence | SUPERSEDED/HISTORICAL | **ARCHIVE / KEEP provenance** | Legacy BNA archive | Never rewrite history to make the old architecture appear not to have existed. | Source manifest, commit/path/checksum, current-authority banner. | Deletion **NOT AUTHORIZED** |
| `KM-11` | Versioned async support/control-plane schemas and test vectors | CONFIRMED CURRENT TRUTH target | **COPY** immutable contract/fixture only; each repo owns its adapter | One Time producer; BNA consumer/control plane | Requires exact version/hash and compatibility tests. Stop on shared package import or synchronous call. | Producer/consumer conformance, replay, outage, privacy, stale-version rejection. | N/A |
| `KM-12` | BNA generic stateless algorithms/patterns with product-neutral value | UNPROVEN until reviewed | **COPY only after extraction review** | Product-local package or new control-plane repo | Stop if code imports BNA models, env, database, sessions, routes, or brand. | Dependency-free unit tests and license/provenance note. | N/A |
| `KM-13` | BNA root package scripts/tests for One Time provisioning, deployment, smoke, and workers | CONFIRMED CURRENT TRUTH | **ARCHIVE**, then **DELETE-LATER** | Legacy BNA archive | Requires no active CI/release/deploy references and replacement evidence. | `git grep` consumer graph, CI matrix, package-script invocation audit. | **NOT AUTHORIZED** |
| `KM-14` | Current One Time optional BNA support producer | NEW FINDING | **KEEP** as default-off async producer; **COPY** frozen contract | One Time | Stop if user request waits on BNA, BNA outage loses receipt, or contract version drifts. | `202` local receipt, outage/retry/dead-letter, idempotent consumer, reverse-status test. | N/A |
| `KM-15` | BNA support/control-plane consumer implementation | UNPROVEN / post-checkpoint | **KEEP only after accepted integration**; otherwise preserve draft | Future BNA control plane | Requires exact accepted base, contract hash, DB durability, bot ownership, and Board assignment. | Real disposable DB process-restart proof, provider-off tests, isolated bot canary if authorized. | No merge/deploy by A12 |
| `KM-16` | BNA PR #141/#142 | UNPROVEN / post-checkpoint | **PRESERVE and adjudicate**; neither archive nor merge yet | BNA conductor | Requires pointer repair, exact ancestry/head readback, semantic scope review, and acceptance owner. | PR/head manifest, tests rerun, skipped-proof closure, no One Time launch dependency. | Closure/merge **NOT AUTHORIZED** |
| `KM-17` | Legacy BNA One Time database rows, blobs, attachments, audit, and identifiers | UNPROVEN live inventory | **KEEP protected**, **MOVE through audited import where required**, **DELETE-LATER** | Correct product owner | Requires PII classification, retention/legal policy, reconciliation, backup/restore, rollback expiry. | Counts/checksums without raw content, import report, restore rehearsal, operator signoff. | **NOT AUTHORIZED** |
| `KM-18` | BNA current pointers elevating the shared-runtime run | NEW FINDING | **MOVE current authority pointer to a bounded current-state handoff; ARCHIVE old run as history** | BNA control governance | Requires A07/E09 acceptance. Stop if a second status map is created or history is edited. | Pointer validator, protocol-drift check, links to old run and current One Time Board. | N/A |

---

## 8. Reconciliation contracts required before code retirement

### 8.1 Contact/identity contract

Minimum mapping fields, stored without raw report content:

```json
{
  "source_system": "legacy_bna",
  "source_entity": "bna_contacts|bna_parent_leads|other_reviewed_source",
  "source_id": "opaque-or-hashed-reference",
  "target_product": "one_time",
  "target_contact_key": "assigned-by-target",
  "match_basis": ["approved normalized identifiers or operator decision"],
  "conflict_state": "none|duplicate|ambiguous|suppressed|do_not_import",
  "consent_authority": "explicit-source-reference-or-unknown",
  "migration_state": "planned|imported|verified|rejected|rolled_back",
  "source_digest": "sha256",
  "import_batch_id": "opaque"
}
```

Rules:

- a matching email or phone does not by itself prove consent, household relation, role, or entitlement;
- learners remain local product identities and are not recreated as adult marketing contacts merely because a legacy table contains a row;
- source IDs are retained only as provenance, not reused as target primary keys;
- target writes are idempotent and produce conflict reports;
- passwords, session tokens, CSRF values, trusted-device tokens, and provider credentials are excluded.

### 8.2 Communication/outbox contract

Every legacy communication/outbox row must be adjudicated into exactly one state:

```text
AUDIT_ONLY
ALREADY_EFFECTED
PENDING_REVIEW
SAFE_TO_RECREATE_AS_NEW_INTENT
DO_NOT_MIGRATE
```

`SAFE_TO_RECREATE_AS_NEW_INTENT` requires a new target-side idempotency key, current consent/suppression evaluation, current provider authority, and a separately authorized execution budget. The old row is never sent directly.

### 8.3 Route contract

Every BNA One Time route gets:

```text
route
current_owner
current_auth_boundary
current_live_status
traffic_status
replacement_route
terminal_disposition
redirect_allowed
cache_asset_dependencies
rollback_route
proof_reference
```

Unknown traffic means `UNPROVEN`, not zero.

### 8.4 Cross-product event contract

Allowed:

- minimized health/version/readiness outcomes;
- opaque support escalation/status;
- bounded counts and repair reason codes;
- signed, versioned, idempotent asynchronous events;
- optional typed command requests only under separate capability/confirmation/audit acceptance.

Forbidden:

- product sessions/cookies;
- direct product-database access;
- CRM contacts or message bodies;
- learner/household records;
- provider credentials/IDs or replayable URLs;
- unrestricted logs/transcripts;
- browser token handoff or impersonation;
- synchronous dependency for landing, signup, login, CRM, classes, content, billing, parent, or student routes.

---

## 9. Required topology and live-state readback before deactivation

A separate read-only job must produce one row per deployed web/worker service:

| Field | Requirement |
|---|---|
| Product/application | Fixed enum: One Time, BNA legacy, BNA control plane, BNA School, unknown. |
| Repository | Exact remote identity; no historical alias substitution. |
| Source | Exact deployed commit/image digest and tree relationship. |
| Process | Web/worker/bot/migration; one owner. |
| Domain | Public hostname only; no private destinations. |
| Database attachment | One-way fingerprint and logical schema inventory only; no URL/value. |
| Session namespace | Cookie name/domain/path/SameSite/secure booleans, secret fingerprint only. |
| Provider namespace | Configuration/readiness booleans and owner; no values or protected IDs. |
| Active route families | Sanitized route templates and status. |
| Active worker families | Names, mode, heartbeat/staleness, no payload content. |
| Cross-product calls | Destination product, method, sync/async, timeout, failure behavior, schema version. |
| Authority | Current Board/decision reference. |

Stop and escalate if any ordinary One Time route has a synchronous BNA call, if both services attach to the same product tables, if cookie namespaces overlap, or if a BNA worker can deliver One Time customer communications after One Time becomes authoritative.

---

## 10. Execution order

### Wave 0 — safe now

1. Preserve this A12 report and exact evidence references.
2. Run/accept A07 bounded BNA pointer repair under `BNA-CONTROL`.
3. Complete the A05 preservation manifest for relevant branches/local work before any archival closure.
4. Perform read-only topology, route, data-model, and dependency scans; no product/provider writes.
5. Keep One Time launch work independent.

### Wave 1 — after Board assignment, without runtime cutover

1. Freeze the cross-repository ownership/event/identity/route contracts in two coordinated, independently testable draft PRs.
2. Produce read-only data counts/conflict reports and the no-replay outbox adjudication design.
3. Reconcile the existing One Time support contract version with the intended BNA consumer; keep real delivery off if incompatible or unproven.
4. Adjudicate PR #141/#142 after BNA pointer repair; do not merge by age or plausibility.

### Wave 2 — only after controlled One Time pilot acceptance and A07/A08 approval

1. Prove standalone One Time replacements and outage isolation.
2. Establish the accepted standalone BNA control-plane foundation and, separately, BNA School foundation.
3. Migrate only accepted data/contracts through rehearsed idempotent processes.
4. Disable legacy BNA One Time workers and product routes behind rollback gates; do not delete.
5. Observe traffic, delivery, data reconciliation, security, and rollback windows.

### Wave 3 — archive and retirement

1. Create the accepted archive/checksum/retention manifest.
2. Mark legacy paths non-authoritative and remove them from active CI/deploy composition only under an assigned bounded change.
3. After all stop conditions and an explicit operator/Board destructive decision, execute a separate delete-later job.
4. Preserve immutable history and source/data export evidence.

---

## 11. Recommended task register

Every implementation or repository write below requires an explicit assignment. Audit preparation alone creates no authority.

| Task | Classification | Dependency | Owner / writer slot | Exact write scope | Stop condition | Required proof | Board assignment required |
|---|---|---|---|---|---|---|---|
| `A12-T01` BNA pointer repair | CONFIRMED CURRENT TRUTH | A07 accepts bounded E09 repair; clean BNA base selected | `BNA-CONTROL` | `BNA-START-HERE.md`; `AGENTS.md` current-authority wording only; `ops/execution-runs/latest.json` only if the accepted pointer changes; one small handoff under the existing control structure | Stop if repair creates a second current status map, edits historical run content, or asserts One Time implementation state from BNA | Pointer validator, protocol-drift watchdog, secret scan, scoped diff, links to current One Time Board and preserved old run | **YES** |
| `A12-T02` contamination manifest | NEW FINDING | A05 preservation rules; pinned refs available | `OT-HYGIENE` for One Time evidence; `BNA-CONTROL` for BNA evidence, never same-repo overlap | New files only under `ops/decomposition/A12/`: `tracked-paths.json`, `route-matrix.csv`, `dependency-scan.json`, `topology-readback.schema.json`, `source-list.md` | Stop on protected values, raw data, local dirty-tree inclusion, or unpinned refs | Reproducible `git ls-files`/import/env/SQL scan with checksums and zero mutation report | **YES** |
| `A12-T03` contract-first extraction foundation | NEW FINDING | `A12-T01`; `A12-T02`; One Time controlled pilot accepted; A07/A08 approved; exact current bases selected | `OT-PRODUCT` for One Time PR; `BNA-CONTROL` for BNA/control-plane PR; sequential coordinated writers | New/changed contract and fixture files only under each repo's `ops/decomposition/A12/contracts/**`, `ops/decomposition/A12/fixtures/**`, and `ops/decomposition/A12/README.md`; no runtime, migration, route, provider, or deploy change | Stop on cross-repo package import, mutable shared schema source, unresolved contract version, or attempt to create deployment/data | Identical contract hash, independent validation in both repos, negative compatibility tests, outage/no-sync design proof | **YES** |
| `A12-T04` read-only data/model reconciliation | NEW FINDING | Accepted `A12-T03` identity and outbox contracts; protected DB access separately authorized | `BNA-PRODUCT` for source inventory; `OT-PRODUCT` for target dry-run, separate windows | Sanitized reports and import code in separately assigned exact paths; first phase may write only `ops/decomposition/A12/data/**`; no production row mutation | Stop on raw PII in artifacts, ambiguous identity/consent, count mismatch, missing backup, or any send-capable row import | Counts, digests, conflict/orphan/duplicate report, dry-run idempotency, disposable target DB rehearsal, rollback plan | **YES** |
| `A12-T05` support/control bridge acceptance | CONFIRMED CURRENT TRUTH target / UNPROVEN live | Contract hash accepted; BNA consumer base accepted; bot/provider ownership proven or provider-off | `OT-PRODUCT` producer and `BNA-CONTROL` consumer, separate PRs | Existing support/event adapter paths named by the accepted contract; no unrelated CRM or product UI | Stop if One Time request waits on BNA, local receipt can be lost, v1/v2 is weakened, payload contains forbidden data, or consumer duplicates | Local `202`, outage/retry/dead-letter, signature/replay/idempotency, compatibility, privacy, process-restart DB proof; optional bounded canary only under separate authority | **YES** |
| `A12-T06` legacy worker/route deactivation | NEW FINDING | `A12-T02` live topology; `A12-T04` reconciliation; standalone replacements accepted; rollback approved | `BNA-PRODUCT` | Exact legacy files/routes/workers enumerated by the accepted manifest; deactivation flags/route statuses only; no deletion | Stop on nonzero unexplained traffic, pending unadjudicated outbox, data mismatch, missing rollback, or current CI/deploy consumer | Exact-SHA staging, worker-off proof, route behavior, no-double-send, cache/bundle check, outage test, rollback rehearsal | **YES** |
| `A12-T07` archive manifest | CONFIRMED CURRENT TRUTH | `A12-T06` accepted and observation window complete; A05 preservation accepted | `BNA-CONTROL` plus `OT-HYGIENE` only for cross-repo preservation references | `docs/archive/legacy-onetime-runtime/README.md`; `ops/decomposition/A12/archive-manifest.json`; `ops/decomposition/A12/delete-later-proposal.md`; no source deletion/move | Stop on missing commit/blob, failed checksum, protected data in archive, or unexpired retention/rollback window | Commit/path/checksum manifest, source/data backup references, current-authority banners, restoration drill | **YES** |
| `A12-T08` destructive delete-later decision | UNPROVEN / NOT AUTHORIZED | `A12-T07`; legal/retention/privacy approval; zero traffic; backups/restores; operator decision | Operator + conductor first; writer assigned only afterward | A separately enumerated path/table/route list; never broad glob-only deletion | Any head drift, data discrepancy, unresolved audit reference, current consumer, rollback need, or missing operator approval | Fresh preservation verification, independent review, exact diff/SQL plan, restore proof, post-delete smoke | **YES — separate destructive authorization** |
| `A12-T09` PR #141/#142 disposition | UNPROVEN | `A12-T01`; preservation manifest; exact heads/bases/checks read back | `BNA-CONTROL` / PR-hygiene authority | PR metadata/handoff/integration decision only; no product deployment or provider activation | Stop on head drift, skipped required proof, unclear stacking, or One Time dependency | Ancestry/semantic manifest, focused rerun, accepted target base and owner | **YES** |

### Collision rules

- `OT-PRODUCT` must not run concurrently with another One Time product writer or release-convergence writer.
- `BNA-CONTROL` and `BNA-PRODUCT` must not edit the same BNA paths or share a dirty checkout.
- No decomposition writer edits `ops/goals/**`; only the One Time conductor may assign/update Board state.
- No archive or delete-later writer runs before preservation acceptance.
- No provider/browser writer is implied by any A12 repository prompt.
- No BNA task may block the current One Time launch-critical chain unless the One Time Board explicitly changes that dependency.

---

## 12. Contract-first extraction prompt

**Status:** READY FOR BOARD ASSIGNMENT; implementation is contract/fixture-only.  
**Mode:** Codex Agent, high reasoning, two clean worktrees, one repository at a time.  
**No deployment, migration, real data, provider, route, or runtime changes.**

```text
# A12-CONTRACT-FIRST — CROSS-REPOSITORY DECOMPOSITION CONTRACTS ONLY

Repositories and audit baselines:

1. shloimie-beep/onetimev2
   audit checkpoint: e986b5e6502b1168b3eb28e200fd49ac8de46477
2. shloimie-beep/bnei-neviim-academy
   audit checkpoint: cebbfc5781b92fcd9a5014df67f8ae4ba0b3a61c

Before work:

- Read A12-result.md, A05-result.md, A06-result.md, accepted A07/A08 results,
  the One Time current goal/Board, and the accepted BNA pointer repair.
- Dynamically resolve the exact clean current base authorized by the Board for
  each repository; record audit checkpoint, selected base, ancestry, branch,
  and head. Never assume the audit checkpoint is the implementation base.
- Use separate clean external worktrees. Do not touch an existing dirty BNA or
  One Time checkout.
- Verify that the One Time controlled pilot and A07/A08 dependency gates named
  by A12 are accepted. If not, write a blocked handoff and stop without edits.
- Confirm one writer slot at a time: OT-PRODUCT for One Time and BNA-CONTROL for
  BNA. Do not run another product/control writer in either repository.

Goal:

Freeze the versioned contracts required to decompose legacy BNA without moving
runtime code, migrating data, changing routes, deploying, or enabling providers.
The two repositories must remain independently buildable and testable. Neither
repository may import code or packages from the other.

Exact write scope in each repository:

- ops/decomposition/A12/README.md
- ops/decomposition/A12/contracts/**
- ops/decomposition/A12/fixtures/**
- ops/decomposition/A12/reports/**
- tests or validators whose only purpose is validating those new immutable
  contracts/fixtures, after recording their exact paths in the task state

Do not edit app runtime, root composition, migrations, existing database code,
provider code, public routes, browser bundles, deployment configuration,
secrets, Board files, or historical reports.

Required contracts:

1. APPLICATION-OWNERSHIP.v1.json
   - One Time, BNA control plane, BNA School, legacy BNA
   - repository/database/session/cookie/deploy/worker/browser-bundle ownership
   - prohibited runtime sharing

2. CROSS-PRODUCT-EVENT.v1.schema.json
   - stable event ID, schema version, occurred-at, source SHA, account/product
     scope, payload kind, minimized payload, signature metadata, dedupe,
     ordering when required, retry/dead-letter, staleness
   - no contacts, message bodies, learners, households, class links, invoices,
     provider IDs, credentials, raw logs, sessions, cookies, or unrestricted URLs

3. SUPPORT-BRIDGE.vNEXT.schema.json
   - reconcile the currently accepted producer/consumer versions without
     weakening an older strict version
   - local One Time receipt, asynchronous delivery, BNA outage isolation,
     idempotent consumer, reverse status, redaction, retention

4. IDENTITY-RECONCILIATION.v1.schema.json
   - source system/entity/opaque source reference, target key, match basis,
     conflict state, consent authority, migration state, digests, batch ID
   - explicitly excludes password/session/token/provider-secret transfer

5. LEGACY-OUTBOX-ADJUDICATION.v1.schema.json
   - exactly AUDIT_ONLY, ALREADY_EFFECTED, PENDING_REVIEW,
     SAFE_TO_RECREATE_AS_NEW_INTENT, or DO_NOT_MIGRATE
   - no legacy row is directly replayable

6. ROUTE-CUTOVER.v1.schema.json
   - current owner/auth/live/traffic state, replacement, redirect permission,
     cache dependency, terminal disposition, rollback and proof

7. TOPOLOGY-READBACK.v1.schema.json
   - repository/source/process/domain/database fingerprint/session namespace/
     provider readiness/route family/worker family/cross-product call/authority
   - no protected values

8. CONTRACT-HASHES.json
   - SHA-256 for every canonical contract and fixture

Required fixtures and negative cases:

- valid minimized health event;
- valid support event and status;
- duplicate/replayed event;
- stale/wrong-version event;
- cross-product/account mismatch;
- forbidden PII/content/provider field;
- BNA unavailable while One Time returns a durable local receipt;
- ambiguous identity and do-not-import decision;
- legacy pending outbox row that is not send authority;
- route with unknown traffic that cannot be deleted;
- no shared cookie/session/database/browser-bundle contract.

Validation:

- contract hashes match across repositories;
- each repository validates fixtures independently;
- no cross-repo import, git submodule, workspace link, package URL, database URL,
  synchronous HTTP call, session/cookie reuse, or browser-bundle sharing;
- secret/PII/provider-URL scans pass;
- git diff --check and scoped formatting pass;
- no external effect and no production mutation.

Output:

- one clean draft PR per repository against its authorized base;
- exact base/head/branch/PR and contract hashes;
- tests actually run;
- unresolved contract/version decisions;
- explicit zero counts for deploys, data writes, provider calls, sends, charges,
  meetings, uploads, DNS changes, and secret changes;
- stable sanitized handoff in each repository.

Stop conditions:

- missing Board assignment or dependency acceptance;
- dirty/untrusted base;
- contract disagreement that cannot be represented as a new explicit version;
- any request to move runtime, migrate real data, alter a route, deploy, or
  activate a provider;
- any protected value or raw customer/Student content appearing in an artifact.
```

---

## 13. Archive prompt

**Status:** NOT RUNNABLE until `A12-T06` cutover acceptance, observation window, A05 preservation acceptance, retention approval, and a separate Board assignment.  
**This prompt creates an archive manifest and delete-later proposal only. It does not delete or move executable files.**

```text
# A12-ARCHIVE — LEGACY ONE TIME ARCHIVE MANIFEST, NO DELETION

Repository:
shloimie-beep/bnei-neviim-academy

Preconditions:

- accepted A12-result.md;
- accepted A05 preservation manifest;
- accepted BNA current-pointer repair;
- accepted standalone One Time replacement and controlled pilot;
- accepted A12 route/topology/data/outbox reconciliation evidence;
- accepted legacy-worker and legacy-route deactivation with rollback proof;
- completed observation window with zero unexplained traffic, no unadjudicated
  outbox rows, and no active CI/deploy/runtime consumer;
- explicit BNA-CONTROL Board assignment for archive-manifest work only.

Use a new clean worktree and dynamically resolve the exact authorized base.
Record the audit checkpoint cebbfc5781b92fcd9a5014df67f8ae4ba0b3a61c,
selected base, ancestry, branch, and head. Stop on head drift or a dirty checkout.

Goal:

Create an immutable, sanitized archive manifest for legacy One Time material in
BNA and a separately reviewable delete-later proposal. Preserve history and
restoration evidence. Do not delete, git-move, disable, deploy, change DNS,
change providers, mutate databases, rotate secrets, close PRs, or alter current
One Time runtime.

Exact write scope:

- docs/archive/legacy-onetime-runtime/README.md
- ops/decomposition/A12/archive-manifest.json
- ops/decomposition/A12/archive-checksums.txt
- ops/decomposition/A12/archive-consumer-graph.json
- ops/decomposition/A12/delete-later-proposal.md
- one sanitized archive handoff under the existing BNA control structure

Inventory tracked paths using the accepted A12 manifest and fresh expansion of:

- src/platform/instances/one-time*
- src/lib/bna/one-time*
- One Time-dependent portions of src/lib/bna/crm/**
- config/**/*one-time* and reviewed Rabbi/One Time provider configuration
- public/one-time*, public/js/one-time*, public/css/one-time*, and reviewed
  One Time-specific assets
- scripts/*one-time*, tests/*one-time*, and One Time package scripts
- historical One Time ADRs, execution runs, smokes, reports, prompts, and review
  artifacts
- legacy migrations/tables/rows only by schema/name/count/digest; never raw data

For each path/object record:

- exact commit/blob SHA and checksum;
- classification: runtime, config, browser asset, test, evidence, data schema,
  historical report, or unknown;
- current consumer graph;
- replacement proof;
- route/worker/data relationship;
- retention classification;
- rollback/restoration reference;
- proposed terminal action: KEEP_HISTORY, KEEP_COMPATIBILITY,
  ARCHIVE_NONAUTHORITATIVE, or DELETE_LATER_REVIEW;
- exact reason deletion is or is not safe.

Archive README requirements:

- state that current One Time implementation truth belongs to
  shloimie-beep/onetimev2 and its Board;
- explain that the BNA material is historical/migration evidence;
- link to the accepted route, topology, identity, outbox, and data reports;
- prohibit resuming legacy One Time implementation from the archive;
- document restoration and provenance.

Delete-later proposal requirements:

- enumerate exact candidate paths/tables/routes; no broad unexpanded glob;
- list every prerequisite and independent reviewer;
- include backup/restore, rollback, cache, traffic, data, outbox, CI, deploy,
  secret, and provider gates;
- state prominently: DESTRUCTIVE CLEANUP NOT AUTHORIZED;
- contain no deletion command, SQL DROP/DELETE, branch deletion, force push,
  provider mutation, or credential rotation command.

Verification:

- every candidate exists at the selected head or is marked drifted;
- every blob is reachable/preserved;
- checksums reproduce;
- no protected values, customer/Student data, raw message content, private
  destination, provider ID, or replayable URL is rendered;
- consumer graph shows no current runtime/CI/deploy dependency for every
  DELETE_LATER_REVIEW candidate;
- secret scan, protocol-drift watchdog, scoped formatting, and diff check pass;
- external effects and production mutations remain zero.

Output one small draft PR and a sanitized handoff. Do not merge or execute the
delete-later proposal. Stop on any missing preservation object, current consumer,
traffic/data discrepancy, retention ambiguity, or rollback failure.
```

---

## 14. P0 / P1 / P2 summary

### P0

**No confirmed P0 was established from the pinned repositories alone.** A live shared production database, shared signing secret, active duplicate sender, or current cross-product session collision would be P0, but each remains **UNPROVEN** pending protected readback.

### P1

1. **NEW FINDING:** BNA's default One Time instance still declares BNA canonical code and shared-row database scope.
2. **NEW FINDING:** the BNA “separate deployment” is infrastructure-separated but still BNA-source/BNA-schema/BNA-auth shaped.
3. **NEW FINDING:** CRM/contact/session/outbox models have diverged; mechanical copy or row replay is unsafe.
4. **CONFIRMED CURRENT TRUTH:** executable One Time routes, browser bundles, provider code, workers, and scripts remain in BNA.
5. **NEW FINDING:** BNA's current pointer still elevates a shared-runtime run above the standalone One Time authority.
6. **UNPROVEN:** current service/database/cookie/secret/worker topology must be read back before deactivation or claims of full separation.

### P2

1. Legacy BNA route aliases, branch/tag assumptions, and review assets need route-specific archival disposition.
2. One Time's optional BNA support bridge can remain default-off and asynchronous; real consumer/version acceptance remains unproven.
3. PR #141/#142 should be preserved and adjudicated after pointer repair, not treated as current baseline or launch dependency.
4. A complete static dependency scan is still required to turn the sampled “no BNA import” result into acceptance evidence.

---

## 15. Source list

### 15.1 Immutable repository checkpoints

- `shloimie-beep/onetimev2` at `e986b5e6502b1168b3eb28e200fd49ac8de46477`
- `shloimie-beep/bnei-neviim-academy` at `cebbfc5781b92fcd9a5014df67f8ae4ba0b3a61c`

### 15.2 One Time current control and implementation

- `AGENTS.md`
- `ops/goals/CURRENT.yaml`
- `ops/goals/OT-LAUNCH-01/SPEC.yaml`
- `ops/goals/OT-LAUNCH-01/BOARD.yaml`
- `ops/goals/OT-LAUNCH-01/DECISIONS.yaml`
- `package.json`
- `packages/config/src/index.ts`
- `packages/db/migrations/0002_crm_auth_core.sql`
- `packages/domain/src/crm/service.ts`
- `apps/web/src/server/app.ts`
- `apps/web/src/server/features/support/router.ts`

### 15.3 BNA legacy runtime/control evidence

- `BNA-START-HERE.md`
- `AGENTS.md`
- `ops/execution-runs/latest.json`
- `ops/execution-runs/2026-07-12-shared-crm-communication-agents-addendum/STATUS.md`
- `package.json`
- `.env.example`
- `scripts/railway-start.mjs`
- `src/platform/instances/one-time.js`
- `src/platform/instances/one-time-separate-deployment.js`
- `scripts/provision-onetime-railway-instance.mjs`
- `scripts/generate-onetime-separate-instance-package.mjs`
- `docs/architecture/one-time-app-shell-adr-2026-07-13.md`
- `config/service-provider-sites/one-time.json`
- `public/js/one-time-single-tenant.js`
- `public/js/one-time-portal-shell.js`
- `public/js/one-time-provider-crm-route.js`
- `src/lib/bna/crm/contact-service.js`
- `src/lib/bna/one-time-delivery-outbox.js`

### 15.4 Contextual PR evidence, not immutable baseline authority

- One Time PR #36 — historical OT89A producer evidence
- One Time PR #97 — conductor context
- BNA PR #141 — open draft, post-checkpoint
- BNA PR #142 — open draft, post-checkpoint

### 15.5 Prior audit and decomposition evidence

- `A01-result.md`
- `A05-result.md`
- `A06-result.md`
- accepted A07/A08 result artifacts when available to the conductor
- `BNA-CONTROL-PLANE-DECOMPOSITION.md`
- `one-time-bna-parallel-execution-prompt-pack-2026-07-26.md`

---

## 16. Final determination

**CONFIRMED CURRENT TRUTH.** A12 performed no repository, provider, deployment, database, route, secret, session, or customer-data mutation.

**CONFIRMED CURRENT TRUTH.** The legacy BNA repository must be treated as a compatibility/migration source containing active-capable One Time code, not as a clean current BNA control-plane source.

**NEW FINDING.** The BNA single-tenant/separate-deployment work is not a suitable extraction source by itself because it preserves BNA code, schema, auth, and model assumptions behind separate infrastructure.

**NEW FINDING.** The safe decomposition unit is a set of versioned ownership, identity, outbox, route, topology, and async-event contracts followed by reconciled cutovers. It is not a shared package, shared database, copied frontend, or synchronous control-plane bridge.

**CONFIRMED CURRENT TRUTH.** The next safe repository action is bounded BNA pointer repair and evidence/contract preparation under assignment. Runtime deactivation, archive execution, data migration, provider activation, and destructive cleanup remain gated.

```text
CONTROL-TOWER-RETURN
AUDIT_ID: A12
REPOSITORY: shloimie-beep/onetimev2 + shloimie-beep/bnei-neviim-academy
EXACT_COMMIT: e986b5e6502b1168b3eb28e200fd49ac8de46477 + cebbfc5781b92fcd9a5014df67f8ae4ba0b3a61c
VERDICT: P1_ACTION_REQUIRED; standalone One Time is authoritative; legacy BNA remains a contaminated compatibility/migration source; no destructive cleanup authorized.
P0: None confirmed. Live shared DB, shared signing secret, duplicate sender, or cookie collision remain UNPROVEN pending protected readback.
P1: BNA default shared-code/shared-row contract; infrastructure-only separation; duplicated CRM/session/outbox models; executable BNA One Time runtime/bundles/workers; stale BNA current pointer.
P2: Route/asset archival, exhaustive dependency scan, optional async support acceptance, and PR141/142 adjudication.
CURRENT_BLOCKER: Board assignment plus BNA pointer repair, preservation, live topology/data/outbox readback, controlled One Time pilot acceptance, and accepted A07/A08 gates.
SAFE_PARALLEL_TASK: BNA E09 pointer repair and read-only A12 contamination/topology manifests; One Time launch continues independently.
WRITER_SLOT: BNA-CONTROL first; then coordinated OT-PRODUCT and BNA-CONTROL contract-only writers; OT-HYGIENE for preservation.
ASSIGNMENT_REQUIRED: YES
EXECUTION_PROMPT_READY: CONTRACT_FIRST_READY_AFTER_ASSIGNMENT; ARCHIVE_PROMPT_NOT_RUNNABLE
EXECUTION_PROMPT_MODE: Codex Agent, high reasoning, separate clean worktrees, no provider/browser access.
EXECUTION_PROMPT_BRANCH: codex/a12-cross-repo-contracts in each repo; later codex/a12-legacy-onetime-archive-manifest in BNA only.
FORBIDDEN_OVERLAPS: No parallel product writers; no non-conductor Board edits; no dirty BNA checkout; no runtime/data/route/provider/deploy mutation from contract prompt; no archive before cutover; no delete before separate destructive approval.
END-CONTROL-TOWER-RETURN
```
