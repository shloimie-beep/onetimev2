# OPS-03 Backup And Restore Proof

Scope: isolated staging PostgreSQL 16 database only.

Native tools:

- `psql (PostgreSQL) 16.14`
- `pg_dump (PostgreSQL) 16.14`
- `pg_restore (PostgreSQL) 16.14`

Proof:

- Created native custom-format dump with `pg_dump -Fc`.
- Restored the dump into disposable clone database `ops03_restore_probe`.
- Verified schema table count and migration ledger after restore.
- Verified sanitized source/restored row-count parity.
- Dropped disposable clone after verification.

Sanitized parity:

| Check                 | Source | Restored |
| --------------------- | -----: | -------: |
| Onetime tables        |    133 |      133 |
| Migration ledger      |     22 |       22 |
| Account users         |      6 |        6 |
| Portal households     |      2 |        2 |
| Portal learners       |      3 |        3 |
| Student access states |      3 |        3 |
| Content items         |      3 |        3 |
| Class occurrences     |      1 |        1 |
| Outbox events         |      1 |        1 |

No row contents, database URLs, or credentials were printed.
