# OPS-11 Database Path

Status: `verified_pg18_retained`

OPS-11 retained the existing production PostgreSQL 18 service. No side-by-side
PG16 downgrade was attempted because no reproducible PG18 incompatibility was
found.

## Production Database

- Railway project: `one-time-production`
- Environment: `production`
- Database service: `Postgres-j9Pi`
- Database service ID: `db590e4a-7dc5-40cb-a243-5206ce21b746`
- Image: `ghcr.io/railwayapp-templates/postgres-ssl:18`
- Volume: `postgres-volume-YYfM`
- Volume ID: `911ff445-84e8-4f03-ac3f-c92e51225398`
- TCP proxy used for controlled local migration access:
  `hayabusa.proxy.rlwy.net:22721`

## PG18 Proof

- Server: PostgreSQL `18.4`
- `server_version_num`: `180004`
- `pg_dump`: `18.4`
- `pg_restore`: `18.4`
- Extensions: `pgcrypto=1.4`, `plpgsql=1.0`
- Collation count: `880`
- Native dump format: custom
- Dump flags: no owner, no ACL
- Dump size: `2515557` bytes
- Dump SHA-256:
  `6f35f3a116e3b095ad8244f1d6d6cbc2668292f2adb4741753ce24e4ba750698`
- Archive listing entries: `3764`
- Private dump path:
  `/backup/ops11-prod-pg18-20260717T000000Z/production-pg18.dump`
- Retention classification: private temporary Railway volume, outside Git

The dump and restore proof ran in one-shot Railway service
`ops11-pg18-proof-20260717` (`52db1072-b4eb-450c-bec7-5151cb9a8461`) using a
private backup volume mounted at `/backup`.

## Migration State

Production migrations were applied once through the controlled TCP proxy:

- First production migration run: `35` applied, latest
  `2190_ot109_rabbi_content_publisher`
- Idempotency verification run: `0` applied, `35` already applied, latest
  `2190_ot109_rabbi_content_publisher`
- Post-promotion `/ready`: database ok, schema latest
  `2190_ot109_rabbi_content_publisher`

## CI Assurance

Added durable PostgreSQL 18 assurance beside the existing PG16 gates:

- Workflow: `.github/workflows/ops11-postgres-18-assurance.yml`
- Script: `scripts/postgres-assurance/ops11-pg18-restore-clone.ts`
- Passing run: `29563814222`
- Job: `87831829048`
- CI PG18 server/client: `18.4`
- CI dump SHA-256:
  `ba332d6439138008ccf54a58347bc73f723e800504eeaf09464d15ab170ad205`
- Source/restored schema counts matched:
  - tables: `173`
  - indexes: `638`
  - constraints: `3104`
  - sequences: `0`
- Migration ledger hash matched.
- Row-count hash matched.

The existing PG16 assurance and learner-seat proof also passed on the selected
release head.

## Restrictions Preserved

- No database URL was printed or committed.
- No private row contents were recorded.
- No production database service was deleted or replaced.
- No PG18 to PG16 downgrade was attempted.
