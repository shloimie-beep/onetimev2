# OT-74 PostgreSQL 16 Local Proof

Local PostgreSQL 16 proof was not run in this desktop environment.

Commands:

- `psql --version`: command not found.
- `docker --version`: command not found.

Impact:

- This blocks only local PostgreSQL 16 proof, as allowed by the OT-74 prompt.
- The migration is covered locally by `runMigrations` through the repository integration suite using the existing PostgreSQL-compatible test harness.
- PostgreSQL 16 CI should run the same migration stack with `1200_ot74_legacy_audience_reconciliation.sql` included.
