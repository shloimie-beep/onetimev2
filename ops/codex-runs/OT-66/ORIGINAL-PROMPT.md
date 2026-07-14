OT-66 — GENERATE ROLE-SCOPED ONE TIME HELPERS, A TYPED ACTION GATEWAY, AND GROUNDED CLASS-KNOWLEDGE RETRIEVAL

AUTHORITATIVE DIRECTIVE

This execution prompt implements the OT-66 directive supplied by the director. Preserve its authorization, privacy, grounding, confirmation, audit, verification, and completion requirements without weakening them. :contentReference[oaicite:0]{index=0}

ROLE

You are the senior engineer responsible for implementing OT-66 in the standalone One Time repository.

You own the complete implementation, verification, sanitized evidence, scoped commits, branch publication, and draft pull request for:

1. The owner/administrator operational helper.
2. The authenticated parent helper.
3. The authenticated student helper.
4. A shared server-side, typed, allowlisted action gateway.
5. An asynchronous retrieval/index projection over approved One Time class content.
6. A grounded class-answering path with server-validated citations.
7. Preview, confirmation, idempotency, optimistic-concurrency, audit, retention, rate-limit, and rollback controls.
8. Shared accessible helper UI components integrated separately into the accepted owner/admin, parent, and student shells.

This is not a general agent platform. It is not an omniscient chatbot. It is not a BNA runtime port. It is not a Telegram implementation. It is not an open-web or general Torah-answering system.

Complete the work in the current execution window. Do not ask for this prompt to be returned, expanded, rewritten, approved again, or repackaged.

REPOSITORY

Repository:

webcraft-media/onetimev2

MANDATORY PARAMETERS

The following placeholders must be replaced with exact, director-approved values before execution:

- OT-60 converged head:
  `{{ACCEPTED_OT60_CONVERGED_HEAD_SHA}}`
- Complete accepted OT-42 CRM head:
  `{{ACCEPTED_OT42_COMPLETE_CRM_HEAD_SHA}}`
- Accepted OT-43 classes and fulfillment head:
  `{{ACCEPTED_OT43_CLASSES_FULFILLMENT_HEAD_SHA}}`
- Accepted OT-47 content-library head:
  `{{ACCEPTED_OT47_CONTENT_LIBRARY_HEAD_SHA}}`
- Accepted OT-52 parent/student portals head:
  `{{ACCEPTED_OT52_PARENT_STUDENT_PORTALS_HEAD_SHA}}`
- Exact director-approved OT-66 construction base:
  `{{DIRECTOR_APPROVED_OT66_BASE_SHA}}`
- Approved server-side AI/provider operating mode:
  `{{APPROVED_SERVER_AI_PROVIDER_MODE}}`
- Approved helper model and budget policy:
  `{{APPROVED_HELPER_MODEL_POLICY}}`
- Approved prompt, response, conversation, audit, and child-data retention policy:
  `{{APPROVED_RETENTION_POLICY}}`

Treat the values as immutable execution inputs. Do not infer, shorten, substitute, “best guess,” or silently update any of them.

OT-65 is optional. Detect it only from accepted commits and evidence contained in the approved base. Do not infer OT-65 acceptance from an OT-46 fixture branch, a PR title, billing tables, or provider configuration.

Telegram is optional and is not a prerequisite. A later Telegram surface may call the same accepted application action gateway, but OT-66 must not own Telegram webhooks, polling, updates, identity mappings, leases, transport, callbacks, or worker topology.

NON-NEGOTIABLE STOP GATES

Stop before editing any file if any condition below is true.

Use the listed stop code in the terminal report and final response. Do not work around a failed gate.

1. `STOP_OT66_PLACEHOLDER_UNRESOLVED`
   - Any mandatory placeholder still contains `{{`, `}}`, an empty string, a sample value, or ambiguous prose.
   - Any SHA placeholder is not an exact 40-character hexadecimal commit SHA.
   - The provider mode, model policy, or retention policy is unclear or internally contradictory.

2. `STOP_OT66_WRONG_REPOSITORY`
   - The repository is not `webcraft-media/onetimev2`.
   - The remote resolves to a different owner or repository.
   - Validating the remote would require printing a credential-bearing URL.

3. `STOP_OT66_DIRTY_SOURCE_WORKTREE`
   - The source checkout has tracked, staged, untracked, conflicted, or ignored task artifacts before work begins.
   - Do not stash, reset, checkout over, clean, remove, or overwrite anything.

4. `STOP_OT66_BASE_MISMATCH`
   - The checked-out source HEAD is not exactly `{{DIRECTOR_APPROVED_OT66_BASE_SHA}}`.
   - Do not switch or reset the source checkout to repair this.

5. `STOP_OT66_COMMIT_MISSING`
   - Any mandatory accepted SHA cannot be resolved locally after a safe fetch.

6. `STOP_OT66_ACCEPTED_HEAD_NOT_CONTAINED`
   - The approved OT-66 base does not contain all mandatory accepted OT-42, OT-43, OT-47, OT-52, and OT-60 heads.

7. `STOP_OT66_OT60_NOT_CONVERGED`
   - The accepted OT-60 commit does not itself contain the accepted OT-42, OT-43, OT-47, and OT-52 heads.
   - The base merely contains parallel branches without an accepted reconciliation.
   - Central auth, role, route, shell, migration, worker, or ownership conflicts remain unresolved.

8. `STOP_OT66_FOUNDATION_DRIFT`
   - The accepted migration ledger, role/capability model, API namespace, auth/session behavior, MFA requirements, class/content ownership, guardian/household/learner model, entitlement rules, portal shell, support seam, worker composition, or application-service interfaces differ materially from the accepted evidence without an explicit reconciliation decision.

9. `STOP_OT66_OWNERSHIP_COLLISION`
   - Another branch or accepted task owns the same helper routes, action-gateway roots, confirmation tables, index migrations, support-ticket integration, browser helper components, or central composition files.
   - The collision does not have an explicit accepted reconciliation decision.

10. `STOP_OT66_MIGRATION_NAMESPACE_UNRESOLVED`
    - The accepted migration ledger does not reserve an exact migration ID or range for OT-66.
    - Do not invent a migration number.

11. `STOP_OT66_REAL_POSTGRESQL_UNAVAILABLE`
    - No safe disposable non-production PostgreSQL database is available for migration, concurrency, transaction, invalidation, isolation, index-freshness, and performance verification.
    - Never substitute production, Railway production, a live One Time database, a BNA database, or another task’s shared database.
    - `pg-mem` is supplementary only and cannot satisfy this gate.

12. `STOP_OT66_UNSAFE_PROVIDER_ARCHITECTURE`
    - Execution would require a browser AI credential, client-direct provider request, arbitrary HTTP client, open-web search, shell tool, database-query tool exposed to a model, filesystem tool exposed to a model, code execution, arbitrary URL retrieval, recursive agent loop, or unrestricted tool invocation.

13. `STOP_OT66_PROVIDER_CONTRACT_UNPROVEN`
    - Provider-backed inference is required by the approved mode but the accepted base has no server-only provider abstraction or the approved policy does not identify an exact supported provider/model/configuration contract.
    - Do not reuse a transcription, BNA, Studio, or unrelated-product key by assumption.

14. `STOP_OT66_RETENTION_POLICY_UNRESOLVED`
    - The retention directive does not determine whether raw prompts, responses, conversation state, child data, confirmations, and audit metadata may be stored and for how long.
    - Defaulting to indefinite retention is prohibited.

15. `STOP_OT66_SUPPORT_OWNERSHIP_UNRESOLVED`
    - An accepted support/task system exists, but it is unclear whether OT-66 should call it, adapt it, or leave support creation unavailable.
    - Do not create a competing ticket platform.

16. `STOP_OT66_UNSAFE_DATABASE_TARGET`
    - The database target is unapproved, appears production-like, contains real child/household/CRM data, or cannot be positively identified as disposable synthetic test infrastructure.

17. `STOP_OT66_WORKTREE_OR_BRANCH_EXISTS`
    - The intended OT-66 branch or worktree path already exists locally or remotely.
    - Do not reuse or delete it.

When a pre-worktree gate fails, make no repository changes. Print a concise checkpoint containing the stop code, failed predicate, observed SHA or path where safe, and exact unblock condition.

If a hard gate fails after scoped work has legitimately begun, preserve the clean scoped work, write a sanitized checkpoint under `ops/evidence/ot-66/`, commit only if doing so preserves a useful non-misleading checkpoint, and stop. Never weaken authorization, privacy, grounding, confirmation, or evidence standards to finish.

PROMPT-GENERATION AUDIT SNAPSHOT — ORIENTATION ONLY

The following facts were observed during prompt generation on July 14, 2026. They are not substitutes for the mandatory future audit and must not be treated as accepted completion evidence:

- `main` exposed only the initial foundation commit:
  `610b585f3d221addd4e7b824c92a5cc256cffcf9`.
- Relevant work was distributed across open draft branches rather than one accepted convergence head.
- The observed OT-39 shell/privacy lane ended at:
  `c1584577780d7b5125bce4fb81d2a454c9e84096`.
- The observed isolated OT-42 CRM module ended at:
  `b2c159a060d8aa50ec6feb69f1cae003fd633bf3`.
- The observed MFA/security lane ended at:
  `245649523566a7a0ace493ba70ede2a405ebdcce`.
- The observed OT-47 branch ended at:
  `9444176dbc55e0c5af048ec1df2ea75ffa8dde33`,
  but contained evidence only and no content-library runtime because real PostgreSQL was unavailable.
- The observed fixture-only billing branch ended at:
  `f4e4fb1dc202f8b17bbf1747c82ae3b0c1c5c899`.
- The observed mock-only Telegram branch ended at:
  `e235af05759f0a97496552c6e8aabed7ba3eee18`.
