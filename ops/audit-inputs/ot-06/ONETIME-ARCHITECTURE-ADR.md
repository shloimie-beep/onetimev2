# ONETIME-ARCHITECTURE-ADR

**Task:** OT-04  
**Date:** 2026-07-14  
**Decision type:** Repository, application, database, Railway, and BNA-control-plane architecture  
**Status:** **Recommended decision; implementation and repository initialization remain unauthorized until the stop conditions in §15 are cleared**  
**Target repository:** `sdratler/OneTimeOneTime`, provided it remains empty and repository ownership/branch-protection decisions are confirmed  
**Source repository inspected:** `shloimie-beep/bnei-neviim-academy`  
**Operating constraint:** Read-only inspection. No repository, database, Railway, DNS, secret, or deployment change was made.

---

## Executive decision

Create One Time as a **standalone, single-product modular monolith** in the clean `sdratler/OneTimeOneTime` repository.

Use one source tree and one container image with two process entry points:

1. **Web process:** public landing, lead capture API, authentication, and the authenticated CRM.
2. **Worker process:** transactional outbox, scheduled reconciliation, and asynchronous BNA-control-plane delivery.

The recommended stack is:

- **Node.js 24 + TypeScript**.
- **Express 5** as the HTTP composition layer.
- **Vite** for frontend builds.
- **Static/server-rendered public pages with no application hydration** for the landing and lead form.
- **A route-chunked React application only for authenticated CRM routes**.
- **PostgreSQL through `pg` and parameterized SQL**, with no ORM in the first slice.
- **Forward-only, ordered, checksum-verified SQL migrations**; never runtime-created schema.
- **PostgreSQL-backed sessions and role assignments**.
- **A transactional database outbox** processed by one leased worker in staging and initially one worker in production.
- **Asynchronous, versioned events plus a protected admin API** for BNA supervision.

Do **not** copy the BNA repository, preserve the BNA Operations shell, share frontend assets, share sessions, or permit cross-application database joins. Do **not** move Studio, agent prompts, provider-integration internals, commercial percentages, pricing-policy internals, or BNA fleet/governance machinery into One Time.

Reuse existing One Time domain behavior only after it is isolated behind characterization tests. Rebuild the product-facing UI, authentication, API composition, migration system, deployment packaging, and BNA connection.

### Why this is the correct decision

The existing source is already Node/Express/PostgreSQL and uses direct SQL, Railway process selection, focused Node tests, Playwright smokes, an outbox, and performance instrumentation. Preserving those backend semantics minimizes migration risk. The current One Time experience nevertheless runs inside a very large BNA server and Operations bundle; the current performance gate permits an Operations shell of approximately 1.15 MB before compression. That shell is specifically not the target product runtime. A focused public artifact and route-chunked CRM remove that critical-path burden without replacing the proven Node/PostgreSQL foundation.

The source also shows that current migrations are scattered across historical root SQL files, broad platform migrations, and runtime schema code. The repository’s own migration-readiness report says historical files must be used as target-diff inputs rather than applied as a blanket list. A clean repository therefore needs one authoritative migration ledger and a compatibility layer against the existing Rabbi database.

---

## Evidence scope and confidence

### Directly inspected

- The provisional repository’s GitHub metadata: private, default branch `main`, and empty at inspection time.
- Current BNA package, dependencies, build scripts, Railway configuration, Dockerfile, and process selector.
- One Time instance/deployment manifests.
- One Time route maps and current-state audits.
- Signup validation and outbox construction.
- CRM contact DTO, deduplication, filtering, paging, timeline, conversation, and task service contracts.
- Role and capability code.
- Representative One Time and platform migrations.
- Migration-readiness controls.
- Railway outbox cron configuration.
- Performance baseline and regression-gate harnesses.
- WAPI/webhook scope and approval contracts.

### Not directly inspected

- The live Railway dashboard.
- Current Railway variable names as actually configured in each environment.
- Any variable or secret value.
- The live Rabbi database schema, data, extensions, indexes, triggers, grants, connection limits, backups, or restore behavior.
- Current DNS/provider dashboards.
- Current active webhook registrations or external-provider account ownership.

Source-reported live evidence is useful as repository evidence, but it is **not** a substitute for a fresh read-only Railway/database inspection before initialization, migration, or cutover.

---

# 1. Recommended application stack

## 1.1 Stack decision

| Layer | Recommended choice | Reason |
|---|---|---|
| Runtime | Node.js 24 | Matches the existing Docker runtime and current server-side JavaScript behavior. |
| Language | TypeScript | Establishes explicit contracts at the new repository boundary while allowing characterized JavaScript modules to be ported incrementally. |
| HTTP server | Express 5 | Preserves Express middleware/route semantics while starting the new repository on one modern major. The HTTP adapter is rebuilt; domain behavior is ported behind tests. |
| Public frontend | Static or server-rendered HTML, CSS, and minimal TypeScript built by Vite; no React hydration | The landing and lead form do not require a SPA. This minimizes JS, third-party requests, and failure modes. |
| Authenticated frontend | React, route-chunked by authenticated route, built by Vite | The CRM needs structured state, list/detail navigation, forms, optimistic feedback, accessibility, and testable components. React is confined to the authenticated product application. |
| API contracts | Versioned JSON HTTP API; runtime validation with a schema library; generated OpenAPI artifact | Replaces implicit `server.js` coupling with stable, testable contracts. |
| Database access | `pg`, parameterized SQL, small repository modules | Fits the existing PostgreSQL/database code and avoids an ORM-driven schema rewrite. |
| Migrations | Forward-only ordered SQL with checksums, advisory lock, and a migration ledger | Compatible with the current raw-SQL history while preventing runtime DDL and ambiguous apply order. |
| Authentication | Database users, Argon2id password hashes, TOTP MFA for owner/admin, PostgreSQL-backed sessions | Replaces environment-variable passwords and permits revocation, audit, expiry, and least privilege. |
| Background execution | Transactional outbox plus one worker process from the same image | Avoids separate service proliferation while retaining idempotency, retries, and BNA event delivery. |
| Deployment | One Dockerfile; same image for web and worker; Railway process selected by `PROCESS_TYPE` | Mirrors the current process-selector pattern but limits it to product web and product worker. |
| Observability | Structured logs, trace ID, deploy SHA, response bytes, `Server-Timing` for app/handler/db/pool, privacy-safe RUM | Carries forward the strongest parts of the existing performance harness. |
| Package management | npm workspaces | Fits the current npm workflow and permits strict package boundaries without creating separate repositories. |

## 1.2 Deployment topology

This is a **modular monolith**, not a microservice system:

- One Git repository.
- One dependency lockfile.
- One Docker image.
- One PostgreSQL database per environment.
- One web service.
- One worker service.
- One migration command executed under a controlled deployment gate.

The web and worker may scale separately later, but they deploy from the same commit and share domain, contract, database, and observability packages.

## 1.3 Why this fits incremental migration

1. Existing pure functions can be moved into `packages/domain` one domain at a time.
2. Existing direct-SQL behavior can be represented in repository adapters without converting the entire database to an ORM model.
3. Existing public and CRM routes can be preserved temporarily through redirects, server-side forwarding, and versioned compatibility endpoints.
4. The existing database can be expanded with a canonical `onetime` schema while legacy `bna_*` tables remain available during backfill and rollback.
5. The new public site does not wait for authenticated CRM completeness.
6. The authenticated CRM does not wait for provider integrations, messaging, billing, Studio, or agent systems.
7. BNA remains operationally aware through events and protected reads without remaining in the request path.

---

# 2. Alternatives considered and rejected

| Alternative | Decision | Specific rejection reason |
|---|---|---|
| Copy the complete BNA repository into `OneTimeOneTime` and delete unrelated files | Rejected | It would import a giant server, BNA-specific routes, Studio and agent machinery, secret-loading conventions, historical audits, migration ambiguity, and a frontend shell that is explicitly not the target. Deletion would not prove that hidden imports, data assumptions, or deployment behavior were removed. |
| Keep One Time in the BNA repository and deploy a separate Railway service | Rejected as the target architecture | This was a reasonable historical intermediate step, and the source contains a separate-instance manifest. It no longer satisfies the stated requirement that One Time become a standalone customer product with its own clean repository and independent lifecycle. It also leaves source ownership, release cadence, and accidental bundle/schema coupling in BNA. |
| Keep the current BNA Operations shell as the One Time authenticated app | Rejected | The shell is BNA-shaped, carries large generated assets, and routes many unrelated administrative surfaces. Current evidence identifies the shared shell as the frontend critical path. A customer CRM should load only the CRM route and its immediate dependencies. |
| Rebuild everything in Next.js/Supabase or revive the archived app | Rejected | The active application is Express/PostgreSQL, while the Next/Supabase material is archived. Reviving it would simultaneously change server framework, data layer, authentication, deployment, and frontend architecture, losing reuse and increasing verification scope. |
| Replace Express/`pg` with NestJS, Fastify, Prisma, or another full backend stack | Rejected for the first slice | Current evidence does not identify Express throughput as the primary bottleneck; the largest confirmed issue is frontend/runtime coupling and missing earlier instrumentation. A backend rewrite would add schema and behavior drift without solving the main problem. |
| Split landing, identity, CRM, events, worker, and BNA bridge into separate microservices | Rejected | The first slice has one product, one data owner, one small team, and one transactional workflow. Multiple services would create distributed transactions, versioning, deployment, secrets, and observability overhead without a demonstrated scaling boundary. |
| Static landing plus an external SaaS CRM | Rejected | It abandons the existing contact, consent, status, timeline, deduplication, and database contracts; creates another system of record; and weakens control over data migration and BNA supervision. |
| Plain unstructured JavaScript for the entire new application | Rejected | It would preserve the conditions that allowed route, schema, and UI contracts to remain implicit. Minimal TypeScript in the new boundary is justified even though the source is JavaScript. |

