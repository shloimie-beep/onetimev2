# OPS-10 Local Gates

Generated: 2026-07-17T05:20:00Z

## Environment

| Check             | Result                                                                           |
| ----------------- | -------------------------------------------------------------------------------- |
| Node              | `v24.13.0`                                                                       |
| `npm ci`          | Passed, 359 packages installed, 0 vulnerabilities reported                       |
| Docker            | Blocked locally, command not installed                                           |
| PostgreSQL client | Blocked locally, `pg_isready` and `psql` not installed                           |
| Railway CLI       | Present as `railway 5.26.2`; release worktree is not linked to a Railway project |

## Passed

| Gate                    | Command                                                                                                                                                                                  | Result                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Targeted formatting     | `npx prettier --check scripts/ops06-load-backpressure.ts ops/codex-runs/OPS-05/PROVIDER-MATRIX.json ops/codex-runs/OPS-05/WEBHOOK-ENDPOINTS.json ops/codex-runs/OPS-09A/FLEET-REPORT.md` | Passed                             |
| Whitespace diff         | `git diff --check`                                                                                                                                                                       | Passed                             |
| Typecheck               | `npm run typecheck`                                                                                                                                                                      | Passed                             |
| Lint                    | `npm run lint`                                                                                                                                                                           | Passed                             |
| Secret scan             | `npm run secret:scan`                                                                                                                                                                    | Passed across 1132 repo text files |
| OPS-06 focused tests    | `npx vitest run tests/unit/ops06/ops-observability.test.ts tests/integration/ops06/ops-diagnostics-routes.test.ts`                                                                       | Passed, 2 files / 4 tests          |
| OPS-06 alerts           | `npm run ops06:alerts`                                                                                                                                                                   | Passed                             |
| OPS-06 migration safety | `npm run ops06:migrations`                                                                                                                                                               | Passed                             |
| Lead capture regression | `npx vitest run tests/integration/lead-capture.test.ts tests/unit/lead-validation.test.ts`                                                                                               | Passed after idempotency repair    |
| Build                   | `npm run build`                                                                                                                                                                          | Passed after idempotency repair    |

## Blocked Or Not Authoritative Locally

| Gate                  | Local Result                                                                                                                                                                    | Required Next Evidence                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Full `npm run format` | Fails on Windows line-ending normalization across hundreds of unchanged files. The PR #60 Linux failure identified exactly three files, and those three are now targeted-clean. | GitHub CI Node 24 verify after push.                                                                               |
| OPS-06 load/restore   | Not run locally because this machine has no disposable Postgres 16 service/client.                                                                                              | GitHub Actions OPS-06 deterministic checks after push, or an explicitly linked disposable Postgres 16 environment. |

## Pull Request CI Observation

| PR  | Check                       | Result                                                                                                 | Evidence                                                                     |
| --- | --------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| #61 | OT-75 static readiness      | Passed on commit `b3c184642c4985c64e01af4c70dd9c58ecdfdd6b`                                            | GitHub Actions                                                               |
| #61 | OT-37 PostgreSQL assurance  | Passed on commit `b3c184642c4985c64e01af4c70dd9c58ecdfdd6b`                                            | GitHub Actions                                                               |
| #61 | OT-83 learner-seat proof    | Passed on commit `b3c184642c4985c64e01af4c70dd9c58ecdfdd6b`                                            | GitHub Actions                                                               |
| #61 | OPS-06 deterministic checks | Failed before idempotency repair: concurrent signup idempotency had 8 fulfilled, 4 rejected, 1 contact | Downloaded artifact `ops06-reliability-29557055116-1/load-backpressure.json` |

## Live Observation

| Target                                            | Route              | Result                                                             |
| ------------------------------------------------- | ------------------ | ------------------------------------------------------------------ |
| Production `https://join.onetimeonetime.com`      | `/api/deploy-info` | 200, old commit `050170d3ce5e9d0ea8e0db5ca0fa96b369bff0b5`         |
| Production `https://join.onetimeonetime.com`      | `/login`           | 404, `Cannot GET /login`                                           |
| Production `https://join.onetimeonetime.com`      | `/version`         | 404, `Cannot GET /version`                                         |
| Staging `https://ot99-web-staging.up.railway.app` | `/version`         | 200, `ops03a-fb5f5ee` / `fb5f5eebc539afc9e93833e9417ee67524d62c36` |
