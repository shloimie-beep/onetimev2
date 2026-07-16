# OPS-05 Observability And Runbooks

Task ID: `OPS-05`

Checkpoint: `ready_for_observability_configuration`

This folder defines production-grade, privacy-safe observability for the
standalone One Time web app, delivery worker, database, provider seams, content
pipeline, portals, and the asynchronous BNA support seam.

The contracts are vendor-neutral. They do not deploy an agent, call providers,
send alerts, mutate production data, or require monitoring credentials. Missing
monitoring credentials block only live configuration, not code, tests, and
runbook readiness.

## Files

- `telemetry-privacy-contract.json`: low-cardinality logs, metrics, traces,
  redaction, retention, and forbidden data rules.
- `slo-alert-matrix.json`: actionable SLOs and alert contracts.
- `dashboards/operator-health.dashboard.json`: dashboard/query examples using
  counts, rates, statuses, and latency buckets only.
- `synthetic-checks.json`: provider-off synthetic checks that exercise public,
  auth, CRM, portal, worker, content, and support readiness without external
  writes.
- `runbooks/operator-runbooks.md`: incident playbooks and degraded Rabbi-facing
  states.
- `verification-plan.md`: local and future monitoring verification.
- `configuration-checkpoint.md`: exact protected config names and operator
  steps required to turn this from contract to live monitoring.

## Scope Rules

- No raw contact text, child data, message bodies, raw URLs, email, phone,
  tokens, cookies, database URLs, payment identifiers, or provider secrets in
  telemetry.
- Ordinary web routes must not synchronously call BNA.
- BNA support status is modeled through asynchronous, redacted receipts and
  cached projections only.
- Provider health uses status/config/readiness counts, not provider payloads.
- Dashboard panels may show "degraded", "unconfigured", "provider disabled",
  "pending", or "blocked" honestly. They must not fabricate healthy states.
