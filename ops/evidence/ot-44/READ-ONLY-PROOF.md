# OT-44 Read-Only Proof

Communications V1A is implemented behind read-only ports.

Read-only session:

- Existing `getSessionByToken` mutates `last_seen_at`, so OT-44 does not call it.
- `ReadOnlySessionScopePort` is defined in the Communications-owned route hook.
- Later integration must bind it to a non-mutating accepted session resolver.

Repository:

- `PostgresCommunicationsReadRepository` uses `SELECT` only.
- Contact-local mode performs a same-scope contact existence `SELECT` before outbox projection.
- It does not call `connect()`, `BEGIN`, `UPDATE`, `INSERT`, `DELETE`, worker claim code, provider code, BNA code, contact update code, or auth audit code.
- It selects outbox intent rows and bounded contact context only.
- It does not select `payload`.

Verified by:

- `tests/integration/communications/api.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run unit`
- `npm run integration`

Real SELECT-only PostgreSQL role proof is `integration_pending` because `OT44_TEST_DATABASE_URL` is not configured and this environment has no `psql` or `docker`.