---

# 3. Proposed repository structure

```text
OneTimeOneTime/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── server/
│   │   │   │   ├── composition/
│   │   │   │   ├── middleware/
│   │   │   │   ├── routes-public/
│   │   │   │   ├── routes-auth/
│   │   │   │   ├── routes-crm/
│   │   │   │   ├── routes-internal-admin/
│   │   │   │   └── views/
│   │   │   └── client/
│   │   │       ├── public/
│   │   │       └── app/
│   │   │           ├── routes/
│   │   │           ├── components/
│   │   │           ├── api/
│   │   │           └── accessibility/
│   │   └── vite.config.*
│   └── worker/
│       └── src/
│           ├── main/
│           ├── outbox/
│           ├── scheduler/
│           └── reconciliation/
├── packages/
│   ├── domain/
│   │   └── src/
│   │       ├── leads/
│   │       ├── contacts/
│   │       ├── crm/
│   │       ├── consent/
│   │       ├── authz/
│   │       ├── audit/
│   │       └── outbox/
│   ├── contracts/
│   │   └── src/
│   │       ├── http/
│   │       ├── events/
│   │       └── internal-admin/
│   ├── db/
│   │   ├── src/
│   │   │   ├── pool/
│   │   │   ├── repositories/
│   │   │   ├── transactions/
│   │   │   └── compatibility/
│   │   └── migrations/
│   │       ├── sql/
│   │       └── manifest/
│   ├── control-plane/
│   │   └── src/
│   │       ├── event-envelope/
│   │       ├── event-client/
│   │       └── request-verification/
│   ├── config/
│   └── observability/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── contract/
│   ├── migration/
│   ├── e2e/
│   ├── security/
│   └── performance/
├── scripts/
│   ├── verify/
│   ├── migration/
│   ├── backfill/
│   └── smoke/
├── ops/
│   ├── adr/
│   ├── runbooks/
│   ├── evidence/
│   └── release/
├── Dockerfile
├── railway.json
├── package.json
├── package-lock.json
├── tsconfig.json
└── README.md
```

## Structure rules

- `packages/domain` has no Express, React, Railway, provider SDK, or raw database dependency.
- `packages/contracts` contains schemas and types, not business decisions or secrets.
- `packages/db` owns SQL and database mapping. UI and route handlers cannot issue SQL directly.
- `packages/control-plane` knows the public BNA contract, not BNA implementation internals.
- `apps/web` composes HTTP and frontend concerns. It does not own domain rules.
- `apps/worker` is the only normal process that dispatches asynchronous external events.
- Public and authenticated frontend code are separate build entry points. Public pages cannot import the authenticated app bundle.
- No BNA package, shared BNA frontend artifact, Git submodule, or copied `server.js` is permitted.
- Historical evidence, generated screenshots, raw input, keyholder scripts, or agent memory from BNA are not imported.

---

# 4. Architectural boundaries

## 4.1 Public web

**Owns:**

- `/` landing page.
- `/privacy` and `/terms`.
- Public lead form.
- Public, same-origin lead submission.
- Accessibility, metadata, canonical URL, structured data, and static assets.

**Does not own:**

- Authentication.
- CRM data queries.
- BNA helper or agent UI.
- Provider integrations.
- Email/WhatsApp/Telegram sending.
- Billing or access grants.

**Rules:**

- No application hydration on initial landing.
- No blocking third-party script.
- No direct call to BNA.
- One lead-submit request only.
- The success response must not expose internal database IDs or operational details.

## 4.2 Authenticated application

**Owns:**

- `/login`.
- `/app/crm` contact/lead list.
- `/app/crm/:contactId` contact detail and timeline.
- CRM mutations permitted by role.
- Owner/admin user and security settings when that slice is enabled.

**Does not own:**

- SQL.
- BNA sessions or BNA frontend code.
- Direct provider APIs.
- Generic BNA task, Studio, prompt, agent, or accounting surfaces.

**Rules:**

- Same-origin API only.
- Server-authorized routes; client hiding is never authorization.
- No CRM PII persisted in localStorage, IndexedDB, service-worker caches, analytics payloads, or RUM.
- Route chunks load only after authentication and route match.

## 4.3 API and domain layer

**Owns:**

- Input validation.
- Idempotency.
- Contact normalization and deduplication.
- Consent/suppression state.
- Lead lifecycle.
- Role/capability decisions.
- Audit events.
- Transaction boundaries.
- Versioned API response contracts.

**Rules:**

- HTTP handlers translate requests and responses only.
- Domain functions cannot call Railway, BNA, or provider APIs.
- Every mutation creates an audit record in the same transaction.
- Public lead capture commits locally even if BNA is unavailable.
- Provider delivery is never in the public request transaction.

## 4.4 Database

**Owns:**

- Canonical One Time records.
- Authentication/session records.
- Legacy ID mappings.
- Audit log.
- Idempotency records.
- Transactional outbox and delivery attempts.
- Migration ledger and backfill checkpoints.

**Rules:**

- New canonical objects live under a dedicated PostgreSQL schema such as `onetime`.
- No runtime `CREATE TABLE` or opportunistic `ALTER TABLE` in web/worker startup.
- No BNA application account receives direct query access.
- No One Time query joins to a BNA database.
- Legacy tables are accessed only through explicit compatibility repositories and temporary least-privilege grants.
- Contract-stage drops/renames are forbidden until the rollback window closes.

## 4.5 Background worker and outbox

**Owns:**

- Claiming due outbox rows.
- Delivering versioned BNA events.
- Retry/backoff/dead-letter transitions.
- Scheduled reconciliation/backfill jobs that have been explicitly enabled.
- Worker heartbeat and backlog metrics.

**Rules:**

- Claim with a lease and row locking; every delivery has an idempotency key.
- Staging runs exactly one worker replica.
- Production begins with one worker; later horizontal scale is safe only after lease/concurrency tests pass.
- A PostgreSQL advisory lock protects singleton scheduler work.
- The current five-minute Railway cron that calls a public web endpoint is not carried forward as the preferred design.
- If a cron remains temporarily, only one cron service may be active, and it must invoke a private worker command rather than a public customer route.

## 4.6 BNA control-plane connection

**Owns:**

- Event-envelope delivery to BNA.
- Verification of signed BNA admin requests.
- Redacted summaries and narrow supervisory commands.

**Does not own:**

- BNA prompts, agent definitions, provider tokens, integration implementation, commercial logic, or frontend components.
- Synchronous authorization for normal One Time users.
- Direct cross-database queries.

### Primary flows

```text
Public browser
  → One Time web
  → One Time domain transaction
  → One Time PostgreSQL
  → local success response
  → outbox row
  → One Time worker
  → BNA event-ingest API

Authenticated browser
  → One Time web/session
  → One Time CRM API
  → One Time domain/repository
  → One Time PostgreSQL

BNA internal UI
  → BNA backend
  → signed One Time protected-admin request
  → redacted One Time response
```

BNA is never in the public landing, lead-commit, login, or CRM page-render critical path.

---

# 5. Extract from BNA versus rebuild

## 5.1 Extract selectively

Extraction means porting behavior into the new repository under characterization tests. It does **not** mean copying whole files unchanged.

