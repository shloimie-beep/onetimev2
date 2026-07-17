# OT-82 Validation Report

Passing commands:

- `npm ci`
- `npm run build`
- `npm run brand:check`
- `npm run lint`
- `npm run typecheck`
- `npm run unit` - 20 files, 122 tests
- `npm run integration` - 18 files, 86 tests
- `CI=1 npx playwright test tests/e2e/brand-system.spec.ts --project=chromium` - 4 tests
- `npm run e2e` - 22 tests
- `npm run accessibility` - 6 tests
- `npm run performance` - final rerun passed 6 tests and bundle check
- `npm run secret:scan` - passed across 557 repo text files
- `npx prettier --check $(git diff --name-only --diff-filter=ACMRTUXB)` - changed files pass
- `git diff --check`
- `npx tsx scripts/check-bundles.ts`

Recorded non-final/intermediate result:

- First `npm run performance` attempt failed one assertion because the first OT39 detail-page LCP sample was `3012ms`; the usable-time p95 was `1103ms` and all other detail LCP samples were around `1.0s`. A clean rerun passed.

Known inherited blocker:

- `npm run format` fails on inherited base formatting debt: 334 non-OT82 files are reported by Prettier. OT82 changed files pass scoped Prettier, so the branch is not marked fully certified by the full `verify` script.
