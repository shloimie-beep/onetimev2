# OT-73 Test Results

Base: `dfef7de2035e08f1ee72e0133ccf656fe7a74444`
Branch: `codex/ot73-landing-intent-reconciliation`

## Commands

- `npm ci`
  - Passed. Installed 348 packages; 0 vulnerabilities.
- `npm run format`
  - Failed on pre-existing repository formatting drift across 166 files.
  - OT-73 scoped follow-up passed with `npx prettier --check` on all changed text files.
- `npm run lint`
  - Passed.
- `npm run typecheck`
  - Passed.
- `npm run unit -- tests/unit/lead-validation.test.ts`
  - Passed. 1 file, 7 tests.
- `npm run build`
  - Build included `clean`, public/app Vite builds, page generation, and `typecheck`; passed.
- `npm run e2e -- tests/e2e/landing-signup.spec.ts`
  - Passed before final formatting. The repo script runs `npm run build` first and then all `tests/e2e`; 16 tests passed.
- `npx playwright test tests/e2e/landing-signup.spec.ts`
  - Passed after final formatting/build. 5 tests passed.
- `node ops/evidence/ot-73/capture-landing-screenshots.mjs`
  - Passed against local memory-backed test server.
  - Asserts no ticker DOM, no retired price/offer text, no built campaign listener, direct header-to-hero flow, required header actions, hero CTA above fold, no horizontal overflow, and canonical footer links.

## Screenshots

- `ops/evidence/ot-73/screenshots/landing-360x800.png`
- `ops/evidence/ot-73/screenshots/landing-390x844.png`
- `ops/evidence/ot-73/screenshots/landing-768x1024.png`
- `ops/evidence/ot-73/screenshots/landing-1440x900.png`
