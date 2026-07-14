# OT-47 Preflight

Task: OT-47 provider-neutral content library foundation.

Status: blocked before product implementation by `STOP_REAL_POSTGRESQL_UNAVAILABLE`.

## Execution Inputs

- Approved base SHA: `a73458d1884b8fcb4843c4852425009577f59ef7`
- Provider-contract readiness: `NOT_PROVEN`
- Source repo origin: `https://github.com/webcraft-media/onetimev2.git`
- Worktree: `../onetimev2-parallel-ot47-content-library`
- Branch: `codex/parallel-ot47-content-library-foundation`
- Immutable review anchor: `codex/parallel-base-a73458d`

## Verified Before Stop

- `git fetch origin` completed without rewriting history.
- Origin fetch/push URL is `webcraft-media/onetimev2`.
- Approved base resolves exactly to `a73458d1884b8fcb4843c4852425009577f59ef7`.
- No pre-existing `../onetimev2-parallel-ot47-content-library` worktree existed.
- No local or remote `codex/parallel-ot47-content-library-foundation` branch existed.
- `codex/parallel-base-a73458d` was absent, then created and pushed at the approved base.
- Local and remote anchor both resolve exactly to `a73458d1884b8fcb4843c4852425009577f59ef7`.
- Source checkout was clean before the worktree was created.
- OT-47 worktree was clean at creation.
- Applicable exact-base instructions read: `AGENTS.md` and `README.md`.
- Migration files present at base: `0001_onetime_lead_slice.sql`, `0002_crm_auth_core.sql`.
- Reserved migration identifier `1400` is unused.

## Baseline Verification

- `npm ci`: pass, 348 packages installed from lockfile, 0 vulnerabilities.
- `npm run typecheck`: pass.
- `npm run unit`: pass, 1 file / 7 tests.
- `npm run integration`: pass, 3 files / 11 tests.
- `npm run secret:scan`: pass across 76 repo text files.
- `npm run lint`: pass.
- `npm run build`: pass.
- `npm run format`: pre-existing failure; Prettier reports formatting warnings across 56 exact-base files.
- `npm run db:verify`: blocked before OT-47 by missing `DATABASE_URL`.

## Mandatory Real PostgreSQL Blocker

OT-47 Phase 12 requires a real non-production PostgreSQL instance for migration,
database, concurrency, and 10,000-row performance proof. The prompt explicitly
requires stopping under `STOP_REAL_POSTGRESQL_UNAVAILABLE` if no safe real
PostgreSQL instance is available.

Safe availability checks performed:

- `DATABASE_URL_PRESENT=false`
- `docker --version`: command unavailable.
- `psql --version`: command unavailable.
- `pg_isready`: command unavailable.
- Local-only `pg` connection probes to `127.0.0.1:5432`: unavailable.

No production database, Railway database, remote database, BNA data, provider
service, Vimeo endpoint, or credential path was accessed.

## Stop Decision

Implementation did not proceed because required scope, migration, concurrency,
dedupe, replay/order, performance, and 10,000-row evidence cannot be proven
honestly without a safe real PostgreSQL instance.

Smallest unblock action: provide a disposable non-production PostgreSQL database
URL approved for OT-47 synthetic tests, or install/start a local PostgreSQL
service reachable from this worktree. The URL must not be production, Railway
production, BNA, One Time live, or any unapproved remote environment.
