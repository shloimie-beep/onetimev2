# OT-73 Test Results

## Passed

- `npm ci` - installed 348 packages from lockfile; npm reported 0 vulnerabilities.
- `npx vitest run --config vitest.unit.config.ts tests/unit/lead-validation.test.ts` - 7 tests passed.
- `npm run build` - clean build, public/app Vite bundles, public page generation, and typecheck passed.
- `npx playwright test tests/e2e/landing-signup.spec.ts --reporter=line` - 7 tests passed.
- `npx playwright test tests/accessibility/public-a11y.spec.ts tests/performance/public-performance.spec.ts --reporter=line` - 6 tests passed.
- `node ops/evidence/ot-73/capture-landing-screenshots.mjs` - captured 4 screenshots with corrected-addendum assertions.
- `npx tsx scripts/check-bundles.ts` - `public_js_bytes=6316`, `public_css_bytes=12801`, `crm_js_bytes=223677`.
- `npm run secret:scan` - passed across 317 repo text files.
- `git diff --check` - passed; only expected CRLF working-copy warnings were printed.

## Corrected Invocation

- `tsx scripts/check-bundles.ts` failed in PowerShell because `tsx` is not on PATH. The same bundle check passed via `npx tsx scripts/check-bundles.ts`.

## Evidence

- Screenshot report: `ops/evidence/ot-73/SCREENSHOTS.md`
- Screenshot files:
  - `ops/evidence/ot-73/screenshots/landing-360x800.png`
  - `ops/evidence/ot-73/screenshots/landing-390x844.png`
  - `ops/evidence/ot-73/screenshots/landing-768x1024.png`
  - `ops/evidence/ot-73/screenshots/landing-1440x900.png`
