# OPS-11 Backup And Restore

Status: `pending`

Native production backup/restore proof is required before production mutation.

## Required Production Proof

- Fresh PostgreSQL 18 client dump from production PostgreSQL 18 server.
- Custom format, no owner, no ACL.
- Stored outside Git in a private temporary backup location or approved private
  backup volume.
- Record only:
  - dump timestamp;
  - dump size;
  - checksum;
  - PostgreSQL server version;
  - PostgreSQL client version;
  - retention classification;
  - restore clone identity.
- Verify archive listing.
- Restore into a disposable isolated PostgreSQL 18 database/service.
- Verify schema, migrations, indexes, constraints, sequences, sanitized
  aggregate counts, and application smokes.

## Local Tool Status

OPS-10 established that Docker, `psql`, `pg_dump`, and `pg_restore` were not
available locally. OPS-11 therefore requires an isolated Railway one-shot
service/container or a narrowly scoped GitHub Actions job instead of weakening
the proof.

## Current Result

Not yet run.
