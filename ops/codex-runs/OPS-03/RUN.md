# OPS-03 Run Log

## Setup

- Created isolated worktree: `C:\Users\User\.ops03-worktrees\OPS-03`.
- Branch: `codex/ops03-staging-readiness-repair`.
- Base SHA: `96b429053d13a139595ed3bd0ea3c854cc2500e8`.
- Preserved current green staging deployments as rollback targets before repair.
- Local-only runtime assets moved outside the repo to `C:\Users\User\.ops03-runtime\OPS-03`.

## Repairs

- Parent learner access:
  - Reproduced the missing access-state failure path locally by deleting a learner's `portal_student_access_state` row before parent setup.
  - Repaired `recordStudentAccessOperation` to enforce learner authorization before mutation and insert a new access-state row when an authorized learner has no current state row.
  - Added unit and integration regression coverage for setup/reset/suspend plus sibling and role isolation.
- Staging metadata:
  - Added environment-aware public origin helper.
  - Public canonical and Open Graph URLs now use `PUBLIC_BASE_URL` when configured.
  - Production default remains explicit: `https://join.onetimeonetime.com`.
- Railway Docker build:
  - Removed production script import from `tests/`.
  - Moved reusable PostgreSQL assurance scenario catalog to `scripts/postgres-assurance/`.
  - Left a test compatibility re-export under `tests/postgres-assurance/`.
- PostgreSQL 16:
  - Created isolated Railway service `ot99-pg16`.
  - Added dedicated volume `ot99-pg16-volume`.
  - Added active TCP proxy for native tool checks.
  - Applied and verified 22 migrations.
  - Seeded fictional staging-only accounts and portal data.
- Backup/restore:
  - Performed native `pg_dump -Fc` using PostgreSQL 16 client tools.
  - Restored to disposable clone `ops03_restore_probe`.
  - Verified schema, migration ledger, and sanitized row-count parity.
  - Dropped the disposable clone after verification.
- Live parent suspend/restore:
  - Live staging acceptance exposed a PostgreSQL-only failure in `setStudentIdentityState`: the account update query referenced `$5/$6` while passing an unused `$4` parameter.
  - `pg-mem` tolerated the unused placeholder, but real PostgreSQL returned `could not determine data type of parameter $4`, causing parent suspend/restore to return 500 after lifecycle mutation.
  - Repaired the query to use contiguous `$4/$5` placeholders and added a unit regression for the PostgreSQL parameter contract.
  - Follow-up live restore exposed a PostgreSQL timestamp typing failure for `account_learner_identity_links.suspended_at`.
  - Repaired the query to cast the nullable `$5` timestamp parameter as `timestamptz` and expanded the SQL contract regression.

## Gates Completed Before Commit

- `npx prettier --check` on branch-owned files: passed.
- `npm run secret:scan`: passed.
- `npm run brand:check`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run unit`: passed, 29 files / 157 tests after final PostgreSQL timestamp repair.
- `npm run integration`: passed, 26 files / 129 tests after final PostgreSQL timestamp repair.
- `npm run build`: passed.
- `npm run e2e`: passed, 32 browser tests.
- `npm run accessibility`: passed, 9 browser tests.
- `npm run performance`: passed, 7 browser tests plus bundle checker.
- `npm run db:verify` against `ot99-pg16`: passed, 22 migrations.
- `npm run format`: repository-wide check remains blocked by pre-existing baseline Prettier drift; scoped OPS-03 file formatting and `git diff --check` passed.

## Final Evidence Commit

- Live staging acceptance passed with 17 checks and 0 failures.
- Captured sanitized acceptance report and screenshots under `ops/codex-runs/OPS-03/evidence/`.
- Re-ran `npm run secret:scan` after adding acceptance evidence; passed across 892 repo text files.
- Final branch-head deployment and draft PR are the remaining closeout steps.

## Deployment Iteration

- First OPS-03 web deployment attempt `40fc8171-0a4e-42d3-ae31-80252a5281a8` failed before build because Railway retained a service config pointer to `railway.web.staging.json`, which was absent from the repo.
- Existing green Nixpacks web deployment `e2821230-66ed-4dca-87f5-a01a4137b4df` remained active/running after that failed attempt.
- Added explicit staging service config files for web and worker selecting the Dockerfile builder.
- Second web deployment attempt `f43e7c54-fca3-45d9-8680-d7d63bda5ae4` proved the Dockerfile build but failed runtime health because the image did not include `ops/commercial/ot87/family-plan.v1.json`, which billing loads at startup.
- Repaired Dockerfile to copy only `ops/commercial` into build/runtime images.
- Third web deployment attempt `bda2fb52-e7d7-4266-9260-7d941ac71721` and worker deployment `56fa089e-8679-483d-bc09-516783e8bc78` succeeded with Docker builder, but root HTML still emitted production canonical/Open Graph URLs because static pages were built before Railway runtime variables were available.
- Added runtime HTML metadata rewrite for static public pages, using `config.publicBaseUrl` for canonical and `og:url`.
