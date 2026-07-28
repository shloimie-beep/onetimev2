# One Time Mishnayos — Supersession and System Disposition

**Package:** `ONE-TIME-PRODUCTION-SPEC-v2.1`  
**Document:** `04-SUPERSESSION-AND-SYSTEM-DISPOSITION-v2.1.md`  
**Status:** Normative source of truth  
**Effective date:** 2026-07-28  
**Repository reviewed:** `shloimie-beep/onetimev2`  
**Reviewed head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`

## Normative package references

This contract is interpreted with:

- `01-PRODUCT-SPEC-v2.1.md`;
- `02-ACCEPTANCE-CONTRACT-v2.1.yaml`;
- `03-DECISION-REGISTER-v2.1.md`;
- `05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md`;
- `06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md`;
- `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`;
- `08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`;
- `09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`;
- `10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`;
- `11-ENVIRONMENT-FIXTURE-CANARY-MANIFEST-v2.1.yaml`;
- `12-MIGRATION-CUTOVER-ROLLBACK-v2.1.md`;
- `13-OPERATIONS-SLO-DR-INCIDENT-v2.1.md`;
- `14-TRACEABILITY-CROSSWALK-v2.1.yaml`.

## 1. Purpose

This contract establishes which historical One Time definitions remain authoritative, which are evidence only, which product surfaces are retired, and how previously accepted work may be reused without allowing obsolete product semantics to govern the v2.1 application.

This document is a product and governance contract. It does not authorize a production deployment, provider mutation, customer communication, charge, refund, data deletion, or destructive cleanup.

## 2. Governing rules

### SUP-001 — v2.1 supersession

The complete approved `ONE-TIME-PRODUCTION-SPEC-v2.1` package supersedes, for current product behavior and release acceptance:

- the v2.0 product specification and acceptance checklist;
- `ops/goals/OT-LAUNCH-01/ACCEPTANCE.yaml`;
- `ops/goals/OT-LAUNCH-01/BOARD.yaml`;
- `ops/goals/OT-LAUNCH-01/DECISIONS.yaml`;
- historical execution queues, writer locks, handoffs, audits, run reports, and dependency graphs;
- fictional/demo acceptance narratives;
- provider-canary authorizations issued for already-completed historical runs;
- any older product description that creates a fourth application role, routine email-code login, a Parent learner mode, a Class Helper, or a production demo/test surface.

Those files remain admissible historical evidence. They do not remain current product requirements, current status, or standing authority.

### SUP-002 — source-of-truth order

For v2.1, conflicts are resolved in this order:

1. The approved v2.1 Decision Register.
2. The other approved normative v2.1 product contracts.
3. The v2.1 machine-readable acceptance contract and candidate-bound evidence ledger.
4. Provider registries for exact provider asset identity and observed state, when consistent with items 1–3.
5. Current repository implementation and automated tests as implementation evidence.
6. Historical Boards, audits, pull-request descriptions, canary reports, and handoffs as evidence only.

No lower-ranked source may silently weaken security, privacy, child-data isolation, financial integrity, migration integrity, provider idempotency, or explicit operator-approval gates.

### SUP-003 — one current status model

After v2.1 adoption, current product status is calculated only from the v2.1 acceptance contract and evidence tied to the exact release candidate.

- An old `done` result does not make a v2.1 requirement pass.
- An old `blocked` result does not block v2.1 work unless the same present-tense technical, safety, authority, or external dependency is represented in v2.1.
- An old `provider_off` result is provider history, not a permanent feature decision.
- An old Board percentage, milestone, or “next task” is not displayed as current product truth.
- No UI surface reads current release status from the old Board.

### SUP-004 — evidence is reusable; semantics are not inherited

Historical evidence may satisfy part of a v2.1 acceptance case only when all of the following are true:

- the tested behavior is unchanged;
- the evidence identifies an immutable repository or application source;
- the environment and provider mode are identified;
- the fixture was authorized and scoped correctly;
- the expected result matches the v2.1 requirement;
- no forbidden side effect occurred;
- the evidence is complete, sanitized, and still fresh enough for the gate;
- the v2.1 evidence ledger explicitly maps it to the new requirement and case ID.

Evidence that used fictional product behavior, a retired role, a routine login-code challenge, a preview route, or an obsolete provider contract may prove only the underlying invariant that remains unchanged. It cannot certify the retired behavior.

### SUP-005 — old authority expires

Historical permissions for a particular canary, seed send, provider action, staging environment, production slice, or cleanup apply only to the exact action for which they were issued. They are not standing authority for v2.1.

Every new external mutation requires the authority defined by the v2.1 acceptance and release contract. Product specifications and historical evidence never imply permission to:

- send to customers;
- enroll a workflow audience;
- activate or publish a provider workflow;
- create or delete a production meeting;
- charge, refund, or alter a subscription;
- change production DNS;
- delete customer data;
- promote a production release.

## 3. Repository control-plane disposition

| Historical source | v2.1 disposition | Normative rule |
|---|---|---|
| `ops/goals/OT-LAUNCH-01/ACCEPTANCE.yaml` | `HISTORICAL_ACCEPTANCE_EVIDENCE` | Old IDs may be cross-referenced, but cannot determine v2.1 pass/fail status. |
| `ops/goals/OT-LAUNCH-01/BOARD.yaml` | `HISTORICAL_STATUS_SNAPSHOT` | It is no longer the current status map and must not drive production UI, task order, or release approval. |
| `ops/goals/OT-LAUNCH-01/DECISIONS.yaml` | `HISTORICAL_DECISION_EVIDENCE` | A decision remains current only when restated or incorporated in v2.1. |
| Historical dependency DAGs and execution-window dependencies | `HISTORICAL_EXECUTION_EVIDENCE` | They do not block v2.1 unless the live dependency is restated in the v2.1 contract. |
| Historical queues, writer locks, conductor lanes, and task packets | `HISTORICAL_COORDINATION_EVIDENCE` | They have no product meaning and no standing external-action authority. |
| `ops/day-one/visible-action-registry.json` | `REGENERATE_FOR_V2_1` | Its schema and test references may be reused, but its route/action inventory and readiness states must be regenerated from the v2.1 production surface. |
| HighLevel provider registries and sanitized readbacks | `PROVIDER_IDENTITY_EVIDENCE` | Exact asset IDs and observed state remain valuable; desired behavior and workflow meaning come from v2.1. |
| Applied database migrations and checksums | `IMMUTABLE_TECHNICAL_HISTORY` | Applied migrations are never rewritten. v2.1 changes use new forward-only migrations. |
| Existing tests | `CONDITIONAL_IMPLEMENTATION_EVIDENCE` | Tests remain useful when mapped to an unchanged v2.1 invariant. Tests for retired product behavior must be removed or rewritten. |
| Existing runbooks and SRE artifacts | `CONDITIONAL_OPERATIONS_EVIDENCE` | Procedures may be reused only when they satisfy the numeric v2.1 operations contract. |
| Historical provider assets and canary resources | `RECONCILE_BY_MANIFEST` | They are not reused, mutated, or deleted based on a name match. Exact IDs, ownership, and disposition must be read back first. |

## 4. Disposition of obsolete and deferred product surfaces

### SUP-010 — fictional/demo customer data

Fictional Cohen-family data, demo Administrators, demo Parents, demo Students, synthetic “Live Demo” customers, preview credentials, and product test records are not production product data.

- They must not appear in production UI, search, reports, counts, leaderboards, calendars, communications, or provider projections.
- Their sessions and credentials must not authenticate in production.
- Production cleanup targets must be identified by exact immutable IDs and provenance, never by a broad name search.
- Historical sanitized fixtures may remain in test code and evidence.
- Automated tests may create isolated transactional fixtures in disposable databases.
- Test fixtures may not be seeded into production or production-candidate persistent staging.

### SUP-011 — Experience Preview and impersonation-like sessions

Experience Preview, fictional Student preview sessions, role-preview cards, preview exchange tokens, and `/app/experience-preview` are retired product behavior.

- They must not be mounted on production or production-candidate staging.
- They must not appear in navigation, dashboard cards, deep links, support instructions, or generated action registries.
- An ordinary Admin may inspect real records only through authorized Admin product views.
- Browser tests use isolated fixtures and direct role sessions created by the test harness; they do not create an operator-facing preview product.

### SUP-012 — product test labs and test lanes

Portal test labs, Zoom test-resource consoles, visible provider test buttons, engineering dashboards, synthetic lanes, and “provider-off demo” workspaces are not production product features.

- Production provider health and degraded state remain visible through ordinary Admin Operations.
- A real provider outage is represented as a truthful unavailable/degraded product state with retry or support guidance.
- Provider canary tooling may exist as non-customer, authorization-gated operational tooling outside normal product navigation.
- Test-only routes are not mounted in production.
- A production-visible disabled control cannot be justified as a “future test lane”; it must be a real product control in a valid prerequisite state or be absent.

### SUP-013 — Class Helper

Class Helper is deferred for launch.

- No Class Helper navigation item, route, tab, card, bot, prompt box, or answer surface appears to a Student, Parent, or Admin.
- Previously generated helper prompts, knowledge artifacts, or tests do not create launch scope.
- The content pipeline may create an Admin-reviewable future knowledge-base artifact, but it remains unpublished and inaccessible to end users.

### SUP-014 — Buffer and social publishing

Buffer integration, scheduled social publishing, social approval queues, Facebook publishing, YouTube publishing, and social-post provider controls are deferred.

- No Buffer credential is required for launch.
- No social publishing worker or job is active in production.
- No social publishing control appears in product navigation.
- Historical social-publishing code or acceptance evidence grants no provider authority.
- Marketing may manually reuse approved copy outside the product; that manual activity is not a One Time product workflow.

### SUP-015 — WhatsApp assistant

There is no WhatsApp lead assistant or WhatsApp qualification bot at launch.

- The public lead-capture assistant belongs to the HighLevel website conversation surface.
- A website lead may not be silently moved into WhatsApp.
- Legacy WhatsApp/offline helper widgets, readiness copy, buttons, and routes are removed.
- WhatsApp reminder preference may be stored as future intent.
- Until WhatsApp has an approved provider, template, consent basis, sender, webhook, and production canary, WhatsApp sends remain zero.
- Disabled WhatsApp delivery never blocks, delays, or falsifies email delivery.

### SUP-016 — Tisha B’Av event assets

The 2026 Tisha B’Av funnel, registration, OT-E01 workflow, OT-C01 workflow wrapper, OT-C01 email campaign, event-only permission records, copy, pages, and provider evidence are historical event assets.

Their v2.1 disposition is:

- provider workflows and campaigns remain paused, draft, ended, or archived with zero new enrollment and zero new send;
- event asset IDs remain recorded so same-name assets are never confused or silently reused;
- event-only consent never becomes general marketing, newsletter, Parent-service, or product-access consent;
- Tisha registration never grants v2.1 Parent, Student, household, billing, or learning access;
- Tisha contacts may become ordinary adult contacts only through the normal v2.1 signup and dedupe contract;
- the public Tisha registration endpoint accepts no new registration and performs no write;
- old Tisha registration and success URLs return `410 Gone` for API/form submission and a non-interactive ended-event response for a browser request;
- the ended-event response links to the current public One Time funnel and contains no event Zoom link;
- the historical funnel may be copied later only into a newly named event with new identifiers, consent text, dates, copy approval, and provider authority.

Tisha assets do not appear in the launch calendar, Dashboard, current workflow counts, normal communications review, or current acceptance percentage.

### SUP-017 — BNA and cross-workspace controls

BNA Boards, bots, repositories, sessions, credentials, tasks, data, and super-admin concepts are outside One Time v2.1.

- One Time has no BNA navigation or branding.
- BNA status cannot block or mark One Time complete.
- The temporarily reused Shloimie operations Telegram transport may receive namespaced `OT` alerts, but it receives no BNA authority over One Time.
- No shared database, session, cookie, worker queue, provider secret, or application role is created.

### SUP-018 — Google Calendar, Hebrew dates, and deferred interface scope

Google Calendar sync, Hebrew-calendar display, multilingual UI, Parent-created goals, editable badge thresholds, favorites, PWA/background push, school-specific administration, multiple simultaneous guardians, and a Parent learner mode are absent at launch.

Absence means:

- no visible placeholder;
- no inaccessible navigation item;
- no background job waiting for configuration;
- no provider credential required;
- no acceptance dependency.

## 5. Identity, role, and authentication disposition

### SUP-020 — role collapse

Assignable application roles are exactly:

- `admin`;
- `parent`;
- `student`.

Historical `owner`, `rabbi`, `teacher`, `viewer`, `crm_agent`, `super_admin`, preview-role, and demo-role values are not assignable authorization roles.

- Shloimie Dratler and Rabbi Eli Scheller are migrated to `admin`.
- Rabbi Eli may retain teacher profile metadata without a different authorization role.
- Historical audit events retain the actor and role value recorded at the time.
- Current permission checks resolve through v2.1 capabilities, not the historical role label.
- Sessions issued under retired role semantics are revoked at cutover.

### SUP-021 — routine email challenges

Routine six-digit email-code login is retired.

- Admin and Parent use email plus password.
- Student uses username plus password.
- Resend setup and reset links remain single-use security flows.
- Historical login-challenge tokens, codes, and sessions are invalid after cutover.
- Login-code delivery evidence may not certify v2.1 login.

### SUP-022 — legacy accounts

Old application passwords, Parent accounts, Student accounts, sessions, and child profiles are not migrated. Old users sign up again through the v2.1 flow. Adult HighLevel identity is deduplicated according to the migration contract.

No historical portal presence, payment, event registration, attendance, or tag silently grants current access.

## 6. HighLevel workflow and identifier disposition

### SUP-030 — GHL authority boundary

HighLevel remains authoritative for adult CRM, campaign execution, adult conversations, consent/suppression projection, and the operator-facing Stripe workflow.

One Time does not become a second campaign editor. A One Time Communications Review surface may show sanitized status, immutable rendered-copy readback, exact audience and suppression readback, and governed Start/Pause requests, but exact campaign authoring and execution remain in HighLevel. Provider seed/canary execution is confined to the release-verification harness and is not exposed as an ordinary production product action.

### SUP-031 — workflow registry migration

Historical workflow IDs are preserved as provider identity evidence. The v2.1 registry must assign one meaning to one identifier.

- OT-11/OT-12 identifier collisions are resolved by a registry migration before either workflow can be activated.
- No existing provider ID is relabeled to mean a different workflow.
- A replacement workflow receives a new unique canonical ID and name.
- Historical event workflows remain in an event/historical namespace.
- Unknown, duplicate, or kind-colliding assets fail closed and cannot enroll or send.
- Registry migration performs no automatic deletion.

### SUP-032 — old workflow readiness

An old `ACTIVE_TESTED`, `SAVED_REOPENED`, or similar provider status does not establish v2.1 readiness. Each launch workflow must pass the v2.1 trigger, ordered actions, waits, exit, suppression-at-send-time, sender, copy fingerprint, bounded operator-only release-canary, pause, and provider-readback contract. The canary is invoked through the release-verification harness, not ordinary product navigation.

## 7. Visible-action certification disposition

### SUP-040 — inventory regeneration

The v2.1 visible-action inventory is generated from the actual release candidate and includes every production-visible:

- route;
- navigation item;
- button;
- link;
- tab;
- form and field;
- filter;
- dialog action;
- calendar action;
- provider-backed action;
- billing or communication action.

Historical inventory entries for Tisha, demos, previews, Class Helper, Buffer, test labs, and retired roles are excluded from the production inventory.

### SUP-041 — allowed action results

Every visible action ends with one of:

- `PASSED`;
- `REMOVED`.

A prerequisite-disabled real product action may be `PASSED` only when the acceptance case proves:

- the prerequisite is legitimate product state;
- the control cannot mutate;
- the explanation is clear;
- satisfying the prerequisite enables the same real action;
- there is no placeholder or deferred feature behind it.

`unavailable_by_design`, `provider_off`, `preview_only`, `demo`, and `untested` are not final production-certification results.

## 8. Historical data and evidence retention

### SUP-050 — preservation before cleanup

Supersession does not mean immediate deletion.

- Applied migrations and audit history remain immutable.
- Provider resources are reconciled by exact ID before any archive or deletion.
- Historical reports remain sanitized evidence.
- Customer or child data follows the v2.1 privacy and retention contract.
- Exact production cleanup requires a target manifest, backup, authorization, readback, and recovery plan.

### SUP-051 — no stale status projection

Historical data may remain stored, but it must not leak into current:

- Dashboard totals;
- user search;
- active household or Student counts;
- calendars;
- access decisions;
- leaderboards;
- campaigns;
- provider health;
- acceptance percentage.

## 9. Supersession acceptance

Supersession is complete only when all of the following are proven against the exact candidate:

1. Current product status is derived exclusively from v2.1 acceptance.
2. Old Board and acceptance IDs are absent from current UI and release calculations.
3. Every historical acceptance ID has a recorded disposition.
4. Retired routes are absent, safely redirected, or return the exact non-mutating terminal response defined here.
5. Retired roles cannot authenticate or authorize.
6. Fictional/demo records and credentials do not appear or work in production.
7. No Tisha, Buffer, Class Helper, preview, test-lane, WhatsApp-assistant, social-publishing, or BNA product control appears.
8. HighLevel registry collisions are resolved without identifier reuse or deletion.
9. The regenerated visible-action inventory contains zero retired entries and zero untested entries.
10. Reused evidence is explicitly mapped to v2.1 and tied to immutable source.
