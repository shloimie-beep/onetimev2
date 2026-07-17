# OPS-11 Database Path

Status: `phase_2_pending`

OPS-11 corrects the OPS-10 assumption that PostgreSQL 18 is automatically a
blocker. The preferred path is to retain existing production `Postgres-j9Pi`
when it passes native PostgreSQL 18 backup/restore and application assurance.

## Known Starting Point

- Production project: `one-time-production`
- Production environment: `production`
- Production web service: `one-time-web`
- Production database service: `Postgres-j9Pi`
- OPS-10 redacted database binding hash: `64f90e4cfe72`
- OPS-10 observed production app SHA:
  `050170d3ce5e9d0ea8e0db5ca0fa96b369bff0b5`

## Required Proof

- Exact PostgreSQL server version and client version.
- Extension, collation, migration ledger, schema, index, constraint, and
  sequence readback.
- Native PostgreSQL 18 custom-format dump with no owner/ACL.
- Archive listing proof.
- Disposable isolated PostgreSQL 18 restore.
- Sanitized aggregate count/hash comparisons only; no row contents.
- Migration/app smoke proof against restored clone.
- Existing PostgreSQL 16 assurance retained.
- New durable PostgreSQL 18 assurance job added to CI.

## Restrictions

- Do not attempt an unproven PostgreSQL 18 to PostgreSQL 16 downgrade.
- Do not delete or mutate the existing production database.
- Do not print or commit raw database URLs.
- Do not record private row contents.