- No OT-43, OT-52, OT-60, or OT-65 branch, PR, or issue was discoverable in that graph.
- The shell/CRM lane and MFA-hardening lane diverged from the CRM core and therefore required real convergence rather than branch-name assumptions.
- No AI SDK or accepted helper-provider abstraction was present in the observed root `package.json`.
- The repository used Node 24, TypeScript, Express 5, React 19, Vite, Zod, `pg`, Pino, forward-only checksummed SQL migrations, and an existing worker process.
- Current conventions included server-derived account/product scope, same-origin no-store APIs, session-family and security-version validation, CSRF, TOTP for privileged roles, idempotency, strong versions/ETags, parameterized SQL, and separate public/authenticated bundles.

The future accepted base is authoritative. If it differs, record the difference and follow the accepted architecture only where the difference is explicitly reconciled.

LOCKED PRODUCT PURPOSE

One Time has separate role-scoped helpers, not one omniscient chatbot.

The browser sends an authenticated request to One Time. One Time:

1. Authenticates the existing One Time session.
2. Resolves the role and relationship scope on the server.
3. Builds an allowlist of capabilities and actions for that exact principal.
4. Retrieves only currently authorized evidence.
5. Calls an approved server-side model adapter only when enabled.
6. Validates every structured model result.
7. Reauthorizes every application read or write.
8. Executes accepted application services rather than duplicating business logic.
9. Validates citations against the exact evidence used.
10. Redacts and constrains the returned DTO.

A helper never gains a capability because:

- a model requests it;
- a prompt mentions it;
- a browser sends an identifier;
- a UI control is hidden or shown;
- a user guesses an opaque ID;
- a retrieved transcript contains an instruction;
- a provider returns a tool call;
- a sibling, learner, household, contact, customer, class, or source identifier exists.

ORDINARY APPLICATION INDEPENDENCE

The CRM, class, content-library, owner/admin shell, parent portal, student portal, billing, support, public pages, authentication, and ordinary navigation must remain usable when:

- provider-backed inference is disabled;
- the provider times out;
- the provider circuit breaker is open;
- embedding/index processing is delayed;
- indexing is disabled;
- the retrieval store is unavailable;
- the helper is rate-limited;
- the helper feature flags are off.

No ordinary route may synchronously wait for transcription, chunking, embedding, index repair, provider reconciliation, or model generation.

BNA AND EXTERNAL-SYSTEM BOUNDARY

Do not modify the BNA application.

Do not copy or depend on:

- BNA `server.js`;
- BNA Operations;
- BNA session or cookie behavior;
- BNA commercial percentages;
- BNA workspace identifiers;
- BNA Studio prompts;
- BNA agent fleets;
- BNA memory systems;
- BNA broad migrations;
- hidden BNA content corpora;
- provider credentials from BNA;
- generated Operations assets;
- unrestricted legacy provider clients.

Legacy BNA helper, parsing, content-pipeline, and action code may be inspected as read-only behavioral evidence only.

Standalone One Time owns its helper runtime. Approved content outcomes may arrive through the accepted OT-47 asynchronous seam. Ordinary helper requests must not call BNA.

PHASE 0 — SAFE PREFLIGHT IN THE EXISTING SOURCE CHECKOUT

Do not edit during this phase.

A. Resolve parameters into local shell variables without printing secrets

Use names equivalent to:

- `OT60_SHA`
- `OT42_SHA`
- `OT43_SHA`
- `OT47_SHA`
- `OT52_SHA`
- `BASE_SHA`
- `PROVIDER_MODE`
- `MODEL_POLICY`
- `RETENTION_POLICY`

Validate all SHA values with:

`^[0-9a-fA-F]{40}$`

Reject unresolved brace syntax.

Do not echo provider credentials, database URLs, signing keys, model keys, retention secrets, or full remote URLs.

B. Verify repository and source cleanliness

Run read-only checks equivalent to:

- `git rev-parse --show-toplevel`
- `git rev-parse --is-inside-work-tree`
- `git status --porcelain=v1 --untracked-files=all`
- `git diff --check`
- `git rev-parse HEAD`

Validate the sanitized remote identity without printing embedded credentials. The normalized repository must end in `webcraft-media/onetimev2` or `webcraft-media/onetimev2.git`.

The source status must be completely empty.

The current source HEAD must equal `BASE_SHA`.

Do not use:

- `git reset`;
- `git clean`;
- `git stash`;
- `git checkout --`;
- `git restore`;
- forced branch movement;
- deletion of an existing worktree;
- deletion of an existing branch.

C. Fetch safely

After confirming the source checkout is clean, run:

- `git fetch --all --prune --tags`

Do not fetch or inspect a credential-bearing URL in a way that writes it to evidence or logs.

D. Verify commit existence

For each mandatory SHA, require:

- `git cat-file -e "$SHA^{commit}"`

E. Verify convergence and containment

Require all of the following to succeed:

- `git merge-base --is-ancestor "$OT42_SHA" "$OT60_SHA"`
- `git merge-base --is-ancestor "$OT43_SHA" "$OT60_SHA"`
- `git merge-base --is-ancestor "$OT47_SHA" "$OT60_SHA"`
- `git merge-base --is-ancestor "$OT52_SHA" "$OT60_SHA"`
- `git merge-base --is-ancestor "$OT60_SHA" "$BASE_SHA"`
- `git merge-base --is-ancestor "$OT42_SHA" "$BASE_SHA"`
- `git merge-base --is-ancestor "$OT43_SHA" "$BASE_SHA"`
- `git merge-base --is-ancestor "$OT47_SHA" "$BASE_SHA"`
- `git merge-base --is-ancestor "$OT52_SHA" "$BASE_SHA"`

Record merge-base results without claiming acceptance from commit messages alone.

F. Inspect the graph and accepted evidence

Inspect:

- `git log --graph --decorate --oneline --all`
- commit metadata for each accepted SHA;
- changed-file lists between each accepted head and OT-60;
- changed-file lists between OT-60 and the approved base;
- `ops/evidence/ot-42/**`;
- `ops/evidence/ot-43/**`;
- `ops/evidence/ot-47/**`;
- `ops/evidence/ot-52/**`;
- `ops/evidence/ot-60/**`;
- optional `ops/evidence/ot-65/**`;
- applicable acceptance manifests or reconciliation reports.

Do not trust a final-report claim if source, migration, test, or containment evidence contradicts it.

G. Inspect repository instructions

Before writing anything, read:

- the repository-root `AGENTS.md`;
- every nested `AGENTS.md` applicable to a file that OT-66 may touch;
- `README.md`;
- current integration manifests;
- relevant package scripts;
- current CI workflows;
- current migration runner;
- current test configuration.

If nested instructions conflict with this prompt or accepted architecture, stop and report the conflict.

H. Inspect the migration ledger

Enumerate and hash every migration in the accepted base.

Inspect:

- `packages/db/migrations/**`;
- the migration runner;
- `onetime.schema_migrations` behavior;
- reserved migration namespaces in accepted task evidence;
- all branches that mention an OT-66 migration or helper/index migration.

Determine the exact OT-66 migration ID from an accepted reservation. Do not select the next apparent number merely because it is unused.

I. Verify disposable PostgreSQL

Before implementing schema or repositories:

- Confirm `DATABASE_URL` is present without printing it.
- Confirm it is explicitly authorized for OT-66 synthetic testing.
- Query only safe identity information such as server version and current database name.
- Reject names, hosts, schemas, or contents that suggest production, live, BNA, Railway production, or real customer data.
- Run the accepted migration verification command.
- Record only a safe database fingerprint, PostgreSQL major version, and synthetic-test designation.

Do not create a database, alter a shared environment, or connect to a live service by assumption.

PHASE 1 — READ-ONLY FOUNDATION AND COLLISION AUDIT

Complete this audit before creating the OT-66 worktree.

1. Authentication and session audit

Map the exact accepted implementations for:

- session-cookie name and settings;
- session lookup;
- session expiry;
- session-family or security-version invalidation;
- credential-version invalidation;
- account/product scope;
- role resolution;
- MFA assurance;
- CSRF verification and rotation;
- logout and protected-state purge;
- suspended/disabled users;
- rate limiting;
- no-store behavior;
- error envelopes;
- safe return paths;
- audit-event conventions.

Privileged owner/admin helper access must preserve accepted MFA requirements.

Parent and student helpers must use accepted OT-52 authentication and session behavior. Do not add parent/student roles to an old owner/admin enum if OT-52 uses a different principal model.

2. Role, capability, and relationship audit

Map the authoritative accepted types and services for:

- owner;
- administrator;
- any other staff role;
- parent/guardian;
- household;
- learner;
- student-session principal;
- membership;
- enrollment;
- entitlement;
- suspension;
- account/product scope;
- learner-to-household and guardian-to-household relationships;
- a student session’s single learner binding;
- security/session versioning.

Determine whether capabilities are:

- role-derived;
- membership-derived;
- policy-derived;
- server-issued;
- stored;
- calculated by application services.

Do not use temporary browser role fallbacks.

3. CRM and task audit

Map accepted OT-42:

- capability vocabulary;
- contact lookup service;
- safe overview projection;
- lead/sign-up projection;
- tags;
- tasks;
- status fields;
- opaque IDs;
- ETags or resource versions;
- idempotency;
- optimistic concurrency;
- audit hooks;
- redaction;
- API routes;
- application-service ports.

Determine which operations are actually complete and mounted. An unmounted interface or fixture does not make a helper action available.

4. Class and fulfillment audit

Map accepted OT-43:

- class;
- occurrence;
- enrollment;
- entitlement;
- next-class calculation;
- access status;
- reminder/delivery status;
- protected destination;
- learner-class relationship;
- attendance and private fields;
- occurrence versions;
- authoritative timezone behavior;
- cancellation/rescheduling;
- delivery truth states.

The helper must not claim a reminder or access delivery occurred unless accepted fulfillment data proves it.

5. Content-library audit

Map accepted OT-47:

- canonical content records;
- artifact kinds;
- source versions;
- approval versions;
- lifecycle states;
- publication states;
- class-occurrence references;
- transcript and review-sheet structures;
- protected destination resolution;
- entitlement checks;
- approved metadata;
- correction/replacement events;
- unpublish/archive events;
- worker registration;
- provider-neutral interfaces;
- audit events;
- current feature flags.

ClassOccurrenceReference or its successor must remain opaque and scoped.

6. Parent/student portal audit

Map accepted OT-52:

- owner/admin shell;
- parent shell;
- student shell;
- route entry points;
- shared design tokens;
- parent household context;
- learner summaries;
- student single-learner session;
- access-reset flow;
- progress/reward APIs;
- protected navigation;
- logout/session-expired behavior;
- mobile and accessibility conventions;
- bundle composition.

7. Support audit

Find the accepted support or task system and identify:

- ticket/application-service interface;
- requester ownership;
- account/product fields;
- household/learner/contact context;
- status and priority policy;
- idempotency;
- confirmation;
- audit;
- diagnostics allowlist;
- API route;
- test fixtures.

If no accepted support system exists, OT-66 may add only a typed support port, a deterministic fixture/sink adapter, UI states, and tests. Do not add a second production ticket database or workflow.

8. Billing audit

Search for accepted OT-65.

OT-65 is considered present only when:

- an exact accepted OT-65 commit is contained in the base;
- its acceptance evidence is present;
- its parent/household billing authorization is explicit;
- it exposes a bounded safe summary application service.

An OT-46 fixture-only billing branch is insufficient.

If OT-65 is absent or ambiguous:

- omit the live billing action from the registry;
- answer billing questions with static approved portal guidance;
- offer the confirmed support path;
- never infer subscription, invoice, entitlement, delinquency, payment, or customer status.

9. Telegram/action audit

If accepted Telegram/action code exists, inspect its application adapter, preview, confirmation, idempotency, and security-version behavior.

Reuse stable application/action abstractions only when accepted.

Do not reuse or own:

- Telegram identity mappings;
- bot-specific principals;
- webhook handlers;
- update normalization;
- callback data;
- polling;
- consumer leases;
- transport;
- chat context;
- worker ingress.

10. Provider audit

Find any accepted server-side AI/provider abstraction.

Determine:

- exact provider mode;
- exact SDK and installed version;
- server-only config names;
- generation model policy;
- embedding model policy;
- timeout and retry policy;
- request and output limits;
- structured-output support;
- cancellation support;
- data-retention configuration;
- telemetry;
- cost accounting;
- circuit breaker;
- test/fake adapters.

If an SDK or API contract is used, verify behavior against current official provider documentation. Record:

- official documentation title;
- access date;
- exact SDK version;
- exact API feature used;
- structured-output behavior;
- timeout/cancellation behavior;
- retention/privacy configuration;
- known limitations.

Use official provider documentation only for provider engineering. This does not authorize open-web retrieval for class answers.

11. Existing helper/index audit

Search all refs and the approved tree for:

- helper;
- assistant;
- chatbot;
- AI;
- RAG;
- embedding;
- vector;
- chunk;
- knowledge index;
- citation;
- action gateway;
- tool registry;
- confirmation proof;
- support ticket;
- prompt policy;
- model adapter.

Classify each match as:

- accepted and active;
- accepted but disabled;
- provisional;
- fixture-only;
- legacy;
- abandoned;
- evidence-only;
- conflicting ownership.

12. File and route collision audit

Inspect all refs for ownership of:

- `/api/v1/helper*`;
- `/api/v1/helpers*`;
- any accepted successor namespace;
- browser helper routes;
- helper components;
- action registries;
- confirmation tables;
- helper audit tables;
- retrieval/index tables;
- content event consumers;
- support routes;
- worker composition;
- migration IDs;
- config names;
- root package files;
- central barrels;
- Vite entry points;
- AppShell/navigation files.

If two branches own the same route or root, stop unless OT-60 explicitly reconciles them.

PHASE 2 — CREATE A FRESH DEDICATED WORKTREE AND BRANCH

Only proceed after every preflight and audit gate passes.

Use:

- Branch:
  `codex/ot66-role-scoped-helpers-action-gateway-class-rag`
- A new sibling worktree path equivalent to:
  `../onetimev2-ot66-role-scoped-helpers`

Before creation, verify:

- the path does not exist;
- the local branch does not exist;
- the remote branch does not exist;
- no worktree already references the branch;
- `BASE_SHA` remains unchanged.

Create it directly from the exact approved SHA:

`git worktree add -b codex/ot66-role-scoped-helpers-action-gateway-class-rag ../onetimev2-ot66-role-scoped-helpers "$BASE_SHA"`

Then:

- enter the new worktree;
- verify `git rev-parse HEAD` equals `BASE_SHA`;
- verify the worktree is clean;
- reread root and applicable nested `AGENTS.md`;
- install dependencies with the accepted lockfile command;
- run the accepted base verification suite before editing;
- build and record base bundle/request/performance baselines;
- run real PostgreSQL migration verification.

Do not create or push an immutable anchor branch unless an accepted repository instruction explicitly requires it.

BASELINE FAILURE RULE

If the exact approved base fails a mandatory test:

- confirm the failure is reproducible without changes;
- record the exact command and sanitized output;
- determine whether it is an accepted documented baseline exception;
- do not silently classify a new failure as pre-existing;
- do not mass-format or modify unrelated files;
- stop if the failure prevents reliable OT-66 verification.

PHASE 3 — WRITE THE DISCOVERED OWNERSHIP PLAN BEFORE PRODUCT CODE

Create sanitized evidence under:

`ops/evidence/ot-66/`

Start with:

- `PREFLIGHT.md`
- `AUDIT-INVENTORY.md`
- `ACCEPTED-HEAD-CONTAINMENT.md`
- `COLLISION-MAP.md`
- `OWNERSHIP-PLAN.md`
- `ARCHITECTURE-DECISION.md`
- `MIGRATION-PLAN.md`
- `PROVIDER-AND-RETENTION-DECISION.md`

Do not include credentials, database URLs, private data, raw prompts, provider payloads, or real user identifiers.

The ownership plan must contain a discovered allowed/forbidden table.

Seed it with the following expectations, then correct it to match the accepted base:

| Path or area | Default OT-66 status | Conditions |
| --- | --- | --- |
| `packages/contracts/src/helpers/**` | Allowed | Use only if no accepted helper root already exists. |
| `packages/domain/src/helpers/**` | Allowed | Domain policy, orchestration, gateway, grounding, redaction, confirmation contracts. |
| `packages/db/src/helpers/**` | Allowed | Scoped repositories only; no duplicate business services. |
| `apps/web/src/server/helpers/**` | Allowed | Router, server adapters, composition hook. |
| `apps/web/src/client/app/helpers/**` | Allowed | Shared helper component family and role wrappers. |
| `apps/worker/src/helpers/**` | Allowed | Index worker hook only if accepted worker composition permits it. |
| One accepted OT-66 migration | Conditional | Exact ID must come from the accepted ledger. |
| `tests/unit/**ot66**` or accepted helper test root | Allowed | Deterministic tests. |
| `tests/integration/**ot66**` | Allowed | Real service and PostgreSQL tests. |
| `tests/e2e/ot-66/**` | Allowed | Browser journeys. |
| `tests/accessibility/ot-66/**` | Allowed | Accessibility matrix. |
| `tests/performance/ot-66/**` | Allowed | Bundle, request, retrieval, and non-AI performance. |
| `ops/evidence/ot-66/**` | Allowed | Sanitized evidence only. |
| Central server composition | Conditional | Only the accepted OT-60 integration file, with no ownership collision. |
| Central worker composition | Conditional | Only to register the accepted asynchronous index worker. |
| Accepted shell/navigation files | Conditional | Only where OT-52 explicitly assigns integration ownership. |
| `packages/config/src/index.ts` or accepted config root | Conditional | Add only disabled-by-default helper config. |
| Central package barrels | Conditional | Prefer direct imports; edit only if accepted architecture requires it. |
| Root `package.json` and lockfile | Conditional | Only for an approved server SDK or required scripts; no browser AI dependency. |
| Existing migrations | Forbidden | Never modify an applied migration. |
| BNA files or repository | Forbidden | Read-only evidence only. |
| Telegram ingress/runtime files | Forbidden | OT-66 does not own Telegram. |
| Billing internals | Forbidden | Consume an accepted OT-65 safe port only. |
| Class/content business logic | Forbidden | Reuse accepted services; do not duplicate. |
| CRM/task business logic | Forbidden | Reuse accepted OT-42 services. |
| Auth/session runtime | Forbidden | Reuse accepted auth. |
| Deployment/Railway/DNS | Forbidden | No deployment or infrastructure activation. |
| Production provider configuration | Forbidden | No live enablement by assumption. |
| Workflows | Forbidden by default | Edit only when explicit OT-60 ownership and required deterministic CI cannot otherwise run. |
| Public landing/signup bundles | Forbidden | No helper or React/provider imports into public pages. |

Every conditional central edit must be justified in `OWNERSHIP-PLAN.md` with:

- accepted owner;
- current file path;
- reason;
- collision search;
- smallest possible diff;
- tests required;
- rollback.

LOCKED ARCHITECTURE

Implement a bounded server-side helper architecture with these components:

1. Helper principal resolver.
2. Role/capability policy resolver.
3. Typed action registry.
4. Typed application-service adapters.
5. Confirmation service.
6. Retrieval/index gateway.
7. Grounded-response validator.
8. Server-only provider adapter.
9. Per-role response redaction.
10. Minimal audit and usage accounting.
11. Rate limits, budgets, timeouts, cancellation, bounded retries, and circuit breaker.
12. Deterministic fake/sink adapters.
13. Shared browser component family with separate server policies.
14. Asynchronous index worker integration.
15. Independent feature flags and rollback.

Dependency direction must remain:

contracts → domain policy/orchestration → database and accepted application adapters → server router/worker composition → browser UI

The domain layer must not import:

