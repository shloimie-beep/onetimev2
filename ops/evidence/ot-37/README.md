# OT-37 Evidence

This folder is reserved for sanitized OT-37 PostgreSQL assurance summaries.

The runner writes the current report files here:

- `latest-postgres-assurance-report.json`
- `latest-postgres-assurance-report.md`

Reports must contain only synthetic data, redacted plan conditions, PostgreSQL
version metadata, row counts, timings, and expected-open findings. Do not store
database dumps, secrets, production URLs, raw tokens, or real contact data here.

Local desktop execution status for OT-60R is recorded in
`LOCAL-ENVIRONMENT-BLOCKER.md`; the disposable PostgreSQL 16 proof is expected
from the GitHub Actions workflow after this branch is pushed.
