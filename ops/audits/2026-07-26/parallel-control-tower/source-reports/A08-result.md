# A08 — BNA School product inventory and extraction audit

**Requested result path:** `ops/audits/2026-07-26/parallel-control-tower/A08-result.md`  
**Audit date:** 2026-07-27  
**Mode:** Read-only  
**Repository audited:** `shloimie-beep/bnei-neviim-academy`  
**Immutable checkpoint:** `cebbfc5781b92fcd9a5014df67f8ae4ba0b3a61c`  
**Repository mutation:** None  
**Database/provider/deployment mutation:** None  
**Tests executed by A08:** None  
**Result status:** Complete audit; contract ready; implementation not assigned

---

## 1. Executive verdict

**CONFIRMED CURRENT TRUTH — the pinned repository contains a real BNA School product, but it is not a safe foundation repository.** The checkpoint exposes executable school behavior for students, families, signups, classes, attendance, goals, payments, communications, portals, content, and the public school website. Those surfaces coexist in one Express/PostgreSQL runtime with BNA control-plane operations, provider marketplace/personal-family behavior, and extensive One Time implementation.

**CONFIRMED CURRENT TRUTH — the previously accepted target topology remains correct and is not reopened by A08.** BNA School requires a new standalone repository, PostgreSQL database, deployment, login/session/cookie namespace, secret namespace, migration lineage, and failure domain. The legacy repository remains a migration source and compatibility archive until each replacement surface passes reconciliation, rollback, and observation gates.

**CONFIRMED CURRENT TRUTH — the first usable BNA School slice remains _School Directory + Daily Attendance_.** It is the smallest slice that establishes authoritative school identities and delivers an independently useful daily workflow without importing the current Operations shell, One Time runtime, complete CRM, billing, content library, or parent/student portals.

**NEW FINDING — the legacy attendance implementation is not an adequate school-day attendance contract.** `bna_class_attendance` and class-attendance APIs exist, but the strongest accepted attendance evidence is either portal display logic or live-class/member/Zoom infrastructure. The new school must implement a school-native attendance aggregate rather than copy the legacy live/class shape one-for-one.

**NEW FINDING — staff, admissions, and tuition are present only as partial or mixed concepts.**

- Staff/teacher identities appear in broad people/workspace role models, but no complete school staff lifecycle/API was found.
- Signups and parent leads are intake/CRM records, not a proven application → decision → enrollment lifecycle.
- Payment intake, reminders, payments, and provider webhooks exist, but a complete school tuition ledger and authoritative billing source were not proven.

These domains must not be represented as “already extracted” or “ready to port.”

**NEW FINDING — identity-specific source fixtures are an extraction hazard.** The pinned source contains hard-coded personal-family seed records and an identity-specific student alias/deduplication group. Those records may be useful as protected migration evidence, but they must not enter the new repository, synthetic tests, public evidence, or event payloads.

**CONFIRMED CURRENT TRUTH — One Time remains independent and first.** A08 creates no authority to create the BNA School repository, change the legacy repository, migrate production data, or overlap the current One Time launch-critical lanes.

### Audit decision

**Verdict: `APPROVE_CONTRACT_ONLY_NOT_IMPLEMENTATION`.**

The architecture and extraction sequence are sufficiently defined for Board review. Before any scaffold writer starts, the control tower must accept:

1. the One Time priority gate;
2. the A06 security/current-file and local-state gates relevant to BNA;
3. a protected read-only school database inventory;
4. operator decisions for staff roles and attendance semantics;
5. an exclusive BNA School writer assignment.

No P0 production failure was proven by A08. The primary P1 risk is architectural and migration-related: copying the monolith would reproduce cross-product auth, data, provider, and privacy coupling.

---

## 2. Evidence hierarchy, scope, and limitations

### 2.1 Evidence hierarchy used

A08 applied the following precedence:

1. **Pinned source at the immutable checkpoint**
   - `server.js`
   - `package.json`
   - public UI files
   - source modules
   - migrations
   - route/action registries
2. **Checkpoint route inventories**
   - `ops/route-registry.json`
   - `docs/owner-review/ROUTE-INVENTORY.csv`
3. **Focused contract tests and accepted execution evidence**
4. **Current PR descriptions for open BNA lanes**
5. **Previously accepted decomposition and security audits**
6. **Historical handoffs and deployment records**

A historical deployment, stale handoff, passing string-presence test, or resolving route was not treated as current production truth.

### 2.2 What A08 did not prove

The following remain **UNPROVEN**:

- current production table definitions, row counts, duplicates, or retention requirements;
- current production/staging source attestation;
- current local dirty worktrees, untracked files, or local-only commits;
- current database RLS configuration;
- current mounting of every legacy route;
- external provider configuration and data ownership;
- legal/accounting retention requirements;
- current backup/restore readiness;
- the complete binary, screenshot, archive, and Git-history privacy state;
- a complete current staff authority model;
- final attendance statuses, timezone rules, correction policy, and all-day versus class-period semantics;
- tuition source of truth and recurring-charge policy.

### 2.3 No-write assurance

A08 did not:

- create a repository, branch, commit, PR, issue, comment, tag, or packet;
- edit `bnei-neviim-academy`;
- access a production database;
- authenticate as a protected user;
- open a provider console;
- send a message;
- run a payment;
- deploy;
- modify One Time.

---

## 3. Prior decisions preserved rather than repeated

| Decision | Classification | A08 treatment |
|---|---|---|
| Three independent applications: BNA Control Plane, One Time, BNA School | **CONFIRMED CURRENT TRUTH** | Preserved. |
| New clean `bna-school` repository and database | **CONFIRMED CURRENT TRUTH** | Preserved; no repository created. |
| Separate product sessions, cookies, secrets, and deployments | **CONFIRMED CURRENT TRUTH** | Binding extraction invariant. |
| Product pages make zero synchronous control-plane calls | **CONFIRMED CURRENT TRUTH** | Binding availability invariant. |
| Signed asynchronous minimized status/event bridge only | **CONFIRMED CURRENT TRUTH** | Included in Packet A08-P05. |
| Legacy BNA repository is migration source/compatibility archive | **CONFIRMED CURRENT TRUTH** | Preserved until independent cutovers pass. |
| First school slice is Directory + Daily Attendance | **CONFIRMED CURRENT TRUTH** | Preserved, with a new attendance rewrite requirement. |
| One Time launch remains independent and first | **CONFIRMED CURRENT TRUTH** | Blocks BNA School implementation assignment now. |
| Shared platform-core compatibility migration as final topology | **SUPERSEDED/HISTORICAL** | Useful for inventory only; not copied wholesale. |
| Same-repository One Time shell sharing the broad backend | **SUPERSEDED/HISTORICAL** | Not authority for BNA School. |
| Cross-portal credential resolver and destination chooser as a target auth pattern | **SUPERSEDED/HISTORICAL** | Must not be copied. |
| PR #141/#142 as school foundation lanes | **UNPROVEN claim rejected; CONFIRMED control-plane scope** | They remain separate control-plane draft lanes and are not BNA School dependencies. |
| Existing secret-scan passes close privacy acceptance | **SUPERSEDED/HISTORICAL** | A06 already invalidated that interpretation. |

---

## 4. Classified finding ledger

### A08-NF-01 — Legacy attendance must be rewritten as a school-native aggregate

**Classification:** **NEW FINDING**  
**Priority:** P1 architecture/acceptance  
**Execution effect:** Changes Packet A08-P04 from “port attendance” to “define and implement attendance.”

Evidence at the checkpoint shows:

- `bna_class_attendance` with class, student, date, status, and notes;
- class attendance GET/POST APIs;
- attendance shown in Operations and parent/student views;
- separate live-class attendance/check-in behavior associated with member and provider workflows.

What is not established is a coherent school-day contract covering:

- school-local date and timezone;
- open/draft/submitted/corrected day state;
- class-period versus all-day attendance;
- roster snapshot behavior;
- permitted status vocabulary;
- late minutes and reason codes;
- correction authority and audit;
- concurrent edits;
- historical roster changes;
- non-provider operation.

**Disposition:** Rewrite. Use legacy rows only as an import source after a protected ownership/readback pass.

---

### A08-NF-02 — Staff is a type/role projection, not a complete school domain

**Classification:** **NEW FINDING**  
**Priority:** P1 first-slice dependency

The platform migration and broad people/workspace models recognize staff and teacher types. The route census did not expose a complete staff lifecycle equivalent to the student/family domain.

Missing or unproven:

- canonical staff record ownership;
- employment/active status;
- start/end dates;
- attendance assignment;
- class assignment;
- staff role versus application authorization;
- archival/reactivation behavior;
- conflict rules for one person with multiple roles.

**Disposition:** Implement only the minimal first-slice staff directory and attendance assignment model. Defer HR/payroll/personnel records.

---

### A08-NF-03 — Admissions is intake, not a proven enrollment lifecycle

**Classification:** **NEW FINDING**  
**Priority:** P2 sequence correction

The current repository exposes:

- public submissions;
- signups;
- BNA signups;
- confirmation;
- parent leads;
- signup document handling.

That supports lead/intake behavior. It does not prove:

- formal application state;
- review/decision state;
- accepted/waitlisted/declined semantics;
- enrollment agreement;
- term placement;
- roster activation;
- withdrawal;
- document completeness;
- legal consent retention.

**Disposition:** Do not migrate signups directly into active students. Preserve source/audit history and build admissions after canonical directory identities exist.

---

### A08-NF-04 — Tuition/payment administration lacks a proven school source of truth

**Classification:** **NEW FINDING**  
**Priority:** P1 decision gate; P2 implementation order

