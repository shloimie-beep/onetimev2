ROLE

You are Codex acting as the senior release engineer, product-completeness engineer, user-journey auditor, bootstrap/seed engineer, security reviewer, accessibility reviewer, and performance-certification engineer for standalone One Time One Time.

Execute OT-68 on exactly one isolated branch. Begin in strict read-only mode. Do not make any repository change until the prerequisite gate below passes completely.

TASK

OT-68 — One Time Rabbi Day-One completeness, bootstrap, and every-visible-action certification.

REPOSITORY

webcraft-media/onetimev2

MISSION

Produce one final product-completeness branch that:

1. Inventories every route, navigation item, card, button, link, field, form, drawer, modal, tab, menu, filter, sort control, pagination control, empty-state action, retry action, status action, support action, and helper action.
2. Maps every visible interactive control to a real route, client handler, or server capability.
3. Removes or hides dead, duplicate, unauthorized, misleading, unaccepted, or Coming Soon controls.
4. Closes small integration gaps without redesigning accepted modules.
5. Adds safe, idempotent, auditable bootstrap tooling for disposable/staging use and an operator runbook for later production approval.
6. Executes and records a complete synthetic Day-One journey.
7. Certifies every visible action with positive and negative tests.
8. Produces one categorical release recommendation without merging, deploying, sending, inviting, charging, activating providers, or changing production infrastructure.

REPOSITORY INVARIANTS

Read the root `AGENTS.md`, all applicable nested instruction files, the accepted dependency documentation, package scripts, migrations, runtime configuration, and test conventions before planning changes.

Preserve the repository’s standalone architecture unless an exact accepted dependency explicitly changed it. The audited foundation uses Node.js 24, TypeScript, Express 5, Vite, PostgreSQL through `pg`, forward-only checksummed migrations, separate public and authenticated bundles, and a transactional outbox. Treat files at the execution SHA as authoritative.

Do not copy or introduce BNA Operations shell code, BNA provider runtime, BNA sessions or cookies, Super Admin chrome, Studio, agents, memory systems, broad BNA migrations, or generated BNA assets.

HARD PREREQUISITE GATE

The operator must supply or identify an operator-approved manifest containing all of the following:

- `OT60_CONVERGENCE_SHA`: one exact 40-character accepted commit SHA.
- `OT68_TARGET_BASE_SHA`: one exact 40-character commit SHA from which the OT-68 branch must be created.
- One explicit decision for each dependency:
  - Rabbi dashboard
  - Account activation
  - Zoom/class access
  - Stripe billing
  - Communications V1B
  - Reports
  - Helpers

Each dependency decision must be exactly one of:

- `INCLUDED_DAY_ONE`, with:
  - exact accepted 40-character commit SHA;
  - acceptance reference;
  - accountable owner;
- `EXCLUDED_LATER`, with:
  - accountable owner;
  - concise reason;
  - confirmation that all related navigation and visible actions must be absent or noninteractive;
- `EXCLUDED_BLOCKING`, with:
  - accountable owner;
  - concise reason;
  - confirmation that OT-68 cannot recommend Day-One release readiness.

Do not infer a dependency decision from merged code, route existence, UI labels, feature flags, issue names, branch names, or prior conversation. Read-only discovery may identify candidate SHAs, but candidates do not satisfy this gate without an explicit acceptance decision.

The acceptable manifest shape is:

  OT60_CONVERGENCE_SHA=<40-hex-sha>
  OT68_TARGET_BASE_SHA=<40-hex-sha>

  RABBI_DASHBOARD=<status>|<accepted-sha-if-included>|<acceptance-reference>|<owner>|<reason-if-excluded>
  ACCOUNT_ACTIVATION=<status>|<accepted-sha-if-included>|<acceptance-reference>|<owner>|<reason-if-excluded>
  ZOOM_CLASS_ACCESS=<status>|<accepted-sha-if-included>|<acceptance-reference>|<owner>|<reason-if-excluded>
  STRIPE_BILLING=<status>|<accepted-sha-if-included>|<acceptance-reference>|<owner>|<reason-if-excluded>
  COMMUNICATIONS_V1B=<status>|<accepted-sha-if-included>|<acceptance-reference>|<owner>|<reason-if-excluded>
  REPORTS=<status>|<accepted-sha-if-included>|<acceptance-reference>|<owner>|<reason-if-excluded>
  HELPERS=<status>|<accepted-sha-if-included>|<acceptance-reference>|<owner>|<reason-if-excluded>

Before writing anything:

1. Confirm the repository origin is exactly `webcraft-media/onetimev2`.
2. Confirm the working tree is clean.
3. Fetch refs without merging or rebasing.
4. Resolve every supplied SHA as a commit.
5. Verify `OT60_CONVERGENCE_SHA` is an ancestor of `OT68_TARGET_BASE_SHA`.
6. Verify every `INCLUDED_DAY_ONE` accepted SHA is an ancestor of `OT68_TARGET_BASE_SHA`.
7. Verify the target base is the exact operator-approved base; do not silently substitute a newer `main`.
8. Record the current checkout SHA and any drift from the approved target base.
9. Confirm no selected dependency remains unmarked.
10. Confirm every unavailable later feature is explicitly marked `EXCLUDED_LATER` or `EXCLUDED_BLOCKING`.

