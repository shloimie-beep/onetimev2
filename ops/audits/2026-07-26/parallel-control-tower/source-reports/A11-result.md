# A11 — One Time Code Architecture and Security Audit

**Audit date:** 2026-07-27  
**Mode:** Read-only source, control-plane, and accepted-evidence audit  
**Intended commit path:** `ops/audits/2026-07-26/parallel-control-tower/A11-result.md`  
**Repository:** `shloimie-beep/onetimev2`  
**Immutable audit commit:** `e986b5e6502b1168b3eb28e200fd49ac8de46477`  
**Repository changes performed:** None  
**Provider actions performed:** None  
**Database mutations performed:** None  
**Deployment actions performed:** None  

## 1. Scope, evidence order, and audit boundary

This audit inspected the One Time application architecture at the pinned commit and prioritized P0/P1 correctness and security over style. The required areas were:

- authentication, sessions, CSRF, and rate limiting;
- Parent/Student and sibling isolation;
- access projection and revocation;
- transactional outbox behavior;
- HighLevel dispatch and provider gates;
- Zoom grant, replay, session, and origin boundaries;
- protected content upload, worker leases, publication, and revocation;
- Telegram confirmation and replay;
- migration ordering, checksums, and concurrency;
- production/staging configuration separation;
- public/authenticated bundle separation;
- error, privacy, and cache behavior;
- material test blind spots.

The evidence order used in this report was:

1. the exact pinned source tree;
2. canonical One Time Board and goal evidence available at the checkpoint;
3. accepted audit results and handoffs, especially A01, A02, A04, A05, A06, and A10;
4. accepted GitHub Actions results attached to the pinned commit;
5. mutable deployment and PR metadata only as dated supporting evidence, never as a replacement for immutable source.

The audit did **not**:

- open Zoom, HighLevel, Resend, WhatsApp, Telegram, Railway, or another provider;
- send a message, create a provider object, consume a real classroom grant, or use a customer identity;
- connect to production or staging databases;
- execute migrations;
- inspect protected provider destinations or credentials;
- render protected deployment identifiers in this report;
- inspect the operator’s current local worktrees or unpushed commits;
- edit the Board, a PR, a branch, a file, a deployment, or a provider.

Those limits matter. A code defect is classified as confirmed when the pinned source directly establishes it. Whether that defect is exposed in the current live production or staging deployment is separately classified as **UNPROVEN** unless exact live source attestation establishes it.

---

## 2. Classification and severity model

### 2.1 Conclusion classifications

- **NEW FINDING** — a material code or acceptance delta not already represented accurately in the current control plane.
- **CONFIRMED CURRENT TRUTH** — directly supported by the pinned source or accepted current evidence and still relevant to execution.
- **SUPERSEDED/HISTORICAL** — true of an earlier state but not authoritative for the pinned source or current execution.
- **UNPROVEN** — consequential but not established by the permitted evidence.

### 2.2 Severity

- **P0** — confirmed active compromise, unrestricted private-data disclosure, cross-tenant access, or a remotely exploitable condition with immediate production impact.
- **P1** — a confirmed correctness/security defect that can produce duplicate external effects, weaken production controls, expose protected operational metadata, break contractual access, or mutate data under a read-only command.
- **P2** — a bounded reliability or privacy defect that does not presently establish duplicate business mutation, unauthorized access, or immediate release compromise.

---

## 3. Executive determination

**Overall status: `P1_ACTION_REQUIRED`.**

| Severity | Count | Determination |
|---|---:|---|
| P0 | 0 | No confirmed active compromise, cross-household disclosure, unrestricted protected-data exposure, or current live credential disclosure was established. |
| P1 | 6 | Six source-confirmed defects require assigned repair and exact acceptance before the relevant release/provider boundary is activated. |
| P2 | 1 | Telegram response replay can duplicate operator-facing replies across a crash boundary, although the confirmed business mutation path remains replay-protected. |

### 3.1 P1 findings

| ID | Classification | Boundary | Exact consequence |
|---|---|---|---|
| A11-P1-01 | **NEW FINDING** | General delivery outbox | Provider idempotency changes on every retry, so an accepted-but-unrecorded provider operation can be repeated. |
| A11-P1-02 | **NEW FINDING** | Production/staging configuration | Three independent environment classifications can disagree; production runtime defaults and production-only controls do not share one canonical deployment class. |
| A11-P1-03 | **NEW FINDING** | Public diagnostics/privacy/cache | Unauthenticated `/version` and `/ready` disclose deployment topology, migration/provider state, blockers, and partially sanitized raw dependency errors. |
| A11-P1-04 | **NEW FINDING** | Zoom/classroom grant transport | A replayable bearer secret is placed in the request URL path before one-time consumption. |
| A11-P1-05 | **NEW FINDING** | Parent/Student household access | Learner creation and restoration do not enforce the three-active-learner contract, while classroom join blocks every learner when the household exceeds three. |
| A11-P1-06 | **NEW FINDING** | Migration verification | `db:verify` invokes the same mutating migration-apply loop as `db:migrate`. |

### 3.2 P2 finding

| ID | Classification | Boundary | Exact consequence |
|---|---|---|---|
| A11-P2-01 | **NEW FINDING** | Telegram response outbox | Response enqueue and inbox completion are not atomic, and retry generates a new correlation key; a crash can create a second reply row. |

### 3.3 Release and execution effect

**CONFIRMED CURRENT TRUTH —** This report does **not** replace or expand the currently authorized Zoom provider task. The existing PR #105 lane remains cleanup-only and remains the exact next executable provider task.

**NEW FINDING —** A11 adds source-level acceptance prerequisites to later work:

- A11-P1-04 must be repaired before a new normal-Student Zoom join canary relies on this classroom launch path.
- A11-P1-02, A11-P1-03, A11-P1-05, and A11-P1-06 must be closed before a full production candidate is accepted.
- A11-P1-01 must be closed before any real general-delivery provider activation or customer-send authority.
- A11-P2-01 must be closed before real Telegram response delivery is enabled.
- All repairs require a new Board assignment and one nonoverlapping One Time product writer. This audit grants no implementation authority.

**UNPROVEN —** The accepted product source and current live production/staging sources are not established by this audit as the pinned A11 commit. Therefore, this report does not claim that every source defect is currently reachable on a live public deployment.

---

# 4. Detailed findings

## A11-P1-01 — Retry-specific provider idempotency can duplicate external delivery

**Classification:** **NEW FINDING**  
**Severity:** **P1**  
**Affected boundary:** General email/WhatsApp delivery worker  
**Live external duplication established:** **UNPROVEN**  
**Code defect established:** **Yes**

### Exact source evidence

1. `packages/domain/src/delivery/activation-policy.ts:168-170` defines:

   ```ts
   export function providerAttemptIdempotencyKey(idempotencyKey: string, attempt: number) {
     return `${idempotencyKey}:attempt-${attempt}`;
   }
   ```

2. `apps/worker/src/delivery/provider-router.ts:164-167` passes that attempt-qualified value to the email provider.

3. `apps/worker/src/delivery/provider-router.ts:199-202` does the same for WhatsApp.

4. `apps/worker/src/delivery/worker.ts:74-105` performs the provider operation before durable delivery completion.

