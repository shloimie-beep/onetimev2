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

## Supersession Security Port

- Audited PR #3 / OT-34 and PR #9 / OT-38 against canonical PR #2 base.
- Kept PR #2's canonical `security_version`, `public_contact_id`, MFA, session, and POST-body CRM search model.
- Excluded PR #3/#9 alternate migrations/models.
- Ported only the missing PR #9 HMAC-derived login-CSRF proof.
- Added regression coverage for cookie replay and tampered proof tokens.