| Source area | Extract | Required transformation |
|---|---|---|
| `src/lib/bna/one-time-signup-workflow.js` | Contact-name/email/phone normalization, Family/School classification, timezone validation, consent-policy versioning, lead-input normalization, idempotency concepts | Remove delivery templates, direct commercial assumptions, reminder scheduling, provider-specific channels, and BNA naming. Limit first slice to lead capture. |
| `src/lib/bna/crm-contact-model.js` | Contact-card vocabulary, normalized identities, deduplication precedence, consent/suppression fields, lifecycle/source labels, list/detail DTO concepts | Replace source-table unions with canonical repositories. Replace offset cursor with a stable keyset cursor before large-data cutover. Do not expose legacy table names. |
| `src/lib/bna/crm/contact-service.js` | Service boundary for list, detail/timeline, conversations, tasks; page-size limit; no-send safety envelope concepts | Rename to One Time contracts, remove BNA entitlements and source-table references, and implement real cursors for every collection. |
| `src/lib/bna/one-time-delivery-outbox.js` | Idempotency, bounded attempts, retry/dead-letter states, redacted public results, no raw secret/link return | Extract only provider-neutral outbox behavior. Provider construction, prompts, WAPI, Telegram, Resend, and class-link resolution stay in BNA unless separately approved later. |
| `src/platform/instances/one-time.js` | Canonical project/workspace aliases, no-BNA-private-data guard, export allowlist concept, separate-domain/database/secrets boundary | Remove the historical same-codebase assumption. Treat IDs as legacy compatibility data, not the new application’s tenancy architecture. |
| `src/lib/bna/one-time-role-model.js` | Owner/admin/read-only capability concepts, negative authorization tests, parent/student isolation concepts for later slices | Do not extract platform-super-admin, Studio worker, agent, or BNA governance roles. Reduce to the product roles in §6. |
| Focused tests and smokes | Validation matrices, no-send assertions, scope-negative cases, lead-to-CRM journey, privacy redaction, idempotency | Rewrite against new API paths and canonical schema; no hard dependency on BNA HTML or sessions. |
| Performance harness | Mobile/throttled profiles, route budgets, trace/deploy headers, DB/pool timing, RUM redaction, no-write smokes | Set smaller product-specific bundle/request budgets and remove BNA route assumptions. |
| Historical SQL | Column meanings, status vocabularies, legacy IDs, indexes, and source mapping | Use only as inventory/diff input. Never bulk-apply historical BNA migrations to the Rabbi database. |

## 5.2 Rebuild in the new repository

- Public landing and lead form.
- Authenticated CRM frontend.
- Login, session, MFA, password reset, and role administration.
- Express route composition and API error model.
- Canonical `onetime` database schema.
- Migration runner and ledger.
- Data compatibility repositories and backfill commands.
- Transactional outbox tables and worker runtime.
- BNA event client and protected admin API.
- Docker/Railway packaging.
- CI, branch protection, release evidence, and rollback runbooks.
- Observability and privacy-safe RUM.

## 5.3 Explicitly keep in BNA

- Operations shell and BNA navigation.
- Studio surfaces and worker identities.
- Agent prompts, model-routing internals, and agent-fleet machinery.
- Telegram bridges and bot orchestration.
- WAPI/Whapi, Resend, Stripe, Google, Drive, Vimeo, Zoom, Buffer, and similar provider internals for the first slice.
- Provider account credentials and webhook secrets.
- Commercial percentages, revenue-sharing, pricing-policy internals, referral economics, and unpublished offer decisions.
- BNA task/decision/governance systems.
- BNA private student, family, accounting, or Academy records.
- Historical memory, raw prompt packets, execution-run artifacts, screenshots, and secret/keyholder tools.

## 5.4 Data to migrate for the first slice

Migrate only the minimum verified One Time scope needed for landing → lead → CRM:

- Contacts.
- Contact identities needed for deduplication.
- Leads and lifecycle/status.
- Consent/suppression fields.
- Assignment/owner fields if currently in active use.
- Internal CRM notes and lead activities needed for operational continuity.
- Legacy identifiers and timestamps.

Defer unless specifically approved:

- Full email or WhatsApp message bodies.
- Student/member/class/library records.
- Billing/access data.
- Provider-integration logs.
- Prompt, agent, task-fleet, and Studio records.
- Files, recordings, transcripts, and external-storage references.

Every imported row must prove One Time scope. Same-email matching alone is insufficient evidence of scope.

---

# 6. Authentication and administrator-role model

## 6.1 Authentication decision

Replace current environment-variable username/password authentication with database-backed users and sessions.

Required properties:

- Passwords hashed with Argon2id.
- TOTP MFA mandatory for `owner` and `admin` before production CRM access.
- Secure, HTTP-only, SameSite cookies.
- Session rotation after login, MFA, password change, and role change.
- Server-side session revocation.
- CSRF protection for all state-changing browser requests.
- Login, MFA, reset, and lead-form rate limiting.
- No public administrative registration.
- No password, recovery code, or session token in environment variables, URLs, logs, analytics, or BNA events.
- Every security-sensitive change records actor, reason, trace ID, timestamp, and before/after role metadata without storing secret material.

The first owner is created through a controlled, one-time invitation/bootstrap procedure. A permanent bootstrap password must not be stored in Railway.

## 6.2 Product roles

| Role | Product permissions | Explicit exclusions |
|---|---|---|
| `owner` | Full One Time administration; user/role management; CRM; security settings; exports; owner-approved feature flags | Cannot alter BNA systems or retrieve BNA internals. Owner transfer requires a separate controlled workflow. |
| `admin` | CRM read/write; staff management below owner; operational settings; audit review | Cannot transfer ownership, change control-plane trust roots, or bypass MFA/audit. |
| `crm_agent` | Contact/lead list, detail, status, assignment, internal notes, permitted follow-up fields | Cannot manage users, security, database, environment, control-plane trust, or owner settings. |
| `viewer` | Read-only CRM and operational summaries | No mutation or export unless separately granted. |

No Studio, platform-super-admin, AI-worker, video-worker, or generic BNA role exists in the customer product database.

## 6.3 BNA support and supervision identity

BNA support access is **not** a shared user table and **not** a shared cookie.

- BNA authenticates service-to-service with a signed, audience-bound assertion.
- Default BNA scope is redacted read-only supervision.
- Human support escalation requires a reason/ticket reference and short expiry.
- A support session is created locally and audited; it is not a normal persistent customer role.
- Any write-capable support scope must be explicitly allowlisted and narrower than `owner`.
- Generic database consoles and arbitrary SQL are not part of the support model.

## 6.4 Authorization rules

- Deny by default.
- Capabilities are checked in domain/application services, not only in route middleware.
- List and detail queries enforce the same permissions.
- Export is a separate capability.
- User/role mutation is a separate capability.
- Internal admin API scopes are distinct from human product roles.
- All object references are opaque One Time IDs; legacy numeric IDs never authorize access.

---

# 7. Existing-database compatibility plan

## 7.1 Database decision

Reuse the existing separate Rabbi PostgreSQL database **only after** its target identity and schema are verified read-only. Add a canonical One Time schema rather than initializing a second unverified production database or applying the historical BNA migration set.

Recommended canonical schema name: `onetime`.

Minimum first-slice canonical objects:

- `onetime.contacts`
- `onetime.contact_identities`
- `onetime.leads`
- `onetime.activities`
- `onetime.idempotency_keys`
- `onetime.users`
- `onetime.user_roles`
- `onetime.sessions`
- `onetime.mfa_factors`
- `onetime.audit_log`
- `onetime.outbox_events`
- `onetime.outbox_attempts`
- `onetime.event_inbox`
- `onetime.legacy_links`
- `onetime.migration_checkpoints`
- `onetime.schema_migrations`

This list is a logical model, not authorization to create tables.

## 7.2 Legacy mapping inputs

The source identifies these likely first-slice inputs:

| Legacy source | Canonical target | Notes |
|---|---|---|
| `bna_contacts` | `onetime.contacts` and `onetime.contact_identities` | Preferred canonical legacy contact when duplicates exist. |
| `bna_parent_leads` | `onetime.leads`, `onetime.activities`, and contact link | Validate actual columns and project/workspace scope first. |
| `bna_product_leads` | `onetime.leads` and lead-source metadata | Preserve append-only history and link to any corresponding parent lead. |
| `bna_contact_communications` | `onetime.activities` | Import only operationally required, correctly scoped rows. |
| `bna_communications` | `onetime.activities` or deferred message domain | Default first slice should import metadata/summaries, not broad raw message history. |
| `bna_whatsapp_messages` | Deferred | Integration and full-message migration stay out of first slice unless specifically approved. |

The actual mapping cannot be finalized until the live schema is inspected.

## 7.3 Identity and compatibility rules

- New aggregate IDs are application-generated UUIDs.
- Preserve legacy source table, legacy primary key, source timestamp, and import checksum in `onetime.legacy_links`.
- Email and phone normalization are versioned; original display values are preserved only where required.
- Deduplication is scoped to the One Time product database and must record why rows were merged.
- Ambiguous duplicate rows are quarantined for review, not silently merged.
- New API cursors use stable keyset fields such as `(last_activity_at, id)`, not an encoded offset.
- Legacy IDs may be accepted only by a temporary internal compatibility adapter and are never returned by new public APIs.

## 7.4 Database roles

Subject to Railway/PostgreSQL capability verification, use separate credentials or roles for:

- `onetime_migrator`: schema changes only during approved migration jobs.
- `onetime_web`: canonical application reads/writes; no DDL.
- `onetime_worker`: outbox/scheduler writes and required canonical reads; no DDL.
- `onetime_legacy_reader`: temporary read-only access to verified legacy tables.
- `onetime_compat_writer`: temporary and disabled by default; minimal legacy writes only during an approved coexistence window.

If Railway exposes only one application credential, preserve the logical separation in code and add database-role separation when the platform permits. This must be inspected rather than assumed.

## 7.5 Migration-system rules

