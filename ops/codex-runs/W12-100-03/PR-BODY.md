# W12-100-03 Public Launch Truth

## Summary

- Replaced placeholder public privacy/terms pages with structured, versioned legal content from `packages/domain/src/legal`.
- Updated signup consent so optional email and WhatsApp reminders are explicit, unchecked by default, channel-specific, and separate from required service communications.
- Added public legal/signup unit, E2E, accessibility, validation, mobile, keyboard, no-JavaScript, and affected performance coverage.

## Exact Tests

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

## Blockers

- Full unfiltered isolated-port E2E/performance OT-88 cases are blocked by an OT-88 test-infrastructure dependency: the mocked Zoom leakage assertion hardcodes `http://127.0.0.1:3100` as the allowed local origin, so runs on isolated ports classify local mocked requests as external.
- Business/legal decision needed before adding cancellation, refund, live-payment, payment authorization, or billing policy language beyond current fixture/test-payment truth.
- Counsel/business decision needed before adding jurisdiction-specific privacy rights, retention/deletion windows, or stronger legal compliance claims.

## Safety Counts

- External actions count: 0
- Production mutation count: 0
- Provider mutation count: 0
- Deployment count: 0