5. `apps/worker/src/delivery/worker.ts:144-177` records completion or retry in a later repository operation.

6. The router’s accepted-receipt cache is process memory, not durable state. It cannot survive process loss.

### Failure sequence

A valid failure sequence is:

1. the worker claims logical delivery `D`;
2. the provider accepts attempt 1;
3. the response is lost, times out, or the process exits before durable completion;
4. the outbox lease expires or the row is retried;
5. attempt 2 uses a **different** provider idempotency key;
6. the provider is allowed to accept the same logical external effect again.

This is not solved by the database outbox’s natural key. The database prevents duplicate logical rows; it does not prevent a provider from accepting two operations when the provider-facing idempotency key changes.

### Risk

- duplicate account-security or lifecycle email;
- duplicate WhatsApp confirmation or reminder;
- inconsistent provider receipt reconciliation;
- false assurance from an outbox row that appears singular while the external side effect is plural;
- a crash-only defect that ordinary success-path tests will not expose.

### Existing controls that remain valid

**CONFIRMED CURRENT TRUTH —**

- provider mode is fail-closed by default;
- exact environment, authorization, destination, consent, and budget gates exist;
- row claiming uses leases and fencing;
- provider references are redacted before ordinary persistence;
- no live duplicate send was proved by this audit.

Those controls reduce reachability. They do not repair the exactly-once boundary once provider execution is authorized.

### Minimal repair prompt

> **NOT RUNNABLE UNTIL BOARD-ASSIGNED**
>
> Preserve the logical delivery idempotency key across every retry. Remove the attempt suffix from provider-facing idempotency. Persist a durable provider-operation state keyed by the logical delivery and provider. Distinguish `not_started`, `in_flight`, `accepted`, `rejected`, and `acceptance_unknown`. On timeout or crash after dispatch, retry with the same provider key or reconcile; never mint a second key. If a provider cannot reconcile safely, quarantine the row as acceptance-unknown rather than resend. Add deterministic fault-injection tests for provider acceptance followed by timeout, process loss before completion, lease expiry, and two workers racing. Prove one provider effect, one durable logical delivery, and no real provider call.

---

## A11-P1-02 — Environment classifications can disagree and bypass production-only controls

**Classification:** **NEW FINDING**  
**Severity:** **P1**  
**Affected boundary:** Configuration, secure cookies, production guards, migration and mock/runtime separation  
**Current live misconfiguration established:** **UNPROVEN**  
**Code defect established:** **Yes**

### Exact source evidence

1. `packages/config/src/index.ts:60-68` defines a delivery environment derived from `NODE_ENV`.

2. `packages/config/src/index.ts:70-112` declares independent values for:

   - `NODE_ENV`;
   - `DELIVERY_ENVIRONMENT`;
   - `ONE_TIME_RUNTIME_ENVIRONMENT`.

3. `packages/config/src/index.ts:271-273` computes One Time runtime as:

   ```ts
   parsed.ONE_TIME_RUNTIME_ENVIRONMENT ??
     (parsed.NODE_ENV === 'test' ? 'test' : 'local')
   ```

   Therefore, `NODE_ENV=production` with no explicit One Time runtime becomes `local`, not `production`.

4. `packages/config/src/index.ts:296-305` applies provider restrictions using `ONE_TIME_RUNTIME_ENVIRONMENT`.

5. `packages/config/src/index.ts:389-410`, `405-410`, `477-511`, and related guards apply other production protections using `NODE_ENV`.

6. `packages/config/src/index.ts:514-518` returns:

   ```ts
   isProduction: parsed.NODE_ENV === 'production'
   ```

7. `apps/web/src/server/app.ts:4415-4433` sets the session and CSRF cookies’ `Secure` attribute from `config.isProduction`.

8. There is no startup rejection requiring the three environment classifications to form one approved tuple.

### Unsafe or incoherent tuples

The source permits or defaults to configurations such as:

- `NODE_ENV=production`, delivery environment production, One Time runtime omitted → One Time runtime becomes local;
- One Time runtime production with `NODE_ENV=development` → production-runtime gates and Node-production gates disagree, while auth cookies are not marked Secure;
- isolated-staging delivery with local One Time runtime → different feature gates can classify the same process differently;
- `NODE_ENV=production` with a non-sink mock-like mode can be evaluated differently depending on which environment variable a guard uses.

Not every tuple activates a real provider. The security problem is that the process has no single authoritative deployment class, so a new guard can easily be attached to the wrong axis and an existing guard can be bypassed by a contradictory tuple.

### Risk

- non-Secure session and CSRF cookies in a process otherwise classified as production;
- production-only secret requirements omitted;
- startup migration or mock/demo restrictions evaluated on the wrong environment axis;
- staging-only code enabled or disabled inconsistently;
- operator belief that “production” has one meaning when the process has three.

### Existing controls that remain valid

**CONFIRMED CURRENT TRUTH —** Many individual provider and mock gates are strict and fail closed. This finding is not that all production guards are absent. It is that the guards are distributed across conflicting classifiers and no canonical tuple is enforced.

### Minimal repair prompt

> **NOT RUNNABLE UNTIL BOARD-ASSIGNED**
>
> Introduce one canonical deployment class and an explicit allowed-tuple matrix for `NODE_ENV`, delivery environment, and One Time runtime. Default production to production, test to test, and development to local; reject every contradictory tuple at startup. Derive `isProduction`, cookie security, migration startup policy, mock/demo policy, webhook secret requirements, and provider eligibility from the same canonical class. Keep isolated staging explicit. Add table-driven tests for every allowed and forbidden tuple, including omitted variables. Prove production-class cookies are always Secure, test/local credentials cannot satisfy production, startup migrations cannot run in production, and no provider is invoked.

---

## A11-P1-03 — Public readiness/version routes disclose protected operational topology

**Classification:** **NEW FINDING**  
**Severity:** **P1**  
**Affected boundary:** Public HTTP surface, privacy, error sanitization, cache behavior  
**Exact current live exposure established:** **UNPROVEN**  
**Unauthenticated source route established:** **Yes**

### Exact source evidence

1. `apps/web/src/server/app.ts:613-615` exposes a coarse `/health` route.

2. `apps/web/src/server/app.ts:617-629` exposes `/ready` without authentication and returns:

   - generation time;
   - dependency records;
   - optional-provider state;
   - blockers.

3. `apps/web/src/server/app.ts:631-647` exposes `/version` without authentication and returns:

   - application version and commit;
   - deployment provider;
   - multiple deployment, project, environment, service, snapshot, and source identifiers.

4. Neither route calls the private/no-store helper used throughout authenticated routes.

5. `packages/observability/src/ops.ts:261-314` includes migration-ledger detail and optional provider enablement state in readiness data.

6. `packages/observability/src/ops.ts:746-751` sanitizes errors by replacing database URLs and long token-like strings, then returns up to 240 characters of the original error. Short hostnames, schema/table names, driver messages, deployment hints, and other topology can remain.

7. Rich operations routes already exist behind an operator session in `apps/web/src/server/ops-routes.ts:23-73`, demonstrating an available protected boundary for full detail.

### Risk