The route census includes payment intake, payment records, paid reconciliation, reminders, checkout/pending/completion behavior, and a billing-provider webhook. Those surfaces are mixed with provider integrations and Operations.

Unproven:

- authoritative tuition schedule;
- payer/household ownership;
- monthly obligation model;
- adjustments, credits, scholarships, refunds, write-offs, and arrears;
- provider settlement versus internal ledger relationship;
- accounting/legal retention;
- historical reconciliation completeness.

**Disposition:** Exclude finance from the first slice. Import no payment rows until the operator identifies the authoritative ledger and a compliance-aware schema is approved.

---

### A08-NF-05 — Identity-specific fixtures and aliases must be treated as protected migration inputs

**Classification:** **NEW FINDING**  
**Priority:** P1 privacy/migration

The checkpoint contains:

- hard-coded personal-family seed records in runtime/test contracts;
- an identity-specific student alias group in deduplication logic.

**Disposition:**

- do not copy those values or records;
- do not convert them into fixtures;
- do not publish them in migration reports;
- replace test coverage with generated synthetic identities;
- if an alias is needed for production reconciliation, store it only in a protected, operator-reviewed import mapping outside public source/evidence.

---

### A08-NF-06 — The legacy class model mixes school, provider, community, media, and live-delivery concerns

**Classification:** **NEW FINDING**  
**Priority:** P1 schema boundary

The broad class schema and routes include school-like records alongside workspace/community/provider ownership and meeting/recording/media behavior. One Time class sessions and assets also use the `bna_class_sessions` lineage.

**Disposition:** Do not copy the legacy class schema. The new school owns:

- academic term;
- school class/section;
- staff assignment;
- roster;
- schedule;
- attendance.

Video meetings, recordings, provider classes, and One Time assets remain outside the school core and behind later adapters if explicitly required.

---

### A08-NF-07 — Mature portals are contract evidence, not extraction-ready UI

**Classification:** **NEW FINDING**  
**Priority:** P1 scope control

The parent and student portals already cover substantial behavior: authentication, linked children, goals, attendance, questions, financial summaries, messages/help, and child login management. They also depend on mixed provider, WhatsApp, live-class, finance, and shared-auth behavior.

**Disposition:** Preserve functional expectations and role-isolation tests. Do not copy the pages or server handlers into the first slice. Rebuild parent/student portals after stable school APIs and roles exist.

---

### A08-NF-08 — Current BNA control pointers cannot authorize school implementation

**Classification:** **NEW FINDING** for A08 execution order; **CONFIRMED drift** in the pinned tree  
**Priority:** P1 governance

`BNA-START-HERE.md` names an older June handoff while `ops/execution-runs/latest.json` points to a July run dominated by One Time/shared-runtime work. The committed control-tower snapshot also records a historically dirty worktree, but that snapshot is not current local-state proof.

**Disposition:** Before any BNA School writer:

- obtain a fresh sanitized local worktree/collision readback;
- create a dedicated Board row;
- do not infer assignment from A08, a prompt pack, a PR description, or the legacy broad goal-mode trigger.

---

### A08-CT-01 — The current runtime is a mixed monolith

**Classification:** **CONFIRMED CURRENT TRUTH**  
**Priority:** P1 architecture

`server.js`, `package.json`, the Operations shell, route/action registries, and database bootstrap cover school, control plane, provider/personal-family, and One Time concerns.

**Disposition:** New clean repository. No fork-and-delete or “hollow out the monolith” foundation strategy.

---

### A08-CT-02 — Real school functionality exists and should be preserved as behavior

**Classification:** **CONFIRMED CURRENT TRUTH**

The repository has executable behavior for:

- student records and scoped detail;
- families/households/guardians;
- public intake;
- classes and attendance;
- goals/check-ins/accountability;
- communications;
- payments;
- content/curriculum;
- parent/student portals;
- public school pages.

**Disposition:** Extract contracts and migrate data deliberately; do not dismiss the legacy system as mere prototype material.

---

### A08-CT-03 — Current authentication crosses product and portal boundaries

**Classification:** **CONFIRMED CURRENT TRUTH**  
**Priority:** P1 security boundary

The current resolver can inspect Operations, provider, parent, and student credential systems, return a destination chooser, and clear multiple portal cookie classes through generic logout.

**Disposition:** Rewrite. No shared destination chooser, shared session store, shared cookie, or generic logout in BNA School.

---

### A08-CT-04 — Open PR #141 and PR #142 are BNA control-plane work

**Classification:** **CONFIRMED CURRENT TRUTH**

- PR #141 is an Agent Action/Rabbi Telegram durability and preview lane.
- PR #142 is an isolated read-only BNA control-plane Operations bot stacked on PR #141.

Neither is a school directory/attendance branch.

**Disposition:** BNA School packets must not use their branches, database migrations, writer slots, or deployment as dependencies.

---

### A08-H-01 — Shared platform-core migration is historical source material

**Classification:** **SUPERSEDED/HISTORICAL**

The additive platform-core migration provides useful entity vocabulary for people, students, guardians, providers, communities, courses, goals, and rewards. It intentionally extends a shared platform schema.

**Disposition:** Use as an inventory reference. Do not make it migration `0001` in BNA School and do not preserve its shared runtime ownership.

---

### A08-U-01 — Production school data condition

**Classification:** **UNPROVEN**

Required protected readback:

- table/column inventory;
- row counts by school-owned domain;
- duplicate and orphan counts;
- nullability anomalies;
- legacy ID types;
- active/archived distributions;
- date/timezone distributions;
- retention requirements;
- school-versus-One-Time/provider contamination counts.

---

### A08-U-02 — Current live source and route mounting

**Classification:** **UNPROVEN**

The pinned source contains many route families. A08 did not prove which exact source currently serves each production route or worker.

---

### A08-U-03 — Current local repository state

**Classification:** **UNPROVEN**

The committed dirty-worktree snapshot is historical. A fresh local readback is required before any future writer starts.

---

### A08-U-04 — Staff governance

**Classification:** **UNPROVEN**

The operator must decide:

- `school_owner` versus `school_admin` governance;
- who can create/archive staff;
- who can assign staff to classes;
- who can submit or correct attendance;
- whether attendance-only staff can view household/student detail.

---

### A08-U-05 — Attendance policy

**Classification:** **UNPROVEN**

The operator must decide:

- authoritative timezone;
- class-period versus school-day records;
- status vocabulary;
- late-minute capture;
- excused reason policy;
- same-day correction and historical correction rules;
- who submits/locks a day;
- treatment of absent roster members and mid-day roster changes.

---

### A08-U-06 — Tuition authority and retention

**Classification:** **UNPROVEN**

No finance packet is runnable until the source of truth, retention, and reconciliation rules are decided.

---

## 5. Complete surface inventory

The inventory below is complete at the **product-surface level** requested by A08. The checkpoint route registries remain the canonical exhaustive path census. Where a legacy handler family is duplicated or mixes concerns, the disposition states whether to copy a contract, transform data, rewrite, defer, or exclude.

### 5.1 Students

**Current routes**

- `GET /api/bna/students`
- `POST /api/bna/students`
- `PATCH /api/bna/students/:id`
- `DELETE /api/bna/students/:id`
- student access-code/account routes under `/api/bna/students/:id/...`
- identity and merge routes under `/api/bna/students/:id/...`
- household-link and device routes under `/api/bna/students/:id/...`
- goal-board and nested communication routes under `/api/bna/students/:id/...`
- `POST /api/student-portal/login`
- `POST /api/student-portal/logout`
- `GET /api/student-portal/session`
- `GET /api/student-portal`
- student-portal goal/checkoff, question, worksheet, and message routes

**Source/UI**

- `server.js`
- `public/operations.html`
- `public/student.html`
- `src/lib/bna/identity-linking.js`
- `src/lib/bna/student-identity-dedupe.js`
- `src/lib/bna/parent-progress.js`

**Data**

- `bna_people`
- `bna_students`
- `bna_student_profiles`
- student password/session/auth-attempt tables
- goal-board/accountability linkages
- project/workspace ownership columns

**Tests/evidence**

- `tests/operations-student-detail-scope.test.js`
- `tests/parent-student-portal-contract.test.js`
- identity-linking/deduplication tests
- accepted June student/goal and workspace-scope suites

**Classification**

- **BNA School core:** student identity, status, archive, household/guardian links.
- **Shared primitive copy-only:** normalization, optimistic conflict conventions, identity matching rules after de-identification.
- **Unsafe/unknown:** identity-specific alias fixtures, legacy access codes, workspace/project coupling.
- **Legacy archive:** Operations-specific renderers and broad project scoping.

**Extraction disposition:** Rebuild APIs/UI; transform school-owned rows through protected import mapping.

---

### 5.2 Parents, guardians, families, and households

**Current routes**

- `POST /api/bna/parent-access/link`
- `POST /api/bna/parent-access/password-reset`
- parent account/access-code routes
- `GET/POST /api/bna/parent-student-links`
- parent portal login, password request/reset, session, logout
- parent portal overview/children/household routes
- parent portal goal/check-in, attendance, question response, help, and child-login-account routes
- parallel `/api/parent/...` route family
- `/api/households/current`
- `/api/household/filter-setup`
- `/api/household/filter-setup/submit-code`

**Source/UI**

- `server.js`
- `public/parent.html`
- `src/lib/bna/parent-progress.js`
- `src/lib/bna/identity-linking.js`

**Data**

- `bna_people`
- `bna_households`
- `bna_household_members`
- parent/student relationship tables
- parent password, reset-token, magic-link, and session tables

**Tests/evidence**

- `tests/parent-student-portal-contract.test.js`
- `tests/workspace-person-household-provider-contract.test.js`
- parent-progress tests