If any gate item is missing, malformed, contradictory, unreachable, or not contained in the target base, make no branch, commit, file edit, migration, seed, provider call, or GitHub write. Return `BLOCKED_PREREQUISITE_GATE` with the exact missing or invalid fields. This is the only routine blocking clarification permitted.

After the gate passes, create one branch from the exact target base:

  ot-68/rabbi-day-one-certification-<base-short-sha>

Do not merge or rebase unaccepted work into it.

RELEASE AND OPERATIONAL BOUNDARY

Permitted:

- Read repository and accepted PR/commit history.
- Create one isolated OT-68 branch.
- Implement small repository glue, tests, feature gating, bootstrap tooling, documentation, and evidence.
- Add forward-only migrations when genuinely required.
- Use local or disposable PostgreSQL 16.
- Use runtime-generated synthetic fixtures.
- Exercise sink, mock, or test-double provider adapters.
- Commit changes to the isolated branch.
- Push that branch and open one draft PR.

Forbidden without a separate exact phase authorization:

- Merge the draft PR.
- Deploy any environment.
- Change Railway services, variables, domains, or processes.
- Change DNS.
- Connect to or migrate a production database.
- Read, copy, export, or modify production rows.
- Create real owner, administrator, parent, student, family, or school users.
- Send invitations or activation messages.
- Send email, WhatsApp, Telegram, SMS, or other external messages.
- Charge, refund, authorize, capture, or otherwise mutate a payment.
- Create or alter Stripe products, prices, customers, subscriptions, or webhooks.
- Activate or modify Zoom, Vimeo, Telegram, email, WhatsApp, Stripe, or other provider configuration.
- Reveal provider URLs, IDs, credentials, setup tokens, or configuration values.
- Change the canonical transition domain.
- Create a BNA runtime dependency.

Do not treat a release recommendation as authorization for any forbidden operation.

LOCKED PRODUCT EXPERIENCE

Enforce all of the following:

- Rabbi Scheller is the real One Time owner.
- Shloimie is a real One Time administrator.
- Do not implement impersonation, View as Rabbi, Super Admin chrome, or a BNA Operations bundle.
- Customer-facing UI must use the accepted owner/administrator naming. Internal technical role names may remain implementation details.
- Left navigation contains main categories.
- Top navigation contains only subsections of the currently selected left-navigation category.
- Do not duplicate the selected category as both a left-navigation category and top-navigation item.
- Use the canonical black/yellow One Time shell with restrained supporting accents.
- Keep names, headings, status labels, and body text fully readable. Do not use faded names or low-contrast identity text.
- Keep the header, support/footer, buttons, fields, forms, cards, drawers, modals, empty states, loading states, error states, and status states consistent.
- Support 360×800 and 390×844 mobile viewports, tablet, and desktop.
- No horizontal page overflow.
- Filters, sort controls, pagination, and primary actions remain reachable on mobile.
- Member Login and Sign Up Now remain visible and operable on mobile public pages.
- Rabbi-facing screens show operational outcomes and readiness, not API keys, provider IDs, raw provider URLs, secret names, webhook details, or integration configuration.
- Public signup remains fast and provider-independent.
- Parent routes are household and relationship scoped.
- Student routes are learner scoped.
- Direct URL access must enforce the same authorization as navigation visibility.
- Unready features are absent or are represented by clearly noninteractive availability information. Do not expose clickable dead controls.
- Do not use clickable Coming Soon buttons, links with `href="#"`, `javascript:` links, empty event handlers, or controls that only display a placeholder toast.

FEATURE-READINESS DECISION LEDGER

Create `docs/release/ot-68/feature-readiness.json`.

It must contain:

- schema version;
- target base SHA;
- OT-68 head SHA;
- OT-60 convergence SHA;
- each selected dependency and its exact accepted SHA or explicit exclusion;
- every discovered product feature;
- Day-One status;
- route and navigation visibility;
- feature-flag name, when applicable;
- default flag state;
- readiness owner;
- exclusion reason;
- whether exclusion blocks the required journey;
- expected unavailable-state behavior.

Feature flags must default off unless an accepted requirement explicitly establishes a safer default. Synthetic tests may enable flags only inside disposable test scope.

Do not guess whether a discovered feature belongs on Day One. Unaccepted or ambiguous features must be hidden and recorded as excluded pending an exact decision.

REQUIRED DAY-ONE INVENTORY

Audit and reconcile at least the following surfaces and capabilities:

Public:

- Landing page.
- Mobile and desktop navigation.
- Member Login.
- Sign Up Now.
- Family signup.
- School signup.
- Validation.
- Rate limiting.
- Duplicate handling.
- Idempotency.
- CRM capture.
- Acknowledgement state.
- Reminder-intent state.
- Privacy-preserving repeat-submission response.
- Legacy and transition-domain redirects.
- Public 404 and error states.

Owner and administrator:

- Account activation.
- Login.
- MFA enrollment and challenge.
- Logout.
- Session expiry.
- Recovery.
- Dashboard.
- CRM.
- Classes.
- Communications.
- Content/library.
- Products/billing.
- Tasks.
- Reports.
- Support.
- Readiness and operational status.
- Empty, partial, populated, forbidden, and provider-unavailable states.

Parent:

