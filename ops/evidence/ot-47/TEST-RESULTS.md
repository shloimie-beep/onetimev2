# OT-47 Test Results

Status: blocked before implementation by `STOP_REAL_POSTGRESQL_UNAVAILABLE`.

## Exact-Base Baseline

- `npm ci`: pass, 348 packages installed from lockfile, 0 vulnerabilities.
- `npm run typecheck`: pass.
- `npm run unit`: pass, 1 file / 7 tests.
- `npm run integration`: pass, 3 files / 11 tests.
- `npm run secret:scan`: pass across 76 repo text files.
- `npm run lint`: pass.
- `npm run build`: pass.

## Exact-Base Baseline Caveats

- `npm run format`: fails before OT-47 with Prettier warnings across 56 base
  files.
- `npm run db:verify`: fails before OT-47 because `DATABASE_URL` is missing.

## OT-47 Tests

Not run because OT-47 implementation stopped before source changes. Required
real PostgreSQL, scope, replay/order, privacy, no-provider-dependency,
accessibility, performance, and migration evidence remains blocked.
