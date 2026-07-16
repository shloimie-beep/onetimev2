# OPS-06 Resume

Current lane: `codex/ops06-reliability-observability` from base `fb5f5eebc539afc9e93833e9417ee67524d62c36`.

Current status: ready for review after local implementation and verification.

Passed:

- `npm run typecheck`
- focused OPS-06 unit/integration Vitest
- `npm run unit`
- `npm run integration`
- `npm run lint`
- `npm run build`
- `npm run secret:scan`
- `npm run ops06:alerts`
- `npm run ops06:migrations`
- targeted Prettier check over OPS-06-owned files

Blocked locally:

- `npm run ops06:probes`: requires `OPS06_BASE_URL`.
- `npm run ops06:load` / `npm run ops06:backup-restore` with `OPS06_ALLOW_PG_ASSURANCE=true`: disposable PostgreSQL unavailable locally (`connect ECONNREFUSED 127.0.0.1:5432`; no `psql` or Docker).
- Full `npm run format`: preexisting repo-wide formatting debt outside this lane.

Safe next commands:

```bash
npm run ops06:alerts
npm run ops06:migrations
npm run ops06:probes
npm run ops06:load
npm run ops06:backup-restore
npm run typecheck
npm run test
```

For real disposable PostgreSQL 16 proof, set:

```bash
OPS06_ALLOW_PG_ASSURANCE=true
PGHOST=127.0.0.1
PGPORT=5432
PGDATABASE=postgres
PGUSER=postgres
PGPASSWORD=postgres
```

Never run against production DB, providers, send channels, payment systems, deployment targets, DNS, or BNA.
