# OPS-03 Local Gate Evidence

Run date: 2026-07-16.

## Static Gates

- `npx prettier --check` on OPS-03-owned files: passed.
- `git diff --check`: passed.
- `npm run secret:scan`: passed across 892 repo text files after adding sanitized live acceptance evidence.
- `npm run brand:check`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run format`: repository-wide check still fails on pre-existing baseline Prettier drift across unrelated files; OPS-03-owned files pass the scoped check above.

## Test Gates

- `npm run unit`: passed, 29 test files / 157 tests.
- `npm run integration`: passed, 26 test files / 129 tests after adding runtime metadata coverage.
- Focused parent learner-access coverage:
  - `tests/ot-52/portal-services.test.ts`
  - `tests/integration/portals/portal-mount.test.ts`
  - `tests/ot-52/portal-router.test.ts`
- PostgreSQL placeholder and timestamp regression:
  - `tests/unit/account-lifecycle-sql.test.ts`
- `npm run build`: passed.
- `npm run e2e`: passed, 32 Playwright tests.
- `npm run accessibility`: passed, 9 Playwright tests.
- `npm run performance`: passed, 7 Playwright tests plus `scripts/check-bundles.ts`.
- Post-runtime metadata and PostgreSQL timestamp reruns: `npm run e2e`, `npm run accessibility`, and `npm run performance` all passed again.

## Bundle Checker Output

- `public_js`: 6316 raw bytes, 2226 gzip bytes.
- `public_css`: 14855 raw bytes, 4038 gzip bytes.
- `crm_js`: 233983 raw bytes across `assets/app-crm.js`, `assets/app-crm2.js`.
- `portal_js`: 229096 raw bytes across `assets/app-portal.js`, `assets/app-crm2.js`.
- `app_css`: 20806 raw bytes.
- `woff2`: 24744 raw bytes.

## Notes

- Vite continues to warn that `/assets/fonts/dm-serif-display-latin.woff2` is resolved at runtime. This warning existed outside the OPS-03 repair and did not fail build, accessibility, e2e, or performance gates.
- Historical browser evidence generated under `ops/evidence/ot-*` was restored so OPS-03 does not commit unrelated regenerated screenshots.