- One authoritative ordered manifest.
- Checksum every migration.
- Migration ledger records version, checksum, started/completed timestamps, actor/deploy SHA, and result.
- One advisory lock prevents concurrent migrators.
- Production web startup does not automatically apply migrations.
- Every migration is tested against both an empty test database and a restored/sanitized Rabbi-database clone.
- Historical BNA migration files are inputs to schema diffing only.
- No destructive down migration is treated as the primary rollback method.

---

# 8. Backward-compatible migration strategy

The required sequence is **expand → backfill → switch → contract later**.

## 8.1 Expand

Purpose: make the existing database capable of supporting the new app without breaking the old runtime.

Actions:

- Take and verify a snapshot/backup first.
- Create the canonical `onetime` schema and migration ledger.
- Add canonical first-slice tables, nullable compatibility fields, indexes, legacy-link table, outbox, and audit tables.
- Do not rename or drop legacy tables/columns.
- Avoid table-rewrite defaults on large tables.
- Build indexes concurrently where supported and operationally appropriate.
- Add a temporary compatibility repository, not broad dual-schema SQL scattered through routes.
- Add feature flags for canonical reads, canonical writes, legacy shadow reads, and any temporary compatibility write.

Exit gate:

- New schema exists on a clone.
- Old app smoke tests still pass against that clone.
- New app migration tests pass.
- No outbound processor is active.

## 8.2 Backfill

Purpose: populate canonical records without changing live behavior.

Actions:

- Read legacy rows in deterministic primary-key order.
- Process bounded, idempotent batches.
- Record checkpoints and per-batch counts/checksums.
- Preserve legacy IDs and timestamps.
- Disable outbox/event production for historical imports unless a specific synthetic import event is required.
- Do not alter legacy `updated_at` values merely to mark import.
- Quarantine ambiguous scope, duplicate, invalid identity, and referential cases.
- Re-run until a no-op pass is achieved.
- Compare counts by status/source/date, identity coverage, and sampled field hashes.

Exit gate:

- Reconciliation report is complete.
- All unresolved exceptions have an owner and disposition.
- No cross-scope records were imported.
- The same backfill can be re-run without duplicate canonical records.

## 8.3 Switch

Purpose: move traffic and system-of-record behavior without removing rollback.

Actions:

1. Enable canonical shadow reads and compare responses without affecting the user.
2. Enable canonical writes for synthetic/staff test leads.
3. Route the legacy public `POST /api/one-time/interest` through a server-side compatibility forwarder to the new lead API. Do not rely on a browser redirect for POST.
4. Switch One Time public traffic to the new web service.
5. Switch authenticated CRM users to the new login and CRM.
6. Keep any required minimal legacy compatibility writer behind a flag for the agreed rollback window; prefer BNA events over legacy writes.
7. Disable the old outbox/cron before enabling the new worker against the same database.
8. Monitor lead counts, idempotency conflicts, API latency, worker backlog, and reconciliation drift.

Exit gate:

- New lead acceptance and CRM readback match expected counts.
- BNA event delivery is asynchronous and healthy.
- Old routes either forward or clearly redirect.
- Rollback to the old web service remains possible without a schema restore.

## 8.4 Contract later

Purpose: remove temporary compatibility only after confidence is established.

Minimum prerequisites:

- At least two successful production releases after the switch.
- Agreed rollback window elapsed.
- No legacy readers or writers observed.
- Final reconciliation reports zero unexplained drift.
- Backup/restore proof is current.
- Explicit approval for every drop, rename, grant revocation, or data archive.

Actions may include:

- Disable and remove compatibility writes.
- Revoke legacy-table grants from One Time roles.
- Archive compatibility code.
- Retain legacy-link records for audit.
- Drop or rename legacy objects only in a separately approved database ADR.

---

# 9. Railway staging plan

The user-provided context says a separate One Time Railway project and Rabbi database already exist. Reuse them; do not provision another project blindly. Dashboard verification is still required.

## 9.1 Environment and service layout

Recommended inside the existing One Time Railway project:

- `staging` environment.
- `production` environment.
- Web service from the same Docker image.
- Worker service from the same Docker image.
- Separate PostgreSQL service/database per environment.
- No independent landing service, CRM service, auth service, or BNA bridge service.

Logical process selection:

- `PROCESS_TYPE=web`
- `PROCESS_TYPE=worker`

Use one authoritative Dockerfile. Do not leave Nixpacks and Dockerfile selection ambiguous.

## 9.2 Database clone or snapshot

Before staging integration:

1. Verify the exact production Rabbi database target without printing its connection value.
2. Prefer a Railway-native snapshot/clone only after dashboard capability and retention are confirmed.
3. Otherwise take an encrypted custom-format `pg_dump` and restore into a dedicated staging database.
4. Record only backup ID/label, timestamp, source environment, PostgreSQL version, and restore result.
5. Sanitize or replace PII when staging access exceeds the production support group.
6. Verify table/column/index/constraint/extension counts after restore.
7. Run migrations and backfill against the clone, never first against production.

## 9.3 Outbound integrations disabled or redirected

Staging must be unable to contact real recipients or create real commercial/provider effects.

Required posture:

- `OUTBOUND_MODE=disabled` for the initial staging deployment.
- Provider secrets are absent from the new app, not merely disabled by flags.
- BNA event delivery points to a staging ingest endpoint or a local sink.
- Email, WhatsApp, Telegram, payment, Drive, Vimeo, Zoom, and social actions remain in BNA and are not called by the first slice.
- Any permitted sink destination uses explicit allowlists and synthetic addresses/numbers.
- Inbound webhooks remain on the existing BNA integration runtime during the first slice.
- No production webhook is repointed merely to test the landing/CRM extraction.

## 9.4 One active cron/outbox processor

- Staging worker replicas: exactly one.
- Production initial worker replicas: exactly one.
- Worker leases and idempotency still must be correct; replica count is not the only safety control.
- Disable the existing Railway delivery cron before enabling the new worker on the same database.
- A scheduler advisory lock prevents two schedulers from enqueuing the same scheduled work.
- Startup must fail closed if `OUTBOUND_MODE` and environment do not match the approved policy.
- Staging deployment gate queries the worker-heartbeat table and proves one active processor.

## 9.5 Rollback

Application rollback:

- Deploy immutable images identified by commit SHA.
- Retain the previous known-good deployment.
- Use additive schema changes through cutover.
- Roll back web traffic to the previous image/service if health, lead acceptance, auth, or CRM gates fail.
- Disable the new worker before re-enabling any old processor.

Database rollback:

- Prefer forward repair for additive migrations.
- Use the verified snapshot/restore for irreversible failure.
- Do not depend on destructive down migrations.
- Do not run contract-stage drops during the initial cutover window.

Recommended automatic rollback triggers for the cutover runbook:

- Readiness failure for more than two minutes.
- Lead API 5xx rate above 1% over five minutes.
- Successful public submits without corresponding committed leads.
- Duplicate-lead/idempotency anomaly above the agreed test baseline.
- Worker backlog continuously increasing for 15 minutes.
- Cross-scope or authorization failure.
- Database migration/checksum mismatch.

These thresholds are recommended defaults and require owner approval before production use.

## 9.6 Domain cutover

1. Confirm domain ownership, DNS provider, canonical host, TLS status, and rollback authority.
2. Lower DNS TTL in advance.
3. Attach and verify the domain on the new staging/preview service first.
4. Validate host allowlist, secure cookies, CSP, canonical tags, redirects, and `/healthz`, `/readyz`, and version readback.
5. Keep legacy `/one-time` as a temporary redirect to the new canonical landing.
6. Keep legacy lead POST as a server-side compatibility forwarder for at least one release.
7. Run a synthetic lead with a reserved test identity and verify CRM visibility and cleanup.
8. Cut public DNS only after the old and new lead-count comparison is clean.
9. Do not move integration webhooks as part of this first cutover.
10. Keep the old service available for rapid rollback during the agreed window.

---

# 10. Environment-variable manifest: names and purposes only

No value is requested or recorded. Names may be adjusted during initialization, but there must be one documented owner and one purpose for every variable.

## 10.1 Core runtime

| Name | Purpose |
|---|---|
| `NODE_ENV` | Runtime mode used by libraries and build output. |
| `APP_ENV` | Explicit One Time environment: local, test, staging, or production. |
| `PORT` | HTTP listening port supplied by Railway. |
| `PROCESS_TYPE` | Selects `web` or `worker` from the same image. |
| `APP_BASE_URL` | Canonical authenticated application origin. |
| `PUBLIC_BASE_URL` | Canonical public origin. |
| `CANONICAL_HOST` | Host accepted for canonical redirects and security checks. |
| `ALLOWED_HOSTS` | Explicit host-header allowlist. |
| `LOG_LEVEL` | Structured-log verbosity. |
| `TRUST_PROXY` | Explicit proxy-hop policy for secure cookies and client IP handling. |
| `DEPLOY_SHA` | Commit/deployment identifier exposed through version and response headers. |

## 10.2 Database and migrations

