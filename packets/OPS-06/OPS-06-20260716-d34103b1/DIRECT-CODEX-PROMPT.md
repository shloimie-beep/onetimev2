# OPS-06 direct Codex execution prompt

You are the principal product-quality and release engineer for Task ID `OPS-06`. Execute this packet against the standalone One Time repository `webcraft-media/onetimev2`. This is a deterministic synthetic Day-One launch rehearsal on isolated staging. The packet ID is `OPS-06-20260716-d34103b1` and the packet directory is `packets/OPS-06/OPS-06-20260716-d34103b1/`.

## Non-negotiable operating constraints

- Persist state first. No network request, database mutation, source edit, dependency install, deployment, provider action, or fixture creation may occur before the state file is atomically written.
- Audit the exact current contracts, routes, UI controls, migrations, worker, and tests read-only before changing anything.
- Do not push, commit to, merge, comment on, or otherwise edit GitHub. Work in a local branch/worktree only.
- Provider-off is the mandatory baseline. Real email, WhatsApp, Telegram, Stripe live mode, Zoom/Vimeo provider targets, Buffer publishing, webhooks, broad sends, live charges, root DNS changes, production database access, production deploys, and real users are forbidden.
- Use only the `.example.test` identities and fictional data in `fixtures.synthetic.json`.
- Historical OT81/OT82/OT83/OT87 certification or evidence is context, not proof. Generate fresh `OPS-06` evidence bound to the exact rehearsal deployment SHA.
- A visible disabled, dead, reserved, placeholder, unavailable-by-design, or Coming Soon control is a gate failure. Do not hide a required broken control to manufacture a pass.
- Implement only missing test-harness/evidence glue and the smallest correctness fix needed to make existing required contracts testable. Do not invent missing business features. If tags, durable notes, relationships, tasks, learner-question queue, subscriber-support receipt, or any other required product capability is absent, record `FAIL_PRODUCT_GAP` with exact code/route/contract evidence.

## Phase 0 — state persistence before all other work

1. Read this packet and validate `checksums.sha256` before using any instruction.
2. Without contacting any remote service, obtain the local repository HEAD if available. Generate `RUN_ID` as `OPS-06-` plus the current UTC timestamp in `YYYYMMDDTHHMMSSZ` form plus eight lowercase hex characters derived from SHA-256 of the packet ID, local HEAD text, and 32 random bytes. Store the random bytes only as their SHA-256 digest.
3. Create `ops/evidence/OPS-06/$RUN_ID/state/` and atomically write `state/state.json` using write-to-temp, fsync, rename, and parent-directory fsync. Also create append-only `state/commands.ndjson` and atomically write `state/safety.json`. Include task ID, packet ID, run ID, phase `STATE_PERSISTED`, packet checksum result, local HEAD if present, dirty-worktree flag, process ID, UTC time, safety flags, command-plan digest, and an empty mutation ledger.
4. Append every later phase transition to `state/state-transitions.jsonl`, append every redacted command/request to `state/commands.ndjson`, and atomically update `state/state.json`. Never rewrite or remove earlier transition records.
5. If state persistence cannot be proven, stop with verdict `FAIL_SAFETY`.

## Phase 1 — isolated staging and exact source discovery

Discover, do not assume, the staging URL and source SHA.

1. Search environment names in this order: `ONE_TIME_STAGING_URL`, `STAGING_BASE_URL`, `RAILWAY_PUBLIC_DOMAIN`, existing OT75/OT81 release manifests, authenticated Railway environment/service inventory, and repository deployment metadata available locally. Record only redacted URLs in general logs; store the full URL in a protected mode-0600 evidence file if required by the runner.
2. Reject any URL equal to or sharing the production root `join.onetimeonetime.com`, any environment/project/service labelled production/live/default, any shared BNA/Operations service, any root-domain mutation requirement, or any target whose isolation cannot be proven.
3. GET `/health`, `/ready`, and `/version`. Require `/version.commit_sha` to be a 40-character Git SHA and `target_app` to identify One Time. Record response headers, status, body digest, TLS hostname, and timing.
4. Fetch repository refs read-only and locate the exact commit. Do not assume `main` or the audit anchor `6ecb680713a2fd5cd7bc03766fe9b8974c9b75df`. Require `git cat-file -e "$STAGING_SHA^{commit}"`, record all branches containing the SHA, and inspect ancestry/capability manifests.
5. Create a detached audit worktree at the exact staging SHA. Record `git status --porcelain`, submodule state, lockfile checksum, package manager versions, and migration checksums.
6. If the staging SHA cannot be matched exactly to source, return `BLOCKED_ENVIRONMENT`. Never test a similar branch and call it equivalent.
7. If temporary harness glue must be deployed, preserve `ORIGINAL_STAGING_SHA`; create a local branch named `codex/ops-06-$RUN_ID`; allow deployment only when `OPS06_ALLOW_STAGING_DEPLOY=1` existed before the run and all target labels prove isolated staging. The temporary deployment must expose its exact harness SHA at `/version`. Never push the branch to GitHub. If deployment authorization is absent, run black-box/local integration evidence and report any untestable mandatory gap as blocked; do not deploy by implication.

