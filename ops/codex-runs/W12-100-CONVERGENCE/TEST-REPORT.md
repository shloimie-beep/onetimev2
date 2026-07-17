# W12-100 Test Report

Generated: 2026-07-17T17:17:56.257Z

| Command                                      | Status              | Notes                                                                                                                 |
| -------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                     | passed              | Installed 359 packages; 0 vulnerabilities.                                                                            |
| `npm run secret:scan`                        | passed              | Passed across 1423 repo text files before closeout artifacts.                                                         |
| `npm run brand:check`                        | passed              | Manifest, token drift, routes, ticker allowlist, and raw source scan passed.                                          |
| `npm run lint`                               | passed              | Passed before and after scoped formatting.                                                                            |
| `npm run typecheck`                          | passed              | Passed before and after scoped formatting.                                                                            |
| `npm run unit`                               | passed              | 42 files / 221 tests passed.                                                                                          |
| `npm run integration`                        | passed              | 44 files / 204 tests passed.                                                                                          |
| `npm run build`                              | passed              | Client bundles, public pages, and typecheck passed.                                                                   |
| `npm run e2e`                                | passed_after_repair | Initial W12-100 journey helper timeout fixed; rerun passed 48 tests.                                                  |
| `npm run accessibility`                      | passed              | 19 tests passed.                                                                                                      |
| `npm run performance`                        | passed              | 10 tests passed plus bundle budget script completed.                                                                  |
| `npm run db:verify`                          | blocked_environment | DATABASE_URL is required for PostgreSQL-backed runtime.                                                               |
| `PostgreSQL 16 assurance`                    | blocked_environment | Docker/psql unavailable locally; localhost PostgreSQL refused 127.0.0.1:5432.                                         |
| `PostgreSQL 18 assurance`                    | blocked_environment | Docker/psql unavailable locally; harness refused 127.0.0.1:5432 and restore-clone requires Docker.                    |
| `duplicate migration-prefix check`           | passed              | Passed across 38 migration files.                                                                                     |
| `scoped Prettier over W12-100 touched files` | passed              | Applied/check passed on actual content diff and W12-100 touched artifacts; inherited generated evidence restored out. |
| `npm run ops06:migrations`                   | passed              | OPS-06 migration safety passed; generated inherited evidence restored out of final diff.                              |
| `new security suite`                         | passed              | 3 files / 7 tests passed.                                                                                             |
| `new delivery suites`                        | passed              | Delivery unit slice 8 files / 64 tests; delivery integration slice 3 files / 17 tests.                                |
| `new provider-fake suite`                    | passed              | 1 file / 2 tests passed.                                                                                              |
| `new journey suite`                          | passed              | W12-100 route journey inventory passed 3 tests after helper repair.                                                   |

## Repairs Made From Validation

- Full e2e initially failed in the W12-100 route journey helper because it waited for an obsolete consent checkbox. The helper was updated to the current optional-reminder consent model and full e2e reran green.
- The W12-100 route journey suite exposed `/app/communications` and `/app/support` server route composition gaps. Both are now served by the protected owner/admin app shell.

## Environment Blockers

- Local database verification and PostgreSQL assurance remain blocked by missing `DATABASE_URL`, missing Docker, missing `psql`, and no localhost PostgreSQL on port 5432.