- Express;
- React;
- provider SDK internals;
- raw database clients;
- Telegram;
- BNA;
- browser APIs.

The browser must not import:

- provider SDKs;
- provider credentials;
- embedding clients;
- database code;
- server prompt text;
- action execution implementations.

BOUNDED ORCHESTRATION — NO UNRESTRICTED AGENT LOOP

Implement at most two provider stages for one user request:

Stage A — bounded intent plan

The provider may return a strict structured plan containing only:

- a supported response intent;
- zero to three registered read actions;
- at most one state-changing action proposal;
- at most one class-retrieval query;
- safe display-oriented arguments;
- no arbitrary tool names;
- no arbitrary identifiers;
- no URLs;
- no SQL;
- no file paths;
- no code;
- no account/product/household/learner override.

The server validates the plan against:

- the exact role policy;
- the exact action registry;
- strict Zod schemas;
- per-request budgets;
- server-resolved candidate references.

The server—not the model—resolves IDs, scope, relationships, entitlements, and current versions.

Stage B — bounded response generation

After validated reads/retrieval:

- the provider receives only redacted authorized results and approved evidence;
- it may return a strict response DTO;
- it may cite only server-issued request-local citation IDs;
- it may refer only to a validated action preview;
- it may not request additional actions;
- it may not recurse;
- it may not browse;
- it may not execute.

Maximum per request:

- two model calls;
- three read actions;
- one retrieval query;
- one state-change preview;
- no loops;
- no autonomous retries beyond the configured bounded provider retry;
- no parallel fan-out beyond a small fixed server limit;
- no background continuation after the HTTP request ends unless the accepted architecture explicitly uses an audited job.

Deterministic navigation, session help, feature explanation, and provider-unavailable responses should bypass the provider when possible.

HELPER PRINCIPAL

Create a server-derived principal type equivalent to:

- surface: `owner_admin`, `parent`, or `student`;
- account key;
- product key;
- authenticated user key;
- session key or safe session-family reference;
- current security/session version;
- role;
- auth assurance;
- server-issued capabilities;
- active/suspended status;
- optional guardian/household bindings for a parent;
- exactly one learner binding for a student;
- accepted membership/enrollment/entitlement context.

Rules:

- Never trust account, product, household, learner, guardian, contact, class, billing principal, or role from the browser.
- Never trust those values from the model.
- Parent scope is calculated from active server-proven guardian/household relationships.
- Student scope resolves to exactly one learner.
- A student API must not accept a learner selector.
- A parent may have multiple authorized learners only through accepted guardian relationships.
- Sibling-private data remains separately authorized; a household relationship is not blanket permission for private student questions.
- Suspended, disabled, expired, stale-version, or anonymous principals fail closed.

ROLE-SCOPED PRODUCT BEHAVIOR

A. Owner/administrator helper

Available only to the Rabbi owner and an accepted authorized One Time administrator.

Permitted, only when the accepted application capability exists:

- Locate a contact or lead within the caller’s One Time account/product.
- Return a safe CRM overview.
- Show recent signups and bounded lead/tag/task state.
- List tasks.
- Preview and, after confirmation, create an internal task.
- Preview and, after confirmation, update an internal task.
- Show the next class or bounded occurrence state.
- Show approved class access state.
- Show truthful reminder/delivery status.
- Show accepted content ingest, review, publication, or library status.
- Resolve an already-authorized internal upload/help destination by safe label.
- Explain navigation to an existing One Time feature.
- Preview and, after confirmation, create a support request.

Forbidden:

- provider credentials;
- raw database rows;
- arbitrary logs;
- webhook internals;
- BNA commercial terms;
- Studio prompts;
- agent fleets;
- Operations;
- hidden integrations;
- full raw CRM notes unless an accepted capability explicitly permits a bounded note view;
- raw class/provider links;
- another account or product;
- unrestricted messaging;
- payment/refund actions;
- access grants;
- credential actions;
- deployment, DNS, or integration mutation.

B. Parent helper

Available only through an authenticated accepted parent/guardian portal session.

Permitted:

- Show the next entitled class.
- Explain permitted class and library access.
- Show bounded summaries for the parent’s authorized learners.
- Explain the accepted student-access reset flow.
- Initiate a reset only if the accepted application service supports a safe initiation action and the registry marks it available.
- Never retrieve or display an existing credential.
- Explain current parent-portal features.
- Find entitled published review sheets or lessons.
- Show a household billing summary only through an accepted OT-65 safe capability.
- Preview and, after confirmation, create a support request.

Forbidden:

- another household;
- another guardian’s data;
- sibling-private questions or notes;
- private student questions;
- internal CRM notes;
- owner/admin controls;
- raw provider links;
- credential retrieval;
- arbitrary learner selection;
- billing information outside the authorized household;
- inferred billing status when OT-65 is absent.

C. Student helper

Available only through an authenticated student session resolved to exactly one learner.

Permitted:

- Show that learner’s next entitled class.
- Find an entitled published lesson or review sheet.
- Answer when the Rabbi discussed a topic, based only on approved class material.
- Answer what was taught, based only on approved class material.
- Show approved progress or reward information when accepted portal APIs permit it.
- Explain technical help.
- Preview and, after confirmation, create a safely scoped support request if the accepted support seam permits it.

Forbidden:

- selecting or inferring a sibling;
- selecting another learner;
- enumerating a household;
- owner/admin CRM;
- billing;
- internal notes;
- unpublished material;
- unentitled material;
- private questions;
- raw recordings;
- provider metadata;
- raw class URLs;
- general web or general Torah answers.

TYPED CAPABILITY AND ACTION REGISTRY

Create one versioned server-side registry.

Every entry must contain:

- stable action name;
- integer or semantic action version;
- user-facing safe label;
- action class: `read_only` or `state_changing`;
- allowed helper surfaces;
- required accepted capability;
- authoritative scope resolver;
- strict input schema;
- strict output schema;
- maximum result size;
- timeout;
- redaction policy;
- audit event name;
- whether preview is required;
- whether confirmation is required;
- idempotency strategy;
- optimistic-concurrency strategy;
- safe failure DTO;
- feature-flag dependency;
- application-service adapter;
- test fixture.

The model can propose only names and versions that the server supplied for the current principal.

The browser may not submit an action name that is not in the principal’s server-issued registry.

The registry must not accept arbitrary:

- account;
- product;
- household;
- guardian;
- learner;
- contact;
- Stripe customer;
- provider object;
- recipient;
- URL;
- SQL;
- file path;
- template;
- capability;
- shell command;
- database query;
- message destination.

INITIAL ACTION CANDIDATES

Audit and implement only candidates backed by an accepted application service. Missing services must result in an explicit unavailable state rather than a fabricated implementation.

Read-only candidates:

- `crm.contact.search.v1`
- `crm.contact.safe_overview.v1`
- `crm.signup.recent.v1`
- `crm.lead_status.summary.v1`
- `crm.tags.summary.v1`
- `crm.tasks.list.v1`
- `classes.next.v1`
- `classes.occurrence_status.v1`
- `classes.access_status.v1`
- `delivery.status.v1`
- `content.lifecycle_status.v1`
- `content.library.search.v1`
- `content.class_answer.v1`
- `navigation.destination.resolve.v1`
- `parent.learners.summary.v1`
- `parent.access_reset.guidance.v1`
- `student.progress.summary.v1`
- `billing.household.summary.v1`, only when accepted OT-65 proves it
- `support.capability.describe.v1`

Potential state-changing candidates:

- `crm.task.create.v1`
- `crm.task.update.v1`
- `parent.student_access_reset.initiate.v1`, only if accepted and safe
- `support.ticket.create.v1`

Do not register destructive, bulk, payment, refund, credential-retrieval, entitlement-change, provider, integration, deployment, DNS, unrestricted message, or external-recipient actions.

Do not make contact archive/reactivation, identity resolution, billing reconciliation, checkout, customer portal creation, webhook actions, or access grants available merely because an underlying service exists. They are outside OT-66 unless a later explicit directive adds them.

APPLICATION-SERVICE REUSE

Action handlers must call accepted application services or typed adapters around those services.

They must not:

- duplicate CRM queries;
- query class tables directly when an accepted class service exists;
- reproduce entitlement policy;
- reproduce billing policy;
- reproduce support ownership;
- reproduce content lifecycle logic;
- bypass service-level authorization;
- bypass domain events;
- bypass audit;
- update tables from a generic helper handler.

Database repositories owned by OT-66 may persist only helper-specific infrastructure such as:

- confirmation records;
- helper idempotency records where existing idempotency cannot be reused;
- minimal helper audit/usage data;
- retrieval/index projections and jobs;
- server-bound conversation state only when the retention policy permits it.

Do not create a second CRM, class service, content catalog, billing service, support system, identity system, household model, learner model, or generic agent platform.

CONFIRMATION PROTOCOL

Read-only actions may execute immediately only when their registry entry explicitly marks them safe.

Every state-changing action must follow this protocol:

1. The server resolves the principal and capability.
2. The server resolves target resources from accepted application services.
3. The server normalizes arguments.
4. The server reads the current resource version where applicable.
5. The server creates a non-sensitive human-readable preview.
6. The server creates a cryptographically random, opaque confirmation proof.
7. Only a hash of the proof is persisted.
8. The proof is short-lived and single-use.
9. The proof is bound to:
   - session or session family;
   - current security/session version;
   - authenticated user;
   - helper surface;
   - role/capability;
   - account;
   - product;
   - guardian/household/learner scope where applicable;
   - action name and version;
   - normalized argument digest;
   - target safe reference;
   - target resource version;
   - idempotency key;
   - issue time;
   - expiry;
   - random nonce.
10. The browser displays exactly what will change using safe display values.
11. The user explicitly confirms.
12. Confirmation uses CSRF and a fresh request idempotency key.
13. The server locks the confirmation record.
14. The server re-resolves the session, role, capability, account/product, relationships, entitlement, and current resource version.
15. The server verifies the normalized action digest.
16. The server atomically prevents duplicate execution.
17. The accepted application service executes.
18. The result or safe failure is persisted for idempotent replay.
19. Duplicate browser, model, network, or user retries return the stored result without repeating the action.