| Name | Purpose |
|---|---|
| `DATABASE_URL` | One Time PostgreSQL connection. |
| `DATABASE_SSL_MODE` | Explicit SSL policy. |
| `DATABASE_POOL_MAX` | Maximum pool size per process. |
| `DATABASE_POOL_IDLE_TIMEOUT_MS` | Idle connection timeout. |
| `DATABASE_CONNECTION_TIMEOUT_MS` | Pool connection acquisition timeout. |
| `DATABASE_STATEMENT_TIMEOUT_MS` | Database statement timeout. |
| `MIGRATION_LOCK_KEY` | Stable advisory-lock identifier for the migration runner. |
| `MIGRATION_MODE` | Verify, apply-staging, or apply-production gate mode. |
| `LEGACY_WORKSPACE_KEY` | Temporary compatibility scope for `rabbi_sheller_provider`. |
| `LEGACY_PROJECT_KEY` | Temporary compatibility scope for `one_time_mishnah_class`. |
| `LEGACY_SHADOW_READ_ENABLED` | Enables response comparison without user-visible switching. |
| `LEGACY_COMPAT_WRITE_ENABLED` | Enables narrowly scoped temporary legacy writes during an approved window. |

## 10.3 Authentication and security

| Name | Purpose |
|---|---|
| `SESSION_SECRET` | Signs/encrypts session identifiers or session metadata as selected by implementation. |
| `SESSION_COOKIE_NAME` | Product-specific cookie name. |
| `SESSION_IDLE_TTL_SECONDS` | Idle session expiration. |
| `SESSION_ABSOLUTE_TTL_SECONDS` | Absolute session expiration. |
| `CSRF_SECRET` | CSRF-token protection material. |
| `AUTH_TOTP_ISSUER` | TOTP issuer label shown in authenticator applications. |
| `AUTH_MFA_REQUIRED` | Fail-closed switch for owner/admin MFA policy. |
| `AUTH_LOGIN_RATE_LIMIT_WINDOW_MS` | Login rate-limit window. |
| `AUTH_LOGIN_RATE_LIMIT_MAX` | Maximum login attempts per rate-limit window. |
| `BOOTSTRAP_OWNER_EMAIL` | Non-secret identity for the one-time owner invitation. |
| `SUPPORT_SESSION_MAX_TTL_SECONDS` | Maximum duration of BNA-requested support sessions. |

## 10.4 Public lead capture and CRM

| Name | Purpose |
|---|---|
| `LEAD_CAPTURE_ENABLED` | Public lead acceptance feature flag. |
| `LEAD_RATE_LIMIT_WINDOW_MS` | Public lead-form rate-limit window. |
| `LEAD_RATE_LIMIT_MAX` | Maximum accepted attempts per rate-limit key. |
| `LEAD_DEDUPE_WINDOW_MINUTES` | Time window used by the idempotency/deduplication policy. |
| `PUBLIC_DEFAULT_LOCALE` | Default landing locale. |
| `PUBLIC_FORM_SCHEMA_VERSION` | Version recorded with lead submissions. |
| `CRM_DEFAULT_PAGE_SIZE` | Default contact-list page size. |
| `CRM_MAX_PAGE_SIZE` | Maximum contact-list page size. |

## 10.5 Worker and outbox

| Name | Purpose |
|---|---|
| `OUTBOX_ENABLED` | Enables outbox processing for the worker. |
| `OUTBOUND_MODE` | Disabled, sink, or live. Must fail closed. |
| `OUTBOX_POLL_INTERVAL_MS` | Worker poll interval. |
| `OUTBOX_BATCH_SIZE` | Maximum rows claimed per batch. |
| `OUTBOX_LEASE_SECONDS` | Claim lease duration. |
| `OUTBOX_MAX_ATTEMPTS` | Dead-letter threshold. |
| `OUTBOX_RETRY_BASE_SECONDS` | Retry backoff base. |
| `SCHEDULER_ENABLED` | Enables singleton scheduler work. |
| `SCHEDULER_LOCK_KEY` | Advisory-lock identifier for scheduled enqueue work. |
| `WORKER_HEARTBEAT_INTERVAL_SECONDS` | Heartbeat update interval. |
| `OUTBOUND_DESTINATION_ALLOWLIST` | Synthetic/sandbox destination allowlist when sink testing is enabled. |

## 10.6 BNA control-plane connection

| Name | Purpose |
|---|---|
| `BNA_SYNC_ENABLED` | Enables asynchronous event delivery to BNA. |
| `BNA_CONTROL_PLANE_BASE_URL` | BNA control-plane API origin. |
| `BNA_CONTROL_PLANE_EVENT_PATH` | Versioned event-ingest path. |
| `BNA_CONTROL_PLANE_TIMEOUT_MS` | Delivery timeout. |
| `BNA_CONTROL_PLANE_ISSUER` | Expected BNA assertion issuer. |
| `BNA_CONTROL_PLANE_AUDIENCE` | Expected audience for protected One Time requests. |
| `BNA_CONTROL_PLANE_JWKS_URL` | Public keys used to verify signed BNA requests. |
| `ONETIME_EVENT_SIGNING_PRIVATE_KEY` | One Time key used to sign outbound event envelopes. |
| `ONETIME_EVENT_SIGNING_KEY_ID` | Rotation identifier for the signing key. |
| `ONETIME_EVENT_ISSUER` | Issuer placed on One Time event assertions. |
| `BNA_ADMIN_API_ENABLED` | Enables protected supervisory endpoints. |
| `BNA_ADMIN_API_CLOCK_SKEW_SECONDS` | Allowed assertion timestamp skew. |
| `BNA_ADMIN_API_NONCE_TTL_SECONDS` | Replay-protection window. |

## 10.7 Observability and performance

| Name | Purpose |
|---|---|
| `OTEL_SERVICE_NAME` | Service identity for traces/metrics. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Telemetry collector endpoint. |
| `OTEL_EXPORTER_OTLP_HEADERS` | Telemetry exporter authentication metadata, if required. |
| `RUM_ENABLED` | Enables privacy-safe browser performance reporting. |
| `RUM_SAMPLE_RATE` | Browser metric sample rate. |
| `ERROR_REPORTING_DSN` | Error-reporting endpoint, if approved. |
| `PERFORMANCE_BUDGET_MODE` | Warn or fail mode outside production; fail in CI/release. |

## 10.8 Cutover and safety

| Name | Purpose |
|---|---|
| `DOMAIN_CUTOVER_MODE` | Legacy, shadow, canary, or canonical route mode. |
| `LEGACY_LEAD_FORWARD_URL` | Temporary server-side target for old lead POST compatibility. |
| `LEGACY_ROUTE_REDIRECT_ENABLED` | Controls legacy GET redirects. |
| `CSP_REPORT_ONLY` | Allows CSP validation before enforcement. |
| `CSP_REPORT_URI` | CSP report destination if approved. |
| `STAGING_DATA_MODE` | Declares sanitized, synthetic, or restricted-clone staging posture. |

## 10.9 Variables that must not be bulk-copied into the first slice

Do not import existing variables merely because they already exist in Railway. The first-slice One Time app should not require direct values under these families:

- `OPENAI_*`, `KIMI_*`, or agent/fleet variables.
- `TELEGRAM_*`.
- `WAPI_*`, `WHAPI_*`, `ONE_TIME_WAPI_*`, or provider webhook secrets.
- `RESEND_*`, Gmail, or broad Google OAuth variables.
- `STRIPE_*`, Green Invoice, payment-link, or billing variables.
- `VIMEO_*`, Zoom, Drive, Buffer, or social variables.
- Studio/operator worker credentials.
- BNA keyholder paths.
- Commercial/pricing/revenue-share configuration.

A later integration ADR may add a specific variable only after ownership, environment, rotation, and failure behavior are documented.

---

# 11. BNA supervision design

## 11.1 Principles

- One Time is the system of record for its customer-product data.
- BNA is the internal control plane, not the One Time request processor.
- Normal One Time operation continues while BNA is unavailable.
- BNA stores summaries and event state, not a duplicate full CRM.
- No shared frontend bundle.
- No cross-app database join.
- No shared browser session or cookie.
- No generic remote-execution endpoint.

## 11.2 Asynchronous event channel

One Time writes the event and business mutation in the same local transaction. The worker later delivers it.

Recommended initial event types:

- `onetime.lead.captured.v1`
- `onetime.lead.lifecycle_changed.v1`
- `onetime.crm.contact_updated.v1`
- `onetime.crm.note_recorded.v1`
- `onetime.auth.security_event.v1`
- `onetime.outbox.delivery_state_changed.v1`
- `onetime.ops.daily_summary.v1`
- `onetime.incident.raised.v1`

Event envelope fields:

- Event ID.
- Event type and schema version.
- Occurred-at timestamp.
- One Time aggregate reference.
- Trace/correlation ID.
- Data-classification label.
- Minimal redacted summary.
- Metrics or state transition.
- Payload digest.
- Signing key ID and signature metadata.

Default events must not contain raw passwords, tokens, cookies, message bodies, prompts, class links, full payment details, or broad contact PII. A lead event can carry the One Time lead reference, source, classification, consent state, lifecycle state, and masked/hash identifiers. BNA may request a permitted redacted record summary through the protected admin API when human review is needed.

