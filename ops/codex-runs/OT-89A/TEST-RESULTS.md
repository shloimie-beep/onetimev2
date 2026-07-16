# OT-89A Test Results

## Remote-Head Preflight

| Command                                                                                     | Result                                                        | Acceptance |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------- |
| `git fetch origin codex/ot89a-subscriber-support-producer`                                  | Pass                                                          | GIT-01     |
| `git ls-remote origin refs/heads/codex/ot89a-subscriber-support-producer refs/pull/36/head` | Pass; both refs at `50b3a9c6790ee4befd457e16c4ac01674dc264ae` | GIT-01     |
| `git status --short --branch` before edits                                                  | Pass; local branch matched origin and audited head            | GIT-01     |

## Focused Readiness Validation

| Command                                                                                                           | Result                  | Acceptance                                                                 |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------- |
| `npx vitest run --config vitest.unit.config.ts tests/unit/support`                                                | Pass; 3 files, 12 tests | ATT-01, ATT-02, ATT-03, CONFIG-01                                          |
| `npx vitest run --config vitest.integration.config.ts tests/integration/support/ot89a-subscriber-support.test.ts` | Pass; 1 file, 11 tests  | AUTH-01, AUTH-02, AUTH-03, ASYNC-01, OUTBOX-01, ATT-04, STATUS-01, IDEM-01 |
| `npx playwright test tests/e2e/support.spec.ts tests/accessibility/support-a11y.spec.ts`                          | Pass; 6 tests           | UI-01, A11Y-01                                                             |

## Full Local Node And Browser Verification

| Command                                               | Result                                                        | Acceptance               |
| ----------------------------------------------------- | ------------------------------------------------------------- | ------------------------ |
| `npm run secret:scan`                                 | Pass; scanned 649 repo text files                             | PRIV-01, GIT-01          |
| Scoped `npx prettier --check` on OT-89A touched files | Pass                                                          | GIT-01                   |
| `npm run brand:check`                                 | Pass                                                          | SCOPE-01                 |
| `npm run lint`                                        | Pass                                                          | GIT-01                   |
| `npm run typecheck`                                   | Pass                                                          | GIT-01                   |
| `npm run unit`                                        | Pass; 24 files, 140 tests                                     | ATT/CONFIG/CONTRACT      |
| `npm run integration`                                 | Pass; 19 files, 97 tests                                      | AUTH/OUTBOX/ATT/STATUS   |
| `npm run build`                                       | Pass; emitted `assets/app-support.js` and completed typecheck | UI-01, STATUS-01, GIT-01 |
| `CI=1 PORT=3101 npm run e2e`                          | Pass; 27 browser tests                                        | UI-01, SCOPE-01          |
| `CI=1 PORT=3102 npm run accessibility`                | Pass; 7 browser tests                                         | UI-01, A11Y-01           |
| `CI=1 PORT=3103 npm run performance`                  | Pass; 6 browser tests plus `scripts/check-bundles.ts`         | GIT-01                   |

## Full Verify Caveat

| Command          | Result                                                                                                                                                                                      | Acceptance            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `npm run verify` | Blocked locally at `npm run format`; Prettier reported 369 pre-existing CRLF-affected files in this Windows checkout before downstream gates. Downstream gates were run individually above. | GIT-01 tracked caveat |

## PostgreSQL Verification

| Command                                                                                         | Result                                                            | Acceptance          |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------- |
| `Get-NetTCPConnection -LocalPort 5432 -State Listen`                                            | No local PostgreSQL listener found                                | DB environment      |
| `pg_isready -h 127.0.0.1 -p 5432 -d postgres -U postgres`                                       | Blocked; `pg_isready` is not installed                            | DB environment      |
| `docker --version`                                                                              | Blocked; Docker is not installed                                  | DB environment      |
| `Get-Service` / `Get-Command psql` / `Get-Command initdb` checks                                | No PostgreSQL service/client/initdb found                         | DB environment      |
| `npm run db:verify`                                                                             | Blocked; `DATABASE_URL is required for PostgreSQL-backed runtime` | DB-01 local blocker |
| OT-37 workflow command, `npx tsx scripts/postgres-assurance/run.ts` with workflow PG env        | Blocked; `connect ECONNREFUSED 127.0.0.1:5432`                    | DB-01 local blocker |
| OT-83 workflow command, `npx tsx tests/ot-83/real-postgres-concurrency.ts` with workflow PG env | Blocked; `connect ECONNREFUSED 127.0.0.1:5432`                    | DB-01 local blocker |

GitHub's PostgreSQL service-backed checks remain required before READY_FOR_OT99 is restored.

## Branch/PR Verification

- Push to `codex/ot89a-subscriber-support-producer`: pending.
- Existing draft PR #36: pending new remote check observation.
- READY_FOR_OT99: withheld until the new remote head is green.
