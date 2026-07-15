# OT-60R Implemented

## Protocol And Setup

- Created fresh branch `codex/ot60r-recovery-convergence` from exact base `4ac288968ba24e30a5c3f8c6924f492eedf4338f`.
- Preserved the complete prompt at `ops/execution/ot-60r/ORIGINAL-PROMPT.md`.
- Installed initial resumable task state, input, checkpoint, remaining-work, decision, test-result, manifest, resume, registry, and control files.

## Product Integration

- Integrated PR #5 / OT-35 authenticated CRM shell.
- Added the app shell frame, single CRM destination, mobile drawer, skip link, session-expired state, responsive toolbar, list/detail states, and focus restoration behavior.
- Preserved canonical PR #2 authenticated CRM API behavior instead of reverting to the older GET search model.
- Adapted shell list loading to POST `/api/v1/crm/contacts/search` with blank filters omitted from the submitted command.
- Adapted OT-35 E2E/performance fixtures to the current idempotent contact-create contract.
- Added Playwright-only login budgets so the local evidence suite does not rate-limit itself.
- Refreshed OT-35 screenshot, accessibility, and performance evidence.
- Integrated PR #7 / OT-39 CRM privacy/performance correction.
- Extracted authenticated CRM client API calls into `crm-api.ts` while preserving canonical POST-body search, body idempotency keys, and existing assignee behavior.
- Added post-paint usability marks, list cache return behavior, privacy checks, OT-39 accessibility, OT-39 screenshots, and 30-sample performance evidence.
- Converted OT-35 E2E/performance specs into supersession sentinels that point to OT-39 coverage.
- Integrated PR #11 / OT-42 CRM module as an additive, unmounted module surface.
- Added OT-42 CRM contracts, capability mapping, protocol helpers, migration `1000`, injectable router/register hooks, protected memory cache, lazy protected tab loader, and focused tests.
- Integrated PR #4 / OT-36 delivery foundation and PR #8 / OT-40 delivery correction.
- Added sink/mock delivery worker configuration, repository, loop, sink router, retry/redaction/eligibility/message preparation logic, deterministic outbox intents from lead capture, corrected delivery claim migration `0004`, and delivery tests.
- Integrated PR #14 / OT-44 communications read model.
- Added communications contracts, cursor binding, normalization, masking, read service, PostgreSQL read adapter, route-registration hook, lazy Communications feature, and tests/evidence.
- Wired OT-44 into the shared app with a non-mutating read-only session scope resolver, global Communications route, contact Communications view, and no default CRM overview Communications prefetch/API request.
- Integrated PR #12 / OT-46 fixture-only billing foundation as an isolated, unmounted module.
- Added billing contracts, disabled-by-default config parser, fixture provider adapter, network guard, return-path validation, entitlement policy, service/router hooks, repository, migration `1300`, reference UI, and focused tests.
- Integrated PR #15 / OT-52 parent/student portals as an isolated, unmounted module.
- Added portal contracts, migration `1500`, repository, domain services, exported routers, feature-local UI components, browser harness, screenshots, and focused router/service/UI tests.
- Preserved parent household authorization, student single-learner isolation, three-active-learner limit, append-only reward corrections, digest-only credential lifecycle, helper unavailable by default, no-send support preview, and protected-action raw provider URL rejection.
- Integrated PR #13 / OT-51 Telegram mock/default-off foundation as an isolated module.
- Added Telegram contracts, migration `1600`, SQL repositories, command/domain services, identity and crypto helpers, worker/lease primitives, webhook ingress hook, mock-only app entrypoint, and focused unit/integration tests.
- Preserved no Telegram network calls, no webhook registration, no polling activation, no central runtime wiring, no provider mutation, default-deny identity, and injected application adapter boundaries.
- Integrated PR #6 / OT-37 PostgreSQL assurance harness.
- Added a PostgreSQL 16 GitHub Actions workflow, disposable database assurance runner, migration/query/performance/concurrency report writer, current integrated-stack scenario catalog, evidence README, and local environment blocker note.
- Adapted the workflow to run on `codex/ot60r-recovery-convergence` and scoped its format step to OT-37 files so unrelated baseline formatting noise does not mask the PostgreSQL proof.
- Fixed OT-37 synthetic contacts for canonical `public_contact_id` requirements and collected passing GitHub Actions PostgreSQL 16 proof with sanitized reports under `ops/evidence/ot-37/ci-run-29377668001/`.
- Preserved PR #10 / OT-47 as evidence only and explicitly left content/library implementation `not_implemented_environmental_gate`.
- Updated stale base CRM E2E expectations to the accepted OT-39 authenticated shell/search behavior and refreshed OT-39 performance evidence during final verification.

## Supersession Security Port

- Audited PR #3 / OT-34 and PR #9 / OT-38 against canonical PR #2 base.
- Kept PR #2's canonical `security_version`, `public_contact_id`, MFA, session, and POST-body CRM search model.
- Excluded PR #3/#9 alternate migrations/models.
- Ported only the missing PR #9 HMAC-derived login-CSRF proof.
- Added regression coverage for cookie replay and tampered proof tokens.
