# OPS-06 Backup Restore Drill

Generated: 2026-07-16T22:56:16.927Z

Status: blocked

Blocker: connect ECONNREFUSED 127.0.0.1:5432

- RPO target minutes: 15
- RTO target minutes: 30
- Measured RTO seconds: n/a
- Restored migration count: n/a

Do not claim Railway PITR or plan features from this report. This proof covers native pg_dump -Fc plus disposable restore only when status is passed.

External mutations: production_database=false, providers=false, sends=false, deployment=false.