## Phase 2 — provider-off and data-safety preflight

1. Prove all real transport/payment/social flags are false or absent. Require sink/fixture adapters for delivery, class launch, protected content, question receipt, support receipt, and billing projection. A provider-off fixture may return an opaque local handle or same-origin synthetic target; it must never expose a raw provider URL.
2. Install a network allowlist at the browser, server test client, and process level: staging origin, loopback/disposable PostgreSQL, and package registries only during dependency installation. During the rehearsal, the only allowed application request host is the staging origin. Any BNA/Operations or third-party request fails safety.
3. Prove database identity: PostgreSQL major version 16, isolated database name/user/host labels, no production host, no shared BNA schema, and no non-synthetic personal rows selected for mutation.
4. Scan fixtures and planned evidence before execution. Emails must end in `.example.test`; phone values must be reserved fictional ranges; no cookie, activation token, password hash, raw password beyond the public synthetic fixture password, provider URL, secret, or real personal data may enter evidence.
5. Capture baseline counts/digests and initialize the fixture ledger exactly as required by `reset-rollback-plan.md`.

## Phase 3 — read-only capability and visible-control audit

1. Inventory package scripts, app composition, all public/protected routes, API endpoints, contracts, domain services, repositories, migrations, worker processes, health/readiness/version endpoints, browser tests, integration tests, and evidence generators at the exact staging SHA.
2. Compare the inventory with `AUDIT-CURRENT-STATE.json`, `journey-matrix.csv`, `action-registry.required.json`, `role-capability-matrix.csv`, `role-state-matrix.csv`, `error-state-matrix.csv`, `viewport-a11y-matrix.csv`, and `isolation-matrix.csv`.
3. Generate `actions/runtime-action-registry.json` from source plus runtime DOM discovery. Every interactive element matching `[data-ops06-action]` must carry one unique `data-ops06-action` value. Dynamic row/item controls use a stable action prefix plus an opaque entity key; never use display names or PII in the ID.
4. The runtime registry must include stable ID, role/capability, route, exact component file/export, label/accessibility name, read/write, exact handler and endpoint, confirmation, idempotency/audit behavior, loading/success/error/offline/permission states, readiness, code owner, and positive/negative test IDs.
5. Add stable IDs and test-state injection only where this is evidence glue and does not change product semantics. Do not add fake handlers to make a dead control clickable.
6. Fail `FAIL_PRODUCT_GAP` for any required action whose exact deployed source has no business contract/route/service. Fail `FAIL_TEST` for a present function that cannot be exercised because test/evidence glue is missing after a reasonable minimal implementation.

## Phase 4 — permitted harness/evidence glue

Permitted local changes are narrowly limited to:

- deterministic synthetic fixture creation and ledger/reset commands gated to isolated staging and `OPS-06`;
- stable `data-ops06-action` attributes and route-specific usable marks;
- deterministic provider-off class/content handles that exercise existing authorization/entitlement contracts without external URLs;
- deterministic failure/latency/offline/session-expiry/conflict/duplicate/provider-unavailable injection available only under an unguessable run-scoped test authorization stored outside source;
- worker health/heartbeat and safe fault injection for sink retry/dead-letter/restart evidence;
- exact SHA/readiness/evidence endpoints that disclose no secrets or PII;
- Playwright/Vitest/PostgreSQL harnesses, schemas, reporters, checksums, and evidence validation;
- fixture ledger and idempotent reset logic described in `reset-rollback-plan.md`.