**Providers/jobs**

- email login/setup links;
- confirmed WhatsApp login/setup links;
- provider delivery logs;
- help/support notification paths.

**Classification**

- **BNA School core:** people, households, guardians, relationships.
- **BNA School later:** parent portal, parent messaging, child login management.
- **Shared primitive copy-only:** linked-child authorization and visibility filtering.
- **Unsafe/unknown:** shared portal resolver, provider sends, personal-family seed data, filter-setup product.
- **Legacy archive:** current monolithic parent page and duplicate auth families.

**Extraction disposition:** Directory relationships in first slice; parent authentication/portal later.

---

### 5.3 Enrollment and admissions

**Current routes**

- `POST /api/submit`
- `GET /api/signups`
- `GET /api/bna/signups`
- signup detail/update/confirmation routes
- `GET/POST/PATCH /api/bna/parent-leads`
- public signup and localized signup pages
- signup document upload/metadata behavior

**Source/UI**

- `server.js`
- `public/signup.html`
- `public/signup-he.html`
- `public/js/signup-documents.js`
- public school and parent pages

**Data**

- signup/lead/contact records;
- document references;
- communication/audit links.

**Tests/evidence**

- portal/public/privacy tests;
- signup form contract coverage.

**Classification**

- **BNA School core domain:** admissions belongs to the school.
- **Current implementation:** lead/intake and communications, not a proven enrollment lifecycle.
- **Unsafe/unknown:** consent/retention, duplicate-to-student conversion, document completeness, status semantics.
- **One Time contamination risk:** shared signup/contact/communication patterns must not import One Time lead behavior.

**Extraction disposition:** Defer until directory exists. Import into admissions staging, never directly into active students.

---

### 5.4 Attendance

**Current routes**

- class attendance GET/POST routes under `/api/bna/classes/:id/attendance`
- live-session check-in routes
- member-portal live-session check-in routes
- parent/student attendance views through portal APIs
- Operations student summary queries include attendance counts/latest status

**Source/UI**

- `server.js`
- `public/operations.html`
- `public/parent.html`
- `public/student.html`

**Data**

- `bna_class_attendance`
- `bna_live_class_attendance`
- class/session/member relationships
- attendance projections in student detail.

**Tests/evidence**

- `tests/operations-student-detail-scope.test.js`
- `tests/parent-student-portal-contract.test.js`
- `tests/live-class-infrastructure.test.js`

**Classification**

- **BNA School core:** school attendance.
- **One Time contamination:** live/member/Zoom check-in and class-delivery behavior.
- **Unsafe/unknown:** authoritative school-day semantics and historical data ownership.

**Extraction disposition:** Rewrite. Legacy class attendance is a migration source only after ownership validation.

---

### 5.5 Classes, rosters, schedules, and sessions

**Current routes**

- `GET /api/bna/classes`
- `POST /api/bna/classes`
- `PATCH /api/bna/classes/:id`
- classes import route
- class attendance routes
- class-session routes
- calendar event GET/POST/PATCH routes
- live-session CRUD, tonight, check-in, communications, and link-delivery routes
- One Time class/session/assets routes under `/api/bna/one-time/...`

**Source/UI**

- `server.js`
- Operations classes/calendar/live-class renderers
- member portal
- One Time classroom/provider modules

**Data**

- `bna_classes`
- `bna_class_members`
- `bna_class_sessions`
- `bna_calendar_events`
- `bna_live_class_series`
- `bna_live_class_sessions`
- `bna_live_class_attendance`
- One Time class asset/library tables

**Tests/evidence**

- `tests/live-class-infrastructure.test.js`
- route-role/action coverage
- historical class and provider smokes

**Classification**

- **BNA School core:** school class, roster, staff assignment, schedule.
- **One Time contamination:** One Time class sessions/assets/library.
- **Shared primitive copy-only:** recurrence/timezone validation and roster idempotency, after isolation.
- **Unsafe/unknown:** provider/community ownership and meeting/recording fields.
- **Legacy archive:** member/live delivery UI.

**Extraction disposition:** New school-native schema; selective transform only.

---

### 5.6 Staff

**Current routes**

- no complete first-class `/api/bna/staff` lifecycle was identified;
- broad people/workspace-user/membership routes can represent staff-like identities;
- class and workspace role logic can associate operators/teachers with records.

**Source/data**

- `bna_people`
- workspace memberships
- role maps
- platform-core person types including staff/teacher.

**Tests/evidence**

- workspace/person/household/provider contract;
- workspace role/scope tests.

**Classification**

- **BNA School core:** minimal staff directory and class/attendance assignment.
- **Unsafe/unknown:** current ownership, active status, authority, role-to-permission mapping.
- **BNA control-plane internal:** platform operators and technical agents are not school staff.

**Extraction disposition:** New minimal domain in first slice; no HR/payroll scope.

---

### 5.7 Tuition and payment administration

**Current routes**

- payment intake GET/POST/PATCH/DELETE routes
- paid reconciliation route
- payment reminder due/run routes
- payment list/create routes
- pending/completed checkout routes
- billing-provider webhook
- parent financial summary through portal payloads

**Source/UI**

- `server.js`
- Operations accounting/payment renderers
- parent portal financial summary

**Data**

- payment intake;
- payments;
- reminder/audit records;
- provider webhook/event records;
- contact/household relationships.

**Providers/jobs**

- billing/invoice provider;
- reminder jobs;
- webhook processing;
- reconciliation.

**Classification**

- **BNA School domain:** eventual tuition ledger and household balances.
- **Unsafe/unknown:** source of truth, provider ownership, reconciliation completeness, compliance/retention.
- **BNA control-plane internal:** aggregate payment-provider health only.
- **One Time contamination risk:** shared payment/access behavior.

**Extraction disposition:** Defer. No first-slice finance migration or provider action.

---

### 5.8 Communications

**Current routes**

- `/api/bna/communications`
- email draft/preview/send route family
- social draft/preview/schedule route family
- contact/student/task/signup nested communication routes
- communication screening/link/match routes
- WhatsApp/WAPI sync, intake, and send route families
- announcements and weekly-update route families
- email log/send/signup-link routes
- parent/student message/help routes

**Source/modules**

- `server.js`
- CRM contact model/service
- inbound communication pipeline
- communication-agent runtime
- Resend/WAPI/Whapi integration modules
- Operations/parent/student/provider UI

**Data**

- communication log;
- email drafts/logs;
- provider webhook events;
- outbox/attempt records;
- contacts/conversations/tasks.

**Tests/evidence**

- communication pipeline tests;
- CRM/contact isolation tests;
- provider readiness and no-send tests;
- portal communication tests.

**Classification**

- **BNA School core later:** school communications and consent/suppression.
- **Shared primitive copy-only:** outbox intent, idempotency, redaction, provider adapter boundaries.
- **One Time contamination:** One Time channel bindings, agents, provider communications.
- **BNA control-plane internal:** delivery-health summaries and incident projections only.
- **Unsafe/unknown:** current school consent authority and historical message ownership.

**Extraction disposition:** Rebuild after directory; no send in foundational packets.

---

### 5.9 Student goals, check-ins, accountability, and devices

**Current routes**

- accountability CRUD and source-enrichment routes
- Torah-learning summary/entry/reconcile routes
- group-goal and group-goal-entry routes
- student goal-board routes
- student portal daily checkoff routes
- parent goal/check-in routes
- assignment/device/device-access-rule routes

**Source modules**

- `src/lib/bna/torah-learning.js`
- `src/lib/bna/goal-board.js`
- `src/lib/bna/parent-progress.js`
- `src/lib/bna/identity-linking.js`
- device-control modules

**Data**

- accountability events;
- goals/check-ins;
- goal-board rows;
- Torah-learning entries;
- assignments/devices/access rules.

**Tests/evidence**

- accepted student/goal suites;
- parent/student portal contract;
- Operations student scope test;
- goal-board and Torah domain tests.

**Classification**

- **BNA School core later:** goals, check-ins, accountability.
- **Shared primitive copy-only:** pure policy calculations, source/status enums, linked-student visibility.
- **Unsafe/unknown:** provider notifications, external source enrichment, identity fixtures, device enforcement scope.

**Extraction disposition:** Copy pure domain concepts only after first slice; rebuild persistence/API/UI.

---

### 5.10 Rewards and gamification

**Current routes**

- gamification event/readiness/manual award/reverse routes
- shoutout/reward routes
- goal-board reward metadata

**Source modules**

- gamification service/modules
- goal-board policy
- Operations UI

**Data**

- reward definitions;
- grants/events;
- shoutouts;
- goal linkage.

**Classification**

- **BNA School core later:** student rewards.
- **One Time contamination risk:** product-specific badge/reward records in shared tables.
- **Shared primitive copy-only:** append-only grant/reversal and audit semantics.
- **Unsafe/unknown:** school reward catalog and visibility policy.

**Extraction disposition:** Later slice after stable student identities and goals.

---

### 5.11 Content and curriculum

**Current routes**

- courses, lessons, questions, responses
- assignments and student-assignment actions
- curriculum/content prompts, jobs, bundles, outputs
- recording intake and video-library routes
- worksheets
- Torah-learning resources
- One Time class assets/library/content routes

**Source/UI**

- `server.js`
- Operations content/course renderers
- provider/member/classroom UI
- content worker scripts
- Drive/transcript/video tooling

**Data**

- courses/modules/lessons;
- assignments;
- content jobs/outputs;
- worksheets;
- video/media;
- class assets/library.

**Providers/jobs**

- Drive ingestion;
- transcription/model providers;
- video hosting;
- content workers;
- class packaging.