- Activation.
- Login and logout.
- Household management.
- Relationship management.
- Linked learner management.
- Learner-scoped access.
- Billing.
- Support.
- Empty, conflict, forbidden, expired-session, and retry states.

Student:

- Activation.
- Login and logout.
- Schedule.
- Protected class launch.
- Library.
- Review sheets.
- Progress.
- Rewards.
- Support.
- Learner isolation.
- Empty, forbidden, provider-unavailable, offline, and expired-session states.

Communications and providers:

- Email acknowledgement intent.
- WhatsApp acknowledgement intent.
- Email reminder intent.
- WhatsApp reminder intent.
- Consent state.
- Outbox processing state.
- Failure and retry state.
- Zoom/class target readiness.
- Vimeo/content readiness.
- Stripe test-mode readiness.
- Stripe live-mode guard state.
- Telegram/internal-helper readiness.
- Provider-unavailable behavior.
- No synchronous provider dependency in public signup.

Platform and operations:

- Feature flags.
- Fresh and upgrade-path migrations.
- Web process.
- Worker process.
- Health and readiness.
- Exact source-SHA reporting.
- Version reporting.
- Audit events.
- Idempotency.
- Concurrency.
- Account and learner isolation.
- `join.onetimeonetime.com` transition-domain invariant.
- BNA oversight seam without an ordinary runtime dependency.

ROUTE INVENTORY AND CONTRACT

Create `docs/release/ot-68/route-registry.json` and a validating schema.

Inventory:

- Static public routes.
- Server-rendered routes.
- Client routes.
- Redirects.
- API routes and HTTP methods.
- Form action targets.
- Activation and recovery routes.
- Authenticated application routes.
- Parent routes.
- Student routes.
- Provider handoff routes.
- Download/export routes.
- Health, readiness, and version routes.
- Worker commands or handlers.
- Background job entry points.
- Test-only routes and why they cannot exist in production.

Each route entry must specify:

- stable route ID;
- method and normalized path;
- route class;
- owning module;
- accepted dependency SHA or OT-68 ownership;
- role and capability;
- account, household, relationship, or learner scope;
- authentication requirement;
- navigation location;
- feature/readiness flag;
- handler;
- expected success status;
- unauthorized and forbidden behavior;
- not-found behavior;
- idempotency and audit expectations;
- positive test IDs;
- negative test IDs;
- Day-One status.

Test direct navigation and server authorization independently. Hiding navigation is not authorization.

Identify and reconcile:

- orphan routes;
- duplicate routes;
- shadowed routes;
- stale redirects;
- links to nonexistent routes;
- routes exposed to the wrong role;
- routes lacking server-side scope enforcement;
- routes from excluded dependencies;
- test-only endpoints accidentally reachable in production.

EVERY-VISIBLE-ACTION REGISTRY

Create:

- `docs/release/ot-68/action-registry.schema.json`
- `docs/release/ot-68/action-registry.json`
- `docs/release/ot-68/action-coverage.json`

The registry is the canonical machine-readable contract for every visible interactive control.

Include all visible:

- links;
- buttons;
- icon buttons;
- menu items;
- tabs;
- switches;
- checkboxes;
- radio controls;
- text fields;
- selects;
- textareas;
- form submit controls;
- drawer controls;
- modal controls;
- filters;
- sorting controls;
- pagination controls;
- table row actions;
- card actions;
- empty-state actions;
- retry actions;
- offline actions;
- status actions;
- export/download actions;
- copy actions;
- support actions;
- helper actions;
- keyboard-triggered actions that are visibly advertised;
- custom elements with pointer or keyboard interaction.

Every action entry must include:

- `action_id`: stable and unique.
- `role`: all permitted roles.
- `capability`: required capability.
- `route`: normalized route.
- `screen`: user-facing screen.
- `component`: source component or template.
- `control_kind`: link, button, field, form, filter, drawer, modal, tab, menu, switch, helper, or other explicit kind.
- `user_visible_label`: exact visible label, or explicit icon-only marker.
- `accessible_name`: resolved accessible name.
- `classification`: read or write.
- `confirmation_requirement`: none or exact confirmation behavior.
- `target_type`: route, endpoint, server action, client handler, or protected provider handoff.
- `server_endpoint_or_action_handler`: exact endpoint or handler. Pure client behavior must name its real handler and parent operation.
- `idempotency_expectation`: required, not required with rationale, or inherited from parent action.
- `audit_expectation`: exact audit event or not applicable with rationale.
- `loading_state`: expected behavior.
- `success_state`: expected behavior.
- `error_state`: expected behavior.
- `permission_state`: expected behavior.
- `offline_state`: expected behavior.
- `positive_test_ids`: one or more test IDs.
- `negative_test_ids`: one or more test IDs.
- `mobile_evidence`: 360 and 390 evidence references.
- `keyboard_evidence`: keyboard test reference.
- `readiness_flag`: exact flag or `always`.
- `readiness_status`: ready, hidden, excluded-later, excluded-blocking, or noninteractive-information.
- `readiness_owner`: accountable owner.
- `parent_action_id`: when a field or subordinate control belongs to a larger transaction.
- `notes`: only when necessary.

For any non-applicable state or expectation, record an explicit rationale. Do not use `TBD`, `TODO`, `unknown`, or an empty value for an exposed control.

Give each rendered interactive element a stable `data-action-id` or an equivalent accepted identifier. Do not expose sensitive information through that identifier.