- public mapping of deployment/provider topology;
- exact migration and blocker intelligence;
- source and infrastructure correlation;
- raw dependency-error fragments;
- stale caching by a browser or intermediary because no explicit no-store policy is set;
- direct conflict with the accepted A06 principle that exact identifiers, credential topology, and operational correlation fields are protected rather than “sanitized.”

### Settled work not repeated

**CONFIRMED CURRENT TRUTH —** A06 already owns broad repository/history scanner coverage, generated-evidence governance, and protected-value taxonomy. A11 does not reopen history rewrite, broad secret scanning, or credential rotation.

**NEW FINDING —** A11 identifies the exact executable unauthenticated route and serialization code that must conform to that existing policy.

### Minimal repair prompt

> **NOT RUNNABLE UNTIL BOARD-ASSIGNED**
>
> Keep public `/health` coarse. Replace public `/ready` and `/version` bodies with a minimal noncorrelatable release/readiness response: boolean health, coarse release fingerprint, and fixed public error code only. Move deployment identifiers, dependency details, migration state, queue state, provider state, blockers, and raw diagnostic messages to the existing authenticated operator route. Apply explicit no-store to public and protected operational responses. Replace public error text with fixed safe codes. Add logged-out tests proving no infrastructure identifiers, provider readiness details, migration IDs, host/table names, or raw errors are returned; add operator tests proving protected diagnostics remain usable.

---

## A11-P1-04 — Classroom launch bearer secret is embedded in the URL path

**Classification:** **NEW FINDING**  
**Severity:** **P1**  
**Affected boundary:** Zoom/classroom grant secrecy, replay, browser history, proxy logs  
**Raw provider URL exposure established:** **No**  
**Replayable One Time bearer exposure in request target established:** **Yes**

### Exact source evidence

1. `packages/domain/src/classroom/service.ts:253-269` restricts grant issuance to the Student session and exact learner.

2. `packages/domain/src/classroom/service.ts:296-339` derives a short-lived secret, stores only its digest, binds the grant to the session, learner, occurrence, and request, and caps TTL at five minutes.

3. `packages/domain/src/classroom/service.ts:352-362` returns:

   ```text
   /classroom/launch/<grant-key>/<secret>
   ```

   with method `GET`.

4. `apps/web/src/server/app.ts:1657-1706` receives that URL before returning no-store, no-referrer, CSP, and noindex headers.

5. `apps/web/src/server/app.ts:1708-1729` later consumes the path through an authenticated same-origin CSRF-protected POST.

### Why the existing controls are insufficient

**CONFIRMED CURRENT TRUTH —** The grant is short-lived, one-time, session-bound, learner-bound, and stored as a digest. The launch page sets no-referrer and no-store. These are strong replay controls.

**NEW FINDING —** They begin only after the bearer is already part of the request target. The path can be retained in:

- browser history;
- address-bar synchronization;
- reverse-proxy and edge access logs;
- observability request names;
- web server logs;
- screenshots or screen recordings;
- copied links;
- failure artifacts generated before response headers are processed.

A short TTL reduces the replay window but does not make a bearer safe in a URL. The application’s own accepted privacy contract says replayable links and target data must stay out of URLs and logs.

### Minimal repair prompt

> **NOT RUNNABLE UNTIL BOARD-ASSIGNED**
>
> Remove the classroom bearer from every URL path and query string. Issue the launch grant through an authenticated API and consume it in an authenticated same-origin CSRF-protected POST body without navigating to a bearer-bearing location. Prefer a server-side session-bound pending launch reference or a one-time opaque nonsecret route key. If a fragment handoff is used, prove the fragment is never sent to the server and is immediately removed with `history.replaceState` before any third-party script or capture; a direct POST flow is preferred. Preserve one-time, TTL, session, learner, occurrence, origin, and replay checks. Add tests for browser history, request target, referrer, access-log serialization, analytics, screenshots, replay, expiry, wrong session, and sibling denial. No Zoom provider call.

---

## A11-P1-05 — The portal permits more than three active learners and then blocks the entire household from class

**Classification:** **NEW FINDING**  
**Severity:** **P1**  
**Affected boundary:** Parent/Student household contract, sibling availability, access projection  
**Cross-household disclosure established:** **No**  
**Contract and availability defect established:** **Yes**

### Exact source evidence

1. `packages/db/src/portals/repository.ts:83-116` counts active learners but returns:

   ```ts
   max_active_learners: null
   learner_limit_reached: false
   ```

2. `packages/db/src/portals/repository.ts:158-218` locks the household and creates a learner plus access-state row without checking the active learner count.

3. Learner restoration/reactivation follows the same no-cap model.

4. `packages/domain/src/classroom/service.ts:730-738` returns `seat_limit_exceeded` whenever `active_learner_count > 3`.

5. The accepted PostgreSQL 16 concurrency workflow at the pinned commit passed while its sanitized evidence explicitly demonstrated:

   - two active learners at start;
   - two concurrent creates both succeeding;
   - four active learners after the race;
   - later archive/replacement/restore operations raising the active count further;
   - zero learner-limit rejections.

   Stable learner identifiers from that artifact are intentionally omitted.

### Consequence

A Parent can create or restore a fourth active learner. The classroom eligibility projection then evaluates **every** learner in the household with `active_learner_count > 3`, so all siblings receive `seat_limit_exceeded`.

This is not only a missing cosmetic count. It converts a permitted Parent mutation into household-wide loss of classroom access.

### Acceptance contradiction

**CONFIRMED CURRENT TRUTH —** The product contract permits up to three learner profiles per family.

**NEW FINDING —** The accepted concurrency evidence proves the opposite behavior and treats the absence of a seat cap as success. That test must be corrected, not preserved as the desired contract.

### Data-handling constraint

**UNPROVEN —** The audit did not inspect current production/staging household counts. Existing households over the limit may or may not exist.

A repair must not silently archive, delete, or reassign any existing learner. Existing over-limit state requires an aggregate-only readback and an explicit operator remediation decision.

### Minimal repair prompt

> **NOT RUNNABLE UNTIL BOARD-ASSIGNED**
>
> Enforce a maximum of three active learners inside the same transaction and household lock used for create and reactivation. Return the existing typed `LEARNER_LIMIT_REACHED` error without partial writes. Populate `max_active_learners=3` and compute `learner_limit_reached` correctly. Replace the accepted no-cap concurrency test with a race where two creates compete for the final seat and exactly one succeeds. Add create, restore, archive, idempotency, and concurrent PostgreSQL tests. For preexisting over-limit households, stop and return aggregate counts to the operator; do not auto-archive, delete, or change identities. Prove compliant households retain classroom access and no sibling or cross-household data is exposed.

---

## A11-P1-06 — `db:verify` applies pending migrations

**Classification:** **NEW FINDING**  
**Severity:** **P1**  
**Affected boundary:** Migration preflight, operator safety, release verification  
**Production mutation established:** **No**  
**Mutating command semantics established:** **Yes**

### Exact source evidence

1. `package.json:40-41` defines:

   ```json
   "db:migrate": "tsx scripts/migrate.ts",
   "db:verify": "tsx scripts/migrate.ts --verify"
   ```

