# DIRECT CODEX EXECUTION PROMPT — OT-87 STRIPE TEST FAMILY SUBSCRIPTION AND ENTITLEMENTS

```text
TASK ID: OT-87
MODE: IMPLEMENT, VERIFY, RUN AUTHORIZED TEST-MODE CANARIES WHEN GATED, CHECKPOINT, PUSH, AND OPEN A DRAFT PR
REPOSITORY: webcraft-media/onetimev2
SOURCE BRANCH: codex/ot83-household-portals-foundation
TARGET BRANCH: codex/ot87-stripe-test-entitlements
RUN STATE ROOT: ops/codex-runs/OT-87/
STRIPE TEST CHECKOUT AND WEBHOOK CANARIES: AUTHORIZED WHEN EVERY TEST-ONLY GATE PASSES
LIVE_STRIPE_CHARGES_AUTHORIZED: NO
LIVE STRIPE RESOURCES, LIVE CHARGES, DEPLOYMENT, DNS, AND PRODUCTION DATABASE MUTATION: NOT AUTHORIZED

ROLE

Act as the principal payments and entitlement engineer for standalone One Time. Implement the V1 family subscription on the exact current remote head of `codex/ot83-household-portals-foundation`. Extend the accepted OT-46 billing foundation, OT-72 Stripe test adapter, and the canonical household/portal model present on the source branch. Do not create a second household, learner, billing, or entitlement architecture when an accepted canonical one exists.

The commercial truth is fixed by `01-COMMERCIAL-POLICY.v1.json` in the supplied packet. Copy that file without semantic alteration to `ops/commercial/ot87/family-plan.v1.json`, validate it at build/startup through a strict server-side schema, and make the policy version part of every entitlement projection and reconciliation report.

## 1. Non-negotiable commercial and safety rules

1. The only checkout offer in OT-87 is the family plan at USD 6700 cents every month, quantity one, with at most three active learner seats in one household.
2. Family checkout only. School submissions remain CRM leads. School actors, school contacts, school households, and school lead records cannot create Checkout Sessions, receive household entitlements, or consume learner seats in V1.
3. Stripe is One Time-owned. Shloimie is the Stripe technical administrator. Rabbi is the application product owner. Administrative application roles do not become paid family subscribers and do not consume learner seats merely because of their role.
4. Stripe TEST mode only. Require `LIVE_STRIPE_CHARGES_AUTHORIZED` to equal the exact string `NO` before loading Stripe transport, resource setup, reconciliation apply mode, or a canary. Reject missing, lowercase, truthy, or alternate values. Reject `sk_live_`, `pk_live_`, restricted live keys, `livemode=true`, live-like configuration, or account mismatches before any mutation.
5. Do not place `$67`, `67/month`, monthly price text, or a trial claim in the public landing hero or moving ticker. The authenticated checkout and billing surfaces must state: `Family plan — $67/month — up to 3 active learners in one household.`
6. OT-87 has no trial. Validate that the configured Stripe Price and Checkout Session have no trial. An unexpected `trialing` subscription enters `manual_review` and grants no access.
7. The grace period is explicitly zero. `past_due`, `unpaid`, and `paused` suspend learning access immediately. Do not invent an implicit grace window.
8. Checkout creation, a browser success URL, a query parameter, client state, or `checkout.session.completed` alone never grants access. Entitlement activation requires verified local correlation, current active subscription truth, and a paid current invoice for USD 6700, with no refund/dispute/manual-review hold.
9. Stripe events are inputs to the local One Time entitlement service. Normal application authorization and content routes read local projections. They must not call Stripe per request.
10. Public signup and CRM must remain functional when Stripe is unavailable. Stripe failures may disable new checkout, portal session creation, setup, and reconciliation, but they must not break landing, signup, login, CRM reads/writes, or local portal reads.
11. Never log or commit full webhook bodies, secret keys, payment method data, card data, customer email/name/address, raw provider URLs, raw Stripe object dumps, or unnecessary raw Stripe IDs. Store only required server-side identifiers; emit redacted hashes/suffixes in evidence.
12. No merge and no deployment. Open a draft PR only.

## 2. Resolve the exact source head and use a clean worktree

Treat the active directory as untrusted. Confirm the repository identity from `git remote get-url origin`; do not operate in BNA or any repository other than `webcraft-media/onetimev2`.

Fetch the source and target refs explicitly:

- `refs/heads/codex/ot83-household-portals-foundation`
- `refs/heads/codex/ot87-stripe-test-entitlements`

Resolve `refs/remotes/origin/codex/ot83-household-portals-foundation^{commit}` after the fetch and record the full 40-character SHA in `ops/codex-runs/OT-87/BASE-RESOLUTION.json`. Never use a remembered SHA, local-only branch head, pull-request merge ref, or literal SHA placeholder.

Use a sibling worktree named `onetimev2-ot87-stripe-test-entitlements` next to the primary checkout.

- When the target remote branch does not exist, create `codex/ot87-stripe-test-entitlements` at the resolved source SHA.
- When the target remote branch exists, treat it only as a repo-backed resume. Create the worktree from the remote target, verify `ops/codex-runs/OT-87/STATE.json` exists, verify its recorded source branch and source SHA, and continue without rewriting history.
- Never force-push. Never reset an existing target branch to a different source SHA.
- If the source ref cannot be resolved, stop before creating the target branch and report `BLOCKED_BASE_REF_MISSING`. Do not substitute another branch.

The feature worktree must be clean before implementation. Record `git status --short`, remote URL, resolved source SHA, target starting SHA, Node version, npm version, and PostgreSQL test availability in the run state without recording credentials.

## 3. Persist repo-backed state before credential inspection

Before reading protected Stripe configuration or making any network call, create and commit the following under `ops/codex-runs/OT-87/`:

- `ORIGINAL-PROMPT.md` containing this full prompt;
- `STATE.json` using the supplied run-state contract;
- `BASE-RESOLUTION.json`;
- `INPUTS.json` with configuration names and configured/not-configured booleans only;
- `CHECKPOINT.md`;
- `DECISIONS.md`;
- `IMPLEMENTED.md`;
- `REMAINING.md`;
- `BLOCKERS.json`;
- `TEST-RESULTS.md`;
- `MIGRATION-CHECKSUMS.json`;
- `EXTERNAL-MUTATIONS.json` using the supplied schema;
- `CANARY-RESULTS.json`;
- `RESUME.md` with exact next commands and no credentials;
- phase ledgers in `ops/codex-runs/OT-87/phases/` for policy/config, schema, adapter/routes, webhook/projection, reconciliation, UI, tests, canaries, and publication.

Commit and push this initial checkpoint before any authorized external Stripe mutation. Update and push a checkpoint immediately before and after each external test-mode mutation group. Every state file must remain free of raw secrets and raw Stripe IDs.

## 4. Audit and extend the accepted architecture

Inspect the source branch before editing. At minimum, inspect and reconcile these accepted seams when present:

- `packages/contracts/src/billing/index.ts`
- `packages/domain/src/billing/config.ts`
- `packages/domain/src/billing/types.ts`
- `packages/domain/src/billing/policy.ts`
- `packages/domain/src/billing/service.ts`
- `packages/domain/src/billing/stripe-test-adapter.ts`
- `packages/db/src/billing/repository.ts`
- the OT-46 billing migration and integration tests
- canonical household, guardian, learner, student-access, and portal services from OT-83
- the existing parent billing summary seam and authenticated application composition
- the public landing hero/ticker implementation and tests

Preserve accepted route/auth/session conventions, transaction helpers, idempotency conventions, error envelopes, logging, migration registration, and test tooling. Reuse the canonical household key as the billing principal or add a strict one-to-one mapping to it. Do not correlate a family entitlement by email alone.

The earlier foundation intentionally used synthetic zero-dollar offers and `grants_access=false`. OT-87 must replace those proof-only restrictions through an additive migration and versioned policy; do not edit an already accepted/applied migration.

## 5. Versioned commercial policy and configuration separation

Copy the supplied policy JSON to `ops/commercial/ot87/family-plan.v1.json`. Add a strict schema and loader that rejects unknown fields and validates all fixed values:

- `offer_key=family_monthly_usd_67_v1`
- `currency=usd`
- `unit_amount_cents=6700`
- `recurring_interval=month`
- `recurring_interval_count=1`
- `max_active_learner_seats=3`
- trial disabled
- zero grace
- family-only checkout
- school entitlement disabled
- Stripe mode test
- live charge authorization false

Separate non-secret policy from protected server configuration. Read the exact test resources from the existing protected configuration mechanism using these exact names:

Server-only values:

- `ONE_TIME_STRIPE_TEST_SECRET_KEY`
- `ONE_TIME_STRIPE_TEST_WEBHOOK_SECRET`
- `ONE_TIME_STRIPE_TEST_ACCOUNT_ID`
- `ONE_TIME_STRIPE_TEST_PRODUCT_ID`
- `ONE_TIME_STRIPE_TEST_PRICE_ID`
- `ONE_TIME_STRIPE_TEST_PORTAL_CONFIGURATION_ID`
- `ONE_TIME_STRIPE_TEST_WEBHOOK_ENDPOINT_ID`

Browser-safe value only when the current Checkout architecture actually needs it:

- `ONE_TIME_STRIPE_TEST_PUBLISHABLE_KEY`

Explicit operational gates:

- `LIVE_STRIPE_CHARGES_AUTHORIZED=NO`
- `ONE_TIME_STRIPE_TEST_RESOURCE_SETUP_AUTHORIZED=YES` for test-resource creation only
- `ONE_TIME_STRIPE_TEST_CANARY_AUTHORIZED=YES` for bounded test canaries only
- `ONE_TIME_STRIPE_TEST_RECONCILIATION_APPLY_AUTHORIZED=YES` for reconciliation writes only

Do not serialize server-only values into HTML, hydration data, browser bundles, redirects, error responses, telemetry, screenshots, state files, PR text, or test snapshots. Config snapshots may report only configured/not-configured, validated/not-validated, mode, safe capability names, and one-way redacted fingerprints that cannot recover the value.

## 6. Test-resource validation and explicitly scoped setup command

Implement exact scripts in `package.json` following repository script conventions:

- `stripe:test:resources:validate`
- `stripe:test:resources:setup`

`stripe:test:resources:validate` is read-only. It must:

1. require `LIVE_STRIPE_CHARGES_AUTHORIZED=NO`;
2. require a secret key beginning with `sk_test_` and reject all live/restricted-live shapes;
3. authenticate with the official Stripe SDK and retrieve the account;
4. compare the authenticated account ID with `ONE_TIME_STRIPE_TEST_ACCOUNT_ID` using constant-time-safe comparison where practical;
5. retrieve the configured Product, Price, Customer Portal configuration, and Webhook Endpoint;
6. reject any retrieved object with `livemode=true` when the object exposes that property;
7. validate the Product is active and dedicated to the OT-87 family plan;
8. validate the Price is active, USD 6700, recurring monthly with interval count one, quantity one, no tiers, and linked to the configured Product;
9. validate no trial is configured in the application or Checkout builder;
10. validate the portal configuration allows payment-method update, invoice history, and cancellation at period end, and does not permit plan switching or quantity changes;
11. validate the webhook endpoint is test-mode, points to the allowlisted One Time webhook path, and subscribes to exactly the events required by the policy plus any provider-required compatibility events documented in `DECISIONS.md`;
12. return a redacted JSON result and make no mutation.

`stripe:test:resources:setup` may create or repair only test resources and only when all of these conditions pass before the first mutation:

- `LIVE_STRIPE_CHARGES_AUTHORIZED=NO`
- `ONE_TIME_STRIPE_TEST_RESOURCE_SETUP_AUTHORIZED=YES`
- the secret key is `sk_test_`
- authenticated account equals the protected expected account
- a writable approved protected-config store is available outside the repository
- the command is invoked with `--apply`; without `--apply`, it is a dry run

Create a dedicated test Product, immutable recurring Price, dedicated Customer Portal configuration, and test Webhook Endpoint only when absent. Never create a live resource. Never repurpose a price with incorrect amount/currency/interval. Never write raw created IDs into the repository. Persist created IDs directly to the approved protected store, then re-read and validate them. Record only mutation type, count, time, mode, account fingerprint, resource-kind fingerprint, and rollback action in `EXTERNAL-MUTATIONS.json`.

When exact resources are absent and safe setup cannot run, finish all code and fixture tests, set `STATE.json.status` to `WAITING_FOR_STRIPE_TEST_RESOURCES`, populate `BLOCKERS.json`, keep external mutation counts at zero, push the branch, and open a draft PR marked blocked. Do not ask for secret values in chat and do not infer IDs.

## 7. Protected Stripe adapter

Use the official Stripe SDK behind the accepted `BillingProviderAdapter`. Keep the injected client seam for unit tests. Extend the existing adapter rather than adding a second Stripe client.

The adapter must provide:

### Customer establishment

- Resolve the authenticated family household principal locally.
- Reuse an existing verified local customer mapping when present.
- When no mapping exists, create a TEST Customer server-side with opaque One Time account/product/household metadata and an idempotency key derived from the local checkout request. Do not put PII in metadata. Do not require email as the correlation key.
- Verify returned Customer mode/account and persist the mapping transactionally.

### Checkout Session

Use a Stripe Checkout Session because the accepted adapter already supports it. Build all parameters server-side:

- `mode=subscription`
- one line item using the protected validated Price ID and quantity one
- the pre-established TEST Customer
- promotion codes disabled
- adjustable quantity disabled
- no trial period
- allowlisted HTTPS success and cancel URLs built from the canonical application origin
- opaque local checkout request key in `client_reference_id`
- minimal opaque metadata on both Session and Subscription: account key, product key, household/principal key, offer key, and policy version
- an idempotency key scoped to account, product, household, offer, and local request key

Store the Stripe Checkout URL only in the existing server redirect vault. Return a short-lived local redirect handle. Never return a raw Stripe URL or provider secret to browser state. A browser may receive the publishable key only if the architecture genuinely requires it; hosted Checkout redirects do not require exposing the secret key.

Record local `checkout_started` before the provider call and `checkout_session_created` after the call. Replays with the same idempotency key and identical request fingerprint return the original local result. Reuse with a different fingerprint is an idempotency conflict and must not call Stripe.

### Customer Portal

Create a Customer Portal Session only for an authenticated guardian authorized for the same family household and an existing verified TEST Customer mapping. Use the protected dedicated portal configuration and an allowlisted return URL. Store the raw portal URL in the server redirect vault and return a local short-lived redirect handle. Portal outage must return a bounded provider-unavailable result without altering entitlement.

### Webhook verification

- Mount the Stripe webhook route with raw bytes before JSON parsing.
- Enforce content type, a 64 KiB body limit, a bounded request timeout, and the Stripe signature tolerance supported by the official SDK.
- Verify the signature with the protected endpoint secret before parsing or logging fields.
- Reject `livemode=true`, wrong account, wrong mode, wrong endpoint scope, or malformed objects.
- Do not log the raw body or signature header.

## 8. Additive data model and migration

Never edit accepted migrations. Scan `packages/db/migrations/*.sql`, parse numeric prefixes, and choose the smallest unused multiple of 100 greater than the current maximum for one additive OT-87 migration. Record the chosen filename and SHA-256 in `MIGRATION-CHECKSUMS.json`.

Evolve the accepted billing schema to support real TEST commercial truth while retaining test-only database constraints. The final schema must support:

- non-synthetic OT-87 test offer mapping at USD 6700 monthly;
- local checkout lifecycle states including started, session_created, completed, expired, canceled, and manual_review;
- Stripe Customer mapping that does not assume Checkout Session creation returns a Customer;
- subscription projection fields including `cancel_at_period_end`, current period start/end, latest invoice reference, status, collection state, provider update time, source event, and projection version;
- minimized invoice/payment-state projection sufficient for paid/payment_failed/refund/dispute policy without card/payment details;
- immutable verified event ledger with provider event ID, raw-body digest, minimized payload digest, created time, aggregate references, processing status, and attempts;
- durable event application records so concurrent duplicate delivery cannot apply twice;
- versioned household entitlement projection with `grants_access` allowed to be true;
- current hold flags for failed payment, refund, dispute, contradiction, and manual review;
- an append-only entitlement transition audit;
- reconciliation jobs/snapshots and resumable cursors;
- indexes for provider event dedupe, customer/subscription correlation, household entitlement reads, and pending reconciliation;
- test-only checks that continue to reject live mode and live-like values.

Do not store raw webhook bodies, payment method details, card data, Customer email/name/address, invoice PDFs, hosted invoice URLs, or charge receipt URLs.

Use the canonical OT-83 household and learner tables. Enforce the three-active-learner cap through the canonical household transaction lock or canonical slot reservation. All create, restore, bulk import, admin, and reconciliation paths that can make a learner active must use the same atomic primitive. Add a database-backed three-slot reservation only if the source branch has no canonical atomic primitive; do not create a duplicate learner registry.

## 9. Webhook ledger, replay, ordering, and lifecycle projection

Implement the supplied webhook state machine and persist every valid signed event before applying it.

Required event behavior:

- `checkout.session.completed`: correlate by Customer, Subscription, client reference, and opaque metadata; mark checkout completed; never grant access alone.
- `checkout.session.expired`: mark the local checkout expired; do not alter an existing active entitlement.
- `customer.subscription.created|updated|deleted|paused|resumed`: update the subscription projection only when the event is causally newer. An older event is recorded as stale and does not overwrite current truth.
- `invoice.paid`: project the minimized invoice state and recompute entitlement.
- `invoice.payment_failed` and `invoice.payment_action_required`: project the failure and suspend access immediately under the zero-grace policy.
- `charge.refunded`: correlate to the current subscription invoice. Full refund suspends; partial refund enters manual review. Trigger reconciliation.
- `charge.dispute.created`: suspend and trigger reconciliation.
- `charge.dispute.closed`: recompute from current provider truth. Won disputes may restore only if current subscription and paid-invoice truth qualifies; lost disputes revoke.

Dedupe rules:

- First valid event ID and digest: insert and process once.
- Same event ID and same digest: return HTTP 200 with duplicate disposition and no repeated side effect.
- Same event ID with different raw digest: return conflict, record digest mismatch/manual review, and do not apply either conflicting body again.
- Concurrent duplicates must converge through database uniqueness and transactional application records.

Ordering rules:

- Use provider event creation time as the primary subscription aggregate order key.
- When two contradictory subscription events have the same creation time and no provider sequence can prove order, do not choose by arrival order. Record contradiction, deny access, and enqueue reconciliation.
- Invoice events update their own invoice aggregate and then recompute the household entitlement from the latest complete local truth.
- Events with unknown customers or mismatched metadata are ledgered with a safe disposition, grant no access, and enqueue bounded reconciliation when a safe correlation candidate exists.

Return 2xx for accepted, duplicate, stale, and safely deferred events so Stripe does not retry forever. Return 4xx for invalid signature, oversized input, wrong mode/account, and digest conflict. Return 5xx only for transient persistence failure before durable acceptance.

## 10. Entitlement policy and local authorization

Implement one pure, deterministic policy evaluator that consumes the versioned manifest plus local projections. It must not call Stripe.

The household entitlement key is scoped by account, product, and canonical household. The evaluator must produce status, grants_access, reason code, effective time, evaluated time, policy version, source event/snapshot, and hold flags.

Apply these exact OT-87 outcomes:

- checkout started/session created/completed without complete paid subscription truth: pending, no access;
- active subscription plus current paid USD 6700 invoice and no hold: active, access;
- active plus `cancel_at_period_end=true` with future `current_period_end`: scheduled_end, access until period end;
- restoration before period end: active, access;
- trialing: manual_review, no access because trial is disabled;
- past_due, unpaid, paused: suspended, no access, zero grace;
- incomplete: pending, no access;
- incomplete_expired: revoked, no access;
- canceled/deleted after the valid period ends: revoked, no access;
- full current-invoice refund: suspended, no access pending reconciliation;
- partial current-invoice refund: manual_review, no access;
- dispute opened: suspended, no access;
- dispute lost: revoked, no access;
- contradiction, unknown state, or unverifiable correlation: manual_review, no access.

Authorization for paid learning resources is the conjunction of:

1. authenticated session and accepted role;
2. canonical family household scope;
3. current local household entitlement `grants_access=true` and not expired;
4. learner belongs to that household;
5. learner is active and occupies one of at most three canonical active seats;
6. student access state is active where the route is learner-specific.

Parent billing/portal management may remain available while learning access is suspended so the family can recover payment, but it remains household-scoped. Product-owner and technical-admin support capabilities remain role-based administrative capabilities, not subscriber entitlements. Schools never pass the family-entitlement predicate.

The success-return page must read local checkout/entitlement status and truthfully display pending, active, or recovery states. It must not accept provider IDs from the browser and must not activate anything. Add a forged-return test proving arbitrary query strings and locally forged browser state cannot grant access.

## 11. Checkout, billing, and public surfaces

Add or complete authenticated family billing surfaces using accepted shell/portal patterns:

- plan truth and seat limit;
- current local subscription/entitlement status;
- current period end and cancellation-at-period-end status;
- create Checkout Session action when eligible;
- Customer Portal action when a customer mapping exists;
- payment-recovery message for suspended states;
- no raw Stripe IDs, URLs, secrets, invoice URLs, or payment details.

The checkout route must derive family/household scope from the authenticated server session and canonical relationship. Ignore browser-supplied account, product, role, household ownership, amount, currency, price, provider account, customer, subscription, or entitlement fields. The browser submits only an opaque local offer key, version, CSRF protection, and idempotency key according to accepted conventions.

Preserve public family and school signup. Add regression assertions that the landing hero and ticker do not show the price while the authenticated billing surface shows the exact plan truth. A school lead sees no checkout action.

## 12. Manual reconciliation command with dry run

Add exact scripts:

- `billing:reconcile:test`
- `billing:reconcile:test:apply`

`npm run billing:reconcile:test -- --scope=family --dry-run --output=ops/codex-runs/OT-87/reconciliation/dry-run.json` must be the default operator path. It must:

1. load bounded local family principals needing reconciliation;
2. read the verified local Customer mapping;
3. retrieve TEST Customer, Subscription, latest Invoice, Refund, and Dispute truth required by policy;
4. reject wrong account/mode or live objects;
5. compare provider truth with local projections;
6. produce deterministic proposed changes and reason codes;
7. perform no database or Stripe mutation;
8. redact raw provider IDs and PII from the report;
9. support bounded pagination, retry with jitter for Stripe rate limits, cancellation, and repo-backed resume cursor.

`npm run billing:reconcile:test:apply -- --scope=family --apply --output=ops/codex-runs/OT-87/reconciliation/apply.json` may write only local projections and reconciliation/audit records. It must require all test/account guards plus `ONE_TIME_STRIPE_TEST_RECONCILIATION_APPLY_AUTHORIZED=YES`. It must not mutate Stripe subscriptions, invoices, charges, customers, refunds, disputes, products, prices, portal configuration, or webhook configuration.

A provider object missing from Stripe must not silently revoke a household. Mark manual review, explain the mismatch, and require an explicit operator decision unless current signed terminal events already prove revocation.

## 13. Tests and proof

Implement focused unit, integration, real PostgreSQL 16, browser, accessibility, security, and resilience tests. Use the supplied negative-test matrix as a minimum, not an aspiration.

Required proof includes:

- strict manifest parsing and policy outcomes;
- protected config rejects live and mismatched account/resource truth;
- official adapter fixture contract;
- test Customer plus Checkout Session idempotency;
- Customer Portal authorization and local redirect vault;
- raw signed webhook verification;
- immutable ledger, same-digest duplicate, changed-digest conflict, concurrent duplicate, out-of-order stale event, and equal-time contradiction;
- checkout completion alone cannot activate;
- active plus paid invoice activates;
- unsupported trial does not activate;
- zero-grace failed payment suspends;
- paid recovery restores;
- cancellation at period end retains access until the recorded end and restoration clears scheduled end;
- refund and dispute holds;
- three active learners succeed and the fourth is denied both sequentially and under concurrent real-PostgreSQL requests;
- archived/suspended learner restoration still respects the cap;
- school checkout/access denial;
- forged success redirect denial;
- routes read local entitlement without Stripe calls;
- public signup and CRM function while the Stripe client throws/timeouts;
- no server secret or raw Stripe ID in browser bundles, HTML, hydration, local/session storage, snapshots, or logs;
- migration apply/verify and checksum stability;
- reconciliation dry run makes zero writes and apply mode is correctly gated;
- default-off behavior when Stripe resources are missing.

Run the repository's complete accepted verification suite, including formatting, lint, typecheck, unit, integration, build, e2e, accessibility, performance, secret scan, migration verification, and any PostgreSQL assurance harness. Record exact commands, exit codes, test counts, environmental blockers, and touched-file checks in `TEST-RESULTS.md`. Do not claim real PostgreSQL concurrency proof from an in-memory database.

## 14. Authorized test canaries

Run canaries only after all local tests pass and `stripe:test:resources:validate` succeeds. Require `ONE_TIME_STRIPE_TEST_CANARY_AUTHORIZED=YES` and `LIVE_STRIPE_CHARGES_AUTHORIZED=NO` immediately before every canary group.

Use a dedicated synthetic family household and protected canary identity. Use Stripe TEST payment methods or TEST Clock facilities; never enter or use a live card. Keep every canary bounded and reversible.

Execute and record these canaries:

1. Checkout Session creation: local started state, redacted test Session evidence, no entitlement yet.
2. Signed webhook delivery: accepted and ledgered.
3. Duplicate same event: HTTP 200, one ledger application, no duplicate transition.
4. Out-of-order older event: ledgered stale, current projection unchanged.
5. Activation: completed checkout plus active subscription plus paid USD 6700 invoice activates the synthetic household.
6. Seats: three synthetic active learners succeed; concurrent fourth activation is denied.
7. Cancellation at period end: scheduled_end retains access until the recorded test period end.
8. Restoration: clearing cancellation before period end restores active status.
9. Customer Portal Session: authorized guardian receives only a local redirect handle.
10. Failed payment: the configured TEST failure path suspends immediately under zero grace.
11. Recovery: subsequent paid invoice and active subscription restore access.
12. Forged return: direct success URL navigation and fabricated query values do not activate.
13. School denial: a synthetic school lead cannot initiate checkout or receive entitlement.
14. Refund/dispute fixture or safe TEST event: hold/reconciliation behavior matches policy. Do not issue a refund or dispute mutation unless a separate exact protected canary gate authorizes that operation; signed fixture/CLI delivery is sufficient otherwise.
15. Stripe outage: disable/interrupt the test client and prove signup/CRM/local entitlement reads continue.

Update `CANARY-RESULTS.json` after each case. Record test mode, timestamps, outcome, local transition keys, redacted resource fingerprints, and cleanup status. Do not record raw IDs, emails, or webhook bodies.

If resources are missing or any guard fails, do not weaken the guard. Set `WAITING_FOR_STRIPE_TEST_RESOURCES`, record which resource kinds are missing without values, and finish fixture/local proof.

## 15. External mutation report and cleanup

Maintain `EXTERNAL-MUTATIONS.json` from the supplied schema. It must explicitly count:

- test Products created/archived;
- test Prices created/archived;
- test Portal configurations created/changed;
- test Webhook Endpoints created/changed;
- test Customers created;
- test Checkout Sessions created/expired;
- test Subscriptions created/canceled;
- test Clock objects created/deleted when used;
- webhook test deliveries;
- refunds/disputes initiated, which must remain zero unless separately gated;
- live calls/resources/charges, which must remain zero.

Capture a redacted pre-mutation snapshot for any setup-managed portal or webhook configuration. Cleanup must cancel synthetic test subscriptions, expire open test Checkout Sessions where supported, archive dedicated test Products/Prices when they were created solely by the run, and restore or disable dedicated endpoint/config objects according to the rollback plan. Never delete the local immutable event ledger or entitlement audit.

## 16. Rollback and operational controls

Implement default-off flags using existing naming conventions and preserve independent control of checkout, portal, webhook intake, webhook projection, reconciliation, and canaries. Add a server-only entitlement emergency control with only `normal` and `deny_all` values; do not implement `allow_all`.

Rollback order for an entitlement incident:

1. set entitlement emergency control to `deny_all`;
2. disable new checkout and portal creation;
3. keep signed webhook intake ledgering when safe, but disable projection if projection code is suspected;
4. run reconciliation dry run;
5. roll application code back to the last known good commit while retaining additive schema;
6. repair projections through audited reconciliation or a forward fix;
7. re-enable projection, portal, checkout, and normal entitlement in that order after proof.

Migrations must be backward-compatible for the prior application version. Do not drop billing/event tables as an immediate rollback. Any destructive cleanup requires a later separately reviewed migration after retention obligations are satisfied.

## 17. Completion, commits, and draft PR

Use focused commits. At minimum separate run-state/policy, schema/repositories, adapter/routes, projection/reconciliation, UI, tests/canaries, and final evidence when the change set supports that division.

Before publication:

- ensure the worktree is clean;
- recompute migration and run-artifact checksums;
- run secret/PII/raw-provider-ID scans;
- verify `LIVE_STRIPE_CHARGES_AUTHORIZED=NO` appears in evidence and no live authorization appears;
- verify external live mutation counts are zero;
- update `STATE.json`, `CHECKPOINT.md`, `IMPLEMENTED.md`, `REMAINING.md`, `TEST-RESULTS.md`, `EXTERNAL-MUTATIONS.json`, `CANARY-RESULTS.json`, and `RESUME.md`.

Push `codex/ot87-stripe-test-entitlements` without force. Open one draft PR targeting `codex/ot83-household-portals-foundation` titled `OT-87 Stripe TEST family subscription and entitlements`.

The PR body must state:

- exact source and head SHAs;
- test-only commercial policy and zero-grace decision;
- architecture and migrations;
- checkout, portal, webhook, ledger, reconciliation, entitlement, and seat-cap behavior;
- local/full test results;
- canary status or `WAITING_FOR_STRIPE_TEST_RESOURCES`;
- redacted external mutation counts and cleanup status;
- migration checksums;
- no live charges/resources, no deployment, no merge, and no production database mutation;
- exact remaining blockers and repo-backed resume path.

Do not merge or deploy.

## 18. Definition of done

OT-87 is complete only when code and fixture tests are complete, policy is machine-readable, data migrations are additive and checksummed, family-only authorization is enforced, three-seat concurrency is proven, normal routes use local projections, Stripe TEST guards are fail-closed, reconciliation has dry-run and gated apply modes, public signup/CRM survives Stripe outage, the branch is pushed, the draft PR exists, and run state allows another engineer to resume without chat reconstruction.

A missing protected Stripe resource does not justify unsafe inference. In that case the correct final state is `WAITING_FOR_STRIPE_TEST_RESOURCES`, with complete code, complete fixture/local tests, a pushed branch, a draft PR, zero unauthorized external mutations, and exact repo-backed resume instructions.
```