BNA deduplicates by event ID and returns success only after durable acceptance. One Time retries with bounded exponential backoff and dead-letters persistent failure.

## 11.3 Protected admin API

Recommended initial endpoints are narrow and versioned:

- Health/readiness/version.
- Daily operational summary.
- Lead/contact counts by lifecycle state.
- Outbox backlog, retry, and dead-letter summary.
- Migration/schema version.
- Redacted contact/lead summary by One Time opaque ID.
- Create a short-lived support session.
- Pause outbound event delivery.
- Resume outbound event delivery.
- Replay one dead-lettered BNA event.

Every request requires:

- Signed service assertion.
- Expected issuer and audience.
- Short expiration.
- Timestamp and nonce replay protection.
- Explicit scope.
- Idempotency key for commands.
- Audit record.
- Response redaction.

There is no endpoint for arbitrary SQL, arbitrary URL fetch, arbitrary provider send, prompt retrieval, secret retrieval, or generic code execution.

## 11.4 BNA UI behavior

The BNA internal frontend remains its own bundle. Its backend calls One Time server-to-server and returns BNA-shaped internal UI data. The browser never loads One Time’s private admin API directly and never relies on cross-origin cookies.

---

# 12. Route-level loading, API, caching, and performance rules

## 12.1 Initial route map

| Route | Surface | Initial code/data behavior |
|---|---|---|
| `/` | Public landing | Static/server-rendered HTML. No blocking API call. Minimal form-enhancement JS only. |
| `/privacy`, `/terms` | Public legal | Static/server-rendered; no app bundle. |
| `/login` | Authentication | Small isolated authentication bundle. No CRM preload. |
| `/app/crm` | CRM list | Load authenticated app shell and CRM-list route chunk. One list API call. |
| `/app/crm/:contactId` | Contact detail | Load detail chunk. One contact summary call; timeline/conversations lazy. |
| `POST /api/v1/leads` | Public lead capture | One local database transaction; no synchronous BNA/provider request. |
| `/api/v1/crm/contacts` | CRM list API | Keyset cursor, default 50, maximum 100, explicit filters/sort. |
| `/api/v1/crm/contacts/:id` | Contact detail | Canonical contact/lead summary only. |
| `/api/v1/crm/contacts/:id/timeline` | Timeline | Separate paged endpoint; no browser-side union of whole tables. |
| `/internal/v1/*` | BNA supervision | Server-to-server only; signed and scoped. |
| `/healthz` | Liveness | Process check; no expensive dependency fan-out. |
| `/readyz` | Readiness | Database connectivity, expected migration version, and essential configuration. |
| `/version` | Deployment proof | Commit/deploy identity; no secret/config values. |

## 12.2 Loading and API-call rules

- Public landing performs zero blocking API calls before form interaction.
- Public submit performs exactly one lead POST.
- CRM list performs one list call on route load.
- Contact detail is not fetched for every list row.
- Timeline, conversations, and tasks are loaded only after selection or route navigation.
- No N+1 API or SQL pattern is permitted.
- Search is debounced at approximately 250 ms and cancels stale requests.
- Search/filter/sort are server-side for canonical data.
- List pages use stable keyset cursors.
- Mutations invalidate only the affected list/detail cache keys.
- Prefetch is limited to high-confidence navigation and disabled on constrained networks.
- No CRM response is persisted in browser durable storage.
- No service worker in the first slice; stale authenticated data risk outweighs offline value.

## 12.3 HTTP caching

| Resource | Policy |
|---|---|
| Fingerprinted JS/CSS/fonts/images | `public, max-age=31536000, immutable` |
| Public HTML | Short shared-cache TTL with stale-while-revalidate where the serving layer supports it; always safe to revalidate. |
| Legal pages | Longer shared TTL than landing, with revalidation on deploy. |
| Authenticated HTML | `private, no-store` or equivalent strict revalidation. |
| CRM API | No shared cache. Use private ETag/conditional GET only where it cannot expose stale authorization. |
| Health/readiness/version | No sensitive caching; brief operational caching only if required by Railway health checks. |
| Internal admin API | `no-store`. |

## 12.4 Performance budgets

These are recommended release budgets for the new product, intentionally smaller than the current BNA shell budgets.

### Public landing

- Initial JavaScript: **≤ 80 KB gzip**.
- Initial CSS: **≤ 50 KB gzip**.
- Initial transferred page weight excluding deferred media: **≤ 750 KB**.
- Requests before interactive: **≤ 20**.
- Synthetic throttled-mobile LCP p95: **≤ 3.5 seconds**.
- Production RUM LCP p75: **≤ 2.5 seconds**.
- INP p75: **≤ 200 ms**.
- CLS p75: **≤ 0.10**.
- Lead API p95: **≤ 750 ms** with no external dependency in the transaction.

### Authenticated CRM

- Initial authenticated shell plus CRM-list JavaScript: **≤ 220 KB gzip**.
- Any individual route chunk: **≤ 75 KB gzip**.
- Initial authenticated transfer excluding user data: **≤ 650 KB**.
- CRM list API p95: **≤ 800 ms**.
- Contact detail/timeline API p95: **≤ 1,000 ms**.
- Database time p95 for first-page CRM list: **≤ 300 ms**.
- Pool wait p95: **≤ 50 ms**.
- Route transition p75 after authentication: **≤ 1,000 ms**.

Budgets fail CI/release; they are not advisory dashboards.

## 12.5 Observability rules

Carry forward and standardize the current performance evidence pattern:

- `Server-Timing` includes app, handler, database, and pool durations plus query count.
- Response includes trace ID, deploy SHA, and response-byte count.
- Logs are structured and correlate request, database, worker, and BNA event delivery.
- RUM records route identifiers and timing only after sanitization.
- RUM never captures query-string PII, cookies, localStorage, DOM text, contact IDs, message content, or destination data.
- Public error bodies are stable, redacted, and do not reveal table names, SQL, provider responses, or configuration.

---

# 13. CI and verification gates before deployment

Every gate is blocking unless explicitly marked as a manual production approval.

| Gate | Required proof | Deployment result on failure |
|---|---|---|
| Repository integrity | Clean worktree, lockfile present, expected branch, no generated drift | Stop |
| Install/build | `npm ci`, TypeScript build, Vite build, web/worker entry points | Stop |
| Formatting/lint/type safety | Formatter, linter, strict TypeScript checks | Stop |
| Unit/domain tests | Lead validation, identity normalization, dedupe, consent, lifecycle, role checks, outbox state machine | Stop |
| API contract tests | OpenAPI/schema compatibility, stable error envelopes, cursor behavior | Stop |
| Authentication/security tests | Password/MFA/session rotation, CSRF, rate limits, role-negative matrix, support assertion replay protection | Stop |
| Migration clean-database test | All migrations apply from empty database in exact order | Stop |
| Migration Rabbi-clone test | Migrations apply to restored/sanitized Rabbi clone | Stop |
| Migration idempotency/checksum test | Re-run is no-op; checksum drift rejected | Stop |
| Destructive-DDL policy | No unapproved drop/rename/not-null/rewrite; expected locks reviewed | Stop |
| Backfill test | Bounded, restartable, no duplicates, checkpoints and reconciliation | Stop |
| Tenant/privacy isolation | Only verified One Time rows; no BNA private records; no same-email scope broadening | Stop |
| Integration/database test | Lead transaction creates contact/lead/activity/audit/outbox atomically | Stop |
| Worker concurrency test | Two test workers cannot double-deliver; lease expiry/reclaim works | Stop |
| Outbox policy test | Disabled/sink/live modes fail closed; retry/dead-letter/idempotency verified | Stop |
| BNA contract test | Provider/consumer schema compatibility and event deduplication | Stop |
| E2E first-slice test | Landing → lead submit → CRM list → contact detail, using synthetic identity | Stop |
| No-outbound smoke | No email, WhatsApp, Telegram, billing, access, Drive, Vimeo, Zoom, social, or production BNA write | Stop |
| Accessibility | Automated checks plus keyboard/focus/screen-reader smoke on landing, form, login, CRM | Stop |
| Performance/bundle | Budgets in §12 pass on desktop and throttled mobile | Stop |
| Privacy/RUM | No PII in URLs, logs, RUM, client storage, screenshots, or artifacts | Stop |
| Secret scan | No secrets, private keys, credentials, or copied Railway values in repository/image | Stop |
| Dependency/license/SBOM | Dependency audit, license allowlist, software bill of materials | Stop |
| Container proof | Same image starts as web and worker; non-selected process does not run | Stop |
| Health/version proof | Liveness, readiness, migration version, and exact deploy SHA | Stop |
| Staging topology | Correct project/environment/database; exactly one active worker; outbound disabled | Stop |
| Staging migration/readback | Snapshot ID recorded, migrations/backfill/reconciliation pass, restore tested | Stop |
| Cutover rehearsal | Legacy redirect/POST forward, synthetic lead, rollback, and worker handoff rehearsed | Stop |
| Production approval | Owner approves exact SHA, target, snapshot, migration set, worker handoff, and rollback plan | Stop without approval |