**Classification**

- **BNA School core later:** school curriculum/resources/worksheets.
- **One Time contamination:** One Time class/library/media pipeline.
- **BNA control-plane internal:** worker/job health only.
- **Unsafe/unknown:** content ownership, private media, transcript history, provider destination state.

**Extraction disposition:** Later inventory and slice; no media/content migration in foundation.

---

### 5.12 Documents and uploads

**Current routes**

- file-intake routes;
- assistant thread file routes;
- signup document handling;
- recording/media intake;
- public handbook and registration-document routes.

**Source/UI**

- `server.js`
- signup document client
- public documents pages
- Operations intake/content UI

**Providers/jobs**

- Drive/file storage;
- parser/transcription pipeline;
- evidence generation.

**Classification**

- **BNA School core later:** admissions/student documents and school-owned uploads.
- **BNA control-plane internal:** sanitized processing status only.
- **Unsafe/unknown:** current private-file ownership, provider links, binary privacy, retention.
- **Legacy archive:** historical evidence corpus.

**Extraction disposition:** Defer until storage, retention, malware scanning, and privacy contracts are approved.

---

### 5.13 School operations

**Current school-operational behavior**

- student directory/detail;
- class/calendar/attendance;
- assignments/devices;
- goals/accountability;
- payments;
- communications;
- intake;
- parent/student access.

**Current internal-platform behavior**

- task/project/workspace control;
- agent fleet and Codex queue;
- Studio/prompt publication;
- support/incident handling;
- deployments/readiness;
- integration/credential management;
- Telegram control operations;
- watchdogs and execution-run control.

**Classification**

- **BNA School core:** ordinary school administration.
- **BNA control-plane internal:** agent, deployment, integration, incident, support index, and aggregate health.
- **Legacy archive:** execution records/evidence.
- **Unsafe/unknown:** any direct control-plane query over detailed school tables.

**Extraction disposition:** Product owns daily school operations. Control plane receives minimized projections only.

---

### 5.14 Public school website

**Current routes/UI**

- `/`
- `/he`
- `/school`
- `/he/school`
- `/parents`
- `/he/parents`
- signup routes
- handbook/registration document routes
- blog/FAQ/public information routes

**Classification**

- **BNA School core:** school marketing and public information.
- **Unsafe/unknown:** current deployment/domain ownership, analytics, form routing, privacy metadata.
- **One Time contamination risk:** global bundles, shared signup/contact behavior, cross-product metadata.

**Extraction disposition:** Move under school ownership after foundation. It may be a school-owned marketing deployment, but never the BNA Control Plane.

---

### 5.15 Authentication and authorization

**Current routes**

- `/api/bna/auth/login`
- `/api/bna/auth/logout`
- `/api/bna/auth/me`
- login-link/password setup routes
- `/api/parent/auth/...`
- `/api/parent-portal/...`
- `/api/student-portal/...`
- provider portal auth
- Operations auth

**Current behavior**

- one resolver can inspect several credential systems;
- server returns a destination chooser;
- generic logout clears multiple portal cookie classes;
- workspace/project scope checks mediate many data routes;
- parent and student have separate legacy password/session tables.

**Classification**

- **Unsafe/unknown for target:** current runtime/session coupling.
- **Shared primitive copy-only:** password hashing standards, safe return-path validation, CSRF/rate-limit/session-family concepts.
- **Legacy archive:** destination chooser and cross-portal logout.
- **BNA School core:** independent school-local auth/RBAC.

**Extraction disposition:** Rewrite completely. Parent/student auth is not in the first slice.

---

### 5.16 Provider marketplace, personal-family workspace, One Time, and control-plane surfaces

These are included because they are material contamination boundaries.

**Provider marketplace/personal-family**

- provider directory/join/profile/upgrade/integration routes;
- household/filter product;
- hard-coded personal-family seed records.

**One Time**

- public funnel/review;
- provider shell;
- CRM/communications;
- classes/library/assets;
- member/classroom;
- agents;
- provider/integration jobs.

**Control plane**

- agents/actions;
- task/Codex queue;
- Studio;
- support;
- integration readiness;
- deployment/watchdog;
- Telegram control bot.

**Classification**

- **One Time contamination:** all One Time product behavior.
- **BNA control-plane internal:** internal operations only.
- **Unsafe/unknown:** generic provider marketplace and personal-family product owner.
- **Legacy archive:** historical shared-runtime implementation/evidence.

**Extraction disposition:** Exclude from BNA School. No imports, runtime packages, shared database access, or frontend assets.

---

## 6. Cross-cutting keep/copy/rewrite/defer/exclude map

| Legacy surface | Target disposition | Reason |
|---|---|---|
| Student/family relationship semantics | **Transform/rebuild** | Core school ownership; legacy IDs and workspace coupling require mapping. |
| Pure normalization and policy calculations | **Copy as source, then independently implement** | Reusable behavior without shared runtime. |
| Operations shell and renderers | **Exclude/archive** | Mixed control-plane/product UI and large shared bundle. |
| Cross-portal auth chooser | **Retire** | Violates independent product sessions. |
| Parent/student portal pages | **Rebuild later** | Mature behavior but mixed providers, finance, communications, and auth. |
| `bna_class_attendance` | **Transform only after policy definition** | Legacy class attendance is not the target school-day aggregate. |
| Live/member/Zoom attendance | **Exclude by default** | One Time/provider delivery concern. |
| Platform-core migration | **Inventory reference only** | Shared platform substrate is superseded as final architecture. |
| CRM/contact/outbox contracts | **Copy protocol concepts only** | Product-local implementation required. |
| Payment/provider integrations | **Defer** | Source of truth and compliance unproven. |
| Content/media/Drive pipeline | **Defer** | Ownership, privacy, provider, and retention risks. |
| Agent/Studio/task/deployment systems | **Control plane** | Internal operations, not school product runtime. |
| One Time modules/tables/routes | **Reject/exclude** | Separate product; launch remains first. |
| Hard-coded real/personal/identity fixtures | **Reject from source and tests** | Privacy and migration contamination risk. |
| Route/action registry patterns | **Copy contract format only** | Useful governance pattern, but separate registries per application. |
| Audit/idempotency/error envelopes | **Copy protocol semantics only** | Independent implementation and storage. |

---

## 7. Schema and domain extraction map

### 7.1 Proposed standalone PostgreSQL ownership

The new BNA School database should initially contain only these schemas:

```text
auth
school
audit
bridge
migration
```

No One Time, provider marketplace, agent-control, deployment, Studio, or control-plane tables belong in the database.

### 7.2 Foundation schema

#### `auth`

```text
auth.users
auth.credentials
auth.sessions
auth.role_assignments
auth.login_attempts
auth.session_events
```

#### `school`

```text
school.schools
school.people
school.students
school.households
school.household_members
school.guardian_relationships
school.staff
school.academic_terms
school.classes
school.class_staff_assignments
school.class_rosters
school.schedule_events
school.attendance_days
school.attendance_records
school.student_status_history
```

#### `audit`

```text
audit.events
```

#### `bridge`

```text
bridge.outbox_events
bridge.delivery_attempts
bridge.dead_letters
```

#### `migration`

```text
migration.import_batches
migration.legacy_id_map
migration.reconciliation_results
migration.rejected_rows
```

`migration.rejected_rows` must store protected diagnostic references or safe reason codes, not raw private payloads in ordinary evidence.

### 7.3 Proposed first-slice attendance model

```text
school.attendance_days
- id
- school_id
- local_date
- timezone
- state: open | submitted | corrected | void
- opened_by
- submitted_by
- submitted_at
- corrected_by
- corrected_at
- version
- created_at
- updated_at

school.attendance_records
- id
- attendance_day_id
- class_id
- student_id
- status
- minutes_late
- reason_code
- note
- recorded_by
- recorded_at
- version
- created_at
- updated_at

unique(attendance_day_id, class_id, student_id)
```

The final status vocabulary is an operator decision. A reasonable candidate for review is:

```text
present
absent
late
excused
remote
unknown
```

This is a proposed contract, not an approved policy.

### 7.4 Legacy-to-school extraction map

| Legacy source | Target | Method | Exclusions/conditions |
|---|---|---|---|
| `bna_people` | `school.people` | Transform | School-owned people only; no provider/control-plane/personal seed rows. |
| `bna_students` | `school.students` | Transform | Require protected dedupe and active/archive mapping. |
| `bna_student_profiles` | `school.students` or later profile table | Selective transform | Only first-slice fields; no broad private notes. |
| `bna_households` | `school.households` | Transform | School families only. |
| `bna_household_members` | `school.household_members` | Transform | Validate relationship and duplicate person ownership. |
| parent/student links and guardian relationships | `school.guardian_relationships` | Transform/reconcile | Never merge children across households automatically. |
| workspace memberships/person types | `school.staff`, `auth.role_assignments` | Operator-reviewed transform | Platform/operator/provider roles excluded. |
| `bna_classes` | `school.classes` | Selective transform | Strip provider/community/meeting/recording fields. |
| `bna_class_members` | `school.class_rosters` | Transform | Validate term, class, student, active dates. |
| `bna_calendar_events` and school class sessions | `school.schedule_events` | Selective transform | Provider/live/media events excluded. |
| `bna_class_attendance` | `school.attendance_days` + `school.attendance_records` | Reconstruct | Requires approved date/status semantics and roster reconciliation. |
| `bna_live_class_attendance` | none by default | Reject/defer | Include only if a protected readback proves school ownership and an approved mapping exists. |
| signups/parent leads | future admissions staging | Defer | Never create active students directly. |
| payments/intake/reminders | future finance staging | Defer | Source of truth and retention decision required. |
| communication/contact logs | future communications staging | Defer | Consent/suppression and product ownership required. |
| goals/check-ins/Torah/accountability | future goals schema | Later transform | Preserve pure policy semantics; no first-slice import. |
| rewards/gamification | future rewards schema | Later transform | Exclude product-specific badges. |
| courses/content/worksheets/video | future content schema | Later inventory | Exclude One Time/provider/private media by default. |
| files/uploads | future documents schema | Later inventory | Storage, retention, scanning, and privacy gates required. |
| task/agent/Studio/deployment/support tables | none in school | Exclude | BNA Control Plane or archive. |
| One Time tables/routes/records | none in school | Reject | Separate product. |
| hard-coded identity fixtures/aliases | protected import mapping only | Reject from source | Never commit or emit. |