2. `scripts/migrate.ts:7-16` calls `runMigrations(pool)` for both commands. The `--verify` flag changes only the word printed after execution.

3. `packages/db/src/index.ts:68-121` shows that `runMigrations`:

   - starts a transaction;
   - takes a PostgreSQL advisory lock;
   - creates the schema and migration table if missing;
   - executes every missing SQL migration;
   - inserts migration-ledger rows;
   - commits.

### Consequence

An operator or release job can reasonably invoke `npm run db:verify` expecting a read-only preflight. Against a database with pending migrations, the command changes schema and ledger state.

This can:

- apply migrations before backup/restore and preflight gates complete;
- consume the intended one-time migration window;
- change the rollback baseline;
- mutate the wrong environment under a mislabeled verification step;
- make later evidence falsely state that a read-only check was performed.

### Existing controls that remain valid

**CONFIRMED CURRENT TRUTH —**

- the apply path uses one transaction;
- it uses an advisory transaction lock;
- it sorts migration files;
- it checks compatible normalized checksums;
- it rolls back on error.

Those are sound migration-apply controls. They do not make `db:verify` read-only.

### Minimal repair prompt

> **NOT RUNNABLE UNTIL BOARD-ASSIGNED**
>
> Split migration application from migration verification. Implement a read-only verifier that does not create schemas or tables, execute migration SQL, insert ledger rows, or acquire a write-intent path. It must compare ordered migration files, normalized checksums, duplicate prefixes, ledger rows, and pending migrations. Exit nonzero on a missing ledger, checksum mismatch, duplicate/reordered migration, or pending migration when the selected mode requires a fully applied database. Keep `db:migrate` as the only apply command. Add disposable PostgreSQL tests proving a pending migration remains unapplied after `db:verify`, schema and ledger row counts are unchanged, checksum mismatch fails, and concurrent apply remains serialized.

---

## A11-P2-01 — Telegram response enqueue and inbox completion can replay a reply

**Classification:** **NEW FINDING**  
**Severity:** **P2**  
**Affected boundary:** Telegram worker reliability and response replay  
**Duplicate confirmed business mutation:** **No**  
**Duplicate response-row path established:** **Yes**

### Exact source evidence

1. `packages/domain/src/telegram/worker.ts:47-68`:

   - claims one inbox item;
   - decrypts and handles it;
   - calls the response transport for each reply;
   - only then marks the inbox item complete.

2. `packages/domain/src/telegram/rabbi-engine.ts:58-67` creates a new random correlation key on every handler invocation.

3. `packages/db/src/telegram/repositories.ts:414-446` derives the response outbox key from bot, environment, correlation key, and chat, then inserts with `ON CONFLICT DO NOTHING`.

4. Because correlation changes on retry, the second execution does not conflict with the first response row.

5. `packages/domain/src/telegram/rabbi-communications.ts:161-216` atomically consumes confirmations and stores the result, so replay of a confirmed business action returns stored state rather than repeating that action.

### Failure sequence

1. handler executes;
2. reply row is inserted;
3. process stops before inbox completion;
4. lease expires;
5. the same inbox item is handled again;
6. a new random correlation key creates a second reply row.

For a confirmation, the second business execution is protected by the consumed confirmation record. The duplicate risk is the reply, not the confirmed mutation. Preview and read responses can also be repeated.

### Minimal repair prompt

> **NOT RUNNABLE UNTIL BOARD-ASSIGNED**
>
> Derive a stable response identity from the inbox/update identity plus reply ordinal, or atomically enqueue all replies and complete the inbox item in one transaction. Do not use a fresh handler correlation key as the sole dedupe boundary. Preserve encrypted inbox payloads, identity mapping, capability checks, confirmation consumption, result replay, and provider-off defaults. Add fault-injection tests for process loss after the first response insert and before inbox completion; prove one response row and one business effect. Do not enable or call real Telegram.

---

# 5. Confirmed current truths that should be preserved

The following conclusions are not findings requiring reimplementation. They are controls that remain correct at the pinned source and must survive every repair.

| Area | Classification | Confirmed source behavior | Evidence |
|---|---|---|---|
| Password hashing | **CONFIRMED CURRENT TRUTH** | Password handling uses Argon2id-compatible application logic and dummy verification paths to reduce account-enumeration timing differences. | `packages/domain/src/auth/service.ts` |
| Session token storage | **CONFIRMED CURRENT TRUTH** | Session and CSRF tokens are random bearer values; only hashes are persisted. | `packages/domain/src/auth/service.ts:544-613` |
| Session invalidation | **CONFIRMED CURRENT TRUTH** | Session lookup checks expiry, revocation, user status, security version, and optional user-agent binding. | `packages/domain/src/auth/service.ts:615-692` |
| Current-access revocation | **CONFIRMED CURRENT TRUTH** | Every Parent/Student session read re-evaluates current application access and revokes the session when access is no longer allowed. | `packages/domain/src/auth/service.ts:652-687` |
| Student identity isolation | **CONFIRMED CURRENT TRUTH** | Student login requires one unambiguous local username mapping, active learner/household/link/access rows, Student role, and current household access. | `packages/domain/src/auth/service.ts:405-542` |
| Launch sibling isolation | **CONFIRMED CURRENT TRUTH** | Classroom grant issuance and consumption require the Student session’s exact learner; a Student cannot select a sibling learner. | `packages/domain/src/classroom/service.ts:253-269`, `365-389` |
| CSRF and same-origin | **CONFIRMED CURRENT TRUTH** | State-changing authenticated routes use session CSRF and same-origin checks; the classroom bootstrap POST follows that pattern. | `apps/web/src/server/app.ts:1708-1729` and route helpers |
| Rate limiting | **CONFIRMED CURRENT TRUTH** | Login/lead limits are durable, multi-scope, and fail closed through database-backed rate-limit services rather than a single process-local counter. | `apps/web/src/server/rate-limit.ts`; `packages/domain/src/security/rate-limit.ts` |
| Owner/admin communications | **CONFIRMED CURRENT TRUTH** | The simplified communications session resolver is used only by owner/admin communications routes; it is not a Parent/Student revocation bypass. | `apps/web/src/server/communications/register.ts:49-120`; `apps/web/src/server/app.ts:4190-4222` |
| HighLevel provider gates | **CONFIRMED CURRENT TRUTH** | Dispatch requires provider mode, an exact run, allowlisted delivery rows, positive bounded budget, authorization, eligibility checks, and lease fencing; uncertain/fence-lost states are quarantined. | `packages/domain/src/highlevel/dispatcher.ts`; `apps/worker/src/highlevel/adapter.ts` |
| Content upload storage | **CONFIRMED CURRENT TRUTH** | Upload storage requires an absolute private root, streams with a hard byte cap, validates MIME and file signature, uses exclusive 0600 files, constrains locators, and cleans partial files on failure. | `packages/domain/src/content/content-factory-storage.ts:27-145` |
| Content worker leases | **CONFIRMED CURRENT TRUTH** | Jobs use `FOR UPDATE SKIP LOCKED`, lease owner digests, lease generations, heartbeat fencing, and refuse external-provider processing without explicit authorization. | `packages/domain/src/content/content-factory-worker.ts:31-137`, `154-259` |
| Content publication/revocation | **CONFIRMED CURRENT TRUTH** | Publication, unpublication, and access checks are database-scoped and transactional in the inspected service paths. | `packages/domain/src/content/content-factory.ts` and publication repositories |
| Telegram ingress | **CONFIRMED CURRENT TRUTH** | Telegram webhook handling is optional, secret-authenticated, size/depth bounded, encrypted at rest, and deduplicated at inbox ingestion. | `apps/web/src/server/app.ts:391-408`; Telegram ingress/repositories |
| Telegram confirmation | **CONFIRMED CURRENT TRUTH** | Writes require an explicit preview/confirm capability, context binding, expiry, security-version checks, target revision, encrypted payload, and atomic confirmation consumption. | `packages/domain/src/telegram/rabbi-engine.ts`; `packages/domain/src/telegram/rabbi-communications.ts:68-216` |
| Migration apply path | **CONFIRMED CURRENT TRUTH** | Actual migration application is transactionally serialized and checksum-checked. | `packages/db/src/index.ts:68-121` |
| Bundle entry separation | **CONFIRMED CURRENT TRUTH** | Public and authenticated applications have separate Vite entry configurations; authenticated build configuration disables the public directory. | `apps/web/vite.public.config.ts`; `apps/web/vite.app.config.ts`; `package.json` build scripts |
| Private response cache policy | **CONFIRMED CURRENT TRUTH** | Authenticated and sensitive routes generally call the private/no-store helper and use safe public error wrappers rather than stack traces. | `apps/web/src/server/app.ts`; route modules |
| Generic API errors | **CONFIRMED CURRENT TRUTH** | The general API handler returns typed public errors and does not serialize raw stack traces. | `apps/web/src/server/app.ts:4224-4322` |

