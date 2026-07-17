# OPS-06 Decisions

- Use one additive migration, `2015_ops06_reliability_observability.sql`, for durable worker heartbeats, synthetic probe run summaries, restore drills, and retention job contracts.
- Keep `/health` as public liveness only. Put dependency details in `/ready` and protected diagnostics under `/api/internal/ops/*` or owner/admin `/api/v1/ops/diagnostics`.
- Protect machine diagnostics with `OPERATIONS_PROBE_TOKEN`; owner/admin sessions can also read diagnostics. Diagnostics must not expose secrets, tokens, raw private payloads, emails, phones, or provider destination values.
- Optional provider transport disabled/unconfigured states are reported as optional dependencies and do not fail core readiness.
- Alert routing uses a deterministic local sink in this branch. No email, WhatsApp, Telegram, provider, or paging notification is sent.
- Disposable PostgreSQL proof requires `OPS06_ALLOW_PG_ASSURANCE=true`; absent explicit disposable target is a blocker, not permission to touch production.
