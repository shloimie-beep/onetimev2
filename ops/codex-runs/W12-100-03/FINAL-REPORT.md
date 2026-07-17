# W12-100-03 Final Report

## Summary

Built public launch-truth legal and consent content for the One Time public site. The placeholder privacy and terms pages are replaced with structured, versioned content sourced from `packages/domain/src/legal`, and the signup form now separates required service communications from optional channel-specific reminders without inferring consent from a selected contact channel.

No staging or production deploy was performed. No production database was accessed. No email, WhatsApp, Telegram, provider webhook, payment, post, Zoom invitation, helper request, provider resource mutation, or production configuration change was made.

## Implemented

- Added `legalPolicyMetadata`, `privacyNotice`, `termsOfUse`, `communicationConsentNotice`, `parentGuardianStudentDataNotice`, and required privacy data category definitions under `packages/domain/src/legal`.
- Rendered launch-quality `/privacy` and `/terms` pages from structured legal content in `scripts/build-public-pages.ts`.
- Updated signup consent so optional email and WhatsApp reminders are explicit, unchecked by default, and mapped to backend reminder preferences only after user action.
- Added signup copy that distinguishes required service communications from optional reminders, explains STOP/unsubscribe/contact behavior, exposes policy-version metadata, and tells users not to submit student-sensitive data.
- Added public styles for legal pages, consent groups, no-JavaScript fallback, and mobile/a11y-safe link targets.
- Added/updated focused unit, E2E, accessibility, validation, mobile, keyboard, no-JavaScript, and performance coverage.

## Legal Truth Boundaries

- The Privacy Notice enumerates the visible current-system categories requested by the lane: signup, account, household, learner, class, progress, communications, support, provider event, payment/test-payment, security, and operational records.
- The Terms no longer say accounts are never granted; they now acknowledge owner, parent/guardian, and student account surfaces.
- The Terms do not claim live paid checkout. Billing language is limited to the current fixture/test-payment evidence.
- The documents intentionally avoid unapproved retention periods, deletion windows, jurisdiction-specific rights, and legal compliance claims.

## Validation

- `npm ci` - passed
- `npx vitest run --config vitest.unit.config.ts tests/unit/lead-validation.test.ts` - passed, 8 tests
- `npm run build:pages` - passed
- `npm run build:client` - passed
- `PORT=3116 npx playwright test tests/e2e/public-legal.spec.ts tests/e2e/landing-signup.spec.ts --project=chromium` - passed, 14 tests
- `PORT=3117 npx playwright test tests/accessibility/public-a11y.spec.ts --project=chromium` - passed, 5 tests
- `npx vitest run --config vitest.integration.config.ts tests/integration/lead-capture.test.ts` - passed, 7 tests
- `PORT=3119 npx playwright test tests/e2e/crm-core.spec.ts --project=chromium` - passed, 2 tests
- `PORT=3122 npx playwright test tests/accessibility/ot81-day-one-matrix.spec.ts --project=chromium` - passed, 1 test
- `PORT=3125 npx playwright test tests/performance/public-performance.spec.ts tests/performance/ot81-day-one-performance.spec.ts --project=chromium` - passed, 4 tests
- `npm run secret:scan` - passed
- `npm run brand:check` - passed
- `npm run lint` - passed
- `npm run typecheck` - passed
- `npm run unit` - passed, 197 tests
- `npm run integration` - passed, 184 tests
- `npm run build` - passed
- `PORT=3120 npx playwright test tests/e2e --project=chromium --grep-invert "OT-88 mocked Zoom classroom launch"` - passed, 41 tests
- `PORT=3123 npx playwright test tests/accessibility --project=chromium` - passed, 15 tests
- `PORT=3126 npx playwright test tests/performance --project=chromium --grep-invert "OT-88 classroom launch"` - passed, 6 tests
- `npx tsx scripts/check-bundles.ts` - passed

## Blockers And Decisions

- Blocked dependency: full unfiltered isolated-port E2E/performance OT-88 cases. The mocked Zoom leakage assertion hardcodes `http://127.0.0.1:3100` as the allowed local origin, so isolated-port runs on 3118/3124 classify local mocked requests as external. This belongs to the OT-88/test-infrastructure lane.
- Needs operator/legal decision: cancellation, refund, live-payment, payment authorization, and billing policy language beyond current fixture/test-payment truth.
- Needs operator/legal decision: jurisdiction-specific privacy rights, retention/deletion windows, and stronger compliance claims.

## Safety Counters

- External actions count: 0
- Production mutations count: 0
- Provider mutations count: 0
- Deployments count: 0
