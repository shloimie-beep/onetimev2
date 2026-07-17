# OT-99 — Release Evidence Contract

All `OT-99` evidence must be tied to an exact SHA, timestamped, reproducible, and free of credentials or production PII. Store repository evidence under `artifacts/OT-99/`.

## OT-99 required evidence groups

- `preflight/`: redacted initial state, remote discovery JSON, candidate adjudication JSON, report excerpts or hashes, exact-SHA CI snapshots, and the audit-hypothesis verdicts.
- `lineage/`: ancestry graphs, merge-base results, merge decisions, skipped-ancestor decisions, and the pull request `#24/#25` selective-delta decision.
- `migrations/`: discovered migration inventory, applied-ledger evidence, deterministic renumber map, checksum changes, PostgreSQL 16 path definitions, logs, and data-invariant results.
- `tests/`: one machine-readable result per required category, command, start and end time, exit code, exact SHA, log path, and artifact path.
- `staging/`: authorization evidence, isolation proof, deployment artifact digest, exact SHA readback, staging URL readback, and provider-off synthetic results.
- `canaries/`: separate authorization, synthetic identity, provider-side readback, idempotency correlation, exact SHA, and rollback state for each protected canary.
- `rollback/`: tested application, flag, worker, queue, credential, migration, and provider rollback procedures.
- `release-manifest.json`: valid against `schemas/OT-99-release-manifest.schema.json`.
- `FINAL-REPORT.md`: valid against the content contract in `docs/OT-99-final-report-contract.md`.

## OT-99 evidence quality rules

A command invocation is evidence only when its exit status and output are captured. A pull request is evidence only when its URL, number, head branch, base branch, and remote head SHA are read back. A deployment is evidence only when the environment returns the exact SHA or build identity. A provider canary is evidence only when provider-side state is read back and correlated to the `OT-99` request.

Redact secrets, tokens, cookies, authorization headers, private contact data, and provider credentials. Preserve non-secret identifiers needed for audit. Run secret and PII scans over `artifacts/OT-99/` before commit.

Missing access must be recorded as `blocked`, `not_authorized`, `not_configured`, or `not_run` with the minimum next evidence needed. It must not be recorded as passed and must not erase verified code-level results.