Branch protection should require the CI gates and at least one review for migration, auth, control-plane, and Railway configuration changes.

---

# 14. Build-order dependency graph

The required main path begins exactly as follows:

```text
foundation
  → landing
    → lead capture
      → CRM
        → staging integration
```

Expanded dependency graph:

```text
foundation
  ├─ repository/build/container/config schema
  ├─ observability/health/version
  ├─ canonical migration runner and DB roles
  ├─ contract/versioning conventions
  ├─ security baseline
  ├─ auth core ───────────────────────────────┐
  ├─ legacy schema inventory/compat mapping ─┤
  └─ BNA event/admin contract skeleton ──────┤
                                             │
foundation → landing                         │
              ├─ public asset pipeline       │
              ├─ accessibility/SEO/privacy   │
              └─ public performance gate     │
                    ↓                        │
                 lead capture                │
              ├─ contacts/leads schema       │
              ├─ validation/consent          │
              ├─ idempotency/rate limits     │
              ├─ audit/outbox transaction    │
              └─ legacy lead mapping         │
                    ↓                        │
                    CRM ← auth core ─────────┘
              ├─ role enforcement
              ├─ contact list/keyset cursor
              ├─ contact detail/timeline
              ├─ mutations/audit
              └─ CRM performance gate
                    ↓
             staging integration
              ├─ Rabbi DB clone/snapshot
              ├─ expand migrations
              ├─ backfill/reconciliation
              ├─ one worker/outbox processor
              ├─ BNA staging event sink
              ├─ no-outbound verification
              └─ rollback rehearsal
                    ↓
             production shadow/read compare
                    ↓
             domain and lead-route cutover
                    ↓
             contract later
```

## Build-order exit criteria

### Foundation

- Clean repository skeleton.
- One image starts web and worker.
- Configuration validation fails closed.
- Database connection, migration verification, health, version, trace, and secret scan pass.
- Source allowlist for extraction approved.

### Landing

- New standalone page has no BNA bundle/helper dependency.
- Public performance and accessibility budgets pass.
- Legal/canonical/domain decisions are represented without enabling lead writes.

### Lead capture

- Local transaction creates canonical records atomically.
- Public API is idempotent and rate-limited.
- No synchronous provider/BNA dependency.
- Synthetic end-to-end capture is visible through a read-only admin probe.

### CRM

- Owner/admin authentication and MFA work.
- List/detail/timeline route contracts and negative role tests pass.
- Stable pagination and no N+1 behavior are proven.
- No legacy table name or BNA route is visible to the product UI.

### Staging integration

- Correct Railway target verified.
- Snapshot/clone restored.
- Expand/backfill/reconciliation complete.
- Exactly one worker active.
- Outbound disabled or sink-only.
- BNA staging events dedupe and retry.
- Rollback rehearsal complete.

No Studio, agent, billing, messaging, portal, class, video, or community scope enters this build graph before the first-slice staging gate passes.

---

# 15. Missing information and explicit stop conditions

## 15.1 Railway information that must be inspected later

Inspect read-only and record names/statuses only; never print variable values.

- Exact Railway project ID/name and ownership.
- Existing environments and which is production.
- Service names, source repository/branch, root directory, and auto-deploy triggers.
- Builder actually used: Dockerfile versus Nixpacks.
- Start command, pre-deploy command, health-check path, restart policy, replica count, region, and resource limits.
- Custom domains, TLS status, and current traffic target.
- PostgreSQL service identity, version, storage, backup/PITR capability, and restore procedure.
- Private networking and public exposure.
- Current active deployment SHA and previous rollback candidate.
- Current cron services and schedules.
- Current worker services and replica counts.
- Current outbound/webhook services.
- Variable **names**, environment scope, and service references; no values.
- Whether production provider secrets are shared by reference across services.
- Logs/metrics retention and access control.
- Any volume or persistent-file dependency.

### Railway stop conditions

Stop repository deployment if any of the following is true:

- The target project/environment/service is ambiguous.
- The builder/start command cannot be proven.
- The Rabbi database target is ambiguous.
- A production cron/worker could process the same outbox concurrently.
- Staging contains production provider credentials or can reach real recipients.
- Snapshot/restore is unavailable or untested.
- Rollback deployment or domain authority is unavailable.

## 15.2 Rabbi database information that must be inspected later

Use a read-only database role/transaction where possible.

- PostgreSQL version and installed extensions.
- Schemas, tables, views, materialized views, sequences, functions, triggers, and RLS policies.
- Columns, types, defaults, generated columns, nullability, constraints, and foreign keys.
- Index definitions and sizes.
- Table sizes and approximate row counts.
- Existing migration ledger, if any.
- Exact structure of `bna_contacts`, `bna_parent_leads`, `bna_product_leads`, communications, outbox, users, and sessions.
- Scope columns and null rates.
- Duplicate email/phone distribution within verified One Time scope.
- Orphaned foreign keys and invalid status values.
- Database roles/grants and connection limits.
- Time zone, collation, and encoding.
- Backup timestamp and restore proof.
- Active writers/readers and their application/service identities.

### Database stop conditions

Stop schema or backfill work if any of the following is true:

- No current backup/snapshot exists.
- A disposable clone cannot be restored.
- Scope columns are absent or do not reliably distinguish One Time rows.
- Existing writers cannot be identified.
- Historical migration state cannot be determined.
- Proposed changes require destructive DDL during the initial cutover.
- Backfill cannot be made idempotent and restartable.
- Reconciliation identifies unexplained cross-scope or duplicate data.

## 15.3 Product, auth, and data decisions still required

- Confirm canonical public domain and whether `/one-time` remains a permanent alias.
- Confirm repository ownership, maintainer group, branch protections, and release approvers.
- Confirm Rabbi as product owner and the initial admin/staff roster.
- Confirm MFA requirement and account-recovery authority.
- Confirm privacy notice, lead consent text/version, retention, deletion, and export policy.
- Confirm which existing internal notes/communications are required in first-slice CRM.
- Confirm source asset ownership/licensing for landing copy, images, logos, and fonts.
- Confirm expected lead/contact volume and SLO acceptance.
- Confirm whether any old BNA route must remain writable after cutover and for how long.

### Product/auth stop conditions

Stop public production launch if:

- Owner/admin identity and recovery authority are unclear.
- Owner/admin MFA is not enforced.
- Consent/retention language is unapproved.
- Public assets lack ownership/license confirmation.
- The old lead route can lose submissions during DNS or application rollback.

## 15.4 BNA control-plane decisions still required

- BNA event-ingest URL and owner.
- Event schema owner and version policy.
- Signing-key issuer/audience/JWKS and rotation procedure.
- Allowed supervisory read scopes.
- Allowed command scopes, if any.
- Support-session reason/ticket policy and maximum duration.
- Redaction/data-classification rules.
- Event retention and replay policy.
- Staging sink and consumer contract-test environment.

### BNA stop conditions

Stop BNA connection enablement if:

- Event delivery would be synchronous in lead capture or CRM mutation.
- One Time must query BNA’s database or load BNA’s frontend bundle.
- BNA requests are not signed, scoped, expiring, and replay-protected.
- Event payloads contain unapproved PII, prompts, secrets, message bodies, commercial internals, or provider credentials.
- BNA has no deduplication by event ID.
- The protected API exposes generic SQL, arbitrary network requests, or arbitrary execution.

## 15.5 Extraction stop conditions

Do not port a BNA module when:

- It imports `server.js`, Operations UI, Studio, agent, provider, keyholder, or broad BNA task/governance code.
- Its behavior cannot be characterized by focused tests.
- Its data query relies on cross-workspace unions or same-email scope broadening.
- It embeds commercial terms, unpublished pricing, prompts, or provider credentials.
- It performs outbound work inside a request transaction.
- Ownership/license of copied assets is unclear.

## 15.6 Repository-initialization gate

The architecture supports initializing `sdratler/OneTimeOneTime`, but initialization must stop until all of these are true:

1. The repository is still empty and is confirmed as the legal/operational target.
2. Maintainers, protected branch, required checks, and release approvers are decided.
3. The BNA extraction allowlist and explicit denylist in §5 are approved.
4. The Railway project and Rabbi database identities are confirmed read-only.
5. A snapshot/clone path is confirmed.
6. No live provider secret will be bulk-copied.
7. The first-slice scope remains landing → lead capture → CRM → staging integration.

---

# Decision consequences

## Positive

- Independent customer-product ownership and release cadence.
- No BNA frontend/runtime dependency.
- Smaller and measurable public/CRM artifacts.
- Existing Node/PostgreSQL behavior can be reused selectively.
- Database migration is reversible through additive change and compatibility.
- BNA retains supervision without becoming a customer-runtime dependency.
- Provider integrations and sensitive internal logic remain centralized in BNA.
- One web and one worker avoid microservice proliferation.

## Negative or temporary cost