### 7.5 Identity rules

The new school must:

- create new stable school-local IDs;
- preserve legacy IDs only in `migration.legacy_id_map`;
- prevent automatic cross-household child merges;
- require explicit review for ambiguous identities;
- keep aliases outside public/test source when they correspond to real people;
- use synthetic generated identities in tests;
- produce count/checksum reconciliation, not row content, in ordinary evidence.

---

## 8. Route and API extraction map

### 8.1 First-slice target API

#### Authentication

```text
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/auth/session
POST /api/v1/auth/csrf/refresh
```

#### Students

```text
GET   /api/v1/students
POST  /api/v1/students
GET   /api/v1/students/:studentId
PATCH /api/v1/students/:studentId
POST  /api/v1/students/:studentId/archive
POST  /api/v1/students/:studentId/reactivate
```

#### Households and guardians

```text
GET    /api/v1/households
POST   /api/v1/households
GET    /api/v1/households/:householdId
PATCH  /api/v1/households/:householdId
PUT    /api/v1/households/:householdId/members/:personId
DELETE /api/v1/households/:householdId/members/:personId
PUT    /api/v1/students/:studentId/guardians/:personId
DELETE /api/v1/students/:studentId/guardians/:personId
```

#### Staff

```text
GET   /api/v1/staff
POST  /api/v1/staff
GET   /api/v1/staff/:staffId
PATCH /api/v1/staff/:staffId
POST  /api/v1/staff/:staffId/archive
```

#### Classes and rosters

```text
GET    /api/v1/classes
POST   /api/v1/classes
GET    /api/v1/classes/:classId
PATCH  /api/v1/classes/:classId
PUT    /api/v1/classes/:classId/roster/:studentId
DELETE /api/v1/classes/:classId/roster/:studentId
PUT    /api/v1/classes/:classId/staff/:staffId
DELETE /api/v1/classes/:classId/staff/:staffId
```

#### Daily attendance

```text
GET  /api/v1/attendance/days/:localDate
POST /api/v1/attendance/days/:localDate/open
PUT  /api/v1/attendance/days/:localDate/classes/:classId/students/:studentId
POST /api/v1/attendance/days/:localDate/classes/:classId/submit
POST /api/v1/attendance/days/:localDate/correct
GET  /api/v1/attendance/students/:studentId?from=<date>&to=<date>
GET  /api/v1/attendance/summary?date=<date>
```

### 8.2 Legacy route disposition

| Legacy route family | Target treatment |
|---|---|
| `/api/bna/students*` | Rewrite under `/api/v1/students`; no project/workspace query parameters in ordinary single-school use. |
| `/api/bna/people*` | Split into people/household/staff resources; do not expose generic platform person mutation. |
| `/api/bna/parent-access*` | Defer; rebuild parent auth later. |
| `/api/parent-portal*` and `/api/parent/*` | Defer; preserve behavior tests only. |
| `/api/student-portal*` | Defer; preserve behavior tests only. |
| `/api/bna/classes*` | Rewrite; strip provider/live/media semantics. |
| live/member routes | Exclude from first school slice. |
| `/api/bna/accountability*`, goals, Torah, devices | Later school slice. |
| signups/parent leads | Later admissions slice. |
| payment/intake/reminder/webhook routes | Later finance slice after source-of-truth decision. |
| communications/email/WhatsApp/social routes | Later school communications; adapters and local outbox only. |
| content/course/video/Drive routes | Later content/documents inventory. |
| Operations/task/agent/Studio/deployment routes | Control plane or archive; never mounted by BNA School. |
| One Time route families | Reject; zero imports/mounts. |
| provider marketplace/personal-family route families | Exclude/defer pending product-owner decision. |
| generic `/api/bna/auth/*` chooser | Retire; replace with school-only auth. |

### 8.3 Compatibility policy

The new application should not begin with broad legacy aliases. During migration:

- legacy BNA remains authoritative for domains not yet cut over;
- BNA School is authoritative only for accepted cutover domains;
- browser links may redirect to the new application after acceptance;
- no request-time proxying, shared session, or dual database join is permitted;
- any temporary export/import runs offline or through separately approved product-local jobs;
- no indefinite dual-write scheme is allowed.

---

## 9. Standalone BNA School foundation

### 9.1 Required topology

```text
Repository: bna-school
Database: BNA School PostgreSQL only
Deployment: BNA School service only
Secrets: BNA School namespace only
Cookie/session: BNA School only
Browser assets: BNA School only
Ordinary page dependency on BNA Control Plane: zero
Ordinary page dependency on One Time: zero
Legacy BNA runtime dependency: zero after cutover
```

### 9.2 Suggested repository boundaries

```text
apps/web/
packages/domain/
packages/db/
packages/contracts/
packages/testing/
ops/migrations/
ops/reconciliation/
docs/architecture/
```

This is a suggested layout, not an instruction to adopt a monorepo package runtime shared with another product.

### 9.3 Shared-code rule

Permitted initially:

- JSON Schema;
- OpenAPI fragments;
- event-envelope specifications;
- example synthetic fixtures;
- compatibility tests;
- written idempotency/error/cursor conventions.

Not permitted initially:

- shared frontend components;
- shared CSS/theme runtime;
- shared router;
- shared browser store;
- shared auth/session middleware;
- shared database models;
- shared migration runner package;
- shared provider client;
- shared application runtime;
- runtime imports from One Time or legacy BNA.

### 9.4 Signed asynchronous bridge

BNA School writes bridge events through a **product-local transactional outbox**. The school transaction commits without waiting for the control plane.

Proposed envelope:

```json
{
  "event_id": "opaque-id",
  "event_type": "school.attendance_day_submitted",
  "schema_version": 1,
  "occurred_at": "ISO-8601",
  "source_application": "bna-school",
  "source_environment": "production",
  "aggregate_type": "attendance_day",
  "aggregate_id": "opaque-id-or-null",
  "payload": {},
  "payload_hash": "sha256",
  "key_id": "rotation-safe-key-id",
  "signature": "ed25519-signature"
}
```

Initial event types should be minimized operational summaries:

```text
school.release.deployed
school.directory.import_reconciled
school.attendance.day_submitted
school.outbox.health_changed
```

Ordinary payloads must not contain:

- names;
- email addresses;
- phone numbers;
- Student notes;
- household details;
- attendance notes or reason text;
- payment details;
- raw communications;
- provider IDs;
- credentials;
- private destinations;
- replayable links.

The receiver must verify:

- signature;
- key ID;
- schema version;
- timestamp window;
- payload hash;
- event ID deduplication;
- replay handling;
- bounded retry/dead-letter policy.

The school must pass an outage test with the control plane completely unavailable.

---

## 10. Forward-only migration strategy

### Phase 0 — Authority, preservation, and protected readback

**Status:** Not complete.

Required before a writer:

- One Time priority gate accepted;
- A06 security/local-state prerequisites accepted;
- fresh clean/non-overlapping worktree readback;
- protected production schema/data inventory;
- operator decisions for staff and attendance;
- Board assignment.

No data or code mutation occurs in this phase.

### Phase 1 — Empty standalone foundation

Create the new repository and empty database lineage only after assignment.

- forward migration runner;
- blank-database migration proof;
- configuration validation;
- application health/readiness;
- auth/session skeleton;
- audit and outbox tables;
- import-boundary tests;
- no real data;
- no deployment unless separately authorized.

### Phase 2 — Protected source inventory and deterministic transform

- snapshot schema metadata and safe counts;
- classify every source table by owner;
- define new IDs;
- create legacy-ID map;
- define row-level rejection reasons;
- implement deterministic import into nonproduction;
- exclude One Time/control-plane/provider/personal seed rows;
- do not log raw private values.

### Phase 3 — Rehearsal and reconciliation

For each import batch:

- source count;
- accepted count;
- rejected count;
- duplicate count;
- orphan count;
- relationship count;
- checksum by safe canonical projection;
- repeat-run idempotency;
- rollback/restore rehearsal.

Any sample row needed for investigation remains in protected evidence, not the repository report.

### Phase 4 — Directory cutover

Cut over students, households, guardians, staff, classes, and rosters only after:

- reconciliation passes;
- role tests pass;
- browser acceptance passes;
- backup/restore passes;
- rollback is rehearsed;
- no One Time rows exist;
- legacy domain can be made read-only without breaking uncopied modules.

### Phase 5 — Daily Attendance cutover

- initialize school-local dates/timezone;
- reconstruct accepted historical attendance if approved;
- operate new attendance as authority;
- keep provider/live attendance separate;
- observe;
- reconcile;
- retain rollback.

### Phase 6 — Later school slices

Recommended order:

1. goals/accountability/rewards;
2. school CRM and communications;
3. admissions/forms/documents;
4. tuition/billing/access;
5. content/curriculum/library/community;
6. parent portal;
7. student portal;
8. detailed analytics.

### Phase 7 — Legacy retirement

