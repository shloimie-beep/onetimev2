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

## Gates Completed Before Commit

- `npx prettier --check` on branch-owned files: passed.
- `npm run secret:scan`: passed.
- `npm run brand:check`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run unit`: passed, 28 files / 155 tests.
- `npm run integration`: passed, 25 files / 128 tests.
- `npm run build`: passed.
- `npm run e2e`: passed, 32 browser tests.
- `npm run accessibility`: passed, 9 browser tests.
- `npm run performance`: passed, 7 browser tests plus bundle checker.
- `npm run db:verify` against `ot99-pg16`: passed, 22 migrations.

## Pending At This Point

- Commit repaired branch.
- Set staging web/worker variables to the PG16 database and staging public origin.
- Redeploy exact repaired SHA to staging and prove Docker builder.
- Run live staging acceptance and capture OPS-03 screenshots.
- Push branch and open draft PR.

## Deployment Iteration

- First OPS-03 web deployment attempt `40fc8171-0a4e-42d3-ae31-80252a5281a8` failed before build because Railway retained a service config pointer to `railway.web.staging.json`, which was absent from the repo.
- Existing green Nixpacks web deployment `e2821230-66ed-4dca-87f5-a01a4137b4df` remained active/running after that failed attempt.
- Added explicit staging service config files for web and worker selecting the Dockerfile builder.