Implement a durable state machine equivalent to:

- `pending`
- `executing`
- `completed`
- `cancelled`
- `expired`
- `conflict`
- `failed_safe`

Handle service transaction boundaries carefully. Do not mark a proof permanently consumed before ensuring a retry cannot create an ambiguous duplicate. Prefer accepted service idempotency and a transactional execution record.

Confirmation expiry should be short, normally five minutes or less unless the accepted policy sets a stricter value.

A stale resource version returns a conflict preview or instructs the user to refresh. It does not silently apply to the latest version.

Cancellation, expiry, duplicate confirmation, stale session, changed security version, changed household relationship, changed entitlement, or changed target version performs no write.

API SURFACE

Use the accepted API namespace and server composition. If the accepted namespace remains `/api/v1`, use the following bounded routes unless an explicit OT-60 decision assigns different names:

1. `GET /api/v1/helpers/session`
2. `POST /api/v1/helpers/requests`
3. `POST /api/v1/helpers/confirmations/confirm`
4. `POST /api/v1/helpers/confirmations/cancel`

Do not put confirmation proofs, user questions, learner names, contact searches, billing data, or other sensitive values in URLs.

All routes must:

- be same-origin;
- require the accepted authenticated session;
- return `Cache-Control: private, no-store, max-age=0`;
- return `Pragma: no-cache`;
- vary appropriately on authenticated state;
- use accepted request IDs and error envelopes;
- apply strict body-size limits;
- use strict schemas;
- reject unknown fields;
- use CSRF for every POST;
- use per-role and per-account rate limiting;
- return no raw stack or provider error;
- purge protected browser state on 401/403 or session expiry.

Suggested request shape:

- version: `1`;
- message: bounded plain text;
- optional server-bound conversation token;
- optional allowlisted route key used only as non-authoritative UI context.

Maximum user message:

- 4,000 Unicode scalar values;
- no more than the accepted model-policy limit;
- total JSON body no more than 16 KiB unless accepted policy is stricter.

Suggested successful outcomes:

- `answer`
- `no_evidence`
- `action_preview`
- `action_completed`
- `partial`
- `provider_unavailable`
- `rate_limited`
- `permission_denied`
- `conflict`
- `session_expired`
- `support_unavailable`

The response DTO may contain:

- safe user-facing text;
- validated citations;
- a safe action preview;
- an opaque confirmation proof;
- safe retry information;
- protected relative in-product destinations;
- request ID;
- policy and action versions.

It must not contain:

- hidden prompt text;
- provider credentials;
- provider request/response bodies;
- model reasoning;
- internal database IDs where a safe reference exists;
- raw retrieved chunks;
- raw class/provider URLs;
- another role’s capabilities;
- server tool schemas;
- internal stack or SQL;
- unredacted logs.

Streaming is disabled by default.

Implement streaming only when `{{APPROVED_SERVER_AI_PROVIDER_MODE}}` and `{{APPROVED_HELPER_MODEL_POLICY}}` explicitly authorize it and the accepted provider adapter supports cancellation and structured final validation.

If streaming is enabled:

- stream only safe provisional text;
- do not stream unvalidated citations;
- do not execute or preview actions until the final structured response validates;
- abort provider work when the client disconnects;
- expose an accessible non-streaming fallback;
- preserve screen-reader usability;
- never leave a partial answer presented as completed.

CLASS-KNOWLEDGE BOUNDARY

The knowledge base is the Rabbi’s approved One Time class content.

It is not:

- the open web;
- a search engine;
- model memory;
- a generic Torah authority;
- unrestricted Sefaria;
- BNA’s hidden corpus;
- Studio output;
- unpublished transcripts;
- raw recordings;
- provider metadata;
- private student questions;
- CRM/support/household/payment data.

Eligible evidence must be:

- One Time-owned;
- current;
- published;
- approved;
- accepted by the OT-47 lifecycle;
- allowed for the current account/product;
- allowed for the caller’s entitlement;
- sanitized under the accepted moderation and consent policy.

Eligible fields may include only what the accepted content lifecycle actually persists and approves, such as:

- approved transcript text;
- approved review-sheet text;
- approved title;
- class date;
- occurrence reference;
- approved Rabbi-authored metadata;
- approved protected destination;
- an approved Sefaria source reference or excerpt already included in the class artifact.

The helper must not browse Sefaria. It may cite an approved Sefaria excerpt only as part of the retrieved class artifact.

If no authorized approved source supports an answer, return a plain no-evidence response such as:

“I did not find that in the available Rabbi class material.”

Offer only a bounded search refinement, protected library destination, or support path.

Do not fill gaps from the model’s background knowledge.

Every substantive class-content answer must include at least one validated citation.

ASYNC RETRIEVAL AND INDEX LIFECYCLE

Implement a versioned, idempotent, asynchronous projection triggered by the exact accepted OT-47 lifecycle events.

Do not invent event names if the accepted domain already defines them.

Semantic behavior must cover:

1. Approved publication
   - A published, approved, current artifact becomes eligible.
   - Eligibility starts only after the source transaction commits.
   - The index job is queued asynchronously.

2. Correction or source-version change
   - Build chunks for the new source and approval version.
   - Validate the complete replacement set.
   - Activate the new set atomically.
   - Retire the prior set.
   - Never serve a mixture of source versions as current.

3. Unpublish or archive
   - Mark the source ineligible immediately in the authoritative projection.
   - Queries must fail closed even before physical vector/chunk cleanup finishes.
   - Queue deterministic cleanup.

4. Entitlement change
   - Update or invalidate retrieval eligibility promptly.
   - Candidate selection and final citation validation must use current entitlement state.
   - Never depend only on stale chunk metadata.

5. Failed, review-needed, transcribing, or processing content
   - Never eligible.
   - Never searchable.
   - Never answerable.

6. Retry and dead letter
   - Index jobs have bounded attempts, leases, backoff, and safe failure codes.
   - Dead-letter state does not block ordinary application pages.
   - Repair is deterministic and auditable.

7. Rebuild
   - Support deterministic account/product-scoped rebuild from current accepted sources.
   - Do not serve stale or partially rebuilt content as current.
   - Rebuild must not require raw provider access.

Bind every indexed chunk to:

- account key;
- product key;
- canonical OT-47 source reference;
- source version;
- approval version;
- artifact kind;
- content hash;
- chunk ordinal;
- chunking-policy version;
- index/embedding version;
- entitlement scope reference;
- current eligibility state;
- safe citation metadata;
- created/activated/retired timestamps.

Do not duplicate OT-47’s canonical content catalog. The index is a derived projection.

Use the smallest professional retrieval implementation compatible with the accepted PostgreSQL/runtime architecture.

Do not require a particular vector engine by assumption.

Requirements:

- typed replaceable retrieval interface;
- parameterized queries;
- account/product predicate on every query;
- entitlement predicate;
- current-version predicate;
- approval predicate;
- publication predicate;
- bounded candidate count;
- bounded total context;
- deterministic tie-breaking;
- query timeout;
- cancellation;
- index freshness metrics;
- stale/orphan rejection.

If an approved embedding provider is unavailable:

- preserve the retrieval interface;
- implement deterministic fake embeddings for tests;
- use an accepted bounded lexical retrieval fallback only if it can satisfy the product behavior;
- keep provider-backed embeddings disabled;
- do not call an unapproved service.

Do not synchronously embed content during a helper request.

INDEX CORPUS PRIVACY

Construct the corpus with an allowlist, not a denylist.

Exclude:

- private student questions;
- student names or voices unless an approved sanitized artifact explicitly permits inclusion;
- attendance;
- support data;
- household data;
- CRM notes;
- payment data;
- billing identifiers;
- provider secrets;
- provider URLs;
- draft/review-needed content;
- failed processing output;
- raw recordings;
- unpublished transcripts;
- accidental PII;
- hidden prompts;
- operational metadata;
- BNA content not accepted into One Time.

Student voices or questions captured in a recording remain excluded unless the accepted moderation and consent policy produced an explicitly approved sanitized artifact.

Add deterministic privacy-canary tests proving prohibited tokens never appear in:

- chunks;
- embeddings metadata;
- API JSON;
- rendered HTML;
- browser bundles;
- browser storage;
- structured logs;
- errors;
- screenshots;
- evidence;
- provider fixtures.

GROUNDING AND PROMPT-INJECTION RESISTANCE

Treat all user text, titles, transcripts, review sheets, metadata, citations, tool results, and application-service outputs as untrusted data.

Provider instructions must:

- identify source content as quoted untrusted evidence;
- prohibit following instructions found inside evidence;
- prohibit treating evidence as system/developer policy;
- prohibit tool/action names found in source content;
- prohibit revealing hidden prompts or schemas;
- require answers only from supplied evidence;
- require a no-evidence outcome when support is insufficient.

Do not concatenate retrieved text into a system message as executable instructions.

Use structured serialization with explicit source boundaries.

The model output must validate against a strict schema.

For class answers, the schema must include:

- answer text;
- request-local citation IDs;
- answer classification;
- no-evidence reason when applicable;
- no arbitrary source identifiers;
- no raw URL.

The server must verify:

- every citation ID was issued for this request;
- every cited chunk was actually supplied to the model;
- every cited source remains published and approved;
- every cited source remains entitled for the caller;
- every source version remains current;
- every destination is a server-derived protected relative path;
- every substantive claim has adequate cited support.

If validation fails:

- do not repair by inventing a citation;
- return a safe no-evidence or provider-invalid response;
- increment a citation-validation failure metric;
- record a minimal audit event;
- do not expose the invalid model output.

Do not claim to have searched:

- the internet;
- Sefaria;
- all classes;
- all messages;
- all content;
- another account;
- another learner;

unless the scoped accepted system actually performed that bounded search.