A legacy route/table may be retired only when:

- replacement parity is accepted;
- data ownership is explicit;
- import/reconciliation passes;
- rollback exists;
- source/deployment is attested;
- observation period passes;
- no ordinary product request depends on the legacy runtime;
- a separate destructive-retirement task is approved.

### Migration mechanics

- Production migrations are forward-only.
- Corrections use new migrations.
- A deployment rollback does not reverse schema destructively.
- No down migration may delete production data.
- No broad table rename/drop occurs in foundation packets.
- No indefinite dual writes.
- No runtime cross-database joins.
- No control-plane query into the school database.

---

## 11. Authentication and session boundary

### 11.1 First-slice roles

```text
school_owner
school_admin
school_manager
staff_attendance
read_only_auditor
```

Final governance assignment remains an operator decision.

### 11.2 Session requirements

Use a school-only host cookie such as:

```text
__Host-bna_school_session
```

Required attributes and behavior:

- `Secure`;
- `HttpOnly`;
- `SameSite=Lax` unless a narrower reviewed flow requires otherwise;
- `Path=/`;
- no `Domain` attribute;
- opaque high-entropy session token;
- server stores only a safe hash;
- rotation on login and privilege change;
- idle and absolute expiry;
- session-family revocation;
- logout revokes only BNA School sessions;
- `Cache-Control: no-store` on authenticated/session responses.

### 11.3 Authentication controls

- modern password hashing;
- constant-work invalid-login path;
- durable rate limiting;
- generic errors;
- explicit CSRF token for unsafe authenticated requests;
- trusted-proxy configuration;
- audit of login, logout, role change, revocation, and recovery;
- no credentials or tokens in logs/evidence;
- privileged MFA policy decided before production owner/admin activation.

### 11.4 Authorization controls

- server-owned role checks;
- school-owned record scope;
- deny by default;
- attendance staff can access only required roster/attendance data;
- read-only auditor cannot mutate;
- student/household detail visibility separately tested;
- no platform super-admin role inherited from legacy BNA;
- no control-plane role grants school access;
- no “View as parent/student” or impersonation;
- no session/token passed through an “Open Application” link.

### 11.5 Explicitly forbidden auth carryover

Do not copy:

- the generic portal destination chooser;
- the unified credential resolver;
- generic logout clearing multiple product cookies;
- provider credentials;
- parent/student credentials into first-slice admin auth;
- workspace aliases as authorization;
- legacy access-code storage;
- shared session tables;
- shared cookie names;
- shared signing/encryption keys.

Parent and student authentication may be added later inside the BNA School product, with independent role-specific contracts and product-local sessions.

---

## 12. Prerequisite readback and first five implementation packets

### A08-R01 — Protected school schema/data and local-state inventory

**Classification:** Read-only prerequisite; not an implementation packet.

**Dependency**

- accepted A06 protected-evidence handling rules;
- explicit operator/Board authority for production database metadata and safe aggregate queries;
- approved non-echoing query/report method;
- exact source environment and service attestation.

**Owner**

- BNA protected-data inventory owner, with an independent reviewer.

**Writer slot**

- `NONE` for source/product code; a separate evidence writer may commit only the sanitized aggregate manifest after review.

**Exact read scope**

- current local repository/worktree metadata: roots, branches, upstreams, clean/dirty counts, ahead/behind counts, local-only commit SHAs/subjects, and path collisions;
- current production/staging source attestation;
- school-relevant database schemas, columns, constraints, indexes, row counts, active/archive counts, duplicate/orphan counts, date/timezone distributions, and ownership/contamination counts;
- no row bodies, private notes, credentials, provider values, or exact personal identifiers.

**Exact write scope**

A sanitized manifest containing only:

- source environment label;
- repository/ref/source attestation;
- table/column/constraint identifiers;
- aggregate counts and safe checksums;
- ownership classification;
- anomaly class/count;
- protected evidence pointer;
- reviewer decision.

**Stop condition**

Stop if:

- any query or tool would print raw Student/family/contact/provider data;
- source identity is ambiguous;
- current production access is not explicitly authorized;
- a provider console or mutation is required;
- a secret/private destination appears;
- a live query could lock, alter, or materially load production;
- worktree collision cannot be resolved from metadata only.

**Required proof**

- timestamped source attestation;
- deterministic query manifest/checksum;
- per-domain aggregate counts;
- duplicate/orphan/contamination counts;
- zero protected values in committed output;
- independent reviewer confirmation;
- explicit statement that no code, data, provider, or deployment mutation occurred.

**Board assignment required:** **Yes**

### First five implementation packets

**None of these packets is assigned or runnable by this audit.** Each requires an explicit Board row after its dependencies are satisfied.

### A08-P01 — Standalone BNA School foundation

**Dependency**

- accepted One Time priority gate;
- accepted A06 BNA security/current-file and fresh local-state gates;
- operator-approved repository, database, deployment, and cookie names;
- no writer collision with PR #141/#142 or another BNA lane.

**Owner**

- BNA School foundation owner.

**Writer slot**

- `BNA-SCHOOL-W1-FOUNDATION`

**Exact write scope**

New `bna-school` repository only:

- runtime/application entry;
- configuration schema;
- PostgreSQL migration runner;
- forward migrations for `auth`, `school`, `audit`, `bridge`, `migration`;
- health/readiness/version endpoints;
- synthetic test harness;
- import/dependency boundary lints;
- architecture ADRs;
- CI checks;
- no business data and no production deploy.

**Forbidden write scope**

- legacy BNA repository;
- One Time repository;
- PR #141/#142 branches;
- production database;
- provider consoles;
- DNS;
- shared packages/runtime.

**Stop condition**

Stop if any design requires:

- an import from legacy BNA or One Time;
- a shared database/session/cookie/secret/deploy;
- a synchronous control-plane call;
- a real credential or data sample;
- an unclean or overlapping worktree;
- a production mutation.

**Required proof**

- exact repository and base commit;
- dependency graph with zero One Time/legacy-runtime imports;
- blank database migrates from zero;
- migrations rerun safely where intended;
- configuration fails closed;
- auth cookie namespace isolation test;
- no network/provider egress in core tests;
- no deploy;
- sanitized file/test manifest.

**Board assignment required:** **Yes**

---

### A08-P02 — Directory schema and protected import/reconciliation tooling

**Dependency**

- A08-P01 accepted;
- protected A08 read-only production schema/data inventory;
- operator decisions for staff, household, archive, and duplicate policies;
- A06 privacy handling accepted.

**Owner**

- BNA School data-migration owner.

**Writer slot**

- `BNA-SCHOOL-W2-DIRECTORY-DATA`

**Exact write scope**

New repository only:

- directory migrations;
- legacy-ID map;
- deterministic import transforms;
- synthetic fixtures;
- reconciliation reports;
- rejected-row reason codes;
- no production import;
- no UI except minimal test harness.

**Stop condition**

Stop if:

- source ownership is ambiguous;
- One Time/provider/control-plane rows cannot be excluded deterministically;
- an identity-specific alias would be committed;
- a child/household merge is ambiguous;
- raw PII would enter logs/evidence;
- a source table requires a live provider call.

**Required proof**

- synthetic import passes;
- protected nonproduction dry run;
- accepted/rejected/duplicate/orphan counts;
- relationship checks;
- idempotent repeat import;
- deterministic safe checksums;
- zero protected values in committed evidence;
- zero One Time/control-plane records in target.

**Board assignment required:** **Yes**

---

### A08-P03 — School auth, RBAC, and Directory UI/API

**Dependency**

- A08-P02 accepted;
- role/governance decision recorded;
- session/MFA policy recorded;
- first-slice UX/route contract approved.

**Owner**

- BNA School product/auth owner.

**Writer slot**

- `BNA-SCHOOL-W3-AUTH-DIRECTORY`

**Exact write scope**

- school-only login/session/logout;
- RBAC;
- student/household/guardian/staff/class/roster API;
- dashboard and directory UI;
- loading/empty/error/permission/conflict states;
- audit events;
- accessibility and responsive behavior.

**Stop condition**

Stop if:

- legacy shared auth is reused;
- provider/parent/student credentials are required;
- a control-plane role grants school access;
- role authority is ambiguous;
- “View as” or impersonation is proposed;
- any ordinary page calls another application.

**Required proof**

- positive and negative role matrix;
- session fixation/revocation/expiry tests;
- CSRF/rate-limit/no-store tests;
- cookie isolation;
- CRUD/archive/reactivate behavior;
- household/guardian relationship guards;
- optimistic conflict behavior;
- browser acceptance at 390, 768, and 1440 widths;
- keyboard/accessibility evidence;
- zero control-plane/One Time browser calls.

**Board assignment required:** **Yes**

---

### A08-P04 — Classes, rosters, and Daily Attendance

**Dependency**

- A08-P03 accepted;
- operator-approved attendance policy;
- school timezone and term model approved;
- protected legacy attendance ownership/readback complete.

**Owner**

- BNA School operations product owner.

**Writer slot**

- `BNA-SCHOOL-W4-ATTENDANCE`

**Exact write scope**

- academic terms;
- school classes;
- staff assignments;
- rosters;
- attendance-day aggregate;
- attendance records;
- submit/correct/audit behavior;
- attendance UI/history;
- no live class, Zoom, meeting, recording, or provider behavior.

**Stop condition**

Stop if:

- attendance policy is unresolved;
- implementation depends on live/member/Zoom tables;
- roster/date reconstruction is ambiguous;
- provider credentials are required;
- a correction can bypass audit/version checks;
- bridge delivery is required for the school transaction.

**Required proof**