- A compatibility schema/repository and backfill must exist during transition.
- Authentication must be rebuilt rather than copied.
- BNA and One Time need explicit event/admin contracts and key rotation.
- Some existing CRM aggregation behavior must be simplified or deferred.
- There will be a period with canonical and legacy models coexisting.
- The clean repository will initially duplicate a small amount of domain behavior, but under explicit contract tests rather than shared source coupling.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Unknown live database shape | Mandatory read-only inventory and restored clone before migration. |
| Duplicate leads during coexistence | Submission idempotency, legacy links, one POST forwarder, reconciliation. |
| Two outbox processors | Worker heartbeat, advisory lock, DB lease, explicit old-cron disable gate. |
| BNA outage blocks product | Local commit first; asynchronous outbox; retry/dead-letter. |
| Auth regression | New DB auth, MFA, role-negative tests, no shared cookies. |
| Frontend grows into another shell | Route budgets, public/app build separation, no generic BNA modules. |
| Secret sprawl | Required-name manifest, no bulk copy, provider secrets excluded from first slice. |
| Data leakage through telemetry | Sanitized route IDs, no CRM durable browser storage, privacy tests. |
| Rollback requires destructive DB action | Expand-only initial migrations; old service remains compatible; snapshot restore available. |

---

# Evidence register

The following evidence was retrieved read-only from `shloimie-beep/bnei-neviim-academy` on 2026-07-14 unless noted. Blob SHAs are included so later reviewers can detect source drift.

| ID | Source | Blob/commit | Architectural fact used |
|---|---|---|---|
| E01 | `package.json` | `e4896e9265a9d74abb1325e7cebe84851f90b9a1` | `server.js` entry, Railway start selector, Node test runner, focused One Time tests, outbox cron, release/smoke/performance scripts, separate-instance and DB bootstrap scripts. |
| E02 | `package.json` dependencies | same file | Express, `pg`, compression, Stripe; Playwright and Lighthouse tooling. |
| E03 | `Dockerfile` | inspected blob | Node 24 Alpine, `npm ci`, `npm start`. |
| E04 | `railway.json` | inspected blob | Nixpacks builder declaration. |
| E05 | `scripts/railway-start.mjs` | inspected blob | Environment-selected web/Telegram process and signal forwarding. |
| E06 | `railway.one-time-delivery-cron.json` | `9ce9a8fbed5d05a850d1f27434cb2905f3b1d3aa` | Five-minute Railway cron, no restart, outbox script entry. |
| E07 | `src/platform/instances/one-time.js` | inspected blob | Canonical project/workspace keys; no-BNA-private-data guard; separate domain/database/secrets boundary; export allowlist. |
| E08 | `src/platform/instances/one-time-separate-deployment.js` | inspected blob | Single-tenant runtime flags, variable-name manifest, required/optional secret-name checks, Railway logical plan, idempotent seed/isolation concepts. |
| E09 | `ops/surface-maps/2026-07-12-onetime-crm-portal-surface-map.md` | `d679990693cefee3b62d79f5b5aadf9e8ced747a` | Current public, Operations, provider, member, parent, student, classroom, library, CRM, communication, and WhatsApp surfaces. |
| E10 | `docs/audits/one-time-one-time/2026-06-18-current-state-and-deployment-audit.md` | `ab6bf438ed7ff8ffc87d9d77691e3c5ee7d66ba1` | Active Express/PostgreSQL/static architecture; archived Next/Supabase status; current env auth; tenancy gaps; separate-deployment history. |
| E11 | `src/lib/bna/one-time-role-model.js` | inspected blob | Existing broad role vocabulary, compatibility aliases, owner/admin mappings, and authorization rules. |
| E12 | `.env.example` | `82926a6e1fbb9767b2445f4acb4a195bee47a381` | Current environment-variable username/password model and broad provider/agent/Studio secret surface. No values were inspected. |
| E13 | `src/lib/bna/one-time-signup-workflow.js` | `4248bbc1386de4e8db4f07dfbb45d922b671a3ca` | Lead validation, Family/School classification, timezone and consent handling, lead normalization, outbox idempotency and recipient hashing. |
| E14 | `src/lib/bna/crm-contact-model.js` | `0a57610c8c3cc54fc3d56f4f720e9fbc5c1917ac` | Contact normalization, deduplication, consent/suppression state, source labels, default 50/max 100 paging, current offset cursor. |
| E15 | `src/lib/bna/crm/contact-service.js` | `70f7e7f3ec80bef754221701f6f1c6e6ca1aeb60` | CRM list/timeline/conversation/task service boundary and no-send response envelope. |
| E16 | `src/lib/bna/one-time-delivery-outbox.js` | `6858c6c74bd14adfa39c500b62fd333be4e421af` | Channel registry, maximum attempts, safety/redaction, provider request construction, retry/dead-letter behavior. |
| E17 | `scripts/run-one-time-delivery-outbox-cron.mjs` | `4c2e77b4887a60aee7ce176b734794d3c1b7e554` | Current cron calls a public HTTPS endpoint with a cron secret, bounded timeout, batch limit, and redacted output. |
| E18 | `scripts/smoke-one-time-interest-crm-e2e-live.mjs` | `fcdf76a0c3d4149b85edcb583a7ea65e29601411` | Existing `/api/one-time/interest` lead path, internal CRM record, no-send guardrails, and CRM readback journey. |
| E19 | `railway-migration-2026-06-05-one-time-projects.sql` | `eb475971a3cbe44c1df76397693d62d01f6d83e1` | Historical project/member schema and data updates; idempotent upserts; broad task reclassification. |
| E20 | `railway-migration-2026-06-16-one-time-product-system.sql` | `c9ab404b1e8a5498c8ebc098c9258e50a9de63d1` | Historical product/lead tables, constraints, indexes, and broad commercial/product schema. Used only as mapping evidence. |
| E21 | `ops/execution-runs/2026-06-24-final-release-integration/MIGRATION-READINESS.md` | `4609515030216530a4ce59966826dbf22e7b4fc0` | Historical migrations are target-diff inputs, not a blanket apply list; backup, inventory, clone dry-run, rollback, and readback are required. |
| E22 | `ops/execution-runs/2026-07-12-onetime-crm-portal-production-correction/EVIDENCE.md` | `e87fa2c2314cefa1c82d1a22238bbf84469b3e62` | CRM scoping, default/max pagination, abort/debounce/cache behavior, large shared shell, public BNA-helper removal, release-gate controls. |
| E23 | `scripts/audit-onetime-architecture-performance-baseline.mjs` | `1ca01a94df1710e4a8fc15cfd94449c7b6cc14ee` | Route matrix, mobile/throttled profiles, redaction, API probes, and baseline budget classes. |
| E24 | `ops/performance-audits/2026-07-13-onetime-architecture-performance-baseline/report.md` | `1c500a15493a2a0e916e79d7e6af238423726b8d` | Shared Operations shell identified as critical path; 160 samples; no direct API breach; instrumentation gaps and measured mobile behavior. |
| E25 | `scripts/audit-onetime-performance-regression-gates.mjs` | `5dff0fd996454d62e0c9dc2466647de8d0bd0502` | Required Server-Timing, trace/deploy/bytes headers, DB/pool timing, privacy-safe RUM, and current bundle gates. |
| E26 | `ops/performance-audits/2026-07-13-onetime-performance-regression-gates/report.md` | `f7756613993a0b21924fad8a2ddf09d1a45f079a` | Regression gate passed with current large shell allowance and live scoped CRM/readiness instrumentation. |
| E27 | `tests/one-time-wapi-scope-contract.test.js` | `5485d7cfa7429afa48e3f15e61b7eb6b3948fc14` | WAPI credentials are scoped, webhook auth avoids query secrets, auto-reply is approval-gated, inbound CRM and dedupe behavior are tightly coupled to BNA server/integration code. |
| E28 | `tasks-pending/2026-07-12-onetime-wapi-webhook-bot-not-responding.md` | `6270e365918b576572a7c18ebf6b6368e124ee99` | Source-reported WAPI webhook registration, inbound communication creation, approval-gated auto-reply, and explicit no-secret/raw-data guardrails. |
| E29 | GitHub commit metadata | latest visible: `cebbfc5781b92fcd9a5014df67f8ae4ba0b3a61c`, dated 2026-07-13 | Confirms the inspected BNA repository remained actively updated immediately before this ADR. Individual file blob SHAs govern the evidence above. |
| E30 | GitHub connector metadata for `sdratler/OneTimeOneTime` | observed 2026-07-14 | Provisional target was private, default branch `main`, size zero, and contained no source to inspect. Recheck before initialization. |

---

# Final architecture decision

**Adopt `sdratler/OneTimeOneTime` as a clean standalone repository after the initialization gate clears. Build One Time as a Node/TypeScript/Express modular monolith with static public pages, a focused route-chunked React CRM, PostgreSQL/`pg`, an additive canonical `onetime` schema, and one transactional-outbox worker. Reuse characterized One Time domain contracts and data mappings; rebuild product UI, auth, API composition, migrations, worker packaging, and BNA integration. Keep BNA as an asynchronous supervisory control plane with signed events and a narrow protected admin API. Do not share frontend code, sessions, provider internals, or database joins.**