Add automated registry verification that:

1. Statically detects obvious interactive controls lacking action IDs.
2. Renders and crawls every relevant role, route, state, and viewport.
3. Discovers native and ARIA interactive elements.
4. Confirms every visible control has exactly one registry entry.
5. Confirms no duplicate action IDs.
6. Confirms every registry action appears in at least one expected rendered state.
7. Confirms every action has positive and negative test coverage.
8. Confirms target routes, handlers, and endpoints exist.
9. Confirms excluded actions are not rendered as interactive controls.
10. Fails on dead anchors, no-op controls, placeholder handlers, and clickable Coming Soon surfaces.
11. Produces exact totals for discovered, registered, positively tested, negatively tested, hidden, excluded, and uncovered actions.
12. Requires uncovered actions to equal zero.

Parameterization is allowed, but the evidence must identify every individual action ID exercised by each test.

CLICK-EVERYTHING CERTIFICATION

Use the action registry to drive browser tests. For every relevant role and applicable state:

- Navigate to every reachable screen.
- Click or operate every visible action.
- Exercise every field’s valid and invalid behavior.
- Verify the expected route, handler, server mutation, or client-state result.
- Verify loading, success, and failure behavior.
- Verify forbidden and unauthorized behavior.
- Verify offline behavior where applicable.
- Verify repeated activation, repeated submission, conflicting updates, duplicate submission, and repeated retry behavior.
- Verify destructive or material writes have the required confirmation.
- Verify keyboard activation produces the same result as pointer activation.
- Verify focus is placed correctly after drawers, modals, errors, retries, route transitions, and success.
- Reset or isolate synthetic data so one action test does not invalidate later tests.
- Never operate against real users, production data, real provider targets, or live payment methods.

CONTROLS WITHOUT COMPLETE IMPLEMENTATION

A control is not Day-One ready unless all of the following exist:

- a real destination or handler;
- server authorization where relevant;
- input validation;
- loading state;
- success state;
- safe error state;
- permission behavior;
- offline behavior where applicable;
- idempotency behavior for repeatable writes;
- audit behavior for material writes;
- mobile behavior;
- keyboard behavior;
- positive tests;
- negative tests.

If any item is missing:

- implement only small, well-bounded integration glue when it does not redesign an accepted module; otherwise
- remove or hide the control;
- update the feature-readiness ledger;
- record the accountable owner and reason;
- treat required-journey loss as a release blocker.

Do not keep a dead control merely to preserve visual symmetry.

SMALL INTEGRATION-GAP BOUNDARY

Permitted OT-68 integration work includes:

- route registration;
- capability wiring;
- feature gating;
- missing state handling;
- validation wiring;
- error boundaries;
- outbox-state wiring;
- idempotency guards;
- audit-event wiring;
- consistent shell integration;
- navigation correction;
- responsive and accessibility correction;
- test fixtures;
- test adapters;
- status/readiness summaries;
- bootstrap and runbook support.

Do not:

- redesign accepted modules;
- replace accepted architecture;
- introduce a new provider;
- activate a provider;
- invent product policy;
- invent billing prices;
- change ownership semantics;
- weaken authorization;
- perform a broad schema rewrite;
- import BNA runtime code.

When a gap requires a product, provider, pricing, legal, or identity decision, exclude it and document the decision needed.

PUBLIC SIGNUP CONTRACT

Family and School signup must remain provider-independent.

For Family signup, prove:

- accessible client and server validation;
- rate limiting;
- canonicalized input;
- privacy-preserving dedupe;
- idempotency;
- concurrent duplicate safety;
- one atomic CRM record or update;
- acknowledgement and reminder intents written transactionally with the CRM operation;
- no synchronous email, WhatsApp, Telegram, Stripe, Zoom, or Vimeo call;
- truthful success copy that distinguishes accepted intent from delivered communication;
- safe retry after network interruption;
- no disclosure that another person or household already exists.

For School signup, prove:

- the lead is captured and deduped;
- acknowledgement intent is truthful;
- the record remains a lead;
- no user account is created;
- no household or learner is created;
- no membership is created;
- no activation token is granted;
- no class entitlement is granted;
- no parent or student portal entitlement is granted.

SAFE BOOTSTRAP TOOLING

Create idempotent, auditable tooling for disposable and explicitly authorized staging databases. Use repository conventions and provide commands equivalent to:

- plan;
- apply;
- verify;
- rerun/no-op verification;
- rollback of bootstrap-owned data.

The tooling must:

- default to plan-only behavior;
- require an explicit environment;
- reject production application by default;
- require an exact source SHA;
- require the accepted-dependency manifest checksum;
- require an explicit apply flag for disposable or staging use;
- use a transaction;
- use an advisory lock or equivalent concurrency guard;
- use stable natural keys;
- record a bootstrap run ID;
- record source SHA, manifest checksum, environment class, operation types, row counts, timestamps, and outcome;
- avoid recording secret values or PII;
- identify rows it owns so rollback cannot delete unrelated data;
- make a second identical run a no-op;
- detect conflicting existing rows and stop safely;
- provide a verification mode;
- provide compensating rollback for bootstrap-owned rows;
- avoid schema creation in the web runtime;
- use forward-only migrations for any required bootstrap metadata.