---

# 6. Settled work and conclusions not to repeat

## 6.1 Existing Zoom cleanup authority

**CONFIRMED CURRENT TRUTH —** The current Zoom task is cleanup of the already-created disposable resource only. A11 does not authorize:

- a replacement meeting;
- a Student join;
- host controls;
- a new provider canary;
- production variables;
- production promotion.

A later host/Student canary still requires a new reviewed Board job and explicit operator authority.

## 6.2 Broad security-history and scanner scope

**CONFIRMED CURRENT TRUTH —** A06 already established that existing scanner passes have bounded coverage, that current/history/generated-evidence concerns require protected inventory, and that history rewrite is not authorized.

A11 does not recommend:

- another generic secret scan as if it closes all exposure;
- credential rotation without a newly confirmed replayable value;
- history rewrite;
- force-push;
- broad evidence deletion;
- reopening already-contained fictional credential incidents.

A11-P1-03 is an executable-route delta that should use A06’s field taxonomy and evidence-governance rules.

## 6.3 HighLevel provider truth

**CONFIRMED CURRENT TRUTH —** Source-level HighLevel gating is strong at the pinned commit. Current provider object truth, campaign/workflow drift, sender state, and exact HighLevel execution remain under A04 and the bounded GHL lanes. A11 performed no provider readback and recommends no duplicate HighLevel implementation.

## 6.4 Accepted source versus live source

**CONFIRMED CURRENT TRUTH —** The control checkpoint is not by itself proof of the exact currently accepted production or staging application source. Green deployment checks and historical screenshots cannot substitute for exact `/version` source attestation and semantic comparison.

**UNPROVEN —** Which A11 findings are reachable on the current live public deployments.

## 6.5 Public/authenticated application bundles

**CONFIRMED CURRENT TRUTH —** Separate entry points are present. This audit found no basis to rebuild the bundling architecture merely to produce activity.

**UNPROVEN —** A complete built-output scan of every emitted JavaScript, CSS, source map, snapshot, and failure artifact at the pinned commit was not performed by this audit.

---

# 7. Test and evidence blind spots

The pinned commit had successful accepted checks, including the main Node 24 verification job with secret scan, formatting, linting, typecheck, unit tests, integration tests, build, browser E2E, accessibility, performance, and bundle gates. PostgreSQL 16/18 assurance workflows also completed successfully.

**CONFIRMED CURRENT TRUTH —** Green CI establishes that the tested contracts passed. It does not override direct source contradictions.

| Blind spot | Classification | Required test delta |
|---|---|---|
| Provider accepted, response lost | **UNPROVEN** | Simulate provider acceptance followed by timeout and prove the retry uses the same provider key and produces one external effect. |
| Worker crash before durable completion | **UNPROVEN** | Stop after provider acceptance and before outbox completion; restart and prove no resend. |
| Environment tuple conflicts | **UNPROVEN** | Table-test every combination of Node, delivery, and One Time runtime classifications, including omitted variables. |
| Secure cookies under contradictory config | **UNPROVEN** | Start every production-class tuple and assert session/CSRF cookie flags and mandatory secrets. |
| Public operations privacy | **UNPROVEN** | Logged-out `/ready` and `/version` tests must reject infrastructure IDs, migration detail, provider states, and raw errors. |
| Request-target leakage | **UNPROVEN** | Assert no classroom bearer appears in route paths, query strings, referrer, server log events, browser history, analytics, or screenshots. |
| Three-learner race | **CONFIRMED ACCEPTANCE CONTRADICTION** | Replace the accepted no-cap race with two concurrent creates competing for the final seat; one succeeds and one returns `LEARNER_LIMIT_REACHED`. |
| Over-limit legacy state | **UNPROVEN** | Aggregate-only readback and deterministic fail-closed handling; no automatic deletion or archive. |
| Read-only migration verification | **UNPROVEN** | Place one pending migration in disposable PostgreSQL; `db:verify` must leave schema and ledger byte-for-byte/state-count unchanged. |
| Telegram reply crash window | **UNPROVEN** | Crash after reply enqueue and before inbox completion; retry must not create a second response row. |
| Proxy/cache behavior | **UNPROVEN** | Verify edge/reverse-proxy request logs and cache policy do not retain protected paths or operational responses. |
| Full built-artifact privacy | **UNPROVEN** | Scan emitted assets and failure artifacts using A06’s protected-field taxonomy without printing matched values. |

### Required negative-test matrix