- status/date/timezone contract tests;
- roster snapshot tests;
- idempotent entry;
- concurrency/version-conflict tests;
- submission/lock/correction audit;
- RBAC;
- absent/late/excused behavior;
- historical roster change behavior;
- mobile/desktop browser acceptance;
- protected import rehearsal;
- operation with providers and control plane unavailable.

**Board assignment required:** **Yes**

---

### A08-P05 — Reconciliation, product-local outbox, and signed status bridge

**Dependency**

- A08-P04 accepted;
- signed-event contract approved;
- key ownership/rotation decision recorded;
- control-plane consumer is optional and must not block school completion.

**Owner**

- BNA School reliability/integration owner.

**Writer slot**

- `BNA-SCHOOL-W5-BRIDGE`

**Exact write scope**

- transactional outbox;
- event canonicalization/signing;
- retry/lease/dead-letter behavior;
- minimized aggregate event schemas;
- delivery attempts;
- bridge diagnostics;
- cutover reconciliation summary events;
- no control-plane runtime package.

**Stop condition**

Stop if:

- event payload contains PII, notes, private destinations, protected provider IDs, or replayable links;
- event delivery is synchronous with product requests;
- key provenance is unclear;
- receiver access requires school database credentials;
- lockstep deploy is required;
- bridge outage degrades ordinary school use.

**Required proof**

- signature verification;
- schema-version compatibility;
- replay/deduplication;
- lease/retry/dead-letter behavior;
- key-rotation fixture;
- payload privacy scan;
- bridge-down school outage test;
- control-plane-down school browser test;
- no direct DB access;
- no shared runtime dependency.

**Board assignment required:** **Yes**

---

## 13. Test and evidence matrix

### 13.1 Existing evidence preserved

| Evidence | Current classification | What it proves | What it does not prove |
|---|---|---|---|
| Historical full suite reported 778/778 | **SUPERSEDED/HISTORICAL acceptance evidence** | Broad legacy source passed at that recorded point. | Current source, current production, extraction safety, or standalone design. |
| Student/goal focused suite | **CONFIRMED historical contract evidence** | Goal/accountability behavior and scoped student operations. | New persistence/auth boundary. |
| Parent/student portal contract | **CONFIRMED source-contract evidence** | Portal route/UI expectations and linked-child visibility. | Runtime security or suitability for copy. |
| Workspace/person/household contract | **CONFIRMED source-contract evidence** | People/household/workspace concepts exist. | Safe school-only ownership; it also exposes contamination. |
| Portal-agnostic auth contract | **CONFIRMED negative architecture evidence** | Cross-portal resolver/cookie behavior exists. | Target auth suitability. |
| Live-class infrastructure test | **CONFIRMED mixed-product evidence** | Live/member class infrastructure exists. | School-day attendance correctness. |
| Route inventory/registry | **CONFIRMED checkpoint census** | Exact source route ownership/status at checkpoint. | Current live deployment mounting. |
| A06 security audit | **CONFIRMED governing prerequisite** | Current-file/privacy/scanner/architecture gates. | Current protected provider/database state. |
| PR #141/#142 test claims | **CONFIRMED PR-description evidence** | Focused control-plane lanes report tests. | School foundation or merge acceptance. |

### 13.2 Tests required for the new application

| Area | Required tests/evidence | Status |
|---|---|---|
| Import boundary | No dependency/import from One Time, legacy runtime, or control plane | **NOT RUN** |
| Database | Blank DB forward migration, migration checksum/order, repeated startup safety | **NOT RUN** |
| Directory schema | Constraints, archives, relationship uniqueness, orphan prevention | **NOT RUN** |
| Import | Determinism, idempotency, duplicates, orphans, safe checksums, reject reasons | **NOT RUN** |
| Privacy | No PII/private content in logs, fixtures, artifacts, URLs, events | **NOT RUN** |
| Auth | Password path, rate limit, CSRF, session rotation/revocation/expiry, no-store | **NOT RUN** |
| Cookie isolation | School cookie only; no cross-product domain/cookie/session | **NOT RUN** |
| RBAC | Positive/negative matrix for five first-slice roles | **NOT RUN** |
| Directory API | CRUD, archive/reactivate, conflict handling, pagination/search | **NOT RUN** |
| Household/guardian | Cross-household merge denial, relationship authorization | **NOT RUN** |
| Staff | Minimal lifecycle and assignment authority | **NOT RUN** |
| Classes/rosters | Term/class uniqueness, effective dates, assignment guards | **NOT RUN** |
| Attendance | Timezone/date/status, roster snapshot, idempotency, concurrency, correction audit | **NOT RUN** |
| Browser | 390/768/1440, loading/empty/error/permission/conflict, keyboard/a11y | **NOT RUN** |
| Hebrew/RTL | Direction, truncation, form order, date rendering if first release includes Hebrew | **NOT RUN** |
| Bridge | Signature, replay, dedupe, retry, lease, dead letter, key rotation | **NOT RUN** |
| Outage | School works with control plane, One Time, and providers unavailable | **NOT RUN** |
| Backup/restore | Backup creation, restore rehearsal, RPO/RTO evidence | **NOT RUN** |
| Source attestation | Version endpoint and immutable deployed source | **NOT RUN** |
| Cutover | Reconciliation, rollback, observation, legacy read-only gate | **NOT RUN** |

### 13.3 Acceptance rule

Static source-string tests may remain useful contract checks, but no new domain is accepted solely because a route/table name exists. Acceptance requires behavior, database state, authorization, failure-state, privacy, browser, and rollback proof appropriate to the slice.

---

## 14. Stop conditions

Stop implementation and return to the Board if any proposed step:

1. modifies active One Time implementation to enable BNA School;
2. imports One Time code, records, routes, migrations, assets, sessions, or secrets;
3. uses PR #141/#142 as a school writer base or database dependency;
4. uses the legacy BNA database as the new school production database;
5. shares a session store, cookie, domain cookie, signing key, encryption key, or auth resolver;
6. requires a normal school page/request to call BNA Control Plane;
7. requires the control plane to query the school database;
8. introduces a runtime cross-database join;
9. introduces a shared frontend/router/CSS/browser state runtime;
10. copies the Operations shell;
11. copies hard-coded personal-family or identity-specific fixtures;
12. prints or commits raw Student/family/private/provider data;
13. places PII, notes, private destinations, protected provider IDs, or replayable links in outbox events;
14. lacks a fresh local worktree/collision readback;
15. lacks an exact Board assignment and exclusive writer slot;
16. begins before the One Time priority gate is accepted;
17. begins protected data work before relevant A06 gates;
18. cannot classify a source row as school-owned versus One Time/provider/control-plane;
19. automatically merges ambiguous child/household identities;
20. treats signups as enrolled students without an approved admissions decision;
21. treats payment/provider rows as the tuition ledger without a source-of-truth decision;
22. copies live/member/Zoom attendance into school attendance without an approved mapping;
23. requires provider credentials for Directory + Daily Attendance;
24. uses destructive/down migrations as the production rollback plan;
25. creates indefinite dual writes;
26. retires a legacy route before parity, reconciliation, rollback, and observation;
27. requires a real send, charge, provider mutation, or production import in a foundation packet;
28. claims completion from route existence, generic smoke, or screenshot alone;
29. fails to prove the school works while the control plane is unavailable;
30. cannot state the authoritative owner of the extracted data.

---

## 15. NOT-RUN-NOW Codex scaffold prompt

```text
# NOT RUN NOW — A08 BNA SCHOOL STANDALONE FOUNDATION

MODE
- Contract-first scaffold only.
- No production data.
- No deployment.
- No provider action.
- No legacy-repository edit.
- No One Time edit.
- Do not execute unless the current Board contains an explicit A08-P01
  assignment with owner, writer slot, branch, exact scope, and accepted
  dependencies.

IMMUTABLE AUDIT SOURCE
- Repository: shloimie-beep/bnei-neviim-academy
- Checkpoint: cebbfc5781b92fcd9a5014df67f8ae4ba0b3a61c
- Audit result:
  ops/audits/2026-07-26/parallel-control-tower/A08-result.md

PREREQUISITES — STOP IF ANY IS ABSENT
1. One Time priority/controlled-pilot gate accepted.
2. Relevant A06 BNA security/current-file gate accepted.
3. Fresh sanitized local worktree/worktree-list/ahead-behind/collision readback.
4. Operator-approved new repository, database, deployment, cookie, and secret
   namespace names.
5. Board assignment for A08-P01 to writer slot BNA-SCHOOL-W1-FOUNDATION.
6. No collision with BNA PR #141, PR #142, or another active writer.

CREATE ONLY THE NEW BNA SCHOOL REPOSITORY

Implement:
- application/runtime entry;
- configuration schema with fail-closed validation;
- PostgreSQL connection and forward-only migration runner;
- initial empty schemas:
  auth, school, audit, bridge, migration;
- initial tables for:
  school account,
  school users/credentials/sessions/roles,
  people/students/households/guardian relationships/staff,
  academic terms/classes/rosters,
  attendance days/records,
  audit events,
  product-local outbox/delivery attempts/dead letters,
  import batches/legacy ID map/reconciliation results;
- health, readiness, and version endpoints;
- synthetic test fixtures only;
- JSON Schema/OpenAPI contract stubs;
- signed-event envelope specification and synthetic compatibility fixtures;
- architecture ADRs covering:
  repository/database/session/cookie/secret/deploy isolation,
  no synchronous control-plane dependency,
  no One Time imports,
  forward-only migrations,
  offline import/cutover model;
- CI checks for:
  dependency/import boundaries,
  migration order/checksums,
  no network egress in core tests,
  no protected data in fixtures/evidence.

DO NOT IMPLEMENT IN THIS PACKET
- production import;
- real users;
- public signup;
- parent portal;
- student portal;
- communications or sends;
- billing/payments;
- content/media/Drive;
- goals/rewards;
- provider marketplace;
- Zoom/live classes;
- control-plane consumer;
- deployment;
- DNS;
- shared packages with One Time, BNA Control Plane, or legacy BNA.

HARD PROHIBITIONS
- No import from the legacy repository or One Time.
- No shared database, session store, cookie, secret, domain cookie, browser
  bundle, auth resolver, provider client, or runtime package.
- No ordinary request may call BNA Control Plane.
- No real Student/family/contact/provider fixture.
- No hard-coded identity alias.
- No raw private value in logs, tests, Markdown, snapshots, or events.
- No destructive migration.
- No git add -A.
- No force-push.
- No deploy.

STOP CONDITIONS
- Board assignment missing or stale;
- naming/governance decision missing;
- worktree collision;
- any shared-runtime requirement;
- any real-data requirement;
- any provider or production access requirement;
- any One Time modification;
- any protected value appears.

REQUIRED PROOF
- exact branch and HEAD;
- exact files created;
- dependency graph proving zero legacy/One Time/control-plane runtime imports;
- blank PostgreSQL database migrates from zero;
- migration order/checksum tests;
- configuration failure tests;
- school cookie/session isolation tests;
- no-network core test proof;
- synthetic event signature/replay fixture tests;
- secret/privacy scan with no value echo;
- git diff --check;
- no deployment and no external mutation.

RETURN
1. branch and HEAD;
2. commits;
3. files;
4. migrations;
5. tests and results;
6. isolation proof;
7. blockers/decisions;
8. exact next packet dependency;
9. explicit statement:
   SCAFFOLD ONLY — NO DATA MIGRATION — NO DEPLOYMENT.
```