Not permitted as evidence glue: inventing CRM tags/notes/relationships/tasks, durable learner questions, durable subscriber support, subscriptions, classrooms, portals, or role capabilities that do not already exist. Those are product gaps and must fail honestly.

Run formatting, lint, typecheck, focused unit/integration tests, secret scan, build, and packet-specific schema/checksum validation after any local change. Record the exact diff and all commands with secrets redacted.

## Phase 5 — PostgreSQL 16 fresh, upgrade, and concurrency proof

Use real PostgreSQL 16, not pg-mem, for mandatory database proof.

1. **Fresh path:** create an empty disposable PostgreSQL 16 database; apply all migrations from the exact source/harness SHA; run migration verification twice; record ordered migration IDs/checksums and schema digest.
2. **Upgrade path:** create a second disposable PostgreSQL 16 database at the immediately preceding deployable source/migration state discovered from ancestry; seed representative non-OPS-06 synthetic rows; upgrade to the rehearsal SHA; verify preservation, constraints, indexes, and migration checksums.
3. Execute at least these concurrent tests with independent connections and barriers:
   - 20 same-payload requests with the same Family signup key produce one logical contact/lead/audit/outbox set and replay-equivalent responses.
   - 20 different-payload requests with the same key preserve the first request and return conflict for all incompatible requests.
   - 10 simultaneous fourth-learner attempts after three active learners leave exactly three active learners and no orphan account/access row.
   - concurrent stale CRM edits produce one winner and deterministic conflicts.
   - parent student-session revocation racing protected requests invalidates all target-student sessions without affecting parent or siblings.
   - two workers claiming the same queue population do not duplicate completion.
4. Run account, role, household, sibling, inactive-entitlement, school-lead, and direct-object isolation in `isolation-matrix.csv`.
5. Record EXPLAIN plans/row counts for list/search/filter hot paths where fixtures are large enough to detect full-scan regressions.

## Phase 6 — deterministic synthetic journey

Use exactly `fixtures.synthetic.json`. Persist every created opaque key in the ledger before advancing. Run all 48 rows in `journey-matrix.csv` in order. Mandatory business outcomes include:

- Family signup creates exactly one CRM contact, lead, audit event, and allowed outbox intents under replay; acknowledgement/reminder copy is truthful and contains no protected/provider target.
- Owner and administrator activate/login, reach dashboard, and exercise CRM list/search/filter/detail/edit/tags/notes/relationships/read-only communications/tasks.
- Create/link the household, activate a provider-off synthetic Family entitlement without charge, issue parent activation, and activate/login the parent.
- Add Ari Adler, Bina Adler, and Chaim Adler; a concurrent Devorah Adler fourth-seat attempt must be denied with no orphan rows.
- Activate Ari Adler's student identity and prove the session is bound to exactly Ari; Bina and Chaim remain learner profiles without student credentials unless the exact product contract requires otherwise.
- Exercise parent and student next class, library, review sheet, progress, rewards, updates, learner question queue, and subscriber support receipt.
- Logout and replay prior requests; parent revocation must invalidate only the selected student sessions.
- School signup remains a CRM lead only. Prove zero subscription, entitlement, household/classroom, account/session, portal grant, protected content, learner question, and support rows. Only the allowed internal lead alert may be queued.
- Inactive subscriber may authenticate only as the real contract permits but must not receive protected learning or support entitlement.

A preview, local modal, disabled button, helper availability message, or provider-unavailable label is not a successful question/support/class/content action.

## Phase 7 — all roles, states, actions, accessibility, and design

1. Run every row in `role-state-matrix.csv` and `error-state-matrix.csv`. Use deterministic fault controls; do not corrupt shared data or depend on random network failure.
2. At each required viewport 360x800, 390x844, 768x1024, and 1440x1000, crawl every required route and state. Click every visible registered action using pointer and keyboard. Also run RTL, reduced motion, and 200% text/reflow.
3. Require zero axe serious/critical violations, logical focus/order, visible focus, Escape/focus-trap behavior, accessible names/descriptions/errors/statuses, no keyboard trap, no horizontal overflow, and at least 44x44 targets where the design requires touch controls.
4. Compare computed design tokens/components. Public and protected shells must use the canonical One Time design system consistently for header, footer, navigation, buttons, cards, forms, typography, spacing, focus, errors, empty states, and status surfaces. Record allowed route-specific exceptions.
5. Reconcile DOM observations with the runtime registry. Zero unregistered controls, duplicate IDs, never-observed entries, dead controls, and forbidden visible placeholder copy are required.