| Test ID | Scenario | Required result |
|---|---|---|
| A11-DEL-01 | Provider accepts and client times out | Same provider idempotency key on retry; one provider effect. |
| A11-DEL-02 | Process exits after provider acceptance, before durable completion | Recovery reconciles or quarantines; no second send. |
| A11-DEL-03 | Two workers race the same logical delivery | One provider operation; loser loses fence. |
| A11-CFG-01 | Production Node environment with One Time runtime omitted | Canonical production classification; startup succeeds only with production requirements. |
| A11-CFG-02 | Production runtime with development/test Node environment | Startup rejects contradictory tuple. |
| A11-CFG-03 | Isolated staging with local runtime | Startup rejects unless explicitly approved by the tuple matrix. |
| A11-CFG-04 | Production-class login | Session and CSRF cookies are Secure; mandatory secrets present. |
| A11-OPS-01 | Logged-out `/health` | Coarse status only; no provider, migration, infrastructure, or error detail. |
| A11-OPS-02 | Logged-out `/ready` and `/version` | Minimal public projection only; explicit no-store. |
| A11-OPS-03 | Operator operations route | Full diagnostics available only to authorized owner/admin session. |
| A11-ZOOM-01 | Student launch action generated | No bearer in URL path/query, HTML, log event, or browser history. |
| A11-ZOOM-02 | Wrong Student session or sibling | Denied without metadata disclosure. |
| A11-ZOOM-03 | Launch replay or expiry | Denied; provider adapter uncalled. |
| A11-PORTAL-01 | Household with two active learners; two concurrent creates | Exactly one final-seat create succeeds; one typed limit rejection; active count equals three. |
| A11-PORTAL-02 | Restore archived learner when three are active | Typed limit rejection; no partial access-state mutation. |
| A11-PORTAL-03 | Existing over-limit fixture | No automatic deletion/archive; launch remains explicitly blocked pending operator disposition. |
| A11-MIG-01 | Pending migration then `db:verify` | Nonzero pending result; zero schema/ledger writes. |
| A11-MIG-02 | Checksum mismatch | Verification fails before any mutation. |
| A11-MIG-03 | Two migration applies | Advisory lock serializes exact one-time application. |
| A11-TG-01 | Crash after response enqueue | Retry yields one response row. |
| A11-TG-02 | Confirm callback replay | Stored result returned; one business mutation and one reply. |
| A11-PRIV-01 | Build/failure artifacts | No replayable bearer, private destination, Student free text, infrastructure ID, or raw error. |

---

# 8. Recommended task ledger

No task below is runnable merely because it appears in this report.

## A11-T00 — Board intake and sequencing

- **Classification:** **NEW FINDING follow-up**
- **Dependency:** A11 accepted by the conductor; A01/A02/A06 readback; current Zoom cleanup state preserved.
- **Owner / writer slot:** `OT-CONTROL`, conductor/W0 only.
- **Exact write scope:** Add A11 finding/task rows and dependencies to the canonical Board; regenerate derived projections through the existing generator. No application, migration, provider, or deployment edits.
- **Stop condition:** Current Board source hash differs from the readback; an overlapping product writer is active; the report would displace or broaden the cleanup-only Zoom task; protected values would enter the Board.
- **Required proof:** Board validation, source-hash projection check, exact task IDs, dependency order, one-writer assignments, and zero protected values.
- **Board assignment required:** **Yes.**

## A11-T01 — Canonical runtime classification

- **Classification:** **NEW FINDING follow-up**
- **Dependency:** A11-T00; sanitized environment-name/expected-class manifest; no environment values.
- **Owner / writer slot:** Sole sequential `OT-PRODUCT` writer.
- **Exact write scope:** `packages/config/src/index.ts`, cookie/runtime helpers in `apps/web/src/server/app.ts`, focused config/auth tests, and documentation of the allowed tuple matrix. No provider adapter or deployment mutation.
- **Stop condition:** A real secret or environment value is needed; the change would activate a provider; an existing writer owns either file; production behavior cannot be represented without an operator decision.
- **Required proof:** Full allowed/forbidden tuple tests; Secure-cookie assertions; mandatory production-secret checks; startup migration/mock/demo/provider guards on the canonical class; standard lint/typecheck/build/tests.
- **Board assignment required:** **Yes.**

## A11-T02 — Public diagnostic minimization

- **Classification:** **NEW FINDING follow-up**
- **Dependency:** A11-T00; A06 protected-field taxonomy; preferably A11-T01’s canonical deployment class.
- **Owner / writer slot:** Sole sequential `OT-PRODUCT` writer, coordinated with `A06-EVIDENCE-GOVERNANCE`; not concurrent.
- **Exact write scope:** `/health`, `/ready`, `/version`, operations projections, safe-error serialization, cache headers, and focused logged-out/operator tests.
- **Stop condition:** A live endpoint or provider must be opened; a protected value appears in evidence; a separate A06 writer owns the same paths.
- **Required proof:** Logged-out responses contain no infrastructure IDs, exact migration/provider state, blockers, or raw errors; protected operator route retains useful diagnostics; no-store present; no deployment.
- **Board assignment required:** **Yes.**

## A11-T03 — Read-only migration verification

- **Classification:** **NEW FINDING follow-up**
- **Dependency:** A11-T00; exact accepted migration inventory and normalized checksum contract; A02’s candidate migration boundary preserved.
- **Owner / writer slot:** Sole sequential `OT-PRODUCT` migration-tool writer.
- **Exact write scope:** `scripts/migrate.ts`, `packages/db/src/index.ts` or a dedicated verification module, `package.json`, focused tests/workflow. Do not edit existing migration SQL.
- **Stop condition:** Verification requires applying a migration; any existing migration byte/prefix would change; a production database is requested.
- **Required proof:** Disposable PostgreSQL proves pending migrations remain unapplied, ledger/schema unchanged, mismatch/order/duplicate failures, and apply concurrency still serialized.
- **Board assignment required:** **Yes.**

## A11-T04 — Stable provider idempotency and uncertain-acceptance state

- **Classification:** **NEW FINDING follow-up**
- **Dependency:** A11-T00; real providers remain disabled; provider contracts reviewed without destinations or credentials.
- **Owner / writer slot:** Sole sequential `OT-PRODUCT` delivery writer.
- **Exact write scope:** Delivery activation policy, provider router, worker/repository state, one forward migration only if durable operation state cannot fit existing schema, and focused fault-injection tests.
- **Stop condition:** A real send/provider call is needed; provider reconciliation cannot be modeled safely; a migration conflicts with the accepted prefix/inventory.
- **Required proof:** Accepted-then-timeout, crash-before-complete, lease-expiry, and two-worker tests; one stable provider key; one logical and external effect; provider sinks only.
- **Board assignment required:** **Yes.**

## A11-T05 — Bearer-free classroom launch transport

- **Classification:** **NEW FINDING follow-up**
- **Dependency:** A11-T00; current PR #105 cleanup terminal and reconciled before any later provider canary; no Zoom execution authority.
- **Owner / writer slot:** Sole sequential `OT-PRODUCT` classroom writer.
- **Exact write scope:** Classroom grant contract/service, web route/bootstrap flow, browser client, tests, and sanitized evidence. No Zoom adapter activation or provider mutation.
- **Stop condition:** Any bearer remains in a URL/log/artifact; a real meeting or credential is required; the change weakens session/learner/origin/replay checks.
- **Required proof:** No-bearing request target/history/referrer/log tests; one-time/session/learner/expiry/replay tests; sibling denial; provider adapter uncalled.
- **Board assignment required:** **Yes.**

## A11-T06 — Three-active-learner enforcement and legacy-state decision

- **Classification:** **NEW FINDING follow-up**
- **Dependency:** A11-T00; product contract confirmed; aggregate-only current-data readback; explicit operator decision if over-limit households exist.
- **Owner / writer slot:** Sole sequential `OT-PRODUCT` portal writer.
- **Exact write scope:** Portal repository/service projections, create/reactivate transactions, typed errors, real PostgreSQL concurrency tests, and replacement of the no-cap acceptance assertion.
- **Stop condition:** Any learner must be deleted/archived/reassigned; customer/Student identities would enter ordinary evidence; current data requires manual remediation.
- **Required proof:** Exactly three active maximum under races; no partial writes; correct projection fields; compliant household classroom access; no cross-household or sibling disclosure.
- **Board assignment required:** **Yes.**