The bootstrap plan may cover:

- One Time account identity.
- One Time product identity.
- Rabbi Scheller’s owner membership reference.
- Shloimie’s administrator membership reference.
- Initial class-series configuration through protected configuration references.
- Sender, reply-to, and internal-alert configuration names without their values.
- Feature flags defaulting off.
- Runtime-generated synthetic parent, student, family, and school fixtures.
- Product and price reference names only after billing decisions are exact.
- Expected web and worker readiness configuration.

It must not create real Rabbi or Shloimie credentials, accounts, invitations, activation messages, MFA secrets, or provider configuration.

Real membership binding must use protected external subject references supplied only during a later exactly authorized operator phase. Do not infer an email address, phone number, username, or provider identity.

Synthetic fixtures must:

- be generated at runtime;
- be unmistakably synthetic;
- use opaque identifiers;
- never be committed;
- never be printed;
- never appear unredacted in screenshots, traces, logs, PR text, or evidence;
- be removed or rolled back after verification when appropriate.

Never print or commit:

- passwords;
- password hashes;
- MFA secrets;
- recovery codes;
- activation or setup tokens;
- class links;
- meeting links;
- phone numbers;
- email addresses;
- API keys;
- signing secrets;
- webhook secrets;
- provider IDs;
- price IDs;
- product IDs;
- customer IDs;
- subscription IDs;
- production database identifiers;
- production rows.

Configuration documentation may contain configuration variable names, but never values.

OPERATOR RUNBOOK

Create `docs/runbooks/ot-68-day-one-bootstrap.md`.

Include:

- purpose and boundary;
- prerequisite accepted SHAs;
- exact artifact/source SHA requirement;
- disposable-database procedure;
- staging plan/apply/verify procedure;
- production plan-only procedure;
- required protected configuration names;
- required database backup and restore checks for a later production phase;
- feature-flag defaults;
- owner/admin membership-reference approval procedure;
- class-series configuration-reference approval procedure;
- billing decision gate;
- dry-run interpretation;
- conflict handling;
- rerun/no-op behavior;
- verification queries that return counts and non-sensitive statuses only;
- rollback behavior;
- audit-event review;
- failure escalation;
- explicit list of operations requiring a separate exact authorization.

Provide a production authorization-envelope template containing fields for:

- exact source SHA;
- exact accepted-manifest checksum;
- environment;
- database fingerprint;
- permitted operation types;
- approved feature flags;
- approved symbolic configuration references;
- approver;
- approval timestamp;
- expiry;
- rollback authority.

Do not populate the template with real values.

AUTHENTICATION AND IDENTITY CERTIFICATION

Using synthetic identities only, test:

- owner activation;
- administrator activation;
- parent activation;
- student activation;
- single-use activation behavior;
- activation expiry;
- activation replay;
- invalid activation;
- account enumeration resistance;
- login success and failure;
- MFA enrollment and challenge;
- MFA failure and replay resistance;
- recovery success and failure;
- recovery expiry;
- session fixation resistance;
- session expiry;
- logout invalidation;
- stale-tab behavior;
- cross-role direct-route denial;
- cross-account denial;
- cross-household denial;
- cross-learner denial.

Do not put tokens or MFA material in logs or screenshots. Test code may access them through an in-process sink or ephemeral protected fixture interface that is unavailable in production builds.

REQUIRED SYNTHETIC DAY-ONE JOURNEY

Always execute the complete journey against a local/disposable PostgreSQL 16 environment with all external transports forced to sink/mock/test-double mode.

An exact-SHA pre-existing staging environment may be exercised only when a separate exact staging-test authorization is supplied. Do not deploy to create that staging environment.

Prove this journey:

1. Start web and worker processes from the exact OT-68 head SHA.
2. Verify web and worker health/readiness and source-SHA reporting.
3. Open `join.onetimeonetime.com` through a local host mapping or equivalent non-DNS-changing test arrangement.
4. Verify the public landing page.
5. Verify Member Login and Sign Up Now at 360×800 and 390×844.
6. Exercise invalid Family signup.
7. Exercise valid Family signup.
8. Exercise concurrent and repeated Family signup.
9. Prove one atomic CRM result and truthful acknowledgement/reminder intent.
10. Prove provider unavailability does not invalidate accepted signup.
11. Exercise valid and duplicate School signup.
12. Prove School remains a lead with no class or portal entitlement.
13. Activate a synthetic owner account.
14. Activate a synthetic administrator account.
15. Exercise owner and administrator login, MFA, recovery, expiry, and logout.
16. Visit the dashboard.
17. Visit CRM.
18. Exercise every visible CRM action.
19. Visit Communications.
20. Exercise acknowledgement, reminder, consent, loading, sent-intent, retry, partial-error, and provider-unavailable states without sending.
21. Visit classes.
22. Exercise class configuration and protected class-target readiness without exposing or opening a real class link.
23. Visit content/library.
24. Exercise Vimeo/content readiness without exposing a raw provider ID or URL.
25. Visit products/billing when included.
26. Exercise Stripe test/readiness behavior without creating a customer, charge, subscription, product, or price.
27. Visit tasks when included and exercise all visible actions.
28. Visit reports when included and exercise all filters, exports, empty states, and authorization states.
29. Exercise support and helper seams when included.
30. Activate a synthetic parent.
31. Create or attach a synthetic linked learner through the accepted relationship workflow.
32. Activate a synthetic student.
33. Verify parent household and learner-scoped portal behavior.
34. Verify student learner-scoped portal behavior.
35. Verify student schedule.
36. Verify protected class launch behavior using a test target.
37. Verify protected library access.
38. Verify review sheets, progress, rewards, and support when included.
39. Verify cross-household and cross-learner denial.
40. Verify the BNA oversight seam without any BNA runtime request.
41. Log out every authenticated role.
42. Confirm each invalidated session cannot be reused.
43. Confirm no external message, invitation, payment, provider mutation, or production write occurred.