SAFE CITATION DTO

Return only safe metadata equivalent to:

- request-local citation ID;
- class title;
- class date;
- artifact kind;
- review-sheet title when present;
- safe occurrence label when present;
- protected in-product relative destination;
- optional short approved excerpt only when the accepted product permits it.

Never return:

- Vimeo URL;
- Zoom URL;
- storage URL;
- provider object ID;
- raw recording location;
- signed URL;
- internal database key;
- another learner’s route;
- an inaccessible destination.

Before returning each citation, resolve the protected destination through the accepted server-side route service and recheck authorization.

PROVIDER ADAPTER

The provider adapter must be server-only.

It must expose bounded methods equivalent to:

- `planIntent`
- `generateGroundedResponse`
- `embedApprovedChunks`, only if approved
- `healthState`
- `usageSummary`

It must not expose arbitrary chat completion access to browser code or model-call sites throughout the application.

Configuration must include:

- provider mode;
- exact model policy version;
- exact prompt-policy version;
- input/output token ceilings;
- timeout;
- retry count;
- concurrency;
- circuit-breaker thresholds;
- cost bucket;
- retention/privacy mode;
- generation and embedding feature flags.

Rules:

- no provider key in a `VITE_` variable;
- no provider key in browser HTML or JavaScript;
- no provider key in API DTOs;
- no client-direct provider endpoint;
- no provider payload in standard logs;
- no real One Time content in ordinary CI;
- no real child, household, CRM, payment, or support data in staging evaluation;
- no assumption that a transcription provider is approved for generation;
- no assumption that a BNA key can be reused;
- no unrestricted provider HTTP tool.

Use dependency injection for deterministic fake adapters.

Ordinary CI must deny external AI network access.

If the approved provider mode is disabled or fixture-only:

- implement the full contracts, policies, UI states, fake adapters, and tests;
- leave provider inference off;
- do not install or call a live SDK unnecessarily;
- classify provider-backed evaluation as not performed.

If an approved SDK is added:

- use the exact current official server SDK;
- pin it through the accepted lockfile;
- record the package/version;
- verify structured outputs, abort behavior, retries, and retention controls;
- confirm it is absent from browser bundles;
- confirm it cannot be imported into public pages.

MODEL AND REQUEST BUDGETS

Implement the stricter of:

- `{{APPROVED_HELPER_MODEL_POLICY}}`; or
- the following engineering ceilings.

Ceilings:

- user input: 4,000 Unicode scalar values;
- one intent-planning call;
- one grounded-response call;
- zero recursive calls;
- up to three read actions;
- up to eight chunks;
- up to four unique sources;
- one state-change preview;
- no state-change execution from a model call;
- one bounded transient retry per provider stage;
- one overall request deadline;
- cancellation on client disconnect;
- no unbounded conversation history.

Configure per-role rate limits. Begin with conservative defaults unless the accepted policy is stricter:

- owner/admin: 30 helper requests per five minutes per user;
- parent: 20 per five minutes per user;
- student: 15 per five minutes per user;
- state-change previews: at most five per ten minutes per user;
- confirmations: at most five per ten minutes per user;
- account/product aggregate ceiling;
- small fixed concurrent-request ceiling.

Place limits in server configuration, not browser code.

Rate-limit responses must be truthful and include safe retry timing.

Circuit breaker:

- count provider failures without logging prompts;
- open after a bounded configured threshold;
- remain open for a short bounded interval;
- return `provider_unavailable`;
- preserve deterministic navigation/support guidance;
- never disable ordinary pages.

REDACTION

Create per-role response redaction and DTO validation.

Owner/admin redaction must remove:

- provider secrets;
- raw provider IDs/URLs;
- auth internals;
- hidden integrations;
- BNA data;
- unrestricted logs;
- full internal notes unless explicitly allowed;
- unrelated account/product data.

Parent redaction must remove:

- another household;
- sibling-private data;
- private student questions;
- internal CRM notes;
- owner/admin fields;
- unrelated billing;
- raw provider links;
- credentials.

Student redaction must remove:

- household controls;
- sibling data;
- other learner data;
- billing;
- internal notes;
- owner/admin data;
- unpublished/unentitled content;
- private questions;
- credentials.

Redact before provider calls and again before browser responses.

Do not rely on the model to redact.

SUPPORT-TICKET SEAM

Prefer the accepted support/task application service.

If present:

- add a typed adapter;
- do not query support tables directly;
- derive requester, account, product, role, household/learner/contact context, and route context on the server;
- show a sanitized preview;
- require confirmation;
- use idempotency;
- audit the safe outcome.

If absent:

- implement a `SupportTicketApplicationPort` or accepted equivalent;
- provide a deterministic fixture/sink adapter;
- present support creation as unavailable outside fixtures;
- offer the accepted ordinary contact/help path;
- do not add a second production ticket platform.

Allowlisted ticket fields may include:

- concise user-entered problem summary;
- safe role;
- safe account/product reference;
- optional safe household or learner reference derived by server;
- safe route key;
- app version;
- request ID;
- limited feature-state diagnostics;
- browser capability class if accepted.

Do not attach by default:

- full conversations;
- raw prompts or responses;
- retrieved chunks;
- credentials;
- provider payloads;
- private sibling/student data;
- payment data;
- full user agent;
- raw internal logs;
- screenshots;
- cookies;
- authorization headers.

RETENTION AND CONVERSATION STATE

Implement `{{APPROVED_RETENTION_POLICY}}` exactly.

At minimum:

- do not silently store complete child conversations indefinitely;
- do not use browser `localStorage`, `sessionStorage`, or IndexedDB for protected helper content;
- keep browser state in memory;
- purge it on logout, 401/403, session expiry, role/capability change, and explicit close if policy requires;
- never store raw prompts or responses in logs;
- never store raw provider payloads in audit;
- store confirmation proofs only as hashes;
- delete expired confirmations and conversation state according to policy;
- keep only the minimum audit fields needed for security and accountability.

If server-bound conversation continuity is permitted:

- use an opaque signed or random token;
- bind it to session, role, account/product, and security version;
- store only the minimum policy-approved context;
- enforce size and turn limits;
- expire it;
- reauthorize every turn;
- never let it carry authority or identifiers across a role/session change.

If raw conversation retention is prohibited:

- use request-local context only;
- return no durable conversation token;
- preserve only minimal audit classifications.

AUDIT AND OBSERVABILITY

Reuse accepted observability and audit infrastructure where it can safely represent helper events.

Otherwise add a narrowly scoped helper audit projection.

Record:

- request/correlation ID;
- account/product safe reference;
- helper surface;
- role;
- capability;
- action name/version;
- result class;
- confirmation state;
- safe target reference;
- citation safe references;
- latency buckets;
- token/cost bucket;
- provider outcome;
- policy versions;
- index version;
- no-evidence classification;
- unauthorized-attempt classification;
- idempotent replay;
- support escalation.

Do not record:

- raw prompt;
- raw response;
- full retrieved chunks;
- private question text;
- child name;
- contact email/phone;
- billing details;
- credentials;
- cookies;
- provider request/response body;
- model reasoning;
- arbitrary metadata returned by the model.

Extend Pino or accepted logger redaction for helper-specific fields.

Metrics must be account/product scoped without high-cardinality PII.

Provide metrics for:

- requests by role;
- success/failure/no-evidence;
- provider latency and failure;
- rate limits;
- circuit-breaker state;
- token/cost buckets;
- index queue depth;
- index freshness;
- stale candidate rejection;
- citation-validation failure;
- unauthorized access attempt;
- action preview;
- confirmation;
- cancellation;
- conflict;
- duplicate replay;
- support escalation.

BROWSER UI

Use one shared helper component family, with separate server-issued policies.

Do not implement one client-side role switcher.

Integrate:

- owner/admin helper into the accepted owner/admin shell;
- parent helper into the accepted parent portal;
- student helper into the accepted student portal.

Do not add BNA/Super Admin chrome.

Use accepted One Time design tokens:

- black/yellow primary identity;
- restrained ice/cyan accents where already accepted;
- readable high-contrast text;
- accepted typography and spacing.

The helper should lazy-load only after the user opens it.

Do not load:

- provider SDK;
- helper model policy;
- embeddings;
- large helper code;
- conversation data;

in public landing/signup bundles or ordinary portal routes before needed.

UI must clearly distinguish:

- informational answer;
- cited class answer;
- no evidence;
- read-only application result;
- proposed action;
- confirmation required;
- completed action;
- cancelled action;
- conflict;
- partial result;
- stale result;
- provider unavailable;
- rate limited;
- permission denied;
- session expired;
- offline;
- support unavailable.

Required states:

- empty;
- loading;
- optional streaming;
- retryable error;
- offline;
- rate limited;
- permission denied;
- session expired;
- no evidence;
- action preview;
- confirmation;
- success;
- cancelled;
- conflict;
- provider unavailable.

Accessibility requirements:

- keyboard-only operation;
- visible focus;
- proper dialog/panel semantics;
- screen-reader labels and announcements;
- focus restoration;
- no keyboard trap except a correctly implemented modal;
- Escape behavior;
- reduced motion;
- 200% reflow;
- logical RTL-safe CSS;
- no horizontal overflow;
- virtual-keyboard resilience;
- touch targets;
- readable names and headings;
- no color-only status;
- no auto-focus that obscures context on mobile;
- accessible confirmation details.

Validate at least:

- 360 × 800;
- 390 × 844;
- accepted tablet viewport;
- accepted desktop viewport.

Student UI must have no learner selector.

Parent UI may show only learners returned by the accepted guardian-scoped portal API.

No dead controls, duplicated navigation, fabricated typing indicators, generic “AI magic” claims, or claims that the system searched the internet.

FEATURE FLAGS

Add or map separate disabled-by-default flags equivalent to:

- `ENABLE_HELPER_INDEXING`
- `ENABLE_OWNER_ADMIN_HELPER`
- `ENABLE_PARENT_HELPER`
- `ENABLE_STUDENT_HELPER`
- `ENABLE_HELPER_READ_ACTIONS`
- `ENABLE_HELPER_STATE_CHANGING_ACTIONS`
- `ENABLE_HELPER_PROVIDER_INFERENCE`

Use accepted config naming conventions if OT-60 reserved different names.

Defaults:

- OFF outside explicitly approved test environments;
- fake/sink adapters in ordinary tests;
- no provider-backed inference by assumption;
- no state-changing actions by assumption;
- no indexing against real content by assumption.

Feature relationships:

- disabling inference does not disable ordinary pages;
- disabling writes retains read-only helper capabilities when enabled;
- disabling indexing prevents new index jobs and class retrieval but preserves ordinary content pages;
- role flags operate independently;
- provider mode cannot override role flags;
- browser flags are display hints only; server flags are authoritative.

ROLLBACK

Rollback is feature-flag and code based. Do not create destructive down migrations for applied forward-only schema.

Support:

- disable provider inference independently;
- disable state-changing actions independently;
- disable each role surface independently;
- disable indexing;
- drain or stop index workers safely;
- reject stale chunks;
- rebuild deterministically;
- retain minimal source/audit records according to policy;
- leave CRM, class, content, billing, support, and portals functional.

Immediate rollback triggers:

- cross-account data;
- cross-product data;
- wrong household;
- sibling or wrong learner data;
- invalid citation;
- unauthorized action;
- prompt/policy leak;
- provider-secret leak;
- raw provider URL;
- stale index served as current;
- unbounded cost;
- elevated provider failure;
- material non-AI performance regression;
- browser credential exposure;
- private questions in corpus;
- retention-policy violation.

DATABASE AND MIGRATION REQUIREMENTS

Use exactly one accepted OT-66 migration unless the accepted ledger explicitly authorizes more.

Never edit an existing migration.

The migration may add only helper-specific infrastructure that cannot safely reuse accepted tables.

Likely needs, subject to the accepted design:

- confirmation records;
- helper execution/idempotency records;
- helper audit/usage records if existing audit is insufficient;
- knowledge-index source projection;
- chunk/index projection;
- index jobs and attempts;
- conversation state only when retention permits.

Required database properties:

- account/product scope on every row;
- opaque public/safe references;
- unique idempotency constraints;
- proof hashes, never raw proofs;
- confirmation expiry and state constraints;
- action/policy versions;
- source/approval/index versions;
- active/current indexes;
- job lease generation;
- bounded retry state;
- foreign keys only to stable accepted keys;
- no cross-task tables;
- no provider secret columns;
- no raw provider URLs;
- no full provider payloads;
- no unrestricted JSON authority fields.

Use transactions and row locks for confirmation and job claims.

Prove:

- migration checksum;
- first apply;
- repeat apply;
- checksum verification;
- constraint behavior;
- concurrent confirmation;
- duplicate idempotency;
- stale-version conflict;
- job claim exclusivity;
- lease loss;
- retry/dead letter;
- atomic source replacement;
- unpublish invalidation;
- entitlement restriction;
- account/product isolation;
- current-version retrieval;
- deterministic rebuild.

TEST DATA

Use fictional synthetic accounts, households, guardians, learners, contacts, classes, transcripts, review sheets, tasks, billing summaries, and support requests.

Do not copy real One Time, BNA, child, household, CRM, payment, or class content into tests or evidence.

Synthetic class content must include:

- clearly fictional lesson titles;
- fictional dates;
- ordinary non-sensitive sample text;
- prompt-injection canaries;
- private-question canaries that must be excluded;
- stale/unpublished/unentitled variants;
- cross-account and cross-product variants.

SECURITY AND ABUSE TEST MATRIX

Add tests for all of the following.

Authentication and scope:

- anonymous;
- expired session;
- revoked session;
- stale session version;
- stale credential version;
- privileged session without required MFA;
- suspended user;
- disabled user;
- wrong role;
- cross-account;
- cross-product;
- unrelated parent;
- wrong household;
- sibling-private data;
- wrong learner;
- student attempting learner selection;
- direct endpoint call bypassing hidden UI.

Prompt injection:

- user message says to ignore policy;
- transcript says to invoke an action;
- review sheet asks to reveal prompts;
- title contains tool instructions;
- metadata contains SQL or URL;
- citation label contains an action;
- application result contains instructions;
- Unicode-obfuscated instruction;
- bidirectional-text edge case;
- nested JSON-like tool request.

Sensitive disclosure:

- reveal system prompt;
- reveal developer prompt;
- reveal tool schemas;
- reveal provider configuration;
- reveal API key;
- reveal internal IDs;
- reveal other users;
- reveal unpublished source;
- reveal raw transcript chunks;
- reveal private questions;
- reveal billing for another household;
- reveal raw provider URL.

Action abuse:

- arbitrary action name;
- unsupported action version;
- browser-supplied account/product;
- browser-supplied household/learner;
- guessed contact or task reference;
- malformed structured output;
- model-proposed SQL;
- model-proposed URL;
- missing CSRF;
- invalid idempotency key;
- duplicate request;
- missing confirmation;
- confirmation replay;
- expired confirmation;
- confirmation from another session;
- security-version change;
- relationship change;
- entitlement change;
- target-version conflict;
- race between two confirmations;
- provider retry attempting duplicate write.

Retrieval failure:

- zero evidence;
- conflicting evidence;
- stale source;
- unpublished source;
- archived source;
- review-needed source;
- unentitled source;
- wrong account/product;
- orphaned chunk;
- mismatched approval version;
- invalid citation;
- hallucinated citation ID;
- stale index;
- partial index outage;
- no embedding provider;
- index job dead letter.

Provider failure:

- timeout;
- cancellation;
- malformed JSON;
- schema violation;
- refusal;
- empty response;
- hallucinated action;
- invalid citation;
- oversized response;
- rate limit;
- circuit breaker;
- cost ceiling;
- retry exhaustion.

Privacy:

- no PII or secrets in URL;
- no protected data in logs;
- no protected data in analytics;
- no protected data in browser storage;
- no protected data in screenshot/evidence;
- no raw provider URL;
- no BNA import;
- no browser provider key;
- no direct browser provider request.

UNIT TESTS

Cover at minimum:

- principal resolution;
- role policy;
- capability intersection;
- action registry completeness;
- strict schemas;
- redaction;
- action planning validation;
- request budgets;
- provider response validation;
- confirmation proof binding;
- expiry;
- state machine;
- idempotency;
- optimistic concurrency;
- citation issuance;
- citation validation;
- no-evidence behavior;
- source eligibility;
- current-version selection;
- entitlement filter;
- prompt-injection handling;
- retention cleanup;
- feature flags;
- rate limits;
- circuit breaker;
- safe error mapping.

INTEGRATION TESTS

Use the real accepted application services and disposable PostgreSQL.

Prove:

- session and MFA behavior;
- server-derived role/scope;
- owner/admin CRM reads;
- task preview and confirmed creation/update;
- parent guardian/household isolation;
- student single-learner isolation;
- class and entitlement reads;
- optional accepted OT-65 billing summary;
- absent-OT-65 degradation;
- support preview and creation or fixture-only unavailable state;
- audit events;
- idempotency;
- concurrent confirmation;
- version conflict;
- index event application;
- atomic replacement;
- unpublish/archive invalidation;
- entitlement restriction;
- account/product isolation;
- worker retry/dead letter;
- index freshness;
- ordinary page independence.

Do not use direct database setup to bypass application authorization except for synthetic fixture seeding through accepted test helpers.

BROWSER JOURNEYS

Add Playwright journeys for:

Owner/admin:

- open helper;
- navigate;
- safe contact lookup;
- task read;
- task preview;
- confirm;
- duplicate confirm;
- conflict;
- provider unavailable;
- no content;
- session expiry.

Parent:

- one learner;
- multiple learners;
- unrelated learner denial;
- next entitled class;
- entitled review sheet;
- reset guidance;
- optional billing summary;
- no-OT-65 billing guidance;
- support preview and confirmation;
- sibling-private denial.

Student:

- no learner selector;
- next class;
- approved lesson search;
- grounded class answer with citation;
- no-evidence answer;
- unpublished/unentitled denial;
- progress/reward when enabled;
- support;
- billing denial;
- sibling denial.

General:

- wrong role;
- anonymous direct route;
- offline;
- rate limited;
- provider unavailable;
- cancellation;
- stale confirmation;
- mobile virtual keyboard;
- 200% zoom/reflow;
- RTL direction;
- reduced motion;
- keyboard and focus.

ACCESSIBILITY TESTS

Use the accepted accessibility harness and automated checks, plus focused assertions for:

- accessible panel/dialog name;
- heading structure;
- live-region restraint;
- focus order;
- focus restoration;
- keyboard confirmation;
- visible focus;
- status semantics;
- error association;
- citation link names;
- mobile drawer/panel interaction;
- no horizontal overflow;
- reduced motion;
- 200% reflow;
- contrast;
- RTL-safe layout;
- virtual-keyboard visibility.

PERFORMANCE AND BUNDLE GATES

Record exact accepted-base measurements before edits.

Preserve existing fixed public budgets, including where still applicable:

- public JavaScript remains within the accepted public budget;
- public CSS remains within the accepted public budget;
- public pages do not import React or authenticated/helper code;
- public HTML does not load authenticated/helper bundles;
- LCP remains at or below 2.5 seconds;
- CLS remains at or below 0.1;
- no horizontal overflow.

Additional OT-66 gates:

- no provider SDK in any browser bundle;
- no helper bundle loaded before a helper is opened;
- initial owner/admin, parent, and student portal bundle grows by no more than the smaller of 10 KiB raw or 10% unless an accepted baseline decision authorizes otherwise;
- helper UI is a separate lazy chunk;
- helper-open state makes at most one additional same-origin bootstrap request before the user submits text;
- ordinary pages make zero provider requests;
- ordinary non-helper request counts do not materially regress;
- fake-model warm helper response p95 is at most 750 ms in the local integration environment;
- retrieval-only p95 is at most 300 ms over at least 10,000 synthetic eligible chunks on disposable PostgreSQL;
- index processing never blocks ordinary page responses;
- provider delay does not hold open unrelated requests;
- cancellation releases server work.