## A11-T07 — Telegram response atomicity

- **Classification:** **NEW FINDING follow-up**
- **Dependency:** A11-T00; Telegram real delivery remains disabled.
- **Owner / writer slot:** Sole sequential `OT-PRODUCT` Telegram writer.
- **Exact write scope:** Telegram worker, response-outbox repository, stable response identity/transaction boundary, focused tests; one forward migration only if required.
- **Stop condition:** Real Telegram access/send is requested; confirmation business idempotency would be weakened; migration collision.
- **Required proof:** Crash-window fault injection; one response row; one business effect; consumed confirmation replay; encrypted payload and capability tests preserved.
- **Board assignment required:** **Yes.**

## A11-T08 — Independent source and acceptance readback

- **Classification:** **NEW FINDING follow-up**
- **Dependency:** Exact immutable repair commits for assigned A11 tasks; all providers still fail closed unless separately authorized.
- **Owner / writer slot:** Independent read-only application-security reviewer; conductor may commit only the sanitized result.
- **Exact write scope:** One A11 closure report and evidence matrix. No application or provider edit.
- **Stop condition:** Evidence is not from exact commits; a test uses a real destination/identity/provider; a failure artifact contains protected content.
- **Required proof:** The complete A11 negative-test matrix, Node 24 checks, disposable PostgreSQL proof, browser privacy proof, exact changed-file/migration manifests, provider-call count zero, and source attestation.
- **Board assignment required:** **Yes** for committed acceptance/closure.

---

# 9. Minimal sequenced repair prompts

These prompts are intentionally narrow. They do not grant authority.

## Prompt A — Runtime classification and diagnostics

```text
TASK: A11 runtime-classification and public-diagnostics repair
MODE: CODE ONLY; NO DEPLOYMENT; NO PROVIDER; NO REAL ENVIRONMENT VALUES
AUTHORITY: Run only under exact Board assignment to the sole OT-PRODUCT writer.

Pin and verify the assigned source. Read A11-P1-02, A11-P1-03, A06 evidence-governance rules, and the current Board.

Implement:
1. one canonical deployment class and an explicit allowed environment-tuple matrix;
2. production defaults to production and contradictory tuples fail startup;
3. auth cookie security and every production/mock/provider/migration guard derive from that class;
4. public health/version/readiness expose only coarse, noncorrelatable fixed fields with no-store;
5. full deployment, migration, queue, provider, blocker, and diagnostic detail moves behind the existing owner/admin operations route;
6. public errors use fixed codes, not dependency messages.

Do not print or commit environment values or infrastructure IDs.
Do not deploy or call a provider.

Prove:
- table-driven tuple tests;
- Secure production cookies;
- required production secrets;
- logged-out diagnostics contain no protected topology;
- operator diagnostics remain useful;
- lint, typecheck, unit/integration, build, browser, accessibility, performance, and bundle checks.
Return one immutable commit and sanitized evidence; stop.
```

## Prompt B — Migration verification

```text
TASK: A11 read-only migration verifier
MODE: LOCAL/DISPOSABLE POSTGRESQL ONLY
AUTHORITY: Run only under exact Board assignment.

Preserve every existing migration byte, filename, prefix, order, and accepted checksum rule.

Separate:
- db:migrate: the only command allowed to apply;
- db:verify: strictly read-only.

db:verify must inspect the file inventory and existing ledger, report pending/mismatch/duplicate/order state, and never create schema/table, run migration SQL, or insert/update/delete ledger rows.

Add disposable PostgreSQL tests:
- empty/missing ledger;
- one pending migration;
- all applied;
- checksum mismatch;
- duplicate/reordered prefix;
- concurrent migration apply remains advisory-lock serialized.

Assert schema object counts and migration-ledger rows are unchanged by every verify case.
No production/staging DB, no deployment, no migration edit.
Return one immutable commit and evidence; stop.
```

## Prompt C — Delivery exactly-once boundary

```text
TASK: A11 delivery provider idempotency repair
MODE: PROVIDER SINKS/STUBS ONLY; ZERO REAL SENDS
AUTHORITY: Run only under exact Board assignment.

Use one stable provider idempotency key per logical delivery across all attempts.
Remove attempt-derived provider keys.
Persist a durable provider-operation state and acceptance reference or acceptance-unknown state.
After a timeout/crash, retry with the same key or reconcile; never mint a new key.
If safe reconciliation is unavailable, quarantine rather than resend.

Fault-injection acceptance:
- provider accepts then timeout;
- process exits before durable completion;
- lease expires;
- two workers race;
- retryable rejection before provider acceptance;
- permanent rejection.

Required result: one logical row, one provider effect, stable key, fenced worker, no destination or provider credential, provider-call stubs only.
Return one immutable commit and evidence; stop.
```

## Prompt D — Classroom launch secrecy

```text
TASK: A11 bearer-free classroom launch
MODE: CODE/BROWSER TESTS ONLY; ZERO ZOOM CALLS
AUTHORITY: Run only under exact Board assignment and without reusing PR #105 cleanup authority.

Remove every launch bearer from URL paths and query strings.
Issue and consume through authenticated, same-origin, CSRF-protected server state/POST flow.
Preserve exact Student-to-learner binding, current entitlement, consent, occurrence window, TTL, one-time consume, session binding, origin checks, and replay denial.

Tests must prove the bearer is absent from:
- request URLs;
- browser history;
- referrer;
- server access-log events;
- analytics;
- screenshots/failure artifacts;
- HTML and built bundles.

Also prove wrong session, sibling, expired, and replayed requests fail with no provider call.
Return one immutable commit and evidence; stop.
```

## Prompt E — Three-learner household contract

```text
TASK: A11 three-active-learner enforcement
MODE: CODE + DISPOSABLE POSTGRESQL; NO CUSTOMER DATA
AUTHORITY: Run only under exact Board assignment.

Inside the existing household lock/transaction:
- reject a create or reactivation that would exceed three active learners;
- return LEARNER_LIMIT_REACHED with no partial write;
- project max_active_learners=3 and learner_limit_reached correctly.

Replace the accepted no-cap race with:
- two active learners;
- two concurrent creates for the final seat;
- exactly one success and one typed rejection;
- final active count three.

Test archive, restore, idempotent replay, two-writer race, Student access state, and classroom eligibility.
Do not auto-delete/archive/reassign existing over-limit records.
If aggregate readback finds over-limit households, stop for operator disposition.
Return one immutable commit and evidence; stop.
```

## Prompt F — Telegram reply dedupe

```text
TASK: A11 Telegram response replay repair
MODE: SYNTHETIC TELEGRAM ONLY; REAL TRANSPORT OFF
AUTHORITY: Run only under exact Board assignment.

Make response identity stable for one inbox update and reply ordinal, or enqueue replies and complete the inbox atomically.
A handler retry must not produce a new response row merely because correlation was regenerated.
Preserve encrypted inbox payloads, identity/capability checks, preview/confirm, target revision, security version, confirmation consume, and stored-result replay.

Inject a crash after the first response enqueue and before inbox completion.
Required result after retry: one response row and one business effect.
No real Telegram token, chat, webhook registration, or send.
Return one immutable commit and evidence; stop.
```