Click every visible action in every applicable role and state during this journey or in a registry-linked supplemental test.

STATE MATRIX

For every applicable screen and action, cover:

- loading;
- empty;
- populated;
- partial error;
- full error;
- retry;
- offline;
- slow response;
- expired session;
- unauthenticated;
- forbidden;
- not found;
- conflict;
- duplicate;
- idempotent replay;
- provider unavailable;
- feature disabled;
- excluded feature;
- stale data;
- concurrent update.

Each action registry entry must state which states apply. A non-applicable state requires a reason.

PROVIDER READINESS WITHOUT PROVIDER MUTATION

Email and WhatsApp:

- Verify consent and reminder preferences.
- Verify outbox intent and state transitions.
- Use sink/mock transport only.
- Verify provider failure and retry state.
- Do not claim delivery when only intent or sink completion is proven.

Zoom/class access:

- Verify symbolic target readiness.
- Verify authorized and unauthorized handoff behavior.
- Verify missing, expired, or unavailable target behavior.
- Do not reveal a real meeting URL.
- Do not launch or join a real meeting.

Vimeo/content:

- Verify authorized protected-content behavior.
- Verify unavailable-content behavior.
- Prevent raw provider identifiers or URLs from leaking into ordinary UI, logs, or evidence.
- Do not modify provider content.

Stripe:

- Verify configuration-state classification without exposing values.
- Verify test/live mode mismatch guards.
- Verify idempotency and webhook-event handling through synthetic events when included.
- Verify parent billing scope.
- Keep payment transport disabled.
- Do not create, authorize, capture, refund, or charge anything.
- Do not create or modify Stripe objects.
- Do not claim live readiness when product/price decisions or exact protected references are unresolved.

Telegram/helpers:

- Keep helper activity internal and sink/mock only.
- Do not expose Telegram configuration to Rabbi-facing UI.
- Do not send a real helper message.
- If helpers are excluded, remove related interactive controls.

BNA OVERSIGHT SEAM

Retain a narrow, versioned oversight seam without making BNA an ordinary runtime dependency.

Acceptable forms include a documented pull-based status contract, non-sensitive audit summary, or offline/export schema.

Prove:

- no BNA package import;
- no BNA session or cookie;
- no BNA database connection;
- no BNA synchronous request;
- no BNA fanout during signup, login, portal use, communications, class access, billing, support, or worker processing;
- no BNA requirement for One Time web or worker health;
- no BNA secrets or workspace identifiers in the browser bundle.

TRANSITION-DOMAIN INVARIANT

Keep `https://join.onetimeonetime.com` as the canonical transition-domain base unless an exact later authorization says otherwise.

Audit:

- canonical tags;
- public links;
- login links;
- signup links;
- activation-link construction;
- recovery-link construction;
- redirects;
- cookie domain and secure settings;
- CORS and origin checks;
- CSRF origin checks;
- provider callback construction;
- generated communication intents;
- static assets;
- tests and documentation.

Do not change DNS. Do not introduce a conflicting canonical hostname. Do not leak an internal Railway hostname or preview hostname into user-facing output.

DATABASE AND CONCURRENCY VERIFICATION

Use actual PostgreSQL 16, not only an in-memory compatibility layer.

Prove:

1. Fresh database migration from zero.
2. Migration checksum verification.
3. Concurrent migration lock behavior.
4. Upgrade path:
   - apply all migrations at `OT68_TARGET_BASE_SHA`;
   - preserve that database;
   - apply OT-68 migrations;
   - run verification and the required journey.
5. No runtime schema creation in web or worker startup.
6. No destructive migration without an exact accepted requirement.
7. Concurrent Family signup.
8. Concurrent School signup.
9. Duplicate idempotency-key handling.
10. Activation-token replay handling.
11. Concurrent relationship or learner changes.
12. Concurrent outbox workers using safe locking.
13. Billing-event idempotency when billing is included.
14. Account isolation.
15. Household isolation.
16. Learner isolation.
17. Rollback on transaction failure.
18. Bootstrap rerun/no-op behavior.
19. Bootstrap rollback affects only bootstrap-owned rows.

SECURITY VERIFICATION

Audit and test:

- server-derived account and product scope;
- server-derived household and learner scope;
- capability enforcement on every handler;
- IDOR/BOLA resistance;
- mass-assignment resistance;
- SQL injection resistance and parameterized SQL;
- stored and reflected XSS resistance;
- CSRF protection for authenticated writes;
- session fixation;
- secure, HttpOnly, SameSite cookie behavior;
- logout invalidation;
- MFA and recovery secrecy;
- activation secrecy and expiry;
- open redirect resistance;
- provider URL injection resistance;
- SSRF resistance where provider targets are resolved;
- rate limiting;
- account-enumeration resistance;
- neutral duplicate responses;
- content-security policy;
- clickjacking protection;
- sensitive-cache behavior;
- audit logging without sensitive payloads;
- idempotency for repeatable writes;
- dependency and lockfile risk using the repository’s accepted scanner or equivalent;
- absence of test-only bypasses in production output.