If environment noise prevents absolute browser timing, retain the fixed user-centered gates and require no statistically material regression against repeated accepted-base samples.

ORDINARY CI

Ordinary CI must use:

- deterministic fake generation adapter;
- deterministic fake embedding adapter;
- fictional corpus;
- fixed clock and IDs where needed;
- no external AI network;
- no BNA network;
- no Telegram network;
- no billing-provider network;
- no real messages;
- no provider mutation;
- no production data.

Add a test or network guard proving external AI calls are impossible in ordinary CI.

PROVIDER-BACKED STAGING EVALUATION

Run only if separately authorized by the approved provider mode and environment.

Use:

- sanitized non-production corpus;
- fictional users;
- fictional households and learners;
- no real child, household, CRM, support, or payment data.

Record:

- exact source SHA;
- provider-safe fingerprint;
- SDK/model identifier;
- model policy version;
- prompt policy version;
- retrieval/index version;
- fixed evaluation questions;
- expected source set;
- groundedness result;
- citation correctness;
- no-evidence correctness;
- authorization result;
- prompt-injection result;
- cost bucket;
- latency;
- rollback result.

Do not mark provider evaluation complete when only fake adapters ran.

Do not send real data merely to prove the integration.

SECRET, PRIVACY, AND STATIC SCANS

Run the accepted secret scanner.

Add scoped scans proving no:

- browser provider key;
- `VITE_` AI credential;
- raw provider endpoint in client code;
- provider SDK in client imports;
- BNA runtime import;
- Operations import;
- Studio/agent import;
- raw Vimeo/Zoom/storage URL in helper DTO fixtures;
- `localStorage`, `sessionStorage`, or IndexedDB use for protected helper content;
- prompt/response logging;
- unrestricted `fetch` in model tools;
- shell execution;
- SQL tool;
- filesystem tool;
- arbitrary URL tool;
- production data in evidence.

Review every grep match manually. Do not claim a clean scan solely because a pattern returned zero results if the pattern was incomplete.

EXACT LOCAL VERIFICATION SEQUENCE

Use the accepted package manager and scripts. Where the observed repository conventions remain current, run at least:

1. `npm ci`
2. focused OT-66 unit tests
3. focused OT-66 integration tests
4. real PostgreSQL migration apply/verify tests
5. real PostgreSQL concurrency and index tests
6. `npm run secret:scan`
7. touched-file Prettier check
8. `npm run format`
9. `npm run lint`
10. `npm run typecheck`
11. `npm run unit`
12. `npm run integration`
13. `npm run test`
14. `npm run build`
15. focused OT-66 Playwright e2e
16. focused OT-66 accessibility
17. focused OT-66 performance
18. `npm run e2e`
19. `npm run accessibility`
20. `npm run performance`
21. `npm run db:verify`
22. `npm run verify`
23. `git diff --check`
24. forbidden-file and forbidden-import scans
25. clean status inspection

If accepted scripts changed, use the accepted equivalents and record both the discovered command and result.

Do not hide a failing full gate behind focused tests.

Do not call a gate passed if it was skipped.

EVIDENCE PACKAGE

Complete sanitized evidence under `ops/evidence/ot-66/`.

Required files:

- `PREFLIGHT.md`
- `AUDIT-INVENTORY.md`
- `ACCEPTED-HEAD-CONTAINMENT.md`
- `COLLISION-MAP.md`
- `OWNERSHIP-PLAN.md`
- `ARCHITECTURE-DECISION.md`
- `ROLE-AND-CAPABILITY-MATRIX.md`
- `ACTION-REGISTRY.md`
- `CONFIRMATION-PROTOCOL.md`
- `RETRIEVAL-AND-INDEX-LIFECYCLE.md`
- `GROUNDING-AND-CITATIONS.md`
- `PROVIDER-AND-RETENTION-DECISION.md`
- `SUPPORT-SEAM.md`
- `SECURITY-AND-PRIVACY.md`
- `MIGRATION-PLAN.md`
- `POSTGRESQL-PROOF.md`
- `TEST-RESULTS.md`
- `BROWSER-AND-ACCESSIBILITY.md`
- `PERFORMANCE-AND-BUNDLES.md`
- `FEATURE-FLAGS-AND-ROLLBACK.md`
- `CHANGED-FILES.txt`
- `FINAL-REPORT.md`

Evidence must state:

- exact base SHA;
- accepted OT-42/43/47/52/60 SHAs;
- optional OT-65 status;
- branch;
- head SHA;
- migration filename and SHA-256;
- action-registry version;
- role-policy version;
- prompt-policy version;
- retrieval/index version;
- provider mode;
- retention policy;
- changed files;
- test commands and results;
- PostgreSQL version and safe fingerprint;
- synthetic fixture counts;
- browser viewport results;
- bundle sizes;
- request counts;
- retrieval latency;
- no-evidence evaluation;
- citation validation;
- external mutation count;
- feature-flag defaults;
- rollback state;
- blockers;
- final git status.

Never include:

- credentials;
- connection strings;
- real names;
- real contact details;
- real child data;
- full prompts;
- full provider payloads;
- private source text;
- raw internal logs;
- screenshots containing sensitive data.

SCOPED COMMIT PLAN

Use small, coherent commits.

A suitable sequence is:

1. Helper contracts, role policy, registry, grounding, and deterministic adapters.
2. Migration, repositories, confirmation, audit, and retrieval/index infrastructure.
3. Server router and accepted application-service adapters.
4. Worker index integration.
5. Shared UI and role-specific shell integration.
6. Unit/integration/browser/accessibility/performance tests.
7. Sanitized evidence and final report.

Adjust the sequence to the accepted repository’s conventions.

Before every commit:

- inspect `git diff`;
- inspect changed files against `OWNERSHIP-PLAN.md`;
- run the relevant focused tests;
- run `git diff --check`;
- confirm no secrets or private data.

Do not commit generated dependency directories, provider responses, temporary databases, local environment files, or unsanitized screenshots.

DRAFT PULL REQUEST

Only after every mandatory local gate passes:

1. Confirm the branch contains only scoped OT-66 changes.
2. Confirm the worktree is clean after commits.
3. Push the dedicated branch without force.
4. Open or update one draft PR.
5. Use the accepted OT-60/converged integration branch as the PR base when repository policy requires it.
6. Include:
   - exact base/head;
   - accepted-head containment;
   - architecture summary;
   - role matrix;
   - action/confirmation summary;
   - retrieval/grounding summary;
   - provider mode;
   - retention policy;
   - PostgreSQL proof;
   - test summary;
   - feature flags;
   - rollback;
   - external mutation count;
   - remaining blocked/disabled capabilities.

Do not:

- merge;
- deploy;
- enable production flags;
- activate provider inference;
- run production indexing;
- mutate BNA;
- register Telegram webhooks;
- start Telegram polling;
- send external messages;
- change billing;
- grant access;
- alter Railway or DNS;
- rotate credentials.

COMPLETION CLASSIFICATION

The final report and final response must separately classify each capability as:

- implemented;
- fixture-verified;
- real-PostgreSQL-verified;
- browser-verified;
- provider-staging-evaluated;
- enabled for owner/admin;
- enabled for parent;
- enabled for student;
- disabled by flag;
- blocked;
- untouched.

Do not collapse “implemented” and “enabled.”

Do not claim provider staging evaluation unless it actually ran with separate authorization.

Do not claim support creation if only a fixture port exists.

Do not claim billing summary if accepted OT-65 is absent.

Do not claim class RAG if only an interface exists and no accepted content/index path was verified.

FINAL RESPONSE FORMAT

End with a concise execution report containing:

- status;
- repository;
- base SHA;
- branch;
- head SHA;
- draft PR;
- migration and checksum;
- implemented surfaces;
- verification summary;
- provider mode;
- retention mode;
- feature-flag defaults;
- provider-staging evaluation status;
- external mutation count;
- blockers;
- evidence root;
- clean worktree status.

If stopped, use:

`STATUS: STOPPED — <STOP_CODE>`

Then state:

- failed gate;
- observed safe evidence;
- exact unblock condition;
- whether any files, commits, branch, PR, provider calls, external sends, database mutations, or deployments occurred.

SUCCESS STANDARD

OT-66 is complete only when all of the following are true:

- the exact approved base and accepted heads were verified;
- OT-60 genuinely contains OT-42/43/47/52;
- a clean dedicated worktree and branch were used;
- repository instructions were followed;
- file and migration ownership were reconciled;
- owner/admin, parent, and student policies are server-side and distinct;
- no browser or model can select scope;
- actions use a typed allowlisted registry;
- state changes require server-bound confirmation;
- duplicate confirmation cannot repeat a write;
- accepted application services are reused;
- the class corpus is approved, published, current, entitled, and One Time-owned;
- stale and unentitled chunks fail closed;
- citations are server-issued and validated;
- unsupported answers return no evidence;
- prompt injection in all untrusted fields is resisted;
- no browser provider key or direct provider call exists;
- no open web, Sefaria browsing, shell, SQL, filesystem, code execution, or arbitrary HTTP tool exists;
- support uses the accepted seam or remains fixture-only;
- retention follows the explicit approved policy;
- ordinary pages remain independent of provider/index availability;
- real PostgreSQL verification passes;
- deterministic no-network CI passes;
- browser, accessibility, privacy, security, bundle, request, and performance gates pass;
- feature flags default off;
- rollback is documented and tested;
- sanitized evidence is complete;
- scoped commits are pushed;
- one draft PR is opened;
- no merge, deployment, external send, provider activation, billing mutation, access grant, BNA mutation, Telegram activation, Railway change, or DNS change occurred.