---

## 16. Source list

All repository paths below were inspected at:

```text
shloimie-beep/bnei-neviim-academy
cebbfc5781b92fcd9a5014df67f8ae4ba0b3a61c
```

### Controlling instruction

- `A08-bna-school-product-inventory-and-extraction-audit.md`

### Repository/runtime and route census

- `package.json`
- `server.js`
- `scripts/railway-start.mjs`
- `ops/route-registry.json`
- `ops/action-registry.json`
- `docs/owner-review/ROUTE-INVENTORY.csv`

### Architecture and migrations

- `migrations/parallel-20260619-core-001-platform-core.sql`
- `ops/parallel-runs/PARALLEL-20260619-001/workers/W1/BASELINE.md`
- `ops/parallel-runs/PARALLEL-20260619-001/workers/W1/MIGRATION-PLAN.md`
- `docs/audits/one-time-one-time/2026-06-18-current-state-and-deployment-audit.md`
- prior `BNA-CONTROL-PLANE-DECOMPOSITION.md` audit at the same checkpoint

### School domain modules

- `src/lib/bna/torah-learning.js`
- `src/lib/bna/goal-board.js`
- `src/lib/bna/identity-linking.js`
- `src/lib/bna/parent-progress.js`
- `src/lib/bna/student-identity-dedupe.js`
- `src/lib/bna/crm-contact-model.js`
- `src/lib/bna/crm/contact-service.js`

### UI

- `public/operations.html`
- `public/parent.html`
- `public/student.html`
- `public/signup.html`
- `public/signup-he.html`
- `public/js/signup-documents.js`
- public school/parent/document pages referenced by the route inventory

### Tests and accepted evidence

- `tests/parent-student-portal-contract.test.js`
- `tests/live-class-infrastructure.test.js`
- `tests/workspace-person-household-provider-contract.test.js`
- `tests/portal-agnostic-auth-contract.test.js`
- `tests/operations-student-detail-scope.test.js`
- `ops/execution-runs/2026-06-18-bna-platform-completion/EVIDENCE.md`
- `ops/execution-runs/2026-06-18-bna-platform-completion/TEST-RESULTS.md`

### Control state and current open lanes

- `BNA-START-HERE.md`
- `AGENTS.md`
- `ops/execution-runs/latest.json`
- `ops/execution-runs/2026-07-12-shared-crm-communication-agents-addendum/STATUS.md`
- `ops/chatgpt-ramble-dropoff/CONTROL-TOWER.md`
- PR #141 — Platform Agent Actions and Rabbi Telegram preview
- PR #142 — Isolated read-only BNA control-plane Operations bot

### Security and preservation dependency

- `A06-result.md`
- One Time control-tower evidence establishing One Time-first launch priority

---

## 17. Final determination

**CONFIRMED CURRENT TRUTH.** The legacy repository contains substantial school behavior worth preserving, but its runtime, database, auth, UI, integrations, and execution controls are too mixed to become the new BNA School through deletion or in-place narrowing.

**CONFIRMED CURRENT TRUTH.** The correct foundation is a new clean BNA School application with its own repository, database, sessions/cookies, secrets, deployment, migrations, and failure domain.

**CONFIRMED CURRENT TRUTH.** Directory + Daily Attendance remains the correct first usable slice.

**NEW FINDING.** Attendance must be modeled anew as a school-day aggregate; the legacy live/class attendance implementation is migration evidence, not the target contract.

**NEW FINDING.** Staff, admissions, and tuition are not complete extractable domains at the checkpoint. Staff needs a minimal new first-slice model; admissions and finance must wait for policy/source-of-truth decisions.

**NEW FINDING.** Identity-specific fixtures and personal-family seeds must never cross into the new repository or ordinary evidence.

**UNPROVEN.** Production data condition, live source attestation, current local worktree state, final staff governance, attendance policy, tuition authority, and complete privacy/history state require separate protected readbacks or operator decisions.

**CONFIRMED CURRENT TRUTH.** No BNA School implementation is assigned by A08. One Time remains independent and first.

```yaml
CONTROL-TOWER-RETURN
audit_id: A08
audit_title: BNA School product inventory and extraction audit
result_path: ops/audits/2026-07-26/parallel-control-tower/A08-result.md
audit_date: 2026-07-27
mode: READ_ONLY
repository: shloimie-beep/bnei-neviim-academy
exact_commit: cebbfc5781b92fcd9a5014df67f8ae4ba0b3a61c
verdict: APPROVE_CONTRACT_ONLY_NOT_IMPLEMENTATION
p0: []
p1:
  - mixed_legacy_runtime_is_not_a_safe_foundation
  - standalone_auth_database_session_secret_deploy_boundary_required
  - attendance_requires_school_native_rewrite
  - staff_governance_and_minimal_domain_required
  - identity_specific_fixtures_must_not_be_copied
  - protected_data_inventory_and_a06_gates_required_before_writer
p2:
  - admissions_lifecycle_after_directory
  - school_communications_after_directory
  - tuition_after_source_of_truth_decision
  - goals_rewards_content_documents_and_portals_after_first_slice
first_usable_slice: School Directory + Daily Attendance
one_time_priority: INDEPENDENT_AND_FIRST
new_findings:
  - legacy_attendance_does_not_prove_school_day_contract
  - staff_is_not_a_complete_first_class_domain
  - current_signups_are_intake_not_enrollment
  - tuition_source_of_truth_is_unproven
  - identity_specific_aliases_and_personal_seed_records_are_extraction_hazards
  - legacy_classes_mix_school_provider_live_and_media_concerns
confirmed_current_truth:
  - substantial_school_product_behavior_exists
  - clean_standalone_bna_school_repository_and_database_are_required
  - no_synchronous_control_plane_dependency
  - pr_141_and_pr_142_are_control_plane_lanes_not_school_lanes
  - legacy_cross_portal_auth_must_not_be_copied
  - one_time_launch_remains_first
superseded_historical:
  - shared_platform_core_as_final_school_architecture
  - same_repo_shared_backend_as_target_topology
  - generic_portal_destination_chooser_as_target_auth
unproven:
  - current_production_schema_row_counts_duplicates_and_retention
  - current_live_source_and_route_mounting
  - current_local_dirty_worktrees_and_local_only_commits
  - final_staff_roles_and_authority
  - final_attendance_timezone_status_and_correction_policy
  - tuition_ledger_and_provider_source_of_truth
tests_run_now: []
github_mutations_performed: false
database_mutations_performed: false
provider_actions_performed: false
deployments_performed: false
safe_parallel_task: >
  Board-assigned protected read-only school schema/data inventory and fresh local
  worktree collision readback; no code write and no provider access.
writer_slot_now: NONE
board_assignments_required:
  - A08-R01-PROTECTED-SCHOOL-DATA-INVENTORY
  - A08-P01-STANDALONE-FOUNDATION
  - A08-P02-DIRECTORY-SCHEMA-IMPORT
  - A08-P03-AUTH-RBAC-DIRECTORY
  - A08-P04-CLASSES-DAILY-ATTENDANCE
  - A08-P05-OUTBOX-SIGNED-BRIDGE
execution_prompt_ready: true
execution_prompt_mode: NOT_RUN_NOW
execution_prompt_branch: UNASSIGNED
current_blocker: >
  One Time priority gate, A06 security/local-state prerequisites, protected
  database inventory, staff/attendance operator decisions, and an exact Board
  writer assignment.
forbidden_overlaps:
  - one_time_launch_or_production_pilot_writers
  - bna_pr_141_agent_actions_writer
  - bna_pr_142_control_plane_bot_writer
  - a06_bna_security_writers
  - legacy_bna_monolith_feature_writer
next_action: >
  Accept A08 as the extraction contract, assign only the protected read-only
  inventory first, and do not assign A08-P01 until all named gates pass.
END-CONTROL-TOWER-RETURN
```