---

# 10. Source list

## 10.1 Audit instruction and control-plane evidence

- `A11-one-time-code-architecture-and-security-audit.md`
- `ops/goals/CURRENT.yaml`
- `ops/goals/OT-LAUNCH-01/BOARD.yaml`
- A01 master control-tower audit result
- A02 controlled-production-pilot gap audit result
- A04 HighLevel truth/sender/workflow audit result
- A05 PR/branch/clone/worktree preservation audit result
- A06 security/privacy/credentials/history audit result
- A10 contacts/consent/audience/communication-authority audit
- current Zoom cleanup handoffs and Board references, read only

## 10.2 Exact source files inspected at the pinned commit

### Authentication, sessions, CSRF, rate limits

- `packages/domain/src/auth/service.ts`
- `apps/web/src/server/app.ts`
- `apps/web/src/server/rate-limit.ts`
- `packages/domain/src/security/rate-limit.ts`

### Portals, isolation, and classroom

- `packages/domain/src/portals/services.ts`
- `packages/db/src/portals/repository.ts`
- `packages/domain/src/classroom/service.ts`
- `packages/db/src/classroom/repository.ts`

### Delivery and HighLevel

- `packages/domain/src/delivery/activation-policy.ts`
- `apps/worker/src/delivery/worker.ts`
- `apps/worker/src/delivery/repository.ts`
- `apps/worker/src/delivery/provider-router.ts`
- `packages/domain/src/highlevel/dispatcher.ts`
- `packages/domain/src/highlevel/http-client.ts`
- `apps/worker/src/highlevel/adapter.ts`

### Content

- `packages/domain/src/content/content-factory.ts`
- `packages/domain/src/content/content-factory-storage.ts`
- `packages/domain/src/content/content-factory-worker.ts`

### Telegram

- `apps/telegram-bot/src/main.ts`
- `apps/telegram-bot/src/ingress.ts`
- `packages/domain/src/telegram/worker.ts`
- `packages/domain/src/telegram/rabbi-engine.ts`
- `packages/domain/src/telegram/rabbi-communications.ts`
- `packages/db/src/telegram/repositories.ts`

### Migrations, configuration, observability, and bundles

- `scripts/migrate.ts`
- `packages/db/src/index.ts`
- `packages/config/src/index.ts`
- `packages/observability/src/ops.ts`
- `apps/web/src/server/ops-routes.ts`
- `apps/web/vite.public.config.ts`
- `apps/web/vite.app.config.ts`
- `package.json`

## 10.3 Accepted automated evidence

- Main `CI` workflow at the pinned commit: successful Node 24 verification job.
- `OT-83 PostgreSQL Concurrency` workflow at the pinned commit: successful, with the no-seat-cap behavior that this audit classifies as an acceptance contradiction.
- `OT-37 PostgreSQL Assurance` workflow: successful.
- `OPS-11 PostgreSQL 18 Assurance` workflow: successful.
- `OPS-06 Reliability Observability` workflow: successful.
- Mutable deployment checks associated with the commit were observed as successful but were not treated as exact live source or product acceptance.

No protected provider IDs, destinations, customer records, Student identities, credentials, or raw private content are reproduced in this report.

---

# 11. Final verdict

**NEW FINDING —** The pinned source is not a weak prototype. Its strongest boundaries—current-access session revocation, Student-to-learner binding, CSRF, durable rate limits, HighLevel canary gates, protected content storage, worker fencing, and Telegram confirmation consumption—are materially sound and should be preserved.

**NEW FINDING —** The most consequential defects occur at boundary transitions:

1. logical outbox state to provider exactly-once behavior;
2. environment labels to production security controls;
3. internal operations truth to public HTTP serialization;
4. one-time grant state to browser/request transport;
5. Parent household mutation to classroom seat eligibility;
6. migration verification naming to actual database mutation;
7. Telegram response enqueue to inbox completion.

**CONFIRMED CURRENT TRUTH —** No P0 condition was established.

**CONFIRMED CURRENT TRUTH —** The current control-tower next action remains the already-authorized Zoom cleanup-only continuation. A11 should be ingested by the conductor without using it to start broad implementation, open providers, or reorder the cleanup dependency.

**NEW FINDING —** Before a later production candidate is accepted, the Board must assign and close the canonical runtime classification, public diagnostics, read-only migration verification, three-learner enforcement, and bearer-free classroom launch tasks. Provider idempotency must close before real general delivery. Telegram response atomicity must close before real Telegram delivery.

**UNPROVEN —** Exact live reachability of these defects remains dependent on current production/staging source attestation and runtime configuration. That readback must not expose infrastructure identifiers in public evidence.

No repository or provider mutation was performed.

```yaml
CONTROL-TOWER-RETURN
audit_id: A11
audit_title: One Time code architecture and security audit
result_path: ops/audits/2026-07-26/parallel-control-tower/A11-result.md
audit_date: 2026-07-27
mode: read_only
repository:
  name: shloimie-beep/onetimev2
  commit: e986b5e6502b1168b3eb28e200fd49ac8de46477
overall_status: P1_ACTION_REQUIRED
confirmed_p0_findings: 0
confirmed_p1_findings: 6
confirmed_p2_findings: 1
p1_findings:
  - A11-P1-01-delivery-provider-idempotency
  - A11-P1-02-runtime-classification-split
  - A11-P1-03-public-diagnostics-disclosure
  - A11-P1-04-classroom-bearer-in-url
  - A11-P1-05-three-learner-cap-not-enforced
  - A11-P1-06-db-verify-mutates
p2_findings:
  - A11-P2-01-telegram-response-replay
current_next_executable_task_changed: false
current_next_executable_task: existing_pr_105_zoom_cleanup_only
new_zoom_canary_authorized: false
production_pilot_authorized: false
provider_activation_authorized: false
repository_changes_performed: false
provider_actions_performed: false
database_mutations_performed: false
deployment_actions_performed: false
protected_values_rendered: false
history_rewrite_authorized: false
board_assignments_required:
  - A11-T00
  - A11-T01
  - A11-T02
  - A11-T03
  - A11-T04
  - A11-T05
  - A11-T06
  - A11-T07
  - A11-T08
release_prerequisites_added:
  before_new_zoom_canary:
    - A11-P1-04
  before_full_production_candidate:
    - A11-P1-02
    - A11-P1-03
    - A11-P1-05
    - A11-P1-06
  before_real_general_delivery:
    - A11-P1-01
  before_real_telegram_delivery:
    - A11-P2-01
next_safe_action: >
  Preserve and complete the already-authorized Zoom cleanup-only lane. The
  conductor may then ingest A11 into the canonical Board, assign one sequential
  nonoverlapping OT-PRODUCT writer per approved repair, and require exact
  provider-off, disposable-PostgreSQL, browser-privacy, and source-attested
  acceptance. Do not deploy, send, open providers, mutate a live database,
  create a replacement Zoom meeting, or rewrite history from this report.
END-CONTROL-TOWER-RETURN
```