## Phase 8 — queue, health, scans, and performance

1. Prove web `/health`, `/ready`, `/version`; worker process health/heartbeat, database readiness, last successful poll, queue age, in-flight leases, retries, and dead letters. Add minimal non-sensitive worker health glue if absent.
2. In sink mode, inject a retryable failure, a non-retryable/poison failure, and a stop-after-claim. Restart the worker after the claim lease. Prove durable backoff, lease recovery, exactly-once logical completion, max-attempt dead-letter, and safe replay. Record no raw recipient/body/provider secret.
3. Run secret scan, PII scan, provider-URL scan, committed-file scan, generated evidence scan, browser storage/cookie scan, and built source/bundle scan. Fail on non-`.example.test` identities, raw provider URLs, BNA/Operations imports or network paths, production hosts, or secret-like values.
4. Run the exact 30-sample throttled-mobile protocol in `performance-budgets.json`. Emit raw samples and p50/p75/p95 for every route; enforce request and compressed bundle budgets. A missing metric or usable mark fails. Require zero BNA/Operations fanout and zero third-party request in provider-off mode.

## Phase 9 — reset, rollback, and final evidence

1. Execute `reset-rollback-plan.md`. Reset only ledgered rows in reverse dependency order, run reset twice, and prove baseline counts/digests return exactly. Never truncate or issue broad deletes.
2. If a temporary isolated-staging harness deployment occurred and was pre-authorized, restore the exact original SHA after fixture reset, verify `/version`, and record both SHAs. Otherwise make no deployment change.
3. Validate final evidence against `evidence.schema.json`, final `actions/runtime-action-registry.json` against `action-registry.schema.json`, and every JSON/CSV file for parseability. Generate `checksums.sha256` for the evidence tree.
4. Final verdict rules:
   - `PASS`: all 17 mandatory gates in `acceptance-gates.json` pass with zero blockers.
   - `FAIL_PRODUCT_GAP`: a required business capability is absent or a visible required control is dead/unavailable.
   - `FAIL_TEST`: product capability exists but fresh proof fails.
   - `FAIL_SAFETY`: isolation, provider-off, data, reset, or forbidden-action invariant fails.
   - `BLOCKED_ENVIRONMENT`: isolated staging, exact source SHA, PostgreSQL 16, or authorized staging harness execution cannot be obtained.
5. Write `FINAL-REPORT.json`, `FINAL-REPORT.md`, `commands.redacted.log`, `changed-files.txt`, and evidence checksums. State exact blockers; never relabel blocked/skipped as pass.

## Required evidence tree

Under `ops/evidence/OPS-06/$RUN_ID/`, produce at minimum:

- `state/state.json`, `state/state-transitions.jsonl`, `state/commands.ndjson`, `state/safety.json`;
- `preflight/target-discovery.json`, `preflight/source-sha.json`, `preflight/provider-off.json`;
- `health/web.json`, `health/worker.json`;
- `audit/contracts-routes-tests.json`, `audit/diff.json`;
- `actions/runtime-action-registry.json`, `actions/dom-registry-diff.json`, `actions/click-results.json`, screenshots and traces;
- all 48 per-step paths declared by `journey-matrix.csv`, plus `journey/results.json`;
- `role-state/results.json`, `isolation/results.json`;
- `database/fresh-migration.json`, `database/upgrade-migration.json`, `database/migration-ledger.json`, `database/concurrency.json`;
- `queue/J43-retry-dead-letter.json`, worker health/log evidence;
- `performance/raw/*.json`, `performance/J46-summary.json`, bundle/request reports;
- `accessibility/J45-matrix.json`, `design/system-consistency.json`;
- `security/scan-summary.json`, `security/network-destinations.json`, `security/mutation-ledger.json`, session/cache proof;
- `reset/J47-reset-1.json`, `reset/J47-reset-2.json`, `reset/post-reset-diff.json`;
- `gates.json`, `FINAL-REPORT.json`, `FINAL-REPORT.md`, `evidence-index.json`, `checksums.sha256`.

Begin with Phase 0. Do not ask for confirmation when the packet already supplies an answer. Stop only at a defined verdict with schema-valid evidence.