Scan the repository diff, built assets, logs, screenshots, traces, reports, and committed evidence for:

- secrets;
- passwords;
- tokens;
- MFA material;
- email addresses;
- phone numbers;
- provider IDs;
- raw provider URLs;
- class links;
- payment identifiers;
- production database references;
- PII;
- BNA runtime references.

A detected sensitive value is a release blocker. Remove it from both the working tree and generated artifacts before committing.

ACCESSIBILITY AND RESPONSIVE VERIFICATION

Target WCAG 2.2 AA.

Test at minimum:

- 360×800;
- 390×844;
- tablet portrait;
- tablet landscape;
- 1440×900 desktop.

Capture sanitized screenshots for:

- public landing;
- Family form;
- School form;
- login/MFA/recovery;
- owner dashboard;
- administrator dashboard;
- CRM;
- Communications;
- classes;
- content/library;
- parent portal;
- student portal;
- representative loading, empty, error, forbidden, offline, and provider-unavailable states.

Verify:

- no horizontal page overflow;
- filters and actions remain reachable;
- visible focus;
- logical tab order;
- skip navigation;
- landmarks and headings;
- unique accessible names;
- labels and descriptions;
- field-error association;
- live-region behavior;
- drawer and modal focus trapping;
- Escape behavior;
- focus restoration;
- keyboard operation of every action;
- 200% and 400% zoom/reflow;
- RTL layout and reading order;
- reduced-motion behavior;
- contrast;
- readable names and headings;
- touch target size;
- no information conveyed only through color;
- no serious or critical automated accessibility findings.

PERFORMANCE VERIFICATION

Run 30 samples under a documented throttled-mobile profile for:

- landing;
- signup;
- first authenticated dashboard load;
- one representative parent route;
- one representative student route;
- protected class or library readiness route.

Record p50, p75, and p95 for:

- LCP;
- CLS;
- INP or an equivalent interaction metric;
- TTFB;
- route-ready time;
- primary-action response time;
- transferred bytes;
- JavaScript bytes;
- request count.

Use cold-cache samples for page-load measurements and a separately documented warm-navigation sample where useful.

Retain existing stricter budgets. At minimum:

- LCP p75 must not exceed 2.5 seconds.
- CLS p75 must not exceed 0.1.
- Public landing and signup must not import React or the authenticated application bundle.
- Public JavaScript and request counts must have explicit enforceable budgets.
- Authenticated route chunks must have explicit enforceable budgets.
- The OT-68 branch must not regress an accepted base metric by more than 5% without a documented, release-blocking exception.
- No provider call may sit on the public signup critical path.

Commit a machine-readable budget configuration and make CI fail when it is exceeded.

WEB, WORKER, HEALTH, AND VERSION CERTIFICATION

Start the built web and worker artifacts independently.

Verify:

- clean startup;
- graceful shutdown;
- database readiness;
- worker concurrency behavior;
- sink outbox processing;
- no automatic production migration behavior;
- health endpoints reveal no secrets;
- readiness reflects required internal dependencies;
- provider unavailability does not make provider-independent public signup unhealthy;
- web and worker identify the same exact source SHA;
- source-SHA readback equals the committed OT-68 head;
- version output identifies One Time, not BNA;
- built artifacts do not report `local`, `unknown`, or an unrelated SHA.

TEST SUITE

Run repository-defined focused and full commands. At minimum, run the accepted equivalents of:

- clean install;
- format check;
- lint;
- typecheck;
- unit tests;
- integration tests;
- browser/end-to-end tests;
- accessibility tests;
- performance tests;
- bundle checks;
- migration verification;
- bootstrap plan/apply/verify/rerun/rollback tests;
- action-registry verification;
- route-registry verification;
- secret/PII/provider-URL scans;
- `git diff --check`.

Run focused tests as changes are made, then run the complete clean verification suite from the final commit.

Do not suppress failing tests, weaken assertions, remove coverage, mark tests skipped, or update visual baselines merely to obtain a pass. Any intentional baseline update must be explained and supported by the locked product experience.

EVIDENCE

Create `docs/release/ot-68/verification.json` and `docs/release/ot-68/release-report.md`.

Store lightweight machine-readable evidence in the repository. Store large screenshots, traces, videos, and performance artifacts as CI or draft-PR artifacts when repository policy discourages committed binaries.

Create an evidence manifest containing:

- exact target base SHA;
- exact OT-68 head SHA;
- accepted dependency manifest and checksum;
- test command;
- test result;
- timestamp;
- environment class;
- PostgreSQL version;
- browser version;
- artifact path;
- artifact checksum;
- sanitized status;
- action and route coverage totals;
- performance percentiles;
- accessibility result;
- security-scan result;
- web and worker source-SHA readback.

Do not include sensitive values or synthetic fixture identities in evidence.

DRAFT PR

After all permitted implementation and verification work:

1. Confirm the branch contains only OT-68 changes on top of the exact approved base.
2. Confirm `git status` is clean.
3. Confirm `git diff --check` passes.
4. Push only the isolated branch.
5. Open one draft PR.
6. Do not merge it.
7. Do not enable auto-merge.

Use a title equivalent to:

  OT-68: certify Rabbi Day-One completeness and bootstrap

The draft PR body must include:

- exact base SHA;
- exact head SHA;
- OT-60 convergence SHA;
- included dependency SHAs;
- explicit excluded dependencies;
- implementation summary;
- removed or hidden controls;
- action coverage totals;
- route coverage totals;
- synthetic journey result;
- migration result;
- bootstrap result;
- accessibility result;
- performance p50/p75/p95;
- security and sensitive-data scan result;
- BNA no-fanout evidence;
- source-SHA readback;
- release recommendation;
- blockers and residual risks;
- explicit confirmation that no merge, deployment, DNS/Railway change, production migration, real-user creation, invitation, external send, payment, or provider mutation occurred.

RELEASE RECOMMENDATION

The final recommendation must be exactly one of:

- `NOT_READY`
- `READY_FOR_EXACT_SHA_STAGING`
- `READY_FOR_CONTROLLED_CANARY_APPROVAL`
- `READY_FOR_LIVE_CUTOVER_APPROVAL`

Apply these rules conservatively:

`NOT_READY`

Use when any prerequisite, required journey, authorization, isolation, migration, bootstrap, security, accessibility, action coverage, route coverage, health, source-SHA, or material performance requirement fails. Also use when an `EXCLUDED_BLOCKING` dependency or other exclusion prevents the required Day-One journey.

`READY_FOR_EXACT_SHA_STAGING`

Use only when the local/disposable exact-SHA build passes all applicable checks, the branch and runbook are ready, and the remaining step is an explicitly authorized exact-SHA staging deployment or staging journey. This status does not authorize staging deployment.

`READY_FOR_CONTROLLED_CANARY_APPROVAL`

Use only when an already-deployed exact-SHA staging environment has passed the complete authorized journey, all included dependencies are accepted, no release blocker remains, rollback is documented, and the remaining step is approval for a tightly controlled canary. This status does not authorize the canary.

`READY_FOR_LIVE_CUTOVER_APPROVAL`

Use only when all Day-One requirements are met, exact staging and required canary evidence already exist and pass, production configuration decisions are exact, the operator runbook and rollback procedure are approved, and the only remaining step is explicit live-cutover authorization. This status does not authorize cutover.

Do not select a higher category based on assumptions, future work, unverified provider configuration, or an unexecuted environment.

DEFINITION OF DONE

OT-68 is complete only when:

- the prerequisite gate passed;
- one isolated branch was used;
- every dependency is explicitly included with an accepted SHA or explicitly excluded;
- every discovered route is classified;
- every visible action is registered;
- every visible action has positive and negative tests;
- action coverage has zero uncovered controls;
- no dead, duplicate, unauthorized, or misleading controls remain;
- excluded features are not exposed as clickable actions;
- the complete synthetic journey passes or the task is classified `NOT_READY`;
- School signup remains lead-only;
- bootstrap plan/apply/verify/rerun/rollback behavior is proven on disposable data;
- no real users or provider objects were created;
- PostgreSQL 16 fresh and upgrade migrations pass;
- concurrency and isolation tests pass;
- accessibility and responsive requirements pass;
- 30-sample performance evidence exists;
- web and worker source-SHA readback matches the final commit;
- no BNA runtime fanout exists;
- secret, PII, provider-ID, and provider-URL scans pass;
- `git diff --check` passes;
- the draft PR is open and unmerged;
- the final recommendation is one exact permitted category.

FINAL RESPONSE FORMAT

Return a concise execution report with these headings:

1. `OT-68 RESULT` — one exact release category.
2. `PREREQUISITE GATE` — manifest status and exact non-sensitive SHAs.
3. `BRANCH AND DRAFT PR` — branch, base SHA, head SHA, and draft PR reference.
4. `IMPLEMENTED GLUE` — small integrations completed.
5. `REMOVED OR HIDDEN CONTROLS` — dead, duplicate, unauthorized, or excluded actions.
6. `ACTION AND ROUTE COVERAGE` — exact totals and zero-coverage assertion.
7. `SYNTHETIC DAY-ONE JOURNEY` — pass/fail by major step.
8. `BOOTSTRAP` — plan/apply/verify/rerun/rollback results.
9. `DATABASE AND CONCURRENCY` — fresh, upgrade, isolation, and concurrency results.
10. `SECURITY AND DATA-HANDLING` — scan and authorization results.
11. `ACCESSIBILITY AND RESPONSIVE` — viewport, keyboard, RTL, reflow, and automated results.
12. `PERFORMANCE` — 30-sample p50/p75/p95 and budgets.
13. `WEB, WORKER, AND SOURCE SHA` — health and exact readback.
14. `EXCLUSIONS, BLOCKERS, AND RESIDUAL RISKS`.
15. `RELEASE BOUNDARY CONFIRMATION` — confirm no merge, deploy, infrastructure mutation, production migration, real-user creation, invite, external send, charge, or provider activation occurred.

Do not include passwords, tokens, contact details, class links, provider URLs, provider IDs, payment identifiers, production data, or synthetic fixture identities in the final response.
